"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _net = _interopRequireDefault(require("net"));

var _tls = _interopRequireDefault(require("tls"));

var _Agent = _interopRequireDefault(require("./Agent"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class HttpsProxyAgent extends _Agent.default {
  // eslint-disable-next-line unicorn/prevent-abbreviations
  constructor(...args) {
    super(...args);
    this.protocol = 'https:';
    this.defaultPort = 443;
  }

  createConnection(configuration, callback) {
    const socket = _net.default.connect(configuration.proxy.port, configuration.proxy.hostname);

    socket.on('error', error => {
      callback(error);
    });
    socket.once('data', () => {
      const secureSocket = _tls.default.connect({ ...configuration.tls,
        socket
      });

      callback(null, secureSocket);
    });
    let connectMessage = '';
    connectMessage += 'CONNECT ' + configuration.host + ':' + configuration.port + ' HTTP/1.1\r\n';
    connectMessage += 'Host: ' + configuration.host + ':' + configuration.port + '\r\n';

    if (configuration.proxy.authorization) {
      connectMessage += 'Proxy-Authorization: Basic ' + Buffer.from(configuration.proxy.authorization).toString('base64') + '\r\n';
    }

    connectMessage += '\r\n';
    socket.write(connectMessage);
  }

}

var _default = HttpsProxyAgent;
exports.default = _default;
//# sourceMappingURL=HttpsProxyAgent.js.map