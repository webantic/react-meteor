// import ReactNative from 'react-native';
import minimongo from '@webantic/minimongo-cache';
import Trackr from 'trackr';
// import { InteractionManager } from 'react-native';
process.nextTick = setImmediate;

const db = new minimongo();
db.debug = false;
// db.batchedUpdates = ReactNative.unstable_batchedUpdates;

function runAfterOtherComputations(fn){
  // InteractionManager.runAfterInteractions(() => {
    Trackr.afterFlush(() => {
      fn();
    });
  // });
}

let waitsForDdp = 0
export default {
  _endpoint: null,
  _options: null,
  ddp: null,
  subscriptions: {},
  db: db,
  calls: [],

  getUrl() {
    return this._endpoint.substring(0, this._endpoint.indexOf('/websocket'));
  },

  waitDdpReady(cb) {
    if(this.ddp) {
      cb();
    } else {
      waitsForDdp++
      runAfterOtherComputations(()=>{
        if (waitsForDdp > 10) {
          console.log('Waiting a long time for DDP, slowing down a bit...')
          setTimeout(() => {
            this.waitDdpReady(cb)
          }, 5000)
        }
        else {
          this.waitDdpReady(cb);
        }
      });
    }
  },

  _cbs: [],
  onChange(cb) {
    this.db.on('change', cb);
    this.ddp.on('connected', cb);
    this.ddp.on('disconnected', cb);
    this.on('loggingIn', cb);
    this.on('change', cb);
  },
  offChange(cb) {
    this.db.off('change', cb);
    this.ddp.off('connected', cb);
    this.ddp.off('disconnected', cb);
    this.off('loggingIn', cb);
    this.off('change', cb);
  },
  on(eventName, cb) {
    this._cbs.push({
      eventName: eventName,
      callback: cb
    });
  },
  off(eventName, cb) {
    this._cbs.splice(this._cbs.findIndex(_cb=>_cb.callback == cb && _cb.eventName == eventName), 1);
  },
  notify(eventName) {
    this._cbs.map(cb=>{
      if(cb.eventName == eventName && typeof cb.callback == 'function') {
        cb.callback();
      }
    });
  },
  waitDdpConnected(cb) {
    if(this.ddp && this.ddp.status == 'connected') {
      cb();
    } else if(this.ddp) {
      this.ddp.once('connected', cb);
    } else {
      setTimeout(()=>{ this.waitDdpConnected(cb) }, 10);
    }
  }
}
