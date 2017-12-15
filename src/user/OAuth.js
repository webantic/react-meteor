/* globals cordova */
import Meteor from '../Meteor'
import Base64 from '../Base64'
import * as URL from '../URL'
import _ from 'underscore'
import { check } from '../Match'
import { isCordova } from '../helpers/index'
import User from '../user/User'

// credentialToken -> credentialSecret. You must provide both the
// credentialToken and the credentialSecret to retrieve an access token from
// the _pendingCredentials collection.
const credentialSecrets = {}
const localStorage = window.localStorage

const openCenteredPopup = function (url, width, height) {
  var screenX = typeof window.screenX !== 'undefined'
        ? window.screenX : window.screenLeft
  var screenY = typeof window.screenY !== 'undefined'
        ? window.screenY : window.screenTop
  var outerWidth = typeof window.outerWidth !== 'undefined'
        ? window.outerWidth : document.body.clientWidth
  var outerHeight = typeof window.outerHeight !== 'undefined'
        ? window.outerHeight : (document.body.clientHeight - 22)
  // XXX what is the 22?

  // Use `outerWidth - width` and `outerHeight - height` for help in
  // positioning the popup centered relative to the current window
  var left = screenX + (outerWidth - width) / 2
  var top = screenY + (outerHeight - height) / 2
  var features = ('width=' + width + ',height=' + height +
                  ',left=' + left + ',top=' + top + ',scrollbars=yes')

  var newwindow = window.open(url, 'Login', features)

  if (typeof newwindow === 'undefined') {
    // blocked by a popup blocker maybe?
    var err = new Error('The login popup was blocked by the browser')
    err.attemptedUrl = url
    throw err
  }

  if (newwindow.focus) { newwindow.focus() }

  return newwindow
}

export const showPopup = function (url, callback, dimensions) {
  // default dimensions that worked well for facebook and google
  var popup = openCenteredPopup(
    url,
    (dimensions && dimensions.width) || 650,
    (dimensions && dimensions.height) || 331
  )

  var checkPopupOpen = setInterval(function () {
    try {
      // Fix for #328 - added a second test criteria (popup.closed === undefined)
      // to humour this Android quirk:
      // http://code.google.com/p/android/issues/detail?id=21061
      var popupClosed = popup.closed || popup.closed === undefined
    } catch (e) {
      // For some unknown reason, IE9 (and others?) sometimes (when
      // the popup closes too quickly?) throws "SCRIPT16386: No such
      // interface supported" when trying to read 'popup.closed'. Try
      // again in 100ms.
      return
    }

    if (popupClosed) {
      clearInterval(checkPopupOpen)
      callback()
    }
  }, 100)
}

// Determine the login style (popup or redirect) for this login flow.
//
//
export const _loginStyle = function (service, config, options) {
  if (Meteor.isCordova) {
    return 'popup'
  }

  var loginStyle = (options && options.loginStyle) || config.loginStyle || 'popup'

  if (!_.contains(['popup', 'redirect'], loginStyle)) { throw new Error('Invalid login style: ' + loginStyle) }

  // If we don't have local storage the redirect login flow won't work,
  // so fallback to the popup style.
  if (loginStyle === 'redirect') {
    try {
      localStorage.setItem('Meteor.oauth.test', 'test')
      localStorage.removeItem('Meteor.oauth.test')
    } catch (e) {
      loginStyle = 'popup'
    }
  }

  return loginStyle
}

export const _stateParam = function (loginStyle, credentialToken, redirectUrl, frontendUrl, serviceName) {
  var state = {
    loginStyle: loginStyle,
    credentialToken: credentialToken,
    isCordova: isCordova(),
    redirectUrl: redirectUrl || URL.absoluteUrl(`/_oauth/${serviceName}`),
    frontendUrl: URL.absoluteUrl(`/_oauth/${serviceName}`)
  }

  if (loginStyle === 'redirect') {
    state.redirectUrl = redirectUrl || ('' + window.location)
  }

  // Encode base64 as not all login services URI-encode the state
  // parameter when they pass it back to us.
  // Use the 'base64' package here because 'btoa' isn't supported in IE8/9.
  return Base64.encode(JSON.stringify(state))
}

// At the beginning of the redirect login flow, before we redirect to
// the login service, save the credential token for this login attempt
// in the reload migration data.
//
export const saveDataForRedirect = function (loginService, credentialToken) {
  localStorage.setItem('oauth', JSON.stringify({ loginService, credentialToken }))
}

// At the end of the redirect login flow, when we've redirected back
// to the application, retrieve the credentialToken and (if the login
// was successful) the credentialSecret.
//
// Called at application startup.  Returns null if this is normal
// application startup and we weren't just redirected at the end of
// the login flow.
//
export const getDataAfterRedirect = function () {
  // var migrationData = Reload._migrationData('oauth')
  var migrationData = JSON.parse(localStorage.getItem('oauth'))

  if (!(migrationData && migrationData.credentialToken)) { return null }

  var credentialToken = migrationData.credentialToken
  var key = _storageTokenPrefix + credentialToken
  var credentialSecret
  try {
    credentialSecret = localStorage.getItem(key)
    localStorage.removeItem(key)
  } catch (e) {
    Meteor._debug('error retrieving credentialSecret', e)
  }
  return {
    loginService: migrationData.loginService,
    credentialToken: credentialToken,
    credentialSecret: credentialSecret
  }
}

// Launch an OAuth login flow.  For the popup login style, show the
// popup.  For the redirect login style, save the credential token for
// this login attempt in the reload migration data, and redirect to
// the service for the login.
//
// options:
//  loginService: "facebook", "google", etc.
//  loginStyle: "popup" or "redirect"
//  loginUrl: The URL at the login service provider to start the OAuth flow.
//  credentialRequestCompleteCallback: for the popup flow, call when the popup
//    is closed and we have the credential from the login service.
//  credentialToken: our identifier for this login flow.
//
export const launchLogin = function (options) {
  if (!options.loginService) { throw new Error('loginService required') }

  if (options.loginStyle === 'popup') {
    const { credentialRequestCompleteCallback } = options

    if (isCordova()) {
      const inAppBrowser = cordova.InAppBrowser.open(options.loginUrl, '_blank')

      ;(function poll (browser) {
        browser.executeScript({code: ';(()=>window._fbOAuthConfig)()'}, (config) => {
          if (config[0]) {
            const { credentialToken, credentialSecret } = config[0]

            browser.close()
            credentialRequestCompleteCallback({ credentialToken, credentialSecret })
          } else {
            setTimeout(poll, 100, browser)
          }
        })
      })(inAppBrowser)

      return
    }

    // left this in as a fallback
    showPopup(
      options.loginUrl,
      _.bind(options.credentialRequestCompleteCallback, null, options.credentialToken),
      options.popupOptions)
  } else if (options.loginStyle === 'redirect') {
    saveDataForRedirect(options.loginService, options.credentialToken)

    window.location = options.loginUrl
  } else {
    throw new Error('invalid login style')
  }
}

// XXX COMPAT WITH 0.7.0.1
// Private interface but probably used by many oauth clients in atmosphere.
export const initiateLogin = function (credentialToken, url, callback, dimensions) {
  showPopup(
    url,
    _.bind(callback, null, credentialToken),
    dimensions
  )
}

// Called by the popup when the OAuth flow is completed, right before
// the popup closes.
export const _handleCredentialSecret = function (credentialToken, secret) {
  check(credentialToken, String)
  check(secret, String)
  if (!_.has(credentialSecrets, credentialToken)) {
    credentialSecrets[credentialToken] = secret
  } else {
    throw new Error('Duplicate credential token from OAuth login')
  }
}

// Used by accounts-oauth, which needs both a credentialToken and the
// corresponding to credential secret to call the `login` method over DDP.
export const _retrieveCredentialSecret = function (credentialToken) {
  // First check the secrets collected by OAuth._handleCredentialSecret,
  // then check localStorage. This matches what we do in
  // end_of_login_response.html.
  var secret = credentialSecrets[credentialToken]
  if (!secret) {
    var localStorageKey = _storageTokenPrefix + credentialToken
    secret = Meteor._localStorage.getItem(localStorageKey)
    Meteor._localStorage.removeItem(localStorageKey)
  } else {
    delete credentialSecrets[credentialToken]
  }
  return secret
}

export const _storageTokenPrefix = 'Meteor.oauth.credentialSecret-'

export const _redirectUri = function (serviceName, config, params, absoluteUrlOptions) {
  // Clone because we're going to mutate 'params'. The 'cordova' and
  // 'android' parameters are only used for picking the host of the
  // redirect URL, and not actually included in the redirect URL itself.
  if (params) {
    params = _.clone(params)
    if (_.isEmpty(params)) {
      params = undefined
    }
  }

  if (config.redirectUrl) {
    return config.redirectUrl
  }

  return URL._constructUrl(
    URL.absoluteApiUrl(`/_oauth/${serviceName}`),
    null,
    params)
}
