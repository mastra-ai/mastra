"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _Logger = _interopRequireDefault(require("../Logger"));

var _factories = require("../factories");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = _Logger.default.child({
  namespace: 'bootstrap'
});

const bootstrap = configurationInput => {
  if (global.GLOBAL_AGENT) {
    log.warn('found global.GLOBAL_AGENT; second attempt to bootstrap global-agent was ignored');
    return false;
  }

  global.GLOBAL_AGENT = (0, _factories.createGlobalProxyAgent)(configurationInput);
  return true;
};

var _default = bootstrap;
exports.default = _default;
//# sourceMappingURL=bootstrap.js.map