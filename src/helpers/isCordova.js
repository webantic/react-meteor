/* globals cordova phonegap */
function isCordova () {
  return (typeof cordova !== 'undefined' || typeof phonegap !== 'undefined') && (cordova || phonegap).platformId !== 'browser'
}

export default isCordova
