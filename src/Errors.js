import { _inherits } from './helpers'

export const makeErrorType = function (name, constructor) {
  var errorClass = function (/* arguments */) {
    // Ensure we get a proper stack trace in most Javascript environments
    if (Error.captureStackTrace) {
      // V8 environments (Chrome and Node.js)
      Error.captureStackTrace(this, errorClass)
    } else {
      // Borrow the .stack property of a native Error object.
      this.stack = new Error().stack
    }
    // Safari magically works.

    constructor.apply(this, arguments)

    this.errorType = name
  }

  _inherits(errorClass, Error)

  return errorClass
}
