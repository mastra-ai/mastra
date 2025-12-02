"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault")["default"];
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getScheduler = exports.TimeoutLatch = void 0;
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
// Setting / Unsetting timeouts for every keystroke was a significant overhead
// Inspired from https://github.com/iostreamer-X/timeout-latch
var TimeoutLatch = exports.TimeoutLatch = /*#__PURE__*/function () {
  function TimeoutLatch(callback, timeoutMS) {
    (0, _classCallCheck2["default"])(this, TimeoutLatch);
    (0, _defineProperty2["default"])(this, "timeLeftMS", void 0);
    (0, _defineProperty2["default"])(this, "timeoutMS", void 0);
    (0, _defineProperty2["default"])(this, "isCancelled", false);
    (0, _defineProperty2["default"])(this, "isTimeExhausted", false);
    (0, _defineProperty2["default"])(this, "callbacks", []);
    this.timeLeftMS = timeoutMS;
    this.timeoutMS = timeoutMS;
    this.callbacks.push(callback);
  }
  return (0, _createClass2["default"])(TimeoutLatch, [{
    key: "tick",
    value: function tick() {
      if (!this.isCancelled && !this.isTimeExhausted) {
        this.timeLeftMS--;
        if (this.timeLeftMS <= 0) {
          this.isTimeExhausted = true;
          var callbacks = this.callbacks.slice();
          this.callbacks.length = 0;
          callbacks.forEach(function (callback) {
            try {
              callback();
            } catch (error) {
              console.error('TimeoutLatch callback error:', error);
            }
          });
        }
      }
    }
  }, {
    key: "cancel",
    value: function cancel() {
      this.isCancelled = true;
      this.callbacks.length = 0;
    }
  }, {
    key: "reset",
    value: function reset() {
      this.timeLeftMS = this.timeoutMS;
      this.isCancelled = false;
      this.isTimeExhausted = false;
    }
  }, {
    key: "isDone",
    get: function get() {
      return this.isCancelled || this.isTimeExhausted;
    }
  }]);
}();
var Scheduler = /*#__PURE__*/function () {
  function Scheduler() {
    (0, _classCallCheck2["default"])(this, Scheduler);
    (0, _defineProperty2["default"])(this, "interval", null);
    (0, _defineProperty2["default"])(this, "latches", new Set());
  }
  return (0, _createClass2["default"])(Scheduler, [{
    key: "add",
    value: function add(latch) {
      this.latches.add(latch);
      this.start();
    }
  }, {
    key: "remove",
    value: function remove(latch) {
      this.latches["delete"](latch);
      if (this.latches.size === 0) {
        this.stop();
      }
    }
  }, {
    key: "start",
    value: function start() {
      var _this = this;
      if (this.interval === null) {
        this.interval = setInterval(function () {
          _this.latches.forEach(function (latch) {
            latch.tick();
            if (latch.isDone) {
              _this.remove(latch);
            }
          });
        }, 1);
      }
    }
  }, {
    key: "stop",
    value: function stop() {
      if (this.interval !== null) {
        clearInterval(this.interval);
        this.interval = null;
      }
    }
  }]);
}();
var globalScheduler = null;
var getScheduler = exports.getScheduler = function getScheduler() {
  if (typeof window === 'undefined') {
    return new Scheduler();
  }
  if (!globalScheduler) {
    globalScheduler = new Scheduler();
  }
  return globalScheduler;
};