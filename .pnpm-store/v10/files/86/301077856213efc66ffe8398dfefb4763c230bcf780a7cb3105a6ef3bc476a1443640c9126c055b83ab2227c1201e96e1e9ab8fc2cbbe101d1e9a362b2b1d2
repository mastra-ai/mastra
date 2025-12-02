"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _constants = require("../constants");

const createMockLogger = (onMessage, parentContext) => {
  // eslint-disable-next-line id-length, unicorn/prevent-abbreviations, no-unused-vars
  const log = (a, b, c, d, e, f, g, h, i, k) => {//
  };

  log.adopt = async routine => {
    return routine();
  }; // eslint-disable-next-line no-unused-vars


  log.child = context => {
    return createMockLogger(onMessage, parentContext);
  };

  log.getContext = () => {
    return {};
  };

  for (const logLevel of Object.keys(_constants.logLevels)) {
    // eslint-disable-next-line id-length, unicorn/prevent-abbreviations
    log[logLevel] = (a, b, c, d, e, f, g, h, i, k) => {
      return log.child({
        logLevel: _constants.logLevels[logLevel]
      })(a, b, c, d, e, f, g, h, i, k);
    };
  } // @see https://github.com/facebook/flow/issues/6705
  // $FlowFixMe


  return log;
};

var _default = createMockLogger;
exports.default = _default;
//# sourceMappingURL=createMockLogger.js.map