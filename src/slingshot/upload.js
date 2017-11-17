import Meteor from '../Meteor'
import Tracker from 'trackr'
import { ReactiveVar } from '../ReactiveVar'
import { Validators } from './validators'
import { getRestrictions } from './restrictions'
import _ from 'underscore'
import call from '../Call'

/**
 * @fileOverview Defines client side API in which files can be uploaded.
 */

/**
 *
 * @param {string} directive - Name of server-directive to use.
 * @param {object} [metaData] - Data to be sent to directive.
 * @constructor
 */

export class Upload {
  constructor (directive, metaData) {
    if (!window.File || !window.FormData) {
      throw new Error('Browser does not support HTML5 uploads')
    }

    const self = this
    self.directive = directive
    self.metaData = metaData
    self.loaded = new ReactiveVar()
    self.total = new ReactiveVar()
    self.status = new ReactiveVar('idle')
  }

  buildFormData () {
    const self = this
    const formData = new window.FormData()

    _.each(self.instructions.postData, function (field) {
      formData.append(field.name, field.value)
    })

    formData.append('file', self.file)

    return formData
  }

  /**
   * @returns {string}
   */
  status () {
    const self = this

    return self.status.get()
  }

  /**
   * @returns {number}
   */
  progress () {
    const self = this

    return self.uploaded() / self.total.get()
  }

  /**
   * @returns {number}
   */
  uploaded () {
    const self = this

    return self.loaded.get()
  }

  /**
  * @param {File} file
  * @returns {null|Error} Returns null on success, Error on failure.
  */
  validate (file) {
    const context = {
      userId: Meteor.userId && Meteor.userId()
    }
    try {
      const validators = Validators
      const restrictions = getRestrictions(this.directive)

      return validators.checkAll(context, file, this.metaData, restrictions) && null
    } catch (error) {
      return error
    }
  }

  /**
   * @param {(File|Blob)} file
   * @returns {Promise}
   */
  send (file) {
    const self = this

    return new Promise((resolve, reject) => {
      if (!(file instanceof window.File) && !(file instanceof window.Blob)) {
        reject(new Error('Not a file'))
      }

      self.file = file

      self.request()
        .then(instructions => {
          self.instructions = instructions

          resolve(self.transfer())
        })
        .catch(error => reject(error))
    })
  }

  /**
   * @returns {Promise}
   */
  request () {
    return new Promise((resolve, reject) => {
      if (!this.file) {
        reject(new Error('No file to request upload for'))
      }

      var file = _.pick(this.file, 'name', 'size', 'type')

      this.status.set('authorizing')

      var error = this.validate(file)
      if (error) {
        this.status.set('failed')
        return reject(error)
      }

      call('slingshot/uploadRequest', this.directive, file, this.metaData, (error, instructions) => {
        this.status.set(error ? 'failed' : 'authorized')

        if (error) {
          return reject(error)
        }

        resolve(instructions)
      })
    })
  }

  /**
   * @returns {Promise}
   */
  transfer () {
    const self = this

    if (self.status.curValue !== 'authorized') {
      throw new Error('Cannot transfer file at upload status: ' + self.status.curValue)
    }

    self.status.set('transferring')
    self.loaded.set(0)

    return new Promise((resolve, reject) => {
      var xhr = new window.XMLHttpRequest()

      xhr.upload.addEventListener('progress', function (event) {
        if (event.lengthComputable) {
          self.loaded.set(event.loaded)
          self.total.set(event.total)
        }
      }, false)

      function getError () {
        return new Meteor.Error(xhr.statusText + ' - ' + xhr.status, 'Failed to upload file to cloud storage')
      }

      xhr.addEventListener('load', function () {
        if (xhr.status < 400) {
          self.status.set('done')
          self.loaded.set(self.total.get())
          resolve(self.instructions.download)
        } else {
          self.status.set('failed')
          reject(getError())
        }
      })

      xhr.addEventListener('error', function () {
        self.status.set('failed')
        reject(getError())
      })

      xhr.addEventListener('abort', function () {
        self.status.set('aborted')
        reject(new Meteor.Error('Aborted',
            'The upload has been aborted by the user'))
      })

      xhr.open('POST', self.instructions.upload, true)

      _.each(self.instructions.headers, function (value, key) {
        xhr.setRequestHeader(key, value)
      })

      xhr.send(self.buildFormData())
      self.xhr = xhr
    })
  }

  /**
   * @returns {boolean}
   */
  isImage () {
    const self = this

    self.status() // React to status change.
    return Boolean(self.file && self.file.type.split('/')[0] === 'image')
  }

  /**
   * Latency compensated url of the file to be uploaded.
   *
   * @param {boolean} preload
   *
   * @returns {string}
   */

  url (preload) {
    const self = this

    if (!self.dataUri) {
      const localUrl = new ReactiveVar()
      const URL = (window.URL || window.webkitURL)

      self.dataUri = new ReactiveVar()

      Tracker.nonreactive(function () {
          /*
            It is important that we generate the local url not more than once
            throughout the entire lifecycle of `self` to prevent flickering.
            */

        var previewRequirement = new Tracker.Dependency()

        Tracker.autorun(function (computation) {
          if (self.file) {
            if (URL) {
              localUrl.set(URL.createObjectURL(self.file))
              computation.stop()
            } else if (Tracker.active && window.FileReader) {
              readDataUrl(self.file, function (result) {
                localUrl.set(result)
                computation.stop()
              })
            }
          } else {
            previewRequirement.depend()
          }
        })

        Tracker.autorun(function (computation) {
          var status = self.status()

          if (self.instructions && status === 'done') {
            computation.stop()
            self.dataUri.set(self.instructions.download)
          } else if (status === 'failed' || status === 'aborted') {
            computation.stop()
          } else if (self.file && !self.dataUri.curValue) {
            previewRequirement.changed()
            self.dataUri.set(localUrl.get())
          }
        })
      })
    }

    if (preload) {
      if (self.file && !self.isImage()) { throw new Error('Cannot pre-load anything other than images') }

      if (!self.preloaded) {
        Tracker.nonreactive(function () {
          self.preloaded = new ReactiveVar()

          Tracker.autorun(function (computation) {
            var url = self.dataUri.get()

            if (self.instructions) {
              preloadImage(url, function () {
                computation.stop()
                self.preloaded.set(url)
              })
            } else { self.preloaded.set(url) }
          })
        })
      }

      return self.preloaded.get()
    } else {
      return self.dataUri.get()
    }
  }

  /** Gets an upload parameter for the directive.
   *
   * @param {String} name
   * @returns {String|Number|Undefined}
   */

  param (name) {
    const self = this

    self.status() // React to status changes.

    const data = self.instructions && self.instructions.postData
    const field = data && _.findWhere(data, {name: name})

    return field && field.value
  }
}

/**
 *
 * @param {String} image - URL of image to preload.
 * @param {Function} callback
 */

function preloadImage (image, callback) {
  var preloader = new window.Image()

  preloader.onload = callback

  preloader.src = image
}

function readDataUrl (file, callback) {
  var reader = new window.FileReader()

  reader.onloadend = function () {
    callback(reader.result)
  }

  reader.readAsDataURL(file)
}
