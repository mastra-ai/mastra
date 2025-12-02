'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var assembleReleasePlan = require('@changesets/assemble-release-plan');
var readChangesets = require('@changesets/read');
var config = require('@changesets/config');
var getPackages = require('@manypkg/get-packages');
var pre = require('@changesets/pre');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var assembleReleasePlan__default = /*#__PURE__*/_interopDefault(assembleReleasePlan);
var readChangesets__default = /*#__PURE__*/_interopDefault(readChangesets);

function _toPrimitive(t, r) {
  if ("object" != typeof t || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != typeof i) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}

function _toPropertyKey(t) {
  var i = _toPrimitive(t, "string");
  return "symbol" == typeof i ? i : i + "";
}

function _defineProperty(e, r, t) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t,
    enumerable: !0,
    configurable: !0,
    writable: !0
  }) : e[r] = t, e;
}

function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
      _defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}

async function getReleasePlan(cwd, sinceRef, passedConfig) {
  const packages = await getPackages.getPackages(cwd);
  const preState = await pre.readPreState(cwd);
  const readConfig = await config.read(cwd, packages);
  const config$1 = passedConfig ? _objectSpread2(_objectSpread2({}, readConfig), passedConfig) : readConfig;
  const changesets = await readChangesets__default["default"](cwd, sinceRef);
  return assembleReleasePlan__default["default"](changesets, packages, config$1, preState);
}

exports["default"] = getReleasePlan;
