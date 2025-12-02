"use strict";

function _classPrivateFieldInitSpec(e, t, a) { _checkPrivateRedeclaration(e, t), t.set(e, a); }
function _checkPrivateRedeclaration(e, t) { if (t.has(e)) throw new TypeError("Cannot initialize the same private elements twice on an object"); }
function _classPrivateFieldGet(s, a) { return s.get(_assertClassBrand(s, a)); }
function _classPrivateFieldSet(s, a, r) { return s.set(_assertClassBrand(s, a), r), r; }
function _assertClassBrand(e, t, n) { if ("function" == typeof e ? e === t : e.has(t)) return arguments.length < 3 ? t : n; throw new TypeError("Private element is not present on this object"); }
const path = require("path");
const types = require("./types.cjs");
var ACTIONS = types.ACTIONS;
var _send = new WeakMap();
var _eCache = new WeakMap();
class Client {
  constructor(send) {
    _classPrivateFieldInitSpec(this, _send, void 0);
    _classPrivateFieldInitSpec(this, _eCache, void 0);
    _classPrivateFieldSet(_send, this, send);
  }
  getDefaultExtensions() {
    var _classPrivateFieldGet2;
    return (_classPrivateFieldGet2 = _classPrivateFieldGet(_eCache, this)) != null ? _classPrivateFieldGet2 : _classPrivateFieldSet(_eCache, this, _classPrivateFieldGet(_send, this).call(this, ACTIONS.GET_DEFAULT_EXTENSIONS, undefined));
  }
  setOptions(options) {
    return _classPrivateFieldGet(_send, this).call(this, ACTIONS.SET_OPTIONS, options);
  }
  transform(code, filename) {
    return _classPrivateFieldGet(_send, this).call(this, ACTIONS.TRANSFORM, {
      code,
      filename
    });
  }
}
var _worker = new WeakMap();
var _signal = new WeakMap();
class WorkerClient extends Client {
  constructor() {
    super((action, payload) => {
      _classPrivateFieldGet(_signal, this)[0] = 0;
      const subChannel = new (_get_worker_threads(WorkerClient).MessageChannel)();
      _classPrivateFieldGet(_worker, this).postMessage({
        signal: _classPrivateFieldGet(_signal, this),
        port: subChannel.port1,
        action,
        payload
      }, [subChannel.port1]);
      Atomics.wait(_classPrivateFieldGet(_signal, this), 0, 0);
      const {
        message
      } = _get_worker_threads(WorkerClient).receiveMessageOnPort(subChannel.port2);
      if (message.error) throw Object.assign(message.error, message.errorData);else return message.result;
    });
    _classPrivateFieldInitSpec(this, _worker, new (_get_worker_threads(WorkerClient).Worker)(path.resolve(__dirname, "./worker/index.cjs"), {
      env: _get_markInRegisterWorker(WorkerClient).call(WorkerClient, process.env)
    }));
    _classPrivateFieldInitSpec(this, _signal, new Int32Array(new SharedArrayBuffer(4)));
    _classPrivateFieldGet(_worker, this).unref();
  }
}
function _get_worker_threads(_this) {
  return require("worker_threads");
}
function _get_markInRegisterWorker(_this2) {
  return require("./is-in-register-worker.cjs").markInRegisterWorker;
}
module.exports = {
  WorkerClient
};
{
  var _LocalClient, _handleMessage;
  module.exports.LocalClient = (_LocalClient = class LocalClient extends Client {
    constructor() {
      var _assertClassBrand$_;
      (_assertClassBrand$_ = _assertClassBrand(_LocalClient, LocalClient, _handleMessage)._) != null ? _assertClassBrand$_ : _handleMessage._ = _assertClassBrand(_LocalClient, LocalClient, require("./worker/handle-message.cjs"));
      super((action, payload) => {
        return _assertClassBrand(_LocalClient, LocalClient, _handleMessage)._.call(LocalClient, action === ACTIONS.TRANSFORM ? ACTIONS.TRANSFORM_SYNC : action, payload);
      });
      this.isLocalClient = true;
    }
  }, _handleMessage = {
    _: void 0
  }, _LocalClient);
}

//# sourceMappingURL=worker-client.cjs.map
