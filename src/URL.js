import Data from './Data'

function encodeString (str) {
  return encodeURIComponent(str).replace(/\*/g, '%2A')
}

export const absoluteUrl = (path) => {
  const location = window.location

  // HashRouter compatibility
  let hash = ''
  if (window.location.hash.includes('#/')) {
    hash = '/#'
  }

  return `${location.protocol}//${location.host}${hash}${path}`
}

export const absoluteApiUrl = (path) => {
  const wsUrl = Data.ddp.socket.endpoint

  return wsUrl.replace('ws:', window.location.protocol).replace('/websocket', '') + path
}

// Encode URL paramaters into a query string, handling nested objects and
// arrays properly.
export const _encodeParams = function (params, prefix) {
  var str = []
  var isParamsArray = Array.isArray(params)
  for (var p in params) {
    if (Object.prototype.hasOwnProperty.call(params, p)) {
      var k = prefix ? prefix + '[' + (isParamsArray ? '' : p) + ']' : p
      var v = params[p]
      if (typeof v === 'object') {
        str.push(this._encodeParams(v, k))
      } else {
        var encodedKey =
          encodeString(k).replace('%5B', '[').replace('%5D', ']')
        str.push(encodedKey + '=' + encodeString(v))
      }
    }
  }
  return str.join('&').replace(/%20/g, '+')
}

export const _constructUrl = function (url, query, params) {
  var queryMatch = /^(.*?)(\?.*)?$/.exec(url)
  return buildUrl(
    queryMatch[1],
    queryMatch[2],
    query,
    params
  )
}

export const buildUrl = (beforeQmark, fromQmark, optQuery, optParams) => {
  var urlWithoutQuery = beforeQmark
  var query = fromQmark ? fromQmark.slice(1) : null

  if (typeof optQuery === 'string') { query = String(optQuery) }

  if (optParams) {
    query = query || ''
    var prms = _encodeParams(optParams)
    if (query && prms) { query += '&' }
    query += prms
  }

  var url = urlWithoutQuery
  if (query !== null) { url += ('?' + query) }

  return url
}
