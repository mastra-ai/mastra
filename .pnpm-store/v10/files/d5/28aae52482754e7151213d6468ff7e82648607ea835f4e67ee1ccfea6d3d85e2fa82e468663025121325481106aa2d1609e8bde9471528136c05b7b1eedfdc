"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _detectNode = _interopRequireDefault(require("detect-node"));

var _globalthis = _interopRequireDefault(require("globalthis"));

var _jsonStringifySafe = _interopRequireDefault(require("json-stringify-safe"));

var _sprintfJs = require("sprintf-js");

var _constants = require("../constants");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const globalThis = (0, _globalthis.default)();
let domain;

if (_detectNode.default) {
  // eslint-disable-next-line global-require
  domain = require('domain');
}

const getParentDomainContext = () => {
  if (!domain) {
    return {};
  }

  const parentRoarrContexts = [];
  let currentDomain = process.domain; // $FlowFixMe

  if (!currentDomain || !currentDomain.parentDomain) {
    return {};
  }

  while (currentDomain && currentDomain.parentDomain) {
    currentDomain = currentDomain.parentDomain;

    if (currentDomain.roarr && currentDomain.roarr.context) {
      parentRoarrContexts.push(currentDomain.roarr.context);
    }
  }

  let domainContext = {};

  for (const parentRoarrContext of parentRoarrContexts) {
    domainContext = _objectSpread(_objectSpread({}, domainContext), parentRoarrContext);
  }

  return domainContext;
};

const getFirstParentDomainContext = () => {
  if (!domain) {
    return {};
  }

  let currentDomain = process.domain; // $FlowFixMe

  if (currentDomain && currentDomain.roarr && currentDomain.roarr.context) {
    return currentDomain.roarr.context;
  } // $FlowFixMe


  if (!currentDomain || !currentDomain.parentDomain) {
    return {};
  }

  while (currentDomain && currentDomain.parentDomain) {
    currentDomain = currentDomain.parentDomain;

    if (currentDomain.roarr && currentDomain.roarr.context) {
      return currentDomain.roarr.context;
    }
  }

  return {};
};

const createLogger = (onMessage, parentContext) => {
  // eslint-disable-next-line id-length, unicorn/prevent-abbreviations
  const log = (a, b, c, d, e, f, g, h, i, k) => {
    const time = Date.now();
    const sequence = globalThis.ROARR.sequence++;
    let context;
    let message;

    if (typeof a === 'string') {
      context = _objectSpread(_objectSpread({}, getFirstParentDomainContext()), parentContext || {}); // eslint-disable-next-line id-length, object-property-newline

      const args = _extends({}, {
        a,
        b,
        c,
        d,
        e,
        f,
        g,
        h,
        i,
        k
      });

      const values = Object.keys(args).map(key => {
        return args[key];
      }); // eslint-disable-next-line unicorn/no-reduce

      const hasOnlyOneParameterValued = 1 === values.reduce((accumulator, value) => {
        // eslint-disable-next-line no-return-assign, no-param-reassign
        return accumulator += typeof value === 'undefined' ? 0 : 1;
      }, 0);
      message = hasOnlyOneParameterValued ? (0, _sprintfJs.sprintf)('%s', a) : (0, _sprintfJs.sprintf)(a, b, c, d, e, f, g, h, i, k);
    } else {
      if (typeof b !== 'string') {
        throw new TypeError('Message must be a string.');
      }

      context = JSON.parse((0, _jsonStringifySafe.default)(_objectSpread(_objectSpread(_objectSpread({}, getFirstParentDomainContext()), parentContext || {}), a)));
      message = (0, _sprintfJs.sprintf)(b, c, d, e, f, g, h, i, k);
    }

    onMessage({
      context,
      message,
      sequence,
      time,
      version: '1.0.0'
    });
  };

  log.child = context => {
    if (typeof context === 'function') {
      return createLogger(message => {
        if (typeof context !== 'function') {
          throw new TypeError('Unexpected state.');
        }

        onMessage(context(message));
      }, parentContext);
    }

    return createLogger(onMessage, _objectSpread(_objectSpread(_objectSpread({}, getFirstParentDomainContext()), parentContext), context));
  };

  log.getContext = () => {
    return _objectSpread(_objectSpread({}, getFirstParentDomainContext()), parentContext || {});
  };

  log.adopt = async (routine, context) => {
    if (!domain) {
      return routine();
    }

    const adoptedDomain = domain.create();
    return adoptedDomain.run(() => {
      // $FlowFixMe
      adoptedDomain.roarr = {
        context: _objectSpread(_objectSpread({}, getParentDomainContext()), context)
      };
      return routine();
    });
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

var _default = createLogger;
exports.default = _default;
//# sourceMappingURL=createLogger.js.map