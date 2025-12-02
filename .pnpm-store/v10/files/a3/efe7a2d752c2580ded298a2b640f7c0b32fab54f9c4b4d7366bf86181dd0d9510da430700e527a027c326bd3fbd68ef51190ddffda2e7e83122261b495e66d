"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _http = _interopRequireDefault(require("http"));

var _https = _interopRequireDefault(require("https"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// eslint-disable-next-line flowtype/no-weak-types
const bindHttpMethod = (originalMethod, agent, forceGlobalAgent) => {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  return (...args) => {
    let url;
    let options;
    let callback;

    if (typeof args[0] === 'string' || args[0] instanceof URL) {
      url = args[0];

      if (typeof args[1] === 'function') {
        options = {};
        callback = args[1];
      } else {
        options = { ...args[1]
        };
        callback = args[2];
      }
    } else {
      options = { ...args[0]
      };
      callback = args[1];
    }

    if (forceGlobalAgent) {
      options.agent = agent;
    } else {
      if (!options.agent) {
        options.agent = agent;
      }

      if (options.agent === _http.default.globalAgent || options.agent === _https.default.globalAgent) {
        options.agent = agent;
      }
    }

    if (url) {
      // $FlowFixMe
      return originalMethod(url, options, callback);
    } else {
      return originalMethod(options, callback);
    }
  };
};

var _default = bindHttpMethod;
exports.default = _default;
//# sourceMappingURL=bindHttpMethod.js.map