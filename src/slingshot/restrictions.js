import { Match, check } from '../Match'

/**
 * @module meteor-slingshot
 */

export const matchAllowedFileTypes = Match.OneOf(String, [String], RegExp, null)

/**
 * List of configured restrictions by name.
 *
 * @type {Object.<String, Function>}
 * @private
 */

export const _restrictions = {}

/**
 * Creates file upload restrictions for a specific directive.
 *
 * @param {string} name - A unique identifier of the directive.
 * @param {Object} restrictions - The file upload restrictions.
 * @returns {Object}
 */

export const fileRestrictions = function (name, restrictions) {
  check(restrictions, {
    authorize: Match.Optional(Function),
    maxSize: Match.Optional(Match.OneOf(Number, null)),
    allowedFileTypes: Match.Optional(matchAllowedFileTypes)
  })

  return (_restrictions[name] =
    Object.assign(_restrictions[name] || {}, restrictions))
}

/**
 * @param {string} name - The unique identifier of the directive to
 * retrieve the restrictions for.
 * @returns {Object}
 */

export const getRestrictions = function (name) {
  return _restrictions[name] || {}
}
