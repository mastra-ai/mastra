"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _url = require("url");

var _errors = require("../errors");

const parseProxyUrl = url => {
  const urlTokens = (0, _url.parse)(url);

  if (urlTokens.query !== null) {
    throw new _errors.UnexpectedStateError('Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL must not have query.');
  }

  if (urlTokens.hash !== null) {
    throw new _errors.UnexpectedStateError('Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL must not have hash.');
  }

  if (urlTokens.protocol !== 'http:') {
    throw new _errors.UnexpectedStateError('Unsupported `GLOBAL_AGENT.HTTP_PROXY` configuration value: URL protocol must be "http:".');
  }

  let port = 80;

  if (urlTokens.port) {
    port = Number.parseInt(urlTokens.port, 10);
  }

  return {
    authorization: urlTokens.auth || null,
    hostname: urlTokens.hostname,
    port
  };
};

var _default = parseProxyUrl;
exports.default = _default;
//# sourceMappingURL=parseProxyUrl.js.map