'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var fs = require('fs-extra');
var path = require('path');
var getPackages = require('@manypkg/get-packages');
var errors = require('@changesets/errors');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var path__default = /*#__PURE__*/_interopDefault(path);

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

async function readPreState(cwd) {
  let preStatePath = path__default["default"].resolve(cwd, ".changeset", "pre.json"); // TODO: verify that the pre state isn't broken

  let preState;

  try {
    let contents = await fs__namespace.readFile(preStatePath, "utf8");

    try {
      preState = JSON.parse(contents);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.error("error parsing json:", contents);
      }

      throw err;
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }

  return preState;
}
async function exitPre(cwd) {
  let preStatePath = path__default["default"].resolve(cwd, ".changeset", "pre.json"); // TODO: verify that the pre state isn't broken

  let preState = await readPreState(cwd);

  if (preState === undefined) {
    throw new errors.PreExitButNotInPreModeError();
  }

  await fs__namespace.outputFile(preStatePath, JSON.stringify(_objectSpread2(_objectSpread2({}, preState), {}, {
    mode: "exit"
  }), null, 2) + "\n");
}
async function enterPre(cwd, tag) {
  var _preState$changesets;

  let packages = await getPackages.getPackages(cwd);
  let preStatePath = path__default["default"].resolve(packages.root.dir, ".changeset", "pre.json");
  let preState = await readPreState(packages.root.dir); // can't reenter if pre mode still exists, but we should allow exited pre mode to be reentered

  if ((preState === null || preState === void 0 ? void 0 : preState.mode) === "pre") {
    throw new errors.PreEnterButInPreModeError();
  }

  let newPreState = {
    mode: "pre",
    tag,
    initialVersions: {},
    changesets: (_preState$changesets = preState === null || preState === void 0 ? void 0 : preState.changesets) !== null && _preState$changesets !== void 0 ? _preState$changesets : []
  };

  for (let pkg of packages.packages) {
    newPreState.initialVersions[pkg.packageJson.name] = pkg.packageJson.version;
  }

  await fs__namespace.outputFile(preStatePath, JSON.stringify(newPreState, null, 2) + "\n");
}

exports.enterPre = enterPre;
exports.exitPre = exitPre;
exports.readPreState = readPreState;
