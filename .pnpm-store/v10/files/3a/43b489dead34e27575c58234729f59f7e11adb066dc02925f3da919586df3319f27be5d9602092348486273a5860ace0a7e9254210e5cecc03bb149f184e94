"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/utils.ts
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _resolvefrom = require('resolve-from'); var _resolvefrom2 = _interopRequireDefault(_resolvefrom);

// node_modules/.pnpm/strip-json-comments@5.0.1/node_modules/strip-json-comments/index.js
var singleComment = Symbol("singleComment");
var multiComment = Symbol("multiComment");
var stripWithoutWhitespace = () => "";
var stripWithWhitespace = (string, start, end) => string.slice(start, end).replace(/\S/g, " ");
var isEscaped = (jsonString, quotePosition) => {
  let index = quotePosition - 1;
  let backslashCount = 0;
  while (jsonString[index] === "\\") {
    index -= 1;
    backslashCount += 1;
  }
  return Boolean(backslashCount % 2);
};
function stripJsonComments(jsonString, { whitespace = true, trailingCommas = false } = {}) {
  if (typeof jsonString !== "string") {
    throw new TypeError(`Expected argument \`jsonString\` to be a \`string\`, got \`${typeof jsonString}\``);
  }
  const strip = whitespace ? stripWithWhitespace : stripWithoutWhitespace;
  let isInsideString = false;
  let isInsideComment = false;
  let offset = 0;
  let buffer = "";
  let result = "";
  let commaIndex = -1;
  for (let index = 0; index < jsonString.length; index++) {
    const currentCharacter = jsonString[index];
    const nextCharacter = jsonString[index + 1];
    if (!isInsideComment && currentCharacter === '"') {
      const escaped = isEscaped(jsonString, index);
      if (!escaped) {
        isInsideString = !isInsideString;
      }
    }
    if (isInsideString) {
      continue;
    }
    if (!isInsideComment && currentCharacter + nextCharacter === "//") {
      buffer += jsonString.slice(offset, index);
      offset = index;
      isInsideComment = singleComment;
      index++;
    } else if (isInsideComment === singleComment && currentCharacter + nextCharacter === "\r\n") {
      index++;
      isInsideComment = false;
      buffer += strip(jsonString, offset, index);
      offset = index;
      continue;
    } else if (isInsideComment === singleComment && currentCharacter === "\n") {
      isInsideComment = false;
      buffer += strip(jsonString, offset, index);
      offset = index;
    } else if (!isInsideComment && currentCharacter + nextCharacter === "/*") {
      buffer += jsonString.slice(offset, index);
      offset = index;
      isInsideComment = multiComment;
      index++;
      continue;
    } else if (isInsideComment === multiComment && currentCharacter + nextCharacter === "*/") {
      index++;
      isInsideComment = false;
      buffer += strip(jsonString, offset, index + 1);
      offset = index + 1;
      continue;
    } else if (trailingCommas && !isInsideComment) {
      if (commaIndex !== -1) {
        if (currentCharacter === "}" || currentCharacter === "]") {
          buffer += jsonString.slice(offset, index);
          result += strip(buffer, 0, 1) + buffer.slice(1);
          buffer = "";
          offset = index;
          commaIndex = -1;
        } else if (currentCharacter !== " " && currentCharacter !== "	" && currentCharacter !== "\r" && currentCharacter !== "\n") {
          buffer += jsonString.slice(offset, index);
          offset = index;
          commaIndex = -1;
        }
      } else if (currentCharacter === ",") {
        result += buffer + jsonString.slice(offset, index);
        buffer = "";
        offset = index;
        commaIndex = index;
      }
    }
  }
  return result + buffer + (isInsideComment ? strip(jsonString.slice(offset)) : jsonString.slice(offset));
}

// src/utils.ts
var _tinyglobby = require('tinyglobby');
function getPostcss() {
  return localRequire("postcss");
}
function getApiExtractor() {
  return localRequire("@microsoft/api-extractor");
}
function localRequire(moduleName) {
  const p = _resolvefrom2.default.silent(process.cwd(), moduleName);
  return p && __require(p);
}
async function removeFiles(patterns, dir) {
  const files = await _tinyglobby.glob.call(void 0, patterns, {
    cwd: dir,
    absolute: true
  });
  files.forEach((file) => _fs2.default.existsSync(file) && _fs2.default.unlinkSync(file));
}
function debouncePromise(fn, delay, onError) {
  let timeout;
  let promiseInFly;
  let callbackPending;
  return function debounced(...args) {
    if (promiseInFly) {
      callbackPending = () => {
        debounced(...args);
        callbackPending = void 0;
      };
    } else {
      if (timeout != null) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = void 0;
        promiseInFly = fn(...args).catch(onError).finally(() => {
          promiseInFly = void 0;
          if (callbackPending) callbackPending();
        });
      }, delay);
    }
  };
}
function slash(path2) {
  const isExtendedLengthPath = path2.startsWith("\\\\?\\");
  if (isExtendedLengthPath) {
    return path2;
  }
  return path2.replace(/\\/g, "/");
}
function truthy(value) {
  return Boolean(value);
}
function jsoncParse(data) {
  try {
    return new Function(`return ${stripJsonComments(data).trim()}`)();
  } catch (e2) {
    return {};
  }
}
function defaultOutExtension({
  format,
  pkgType
}) {
  let jsExtension = ".js";
  let dtsExtension = ".d.ts";
  const isModule = pkgType === "module";
  if (isModule && format === "cjs") {
    jsExtension = ".cjs";
    dtsExtension = ".d.cts";
  }
  if (!isModule && format === "esm") {
    jsExtension = ".mjs";
    dtsExtension = ".d.mts";
  }
  if (format === "iife") {
    jsExtension = ".global.js";
  }
  return {
    js: jsExtension,
    dts: dtsExtension
  };
}
function ensureTempDeclarationDir() {
  const cwd = process.cwd();
  const dirPath = _path2.default.join(cwd, ".tsup", "declaration");
  if (_fs2.default.existsSync(dirPath)) {
    return dirPath;
  }
  _fs2.default.mkdirSync(dirPath, { recursive: true });
  const gitIgnorePath = _path2.default.join(cwd, ".tsup", ".gitignore");
  writeFileSync(gitIgnorePath, "**/*\n");
  return dirPath;
}
var toObjectEntry = (entry) => {
  if (typeof entry === "string") {
    entry = [entry];
  }
  if (!Array.isArray(entry)) {
    return entry;
  }
  entry = entry.map((e) => e.replace(/\\/g, "/"));
  const ancestor = findLowestCommonAncestor(entry);
  return entry.reduce(
    (result, item) => {
      const key = item.replace(ancestor, "").replace(/^\//, "").replace(/\.[a-z]+$/, "");
      return {
        ...result,
        [key]: item
      };
    },
    {}
  );
};
var findLowestCommonAncestor = (filepaths) => {
  if (filepaths.length <= 1) return "";
  const [first, ...rest] = filepaths;
  let ancestor = first.split("/");
  for (const filepath of rest) {
    const directories = filepath.split("/", ancestor.length);
    let index = 0;
    for (const directory of directories) {
      if (directory === ancestor[index]) {
        index += 1;
      } else {
        ancestor = ancestor.slice(0, index);
        break;
      }
    }
    ancestor = ancestor.slice(0, index);
  }
  return ancestor.length <= 1 && ancestor[0] === "" ? `/${ancestor[0]}` : ancestor.join("/");
};
function toAbsolutePath(p, cwd) {
  if (_path2.default.isAbsolute(p)) {
    return p;
  }
  return slash(_path2.default.normalize(_path2.default.join(cwd || process.cwd(), p)));
}
function writeFileSync(filePath, content) {
  _fs2.default.mkdirSync(_path2.default.dirname(filePath), { recursive: true });
  _fs2.default.writeFileSync(filePath, content);
}
function replaceDtsWithJsExtensions(dtsFilePath) {
  return dtsFilePath.replace(
    /\.d\.(ts|mts|cts)$/,
    (_, fileExtension) => {
      switch (fileExtension) {
        case "ts":
          return ".js";
        case "mts":
          return ".mjs";
        case "cts":
          return ".cjs";
        default:
          return "";
      }
    }
  );
}
var convertArrayEntriesToObjectEntries = (arrayOfEntries) => {
  const objectEntries = Object.fromEntries(
    arrayOfEntries.map(
      (entry) => [
        _path2.default.posix.join(
          ...entry.split(_path2.default.posix.sep).slice(1, -1).concat(_path2.default.parse(entry).name)
        ),
        entry
      ]
    )
  );
  return objectEntries;
};
var resolveEntryPaths = async (entryPaths) => {
  const resolvedEntryPaths = typeof entryPaths === "string" || Array.isArray(entryPaths) ? convertArrayEntriesToObjectEntries(await _tinyglobby.glob.call(void 0, entryPaths)) : entryPaths;
  return resolvedEntryPaths;
};
var resolveExperimentalDtsConfig = async (options, tsconfig) => {
  const resolvedEntryPaths = await resolveEntryPaths(
    _optionalChain([options, 'access', _2 => _2.experimentalDts, 'optionalAccess', _3 => _3.entry]) || options.entry
  );
  const experimentalDtsObjectEntry = Object.keys(resolvedEntryPaths).length === 0 ? Array.isArray(options.entry) ? convertArrayEntriesToObjectEntries(options.entry) : options.entry : resolvedEntryPaths;
  const normalizedExperimentalDtsConfig = {
    compilerOptions: {
      ...tsconfig.data.compilerOptions || {},
      ..._optionalChain([options, 'access', _4 => _4.experimentalDts, 'optionalAccess', _5 => _5.compilerOptions]) || {}
    },
    entry: experimentalDtsObjectEntry
  };
  return normalizedExperimentalDtsConfig;
};
var resolveInitialExperimentalDtsConfig = async (experimentalDts) => {
  if (experimentalDts == null) {
    return;
  }
  if (typeof experimentalDts === "boolean")
    return experimentalDts ? { entry: {} } : void 0;
  if (typeof experimentalDts === "string") {
    return {
      entry: convertArrayEntriesToObjectEntries(await _tinyglobby.glob.call(void 0, experimentalDts))
    };
  }
  return {
    ...experimentalDts,
    entry: _optionalChain([experimentalDts, 'optionalAccess', _6 => _6.entry]) == null ? {} : await resolveEntryPaths(experimentalDts.entry)
  };
};





















exports.__require = __require; exports.__commonJS = __commonJS; exports.__toESM = __toESM; exports.getPostcss = getPostcss; exports.getApiExtractor = getApiExtractor; exports.localRequire = localRequire; exports.removeFiles = removeFiles; exports.debouncePromise = debouncePromise; exports.slash = slash; exports.truthy = truthy; exports.jsoncParse = jsoncParse; exports.defaultOutExtension = defaultOutExtension; exports.ensureTempDeclarationDir = ensureTempDeclarationDir; exports.toObjectEntry = toObjectEntry; exports.toAbsolutePath = toAbsolutePath; exports.writeFileSync = writeFileSync; exports.replaceDtsWithJsExtensions = replaceDtsWithJsExtensions; exports.resolveExperimentalDtsConfig = resolveExperimentalDtsConfig; exports.resolveInitialExperimentalDtsConfig = resolveInitialExperimentalDtsConfig;
