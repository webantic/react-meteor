// @ts-check
import * as OAuth from './OAuth'
import Random from '../../lib/Random'
import { Collection } from '../Collection'

export const requestCredential = function (options, credentialRequestCompleteCallback) {
  // support both (options, callback) and (callback).
  if (!credentialRequestCompleteCallback && typeof options === 'function') {
    credentialRequestCompleteCallback = options
    options = {}
  }

  const loginServiceConfig = new Collection('meteor_accounts_loginServiceConfiguration')
  const config = loginServiceConfig.findOne({ service: 'facebook' })

  if (!config) {
    return credentialRequestCompleteCallback && credentialRequestCompleteCallback(
      new Error('Login service configuration not yet loaded')
    )
  }

  var credentialToken = Random.secret()
  var mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent)
  var display = mobile ? 'touch' : 'popup'

  var scope = 'email'
  if (options && options.requestPermissions) { scope = options.requestPermissions.join(',') }

  var loginStyle = OAuth._loginStyle('facebook', config, options)

  var loginUrl =
        'https://www.facebook.com/v2.9/dialog/oauth?client_id=' + config.appId +
        '&redirect_uri=' + OAuth._redirectUri('facebook', config) +
        '&display=' + display + '&scope=' + scope +
        '&state=' + OAuth._stateParam(loginStyle, credentialToken, options && options.redirectUrl, 'facebook')

  // Handle authentication type (e.g. for force login you need auth_type: "reauthenticate")
  if (options && options.auth_type) {
    loginUrl += '&auth_type=' + encodeURIComponent(options.auth_type)
  }

  OAuth.launchLogin({
    loginService: 'facebook',
    loginStyle: loginStyle,
    loginUrl: loginUrl,
    credentialRequestCompleteCallback: credentialRequestCompleteCallback,
    credentialToken: credentialToken
  })
}
