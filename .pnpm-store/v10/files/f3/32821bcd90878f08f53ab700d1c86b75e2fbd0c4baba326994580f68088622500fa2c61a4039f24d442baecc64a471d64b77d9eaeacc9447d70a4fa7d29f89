"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _detectNode = _interopRequireDefault(require("detect-node"));

var _semverCompare = _interopRequireDefault(require("semver-compare"));

var _package = require("../../package.json");

var _createNodeWriter = _interopRequireDefault(require("./createNodeWriter"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// eslint-disable-next-line flowtype/no-weak-types
const createRoarrInititialGlobalState = currentState => {
  const versions = (currentState.versions || []).concat();
  versions.sort(_semverCompare.default);
  const currentIsLatestVersion = !versions.length || (0, _semverCompare.default)(_package.version, versions[versions.length - 1]) === 1;

  if (!versions.includes(_package.version)) {
    versions.push(_package.version);
  }

  versions.sort(_semverCompare.default);

  let newState = _objectSpread(_objectSpread({
    sequence: 0
  }, currentState), {}, {
    versions
  });

  if (_detectNode.default) {
    if (currentIsLatestVersion || !newState.write) {
      newState = _objectSpread(_objectSpread({}, newState), (0, _createNodeWriter.default)());
    }
  }

  return newState;
};

var _default = createRoarrInititialGlobalState;
exports.default = _default;
//# sourceMappingURL=createRoarrInititialGlobalState.js.map