'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var fs = require('fs-extra');
var humanId = require('human-id');
var path = require('path');
var prettier = require('prettier');

function _interopDefault (e) { return e && e.__esModule ? e : { 'default': e }; }

var fs__default = /*#__PURE__*/_interopDefault(fs);
var humanId__default = /*#__PURE__*/_interopDefault(humanId);
var path__default = /*#__PURE__*/_interopDefault(path);
var prettier__default = /*#__PURE__*/_interopDefault(prettier);

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

function getPrettierInstance(cwd) {
  try {
    return require(require.resolve("prettier", {
      paths: [cwd]
    }));
  } catch (err) {
    if (!err || err.code !== "MODULE_NOT_FOUND") {
      throw err;
    }

    return prettier__default["default"];
  }
}

async function writeChangeset(changeset, cwd, options) {
  const {
    summary,
    releases
  } = changeset;
  const changesetBase = path__default["default"].resolve(cwd, ".changeset"); // Worth understanding that the ID merely needs to be a unique hash to avoid git conflicts
  // experimenting with human readable ids to make finding changesets easier

  const changesetID = humanId__default["default"]({
    separator: "-",
    capitalize: false
  });
  const prettierInstance = (options === null || options === void 0 ? void 0 : options.prettier) !== false ? getPrettierInstance(cwd) : undefined;
  const newChangesetPath = path__default["default"].resolve(changesetBase, `${changesetID}.md`); // NOTE: The quotation marks in here are really important even though they are
  // not spec for yaml. This is because package names can contain special
  // characters that will otherwise break the parsing step

  const changesetContents = `---
${releases.map(release => `"${release.name}": ${release.type}`).join("\n")}
---

${summary}
  `;
  await fs__default["default"].outputFile(newChangesetPath, prettierInstance ? // Prettier v3 returns a promise
  await prettierInstance.format(changesetContents, _objectSpread2(_objectSpread2({}, await prettierInstance.resolveConfig(newChangesetPath)), {}, {
    parser: "markdown"
  })) : changesetContents);
  return changesetID;
}

exports["default"] = writeChangeset;
