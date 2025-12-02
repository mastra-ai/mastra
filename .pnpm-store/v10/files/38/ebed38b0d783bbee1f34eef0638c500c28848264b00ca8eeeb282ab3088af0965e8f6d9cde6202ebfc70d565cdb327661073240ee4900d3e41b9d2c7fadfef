"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _Logger = _interopRequireDefault(require("../Logger"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = _Logger.default.child({
  namespace: 'createProxyController'
});

const KNOWN_PROPERTY_NAMES = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];

const createProxyController = () => {
  // eslint-disable-next-line fp/no-proxy
  return new Proxy({
    HTTP_PROXY: null,
    HTTPS_PROXY: null,
    NO_PROXY: null
  }, {
    set: (subject, name, value) => {
      if (!KNOWN_PROPERTY_NAMES.includes(name)) {
        throw new Error('Cannot set an unmapped property "' + name + '".');
      }

      subject[name] = value;
      log.info({
        change: {
          name,
          value
        },
        newConfiguration: subject
      }, 'configuration changed');
      return true;
    }
  });
};

var _default = createProxyController;
exports.default = _default;
//# sourceMappingURL=createProxyController.js.map