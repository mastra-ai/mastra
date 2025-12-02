"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _net = _interopRequireDefault(require("net"));

var _Agent = _interopRequireDefault(require("./Agent"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class HttpProxyAgent extends _Agent.default {
  // @see https://github.com/sindresorhus/eslint-plugin-unicorn/issues/169#issuecomment-486980290
  // eslint-disable-next-line unicorn/prevent-abbreviations
  constructor(...args) {
    super(...args);
    this.protocol = 'http:';
    this.defaultPort = 80;
  }

  createConnection(configuration, callback) {
    const socket = _net.default.connect(configuration.proxy.port, configuration.proxy.hostname);

    callback(null, socket);
  }

}

var _default = HttpProxyAgent;
exports.default = _default;
//# sourceMappingURL=HttpProxyAgent.js.map