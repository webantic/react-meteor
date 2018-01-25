import Data from './Data';

export default async function(eventName) {
  var args = Array.prototype.slice.call(arguments, 1);
  if (args.length && typeof args[args.length - 1] === "function") {
    var callback = args.pop();
  }

  let resolve
  let reject

  const id = Data.ddp.method(eventName, args);
  Data.calls.push({
    id: id,
    callback: (err, res) => {
      if (typeof callback === 'function') {
        callback(err, res)
      }
      if (err) {
        reject(err)
      }
      else {
        resolve(res)
      }
    }
  })

  return new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
}