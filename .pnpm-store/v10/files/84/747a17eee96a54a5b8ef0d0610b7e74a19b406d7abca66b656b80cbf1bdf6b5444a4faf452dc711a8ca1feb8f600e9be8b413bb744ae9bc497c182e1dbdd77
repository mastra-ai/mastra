(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.rafSchd = factory());
}(this, function () { 'use strict';

  var rafSchd = function rafSchd(fn) {
    var lastArgs = [];
    var frameId = null;

    var wrapperFn = function wrapperFn() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      lastArgs = args;

      if (frameId) {
        return;
      }

      frameId = requestAnimationFrame(function () {
        frameId = null;
        fn.apply(void 0, lastArgs);
      });
    };

    wrapperFn.cancel = function () {
      if (!frameId) {
        return;
      }

      cancelAnimationFrame(frameId);
      frameId = null;
    };

    return wrapperFn;
  };

  return rafSchd;

}));
