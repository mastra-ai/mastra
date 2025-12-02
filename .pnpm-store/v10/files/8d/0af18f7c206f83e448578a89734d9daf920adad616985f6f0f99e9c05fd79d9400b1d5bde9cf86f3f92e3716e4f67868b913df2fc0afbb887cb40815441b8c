var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
));

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/is.js
var require_is = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/is.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var objectToString = Object.prototype.toString;
    function isError(wat) {
      switch (objectToString.call(wat)) {
        case "[object Error]":
        case "[object Exception]":
        case "[object DOMException]":
          return !0;
        default:
          return isInstanceOf(wat, Error);
      }
    }
    function isBuiltin(wat, className) {
      return objectToString.call(wat) === `[object ${className}]`;
    }
    function isErrorEvent(wat) {
      return isBuiltin(wat, "ErrorEvent");
    }
    function isDOMError(wat) {
      return isBuiltin(wat, "DOMError");
    }
    function isDOMException(wat) {
      return isBuiltin(wat, "DOMException");
    }
    function isString(wat) {
      return isBuiltin(wat, "String");
    }
    function isParameterizedString(wat) {
      return typeof wat == "object" && wat !== null && "__sentry_template_string__" in wat && "__sentry_template_values__" in wat;
    }
    function isPrimitive(wat) {
      return wat === null || isParameterizedString(wat) || typeof wat != "object" && typeof wat != "function";
    }
    function isPlainObject(wat) {
      return isBuiltin(wat, "Object");
    }
    function isEvent(wat) {
      return typeof Event < "u" && isInstanceOf(wat, Event);
    }
    function isElement(wat) {
      return typeof Element < "u" && isInstanceOf(wat, Element);
    }
    function isRegExp(wat) {
      return isBuiltin(wat, "RegExp");
    }
    function isThenable(wat) {
      return !!(wat && wat.then && typeof wat.then == "function");
    }
    function isSyntheticEvent(wat) {
      return isPlainObject(wat) && "nativeEvent" in wat && "preventDefault" in wat && "stopPropagation" in wat;
    }
    function isInstanceOf(wat, base) {
      try {
        return wat instanceof base;
      } catch {
        return !1;
      }
    }
    function isVueViewModel(wat) {
      return !!(typeof wat == "object" && wat !== null && (wat.__isVue || wat._isVue));
    }
    exports.isDOMError = isDOMError;
    exports.isDOMException = isDOMException;
    exports.isElement = isElement;
    exports.isError = isError;
    exports.isErrorEvent = isErrorEvent;
    exports.isEvent = isEvent;
    exports.isInstanceOf = isInstanceOf;
    exports.isParameterizedString = isParameterizedString;
    exports.isPlainObject = isPlainObject;
    exports.isPrimitive = isPrimitive;
    exports.isRegExp = isRegExp;
    exports.isString = isString;
    exports.isSyntheticEvent = isSyntheticEvent;
    exports.isThenable = isThenable;
    exports.isVueViewModel = isVueViewModel;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/string.js
var require_string = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/string.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var is = require_is();
    function truncate(str, max = 0) {
      return typeof str != "string" || max === 0 || str.length <= max ? str : `${str.slice(0, max)}...`;
    }
    function snipLine(line, colno) {
      let newLine = line, lineLength = newLine.length;
      if (lineLength <= 150)
        return newLine;
      colno > lineLength && (colno = lineLength);
      let start = Math.max(colno - 60, 0);
      start < 5 && (start = 0);
      let end = Math.min(start + 140, lineLength);
      return end > lineLength - 5 && (end = lineLength), end === lineLength && (start = Math.max(end - 140, 0)), newLine = newLine.slice(start, end), start > 0 && (newLine = `'{snip} ${newLine}`), end < lineLength && (newLine += " {snip}"), newLine;
    }
    function safeJoin(input, delimiter) {
      if (!Array.isArray(input))
        return "";
      let output = [];
      for (let i = 0; i < input.length; i++) {
        let value = input[i];
        try {
          is.isVueViewModel(value) ? output.push("[VueViewModel]") : output.push(String(value));
        } catch {
          output.push("[value cannot be serialized]");
        }
      }
      return output.join(delimiter);
    }
    function isMatchingPattern(value, pattern, requireExactStringMatch = !1) {
      return is.isString(value) ? is.isRegExp(pattern) ? pattern.test(value) : is.isString(pattern) ? requireExactStringMatch ? value === pattern : value.includes(pattern) : !1 : !1;
    }
    function stringMatchesSomePattern(testString, patterns = [], requireExactStringMatch = !1) {
      return patterns.some((pattern) => isMatchingPattern(testString, pattern, requireExactStringMatch));
    }
    exports.isMatchingPattern = isMatchingPattern;
    exports.safeJoin = safeJoin;
    exports.snipLine = snipLine;
    exports.stringMatchesSomePattern = stringMatchesSomePattern;
    exports.truncate = truncate;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/aggregate-errors.js
var require_aggregate_errors = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/aggregate-errors.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var is = require_is(), string = require_string();
    function applyAggregateErrorsToEvent(exceptionFromErrorImplementation, parser, maxValueLimit = 250, key, limit, event, hint) {
      if (!event.exception || !event.exception.values || !hint || !is.isInstanceOf(hint.originalException, Error))
        return;
      let originalException = event.exception.values.length > 0 ? event.exception.values[event.exception.values.length - 1] : void 0;
      originalException && (event.exception.values = truncateAggregateExceptions(
        aggregateExceptionsFromError(
          exceptionFromErrorImplementation,
          parser,
          limit,
          hint.originalException,
          key,
          event.exception.values,
          originalException,
          0
        ),
        maxValueLimit
      ));
    }
    function aggregateExceptionsFromError(exceptionFromErrorImplementation, parser, limit, error, key, prevExceptions, exception, exceptionId) {
      if (prevExceptions.length >= limit + 1)
        return prevExceptions;
      let newExceptions = [...prevExceptions];
      if (is.isInstanceOf(error[key], Error)) {
        applyExceptionGroupFieldsForParentException(exception, exceptionId);
        let newException = exceptionFromErrorImplementation(parser, error[key]), newExceptionId = newExceptions.length;
        applyExceptionGroupFieldsForChildException(newException, key, newExceptionId, exceptionId), newExceptions = aggregateExceptionsFromError(
          exceptionFromErrorImplementation,
          parser,
          limit,
          error[key],
          key,
          [newException, ...newExceptions],
          newException,
          newExceptionId
        );
      }
      return Array.isArray(error.errors) && error.errors.forEach((childError, i) => {
        if (is.isInstanceOf(childError, Error)) {
          applyExceptionGroupFieldsForParentException(exception, exceptionId);
          let newException = exceptionFromErrorImplementation(parser, childError), newExceptionId = newExceptions.length;
          applyExceptionGroupFieldsForChildException(newException, `errors[${i}]`, newExceptionId, exceptionId), newExceptions = aggregateExceptionsFromError(
            exceptionFromErrorImplementation,
            parser,
            limit,
            childError,
            key,
            [newException, ...newExceptions],
            newException,
            newExceptionId
          );
        }
      }), newExceptions;
    }
    function applyExceptionGroupFieldsForParentException(exception, exceptionId) {
      exception.mechanism = exception.mechanism || { type: "generic", handled: !0 }, exception.mechanism = {
        ...exception.mechanism,
        ...exception.type === "AggregateError" && { is_exception_group: !0 },
        exception_id: exceptionId
      };
    }
    function applyExceptionGroupFieldsForChildException(exception, source, exceptionId, parentId) {
      exception.mechanism = exception.mechanism || { type: "generic", handled: !0 }, exception.mechanism = {
        ...exception.mechanism,
        type: "chained",
        source,
        exception_id: exceptionId,
        parent_id: parentId
      };
    }
    function truncateAggregateExceptions(exceptions, maxValueLength) {
      return exceptions.map((exception) => (exception.value && (exception.value = string.truncate(exception.value, maxValueLength)), exception));
    }
    exports.applyAggregateErrorsToEvent = applyAggregateErrorsToEvent;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/array.js
var require_array = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/array.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function flatten(input) {
      let result = [], flattenHelper = (input2) => {
        input2.forEach((el) => {
          Array.isArray(el) ? flattenHelper(el) : result.push(el);
        });
      };
      return flattenHelper(input), result;
    }
    exports.flatten = flatten;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/version.js
var require_version = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/version.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var SDK_VERSION = "8.9.2";
    exports.SDK_VERSION = SDK_VERSION;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/worldwide.js
var require_worldwide = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/worldwide.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var version = require_version(), GLOBAL_OBJ = globalThis;
    function getGlobalSingleton(name, creator, obj) {
      let gbl = obj || GLOBAL_OBJ, __SENTRY__ = gbl.__SENTRY__ = gbl.__SENTRY__ || {}, versionedCarrier = __SENTRY__[version.SDK_VERSION] = __SENTRY__[version.SDK_VERSION] || {};
      return versionedCarrier[name] || (versionedCarrier[name] = creator());
    }
    exports.GLOBAL_OBJ = GLOBAL_OBJ;
    exports.getGlobalSingleton = getGlobalSingleton;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/browser.js
var require_browser = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/browser.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var is = require_is(), worldwide = require_worldwide(), WINDOW = worldwide.GLOBAL_OBJ, DEFAULT_MAX_STRING_LENGTH = 80;
    function htmlTreeAsString(elem, options = {}) {
      if (!elem)
        return "<unknown>";
      try {
        let currentElem = elem, MAX_TRAVERSE_HEIGHT = 5, out = [], height = 0, len = 0, separator = " > ", sepLength = separator.length, nextStr, keyAttrs = Array.isArray(options) ? options : options.keyAttrs, maxStringLength = !Array.isArray(options) && options.maxStringLength || DEFAULT_MAX_STRING_LENGTH;
        for (; currentElem && height++ < MAX_TRAVERSE_HEIGHT && (nextStr = _htmlElementAsString(currentElem, keyAttrs), !(nextStr === "html" || height > 1 && len + out.length * sepLength + nextStr.length >= maxStringLength)); )
          out.push(nextStr), len += nextStr.length, currentElem = currentElem.parentNode;
        return out.reverse().join(separator);
      } catch {
        return "<unknown>";
      }
    }
    function _htmlElementAsString(el, keyAttrs) {
      let elem = el, out = [], className, classes, key, attr, i;
      if (!elem || !elem.tagName)
        return "";
      if (WINDOW.HTMLElement && elem instanceof HTMLElement && elem.dataset) {
        if (elem.dataset.sentryComponent)
          return elem.dataset.sentryComponent;
        if (elem.dataset.sentryElement)
          return elem.dataset.sentryElement;
      }
      out.push(elem.tagName.toLowerCase());
      let keyAttrPairs = keyAttrs && keyAttrs.length ? keyAttrs.filter((keyAttr) => elem.getAttribute(keyAttr)).map((keyAttr) => [keyAttr, elem.getAttribute(keyAttr)]) : null;
      if (keyAttrPairs && keyAttrPairs.length)
        keyAttrPairs.forEach((keyAttrPair) => {
          out.push(`[${keyAttrPair[0]}="${keyAttrPair[1]}"]`);
        });
      else if (elem.id && out.push(`#${elem.id}`), className = elem.className, className && is.isString(className))
        for (classes = className.split(/\s+/), i = 0; i < classes.length; i++)
          out.push(`.${classes[i]}`);
      let allowedAttrs = ["aria-label", "type", "name", "title", "alt"];
      for (i = 0; i < allowedAttrs.length; i++)
        key = allowedAttrs[i], attr = elem.getAttribute(key), attr && out.push(`[${key}="${attr}"]`);
      return out.join("");
    }
    function getLocationHref() {
      try {
        return WINDOW.document.location.href;
      } catch {
        return "";
      }
    }
    function getDomElement(selector) {
      return WINDOW.document && WINDOW.document.querySelector ? WINDOW.document.querySelector(selector) : null;
    }
    function getComponentName(elem) {
      if (!WINDOW.HTMLElement)
        return null;
      let currentElem = elem, MAX_TRAVERSE_HEIGHT = 5;
      for (let i = 0; i < MAX_TRAVERSE_HEIGHT; i++) {
        if (!currentElem)
          return null;
        if (currentElem instanceof HTMLElement) {
          if (currentElem.dataset.sentryComponent)
            return currentElem.dataset.sentryComponent;
          if (currentElem.dataset.sentryElement)
            return currentElem.dataset.sentryElement;
        }
        currentElem = currentElem.parentNode;
      }
      return null;
    }
    exports.getComponentName = getComponentName;
    exports.getDomElement = getDomElement;
    exports.getLocationHref = getLocationHref;
    exports.htmlTreeAsString = htmlTreeAsString;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/debug-build.js
var require_debug_build = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/debug-build.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var DEBUG_BUILD = typeof __SENTRY_DEBUG__ > "u" || __SENTRY_DEBUG__;
    exports.DEBUG_BUILD = DEBUG_BUILD;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/logger.js
var require_logger = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/logger.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var debugBuild = require_debug_build(), worldwide = require_worldwide(), PREFIX = "Sentry Logger ", CONSOLE_LEVELS = [
      "debug",
      "info",
      "warn",
      "error",
      "log",
      "assert",
      "trace"
    ], originalConsoleMethods = {};
    function consoleSandbox(callback) {
      if (!("console" in worldwide.GLOBAL_OBJ))
        return callback();
      let console2 = worldwide.GLOBAL_OBJ.console, wrappedFuncs = {}, wrappedLevels = Object.keys(originalConsoleMethods);
      wrappedLevels.forEach((level) => {
        let originalConsoleMethod = originalConsoleMethods[level];
        wrappedFuncs[level] = console2[level], console2[level] = originalConsoleMethod;
      });
      try {
        return callback();
      } finally {
        wrappedLevels.forEach((level) => {
          console2[level] = wrappedFuncs[level];
        });
      }
    }
    function makeLogger() {
      let enabled = !1, logger2 = {
        enable: () => {
          enabled = !0;
        },
        disable: () => {
          enabled = !1;
        },
        isEnabled: () => enabled
      };
      return debugBuild.DEBUG_BUILD ? CONSOLE_LEVELS.forEach((name) => {
        logger2[name] = (...args) => {
          enabled && consoleSandbox(() => {
            worldwide.GLOBAL_OBJ.console[name](`${PREFIX}[${name}]:`, ...args);
          });
        };
      }) : CONSOLE_LEVELS.forEach((name) => {
        logger2[name] = () => {
        };
      }), logger2;
    }
    var logger = makeLogger();
    exports.CONSOLE_LEVELS = CONSOLE_LEVELS;
    exports.consoleSandbox = consoleSandbox;
    exports.logger = logger;
    exports.originalConsoleMethods = originalConsoleMethods;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/dsn.js
var require_dsn = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/dsn.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var debugBuild = require_debug_build(), logger = require_logger(), DSN_REGEX = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+)?)?@)([\w.-]+)(?::(\d+))?\/(.+)/;
    function isValidProtocol(protocol) {
      return protocol === "http" || protocol === "https";
    }
    function dsnToString(dsn, withPassword = !1) {
      let { host, path, pass, port, projectId, protocol, publicKey } = dsn;
      return `${protocol}://${publicKey}${withPassword && pass ? `:${pass}` : ""}@${host}${port ? `:${port}` : ""}/${path && `${path}/`}${projectId}`;
    }
    function dsnFromString(str) {
      let match = DSN_REGEX.exec(str);
      if (!match) {
        logger.consoleSandbox(() => {
          console.error(`Invalid Sentry Dsn: ${str}`);
        });
        return;
      }
      let [protocol, publicKey, pass = "", host, port = "", lastPath] = match.slice(1), path = "", projectId = lastPath, split = projectId.split("/");
      if (split.length > 1 && (path = split.slice(0, -1).join("/"), projectId = split.pop()), projectId) {
        let projectMatch = projectId.match(/^\d+/);
        projectMatch && (projectId = projectMatch[0]);
      }
      return dsnFromComponents({ host, pass, path, projectId, port, protocol, publicKey });
    }
    function dsnFromComponents(components) {
      return {
        protocol: components.protocol,
        publicKey: components.publicKey || "",
        pass: components.pass || "",
        host: components.host,
        port: components.port || "",
        path: components.path || "",
        projectId: components.projectId
      };
    }
    function validateDsn(dsn) {
      if (!debugBuild.DEBUG_BUILD)
        return !0;
      let { port, projectId, protocol } = dsn;
      return ["protocol", "publicKey", "host", "projectId"].find((component) => dsn[component] ? !1 : (logger.logger.error(`Invalid Sentry Dsn: ${component} missing`), !0)) ? !1 : projectId.match(/^\d+$/) ? isValidProtocol(protocol) ? port && isNaN(parseInt(port, 10)) ? (logger.logger.error(`Invalid Sentry Dsn: Invalid port ${port}`), !1) : !0 : (logger.logger.error(`Invalid Sentry Dsn: Invalid protocol ${protocol}`), !1) : (logger.logger.error(`Invalid Sentry Dsn: Invalid projectId ${projectId}`), !1);
    }
    function makeDsn(from) {
      let components = typeof from == "string" ? dsnFromString(from) : dsnFromComponents(from);
      if (!(!components || !validateDsn(components)))
        return components;
    }
    exports.dsnFromString = dsnFromString;
    exports.dsnToString = dsnToString;
    exports.makeDsn = makeDsn;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/error.js
var require_error = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/error.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var SentryError = class extends Error {
      /** Display name of this error instance. */
      constructor(message, logLevel = "warn") {
        super(message), this.message = message, this.name = new.target.prototype.constructor.name, Object.setPrototypeOf(this, new.target.prototype), this.logLevel = logLevel;
      }
    };
    exports.SentryError = SentryError;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/object.js
var require_object = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/object.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var browser = require_browser(), debugBuild = require_debug_build(), is = require_is(), logger = require_logger(), string = require_string();
    function fill(source, name, replacementFactory) {
      if (!(name in source))
        return;
      let original = source[name], wrapped = replacementFactory(original);
      typeof wrapped == "function" && markFunctionWrapped(wrapped, original), source[name] = wrapped;
    }
    function addNonEnumerableProperty(obj, name, value) {
      try {
        Object.defineProperty(obj, name, {
          // enumerable: false, // the default, so we can save on bundle size by not explicitly setting it
          value,
          writable: !0,
          configurable: !0
        });
      } catch {
        debugBuild.DEBUG_BUILD && logger.logger.log(`Failed to add non-enumerable property "${name}" to object`, obj);
      }
    }
    function markFunctionWrapped(wrapped, original) {
      try {
        let proto = original.prototype || {};
        wrapped.prototype = original.prototype = proto, addNonEnumerableProperty(wrapped, "__sentry_original__", original);
      } catch {
      }
    }
    function getOriginalFunction(func) {
      return func.__sentry_original__;
    }
    function urlEncode(object) {
      return Object.keys(object).map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(object[key])}`).join("&");
    }
    function convertToPlainObject(value) {
      if (is.isError(value))
        return {
          message: value.message,
          name: value.name,
          stack: value.stack,
          ...getOwnProperties(value)
        };
      if (is.isEvent(value)) {
        let newObj = {
          type: value.type,
          target: serializeEventTarget(value.target),
          currentTarget: serializeEventTarget(value.currentTarget),
          ...getOwnProperties(value)
        };
        return typeof CustomEvent < "u" && is.isInstanceOf(value, CustomEvent) && (newObj.detail = value.detail), newObj;
      } else
        return value;
    }
    function serializeEventTarget(target) {
      try {
        return is.isElement(target) ? browser.htmlTreeAsString(target) : Object.prototype.toString.call(target);
      } catch {
        return "<unknown>";
      }
    }
    function getOwnProperties(obj) {
      if (typeof obj == "object" && obj !== null) {
        let extractedProps = {};
        for (let property in obj)
          Object.prototype.hasOwnProperty.call(obj, property) && (extractedProps[property] = obj[property]);
        return extractedProps;
      } else
        return {};
    }
    function extractExceptionKeysForMessage(exception, maxLength = 40) {
      let keys = Object.keys(convertToPlainObject(exception));
      if (keys.sort(), !keys.length)
        return "[object has no keys]";
      if (keys[0].length >= maxLength)
        return string.truncate(keys[0], maxLength);
      for (let includedKeys = keys.length; includedKeys > 0; includedKeys--) {
        let serialized = keys.slice(0, includedKeys).join(", ");
        if (!(serialized.length > maxLength))
          return includedKeys === keys.length ? serialized : string.truncate(serialized, maxLength);
      }
      return "";
    }
    function dropUndefinedKeys(inputValue) {
      return _dropUndefinedKeys(inputValue, /* @__PURE__ */ new Map());
    }
    function _dropUndefinedKeys(inputValue, memoizationMap) {
      if (isPojo(inputValue)) {
        let memoVal = memoizationMap.get(inputValue);
        if (memoVal !== void 0)
          return memoVal;
        let returnValue = {};
        memoizationMap.set(inputValue, returnValue);
        for (let key of Object.keys(inputValue))
          typeof inputValue[key] < "u" && (returnValue[key] = _dropUndefinedKeys(inputValue[key], memoizationMap));
        return returnValue;
      }
      if (Array.isArray(inputValue)) {
        let memoVal = memoizationMap.get(inputValue);
        if (memoVal !== void 0)
          return memoVal;
        let returnValue = [];
        return memoizationMap.set(inputValue, returnValue), inputValue.forEach((item) => {
          returnValue.push(_dropUndefinedKeys(item, memoizationMap));
        }), returnValue;
      }
      return inputValue;
    }
    function isPojo(input) {
      if (!is.isPlainObject(input))
        return !1;
      try {
        let name = Object.getPrototypeOf(input).constructor.name;
        return !name || name === "Object";
      } catch {
        return !0;
      }
    }
    function objectify(wat) {
      let objectified;
      switch (!0) {
        case wat == null:
          objectified = new String(wat);
          break;
        // Though symbols and bigints do have wrapper classes (`Symbol` and `BigInt`, respectively), for whatever reason
        // those classes don't have constructors which can be used with the `new` keyword. We therefore need to cast each as
        // an object in order to wrap it.
        case (typeof wat == "symbol" || typeof wat == "bigint"):
          objectified = Object(wat);
          break;
        // this will catch the remaining primitives: `String`, `Number`, and `Boolean`
        case is.isPrimitive(wat):
          objectified = new wat.constructor(wat);
          break;
        // by process of elimination, at this point we know that `wat` must already be an object
        default:
          objectified = wat;
          break;
      }
      return objectified;
    }
    exports.addNonEnumerableProperty = addNonEnumerableProperty;
    exports.convertToPlainObject = convertToPlainObject;
    exports.dropUndefinedKeys = dropUndefinedKeys;
    exports.extractExceptionKeysForMessage = extractExceptionKeysForMessage;
    exports.fill = fill;
    exports.getOriginalFunction = getOriginalFunction;
    exports.markFunctionWrapped = markFunctionWrapped;
    exports.objectify = objectify;
    exports.urlEncode = urlEncode;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/stacktrace.js
var require_stacktrace = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/stacktrace.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var STACKTRACE_FRAME_LIMIT = 50, UNKNOWN_FUNCTION = "?", WEBPACK_ERROR_REGEXP = /\(error: (.*)\)/, STRIP_FRAME_REGEXP = /captureMessage|captureException/;
    function createStackParser(...parsers) {
      let sortedParsers = parsers.sort((a, b) => a[0] - b[0]).map((p) => p[1]);
      return (stack, skipFirstLines = 0, framesToPop = 0) => {
        let frames = [], lines = stack.split(`
`);
        for (let i = skipFirstLines; i < lines.length; i++) {
          let line = lines[i];
          if (line.length > 1024)
            continue;
          let cleanedLine = WEBPACK_ERROR_REGEXP.test(line) ? line.replace(WEBPACK_ERROR_REGEXP, "$1") : line;
          if (!cleanedLine.match(/\S*Error: /)) {
            for (let parser of sortedParsers) {
              let frame = parser(cleanedLine);
              if (frame) {
                frames.push(frame);
                break;
              }
            }
            if (frames.length >= STACKTRACE_FRAME_LIMIT + framesToPop)
              break;
          }
        }
        return stripSentryFramesAndReverse(frames.slice(framesToPop));
      };
    }
    function stackParserFromStackParserOptions(stackParser) {
      return Array.isArray(stackParser) ? createStackParser(...stackParser) : stackParser;
    }
    function stripSentryFramesAndReverse(stack) {
      if (!stack.length)
        return [];
      let localStack = Array.from(stack);
      return /sentryWrapped/.test(localStack[localStack.length - 1].function || "") && localStack.pop(), localStack.reverse(), STRIP_FRAME_REGEXP.test(localStack[localStack.length - 1].function || "") && (localStack.pop(), STRIP_FRAME_REGEXP.test(localStack[localStack.length - 1].function || "") && localStack.pop()), localStack.slice(0, STACKTRACE_FRAME_LIMIT).map((frame) => ({
        ...frame,
        filename: frame.filename || localStack[localStack.length - 1].filename,
        function: frame.function || UNKNOWN_FUNCTION
      }));
    }
    var defaultFunctionName = "<anonymous>";
    function getFunctionName(fn) {
      try {
        return !fn || typeof fn != "function" ? defaultFunctionName : fn.name || defaultFunctionName;
      } catch {
        return defaultFunctionName;
      }
    }
    function getFramesFromEvent(event) {
      let exception = event.exception;
      if (exception) {
        let frames = [];
        try {
          return exception.values.forEach((value) => {
            value.stacktrace.frames && frames.push(...value.stacktrace.frames);
          }), frames;
        } catch {
          return;
        }
      }
    }
    exports.UNKNOWN_FUNCTION = UNKNOWN_FUNCTION;
    exports.createStackParser = createStackParser;
    exports.getFramesFromEvent = getFramesFromEvent;
    exports.getFunctionName = getFunctionName;
    exports.stackParserFromStackParserOptions = stackParserFromStackParserOptions;
    exports.stripSentryFramesAndReverse = stripSentryFramesAndReverse;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/handlers.js
var require_handlers = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/handlers.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var debugBuild = require_debug_build(), logger = require_logger(), stacktrace = require_stacktrace(), handlers = {}, instrumented = {};
    function addHandler(type, handler) {
      handlers[type] = handlers[type] || [], handlers[type].push(handler);
    }
    function resetInstrumentationHandlers() {
      Object.keys(handlers).forEach((key) => {
        handlers[key] = void 0;
      });
    }
    function maybeInstrument(type, instrumentFn) {
      instrumented[type] || (instrumentFn(), instrumented[type] = !0);
    }
    function triggerHandlers(type, data) {
      let typeHandlers = type && handlers[type];
      if (typeHandlers)
        for (let handler of typeHandlers)
          try {
            handler(data);
          } catch (e) {
            debugBuild.DEBUG_BUILD && logger.logger.error(
              `Error while triggering instrumentation handler.
Type: ${type}
Name: ${stacktrace.getFunctionName(handler)}
Error:`,
              e
            );
          }
    }
    exports.addHandler = addHandler;
    exports.maybeInstrument = maybeInstrument;
    exports.resetInstrumentationHandlers = resetInstrumentationHandlers;
    exports.triggerHandlers = triggerHandlers;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/console.js
var require_console = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/console.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var logger = require_logger(), object = require_object(), worldwide = require_worldwide(), handlers = require_handlers();
    function addConsoleInstrumentationHandler(handler) {
      let type = "console";
      handlers.addHandler(type, handler), handlers.maybeInstrument(type, instrumentConsole);
    }
    function instrumentConsole() {
      "console" in worldwide.GLOBAL_OBJ && logger.CONSOLE_LEVELS.forEach(function(level) {
        level in worldwide.GLOBAL_OBJ.console && object.fill(worldwide.GLOBAL_OBJ.console, level, function(originalConsoleMethod) {
          return logger.originalConsoleMethods[level] = originalConsoleMethod, function(...args) {
            let handlerData = { args, level };
            handlers.triggerHandlers("console", handlerData);
            let log = logger.originalConsoleMethods[level];
            log && log.apply(worldwide.GLOBAL_OBJ.console, args);
          };
        });
      });
    }
    exports.addConsoleInstrumentationHandler = addConsoleInstrumentationHandler;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/supports.js
var require_supports = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/supports.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var debugBuild = require_debug_build(), logger = require_logger(), worldwide = require_worldwide(), WINDOW = worldwide.GLOBAL_OBJ;
    function supportsErrorEvent() {
      try {
        return new ErrorEvent(""), !0;
      } catch {
        return !1;
      }
    }
    function supportsDOMError() {
      try {
        return new DOMError(""), !0;
      } catch {
        return !1;
      }
    }
    function supportsDOMException() {
      try {
        return new DOMException(""), !0;
      } catch {
        return !1;
      }
    }
    function supportsFetch() {
      if (!("fetch" in WINDOW))
        return !1;
      try {
        return new Headers(), new Request("http://www.example.com"), new Response(), !0;
      } catch {
        return !1;
      }
    }
    function isNativeFunction(func) {
      return func && /^function\s+\w+\(\)\s+\{\s+\[native code\]\s+\}$/.test(func.toString());
    }
    function supportsNativeFetch() {
      if (typeof EdgeRuntime == "string")
        return !0;
      if (!supportsFetch())
        return !1;
      if (isNativeFunction(WINDOW.fetch))
        return !0;
      let result = !1, doc = WINDOW.document;
      if (doc && typeof doc.createElement == "function")
        try {
          let sandbox = doc.createElement("iframe");
          sandbox.hidden = !0, doc.head.appendChild(sandbox), sandbox.contentWindow && sandbox.contentWindow.fetch && (result = isNativeFunction(sandbox.contentWindow.fetch)), doc.head.removeChild(sandbox);
        } catch (err) {
          debugBuild.DEBUG_BUILD && logger.logger.warn("Could not create sandbox iframe for pure fetch check, bailing to window.fetch: ", err);
        }
      return result;
    }
    function supportsReportingObserver() {
      return "ReportingObserver" in WINDOW;
    }
    function supportsReferrerPolicy() {
      if (!supportsFetch())
        return !1;
      try {
        return new Request("_", {
          referrerPolicy: "origin"
        }), !0;
      } catch {
        return !1;
      }
    }
    exports.isNativeFunction = isNativeFunction;
    exports.supportsDOMError = supportsDOMError;
    exports.supportsDOMException = supportsDOMException;
    exports.supportsErrorEvent = supportsErrorEvent;
    exports.supportsFetch = supportsFetch;
    exports.supportsNativeFetch = supportsNativeFetch;
    exports.supportsReferrerPolicy = supportsReferrerPolicy;
    exports.supportsReportingObserver = supportsReportingObserver;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/time.js
var require_time = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/time.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var worldwide = require_worldwide(), ONE_SECOND_IN_MS = 1e3;
    function dateTimestampInSeconds() {
      return Date.now() / ONE_SECOND_IN_MS;
    }
    function createUnixTimestampInSecondsFunc() {
      let { performance } = worldwide.GLOBAL_OBJ;
      if (!performance || !performance.now)
        return dateTimestampInSeconds;
      let approxStartingTimeOrigin = Date.now() - performance.now(), timeOrigin = performance.timeOrigin == null ? approxStartingTimeOrigin : performance.timeOrigin;
      return () => (timeOrigin + performance.now()) / ONE_SECOND_IN_MS;
    }
    var timestampInSeconds = createUnixTimestampInSecondsFunc();
    exports._browserPerformanceTimeOriginMode = void 0;
    var browserPerformanceTimeOrigin = (() => {
      let { performance } = worldwide.GLOBAL_OBJ;
      if (!performance || !performance.now) {
        exports._browserPerformanceTimeOriginMode = "none";
        return;
      }
      let threshold = 3600 * 1e3, performanceNow = performance.now(), dateNow = Date.now(), timeOriginDelta = performance.timeOrigin ? Math.abs(performance.timeOrigin + performanceNow - dateNow) : threshold, timeOriginIsReliable = timeOriginDelta < threshold, navigationStart = performance.timing && performance.timing.navigationStart, navigationStartDelta = typeof navigationStart == "number" ? Math.abs(navigationStart + performanceNow - dateNow) : threshold, navigationStartIsReliable = navigationStartDelta < threshold;
      return timeOriginIsReliable || navigationStartIsReliable ? timeOriginDelta <= navigationStartDelta ? (exports._browserPerformanceTimeOriginMode = "timeOrigin", performance.timeOrigin) : (exports._browserPerformanceTimeOriginMode = "navigationStart", navigationStart) : (exports._browserPerformanceTimeOriginMode = "dateNow", dateNow);
    })();
    exports.browserPerformanceTimeOrigin = browserPerformanceTimeOrigin;
    exports.dateTimestampInSeconds = dateTimestampInSeconds;
    exports.timestampInSeconds = timestampInSeconds;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/fetch.js
var require_fetch = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/fetch.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var is = require_is(), object = require_object(), supports = require_supports(), time = require_time(), worldwide = require_worldwide(), handlers = require_handlers();
    function addFetchInstrumentationHandler(handler) {
      let type = "fetch";
      handlers.addHandler(type, handler), handlers.maybeInstrument(type, instrumentFetch);
    }
    function instrumentFetch() {
      supports.supportsNativeFetch() && object.fill(worldwide.GLOBAL_OBJ, "fetch", function(originalFetch) {
        return function(...args) {
          let { method, url } = parseFetchArgs(args), handlerData = {
            args,
            fetchData: {
              method,
              url
            },
            startTimestamp: time.timestampInSeconds() * 1e3
          };
          handlers.triggerHandlers("fetch", {
            ...handlerData
          });
          let virtualStackTrace = new Error().stack;
          return originalFetch.apply(worldwide.GLOBAL_OBJ, args).then(
            (response) => {
              let finishedHandlerData = {
                ...handlerData,
                endTimestamp: time.timestampInSeconds() * 1e3,
                response
              };
              return handlers.triggerHandlers("fetch", finishedHandlerData), response;
            },
            (error) => {
              let erroredHandlerData = {
                ...handlerData,
                endTimestamp: time.timestampInSeconds() * 1e3,
                error
              };
              throw handlers.triggerHandlers("fetch", erroredHandlerData), is.isError(error) && error.stack === void 0 && (error.stack = virtualStackTrace, object.addNonEnumerableProperty(error, "framesToPop", 1)), error;
            }
          );
        };
      });
    }
    function hasProp(obj, prop) {
      return !!obj && typeof obj == "object" && !!obj[prop];
    }
    function getUrlFromResource(resource) {
      return typeof resource == "string" ? resource : resource ? hasProp(resource, "url") ? resource.url : resource.toString ? resource.toString() : "" : "";
    }
    function parseFetchArgs(fetchArgs) {
      if (fetchArgs.length === 0)
        return { method: "GET", url: "" };
      if (fetchArgs.length === 2) {
        let [url, options] = fetchArgs;
        return {
          url: getUrlFromResource(url),
          method: hasProp(options, "method") ? String(options.method).toUpperCase() : "GET"
        };
      }
      let arg = fetchArgs[0];
      return {
        url: getUrlFromResource(arg),
        method: hasProp(arg, "method") ? String(arg.method).toUpperCase() : "GET"
      };
    }
    exports.addFetchInstrumentationHandler = addFetchInstrumentationHandler;
    exports.parseFetchArgs = parseFetchArgs;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/globalError.js
var require_globalError = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/globalError.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var worldwide = require_worldwide(), handlers = require_handlers(), _oldOnErrorHandler = null;
    function addGlobalErrorInstrumentationHandler(handler) {
      let type = "error";
      handlers.addHandler(type, handler), handlers.maybeInstrument(type, instrumentError);
    }
    function instrumentError() {
      _oldOnErrorHandler = worldwide.GLOBAL_OBJ.onerror, worldwide.GLOBAL_OBJ.onerror = function(msg, url, line, column, error) {
        let handlerData = {
          column,
          error,
          line,
          msg,
          url
        };
        return handlers.triggerHandlers("error", handlerData), _oldOnErrorHandler && !_oldOnErrorHandler.__SENTRY_LOADER__ ? _oldOnErrorHandler.apply(this, arguments) : !1;
      }, worldwide.GLOBAL_OBJ.onerror.__SENTRY_INSTRUMENTED__ = !0;
    }
    exports.addGlobalErrorInstrumentationHandler = addGlobalErrorInstrumentationHandler;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/globalUnhandledRejection.js
var require_globalUnhandledRejection = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/instrument/globalUnhandledRejection.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var worldwide = require_worldwide(), handlers = require_handlers(), _oldOnUnhandledRejectionHandler = null;
    function addGlobalUnhandledRejectionInstrumentationHandler(handler) {
      let type = "unhandledrejection";
      handlers.addHandler(type, handler), handlers.maybeInstrument(type, instrumentUnhandledRejection);
    }
    function instrumentUnhandledRejection() {
      _oldOnUnhandledRejectionHandler = worldwide.GLOBAL_OBJ.onunhandledrejection, worldwide.GLOBAL_OBJ.onunhandledrejection = function(e) {
        let handlerData = e;
        return handlers.triggerHandlers("unhandledrejection", handlerData), _oldOnUnhandledRejectionHandler && !_oldOnUnhandledRejectionHandler.__SENTRY_LOADER__ ? _oldOnUnhandledRejectionHandler.apply(this, arguments) : !0;
      }, worldwide.GLOBAL_OBJ.onunhandledrejection.__SENTRY_INSTRUMENTED__ = !0;
    }
    exports.addGlobalUnhandledRejectionInstrumentationHandler = addGlobalUnhandledRejectionInstrumentationHandler;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/env.js
var require_env = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/env.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function isBrowserBundle() {
      return typeof __SENTRY_BROWSER_BUNDLE__ < "u" && !!__SENTRY_BROWSER_BUNDLE__;
    }
    function getSDKSource() {
      return "npm";
    }
    exports.getSDKSource = getSDKSource;
    exports.isBrowserBundle = isBrowserBundle;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/node.js
var require_node = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/node.js"(exports, module) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var env = require_env();
    function isNodeEnv() {
      return !env.isBrowserBundle() && Object.prototype.toString.call(typeof process < "u" ? process : 0) === "[object process]";
    }
    function dynamicRequire(mod, request) {
      return mod.require(request);
    }
    function loadModule(moduleName) {
      let mod;
      try {
        mod = dynamicRequire(module, moduleName);
      } catch {
      }
      try {
        let { cwd } = dynamicRequire(module, "process");
        mod = dynamicRequire(module, `${cwd()}/node_modules/${moduleName}`);
      } catch {
      }
      return mod;
    }
    exports.dynamicRequire = dynamicRequire;
    exports.isNodeEnv = isNodeEnv;
    exports.loadModule = loadModule;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/isBrowser.js
var require_isBrowser = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/isBrowser.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var node = require_node(), worldwide = require_worldwide();
    function isBrowser() {
      return typeof window < "u" && (!node.isNodeEnv() || isElectronNodeRenderer());
    }
    function isElectronNodeRenderer() {
      return (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        worldwide.GLOBAL_OBJ.process !== void 0 && worldwide.GLOBAL_OBJ.process.type === "renderer"
      );
    }
    exports.isBrowser = isBrowser;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/memo.js
var require_memo = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/memo.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function memoBuilder() {
      let hasWeakSet = typeof WeakSet == "function", inner = hasWeakSet ? /* @__PURE__ */ new WeakSet() : [];
      function memoize(obj) {
        if (hasWeakSet)
          return inner.has(obj) ? !0 : (inner.add(obj), !1);
        for (let i = 0; i < inner.length; i++)
          if (inner[i] === obj)
            return !0;
        return inner.push(obj), !1;
      }
      function unmemoize(obj) {
        if (hasWeakSet)
          inner.delete(obj);
        else
          for (let i = 0; i < inner.length; i++)
            if (inner[i] === obj) {
              inner.splice(i, 1);
              break;
            }
      }
      return [memoize, unmemoize];
    }
    exports.memoBuilder = memoBuilder;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/misc.js
var require_misc = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/misc.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var object = require_object(), string = require_string(), worldwide = require_worldwide();
    function uuid4() {
      let gbl = worldwide.GLOBAL_OBJ, crypto2 = gbl.crypto || gbl.msCrypto, getRandomByte = () => Math.random() * 16;
      try {
        if (crypto2 && crypto2.randomUUID)
          return crypto2.randomUUID().replace(/-/g, "");
        crypto2 && crypto2.getRandomValues && (getRandomByte = () => {
          let typedArray = new Uint8Array(1);
          return crypto2.getRandomValues(typedArray), typedArray[0];
        });
      } catch {
      }
      return ("10000000100040008000" + 1e11).replace(
        /[018]/g,
        (c) => (
          // eslint-disable-next-line no-bitwise
          (c ^ (getRandomByte() & 15) >> c / 4).toString(16)
        )
      );
    }
    function getFirstException(event) {
      return event.exception && event.exception.values ? event.exception.values[0] : void 0;
    }
    function getEventDescription(event) {
      let { message, event_id: eventId } = event;
      if (message)
        return message;
      let firstException = getFirstException(event);
      return firstException ? firstException.type && firstException.value ? `${firstException.type}: ${firstException.value}` : firstException.type || firstException.value || eventId || "<unknown>" : eventId || "<unknown>";
    }
    function addExceptionTypeValue(event, value, type) {
      let exception = event.exception = event.exception || {}, values = exception.values = exception.values || [], firstException = values[0] = values[0] || {};
      firstException.value || (firstException.value = value || ""), firstException.type || (firstException.type = type || "Error");
    }
    function addExceptionMechanism(event, newMechanism) {
      let firstException = getFirstException(event);
      if (!firstException)
        return;
      let defaultMechanism = { type: "generic", handled: !0 }, currentMechanism = firstException.mechanism;
      if (firstException.mechanism = { ...defaultMechanism, ...currentMechanism, ...newMechanism }, newMechanism && "data" in newMechanism) {
        let mergedData = { ...currentMechanism && currentMechanism.data, ...newMechanism.data };
        firstException.mechanism.data = mergedData;
      }
    }
    var SEMVER_REGEXP = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    function parseSemver(input) {
      let match = input.match(SEMVER_REGEXP) || [], major = parseInt(match[1], 10), minor = parseInt(match[2], 10), patch = parseInt(match[3], 10);
      return {
        buildmetadata: match[5],
        major: isNaN(major) ? void 0 : major,
        minor: isNaN(minor) ? void 0 : minor,
        patch: isNaN(patch) ? void 0 : patch,
        prerelease: match[4]
      };
    }
    function addContextToFrame(lines, frame, linesOfContext = 5) {
      if (frame.lineno === void 0)
        return;
      let maxLines = lines.length, sourceLine = Math.max(Math.min(maxLines - 1, frame.lineno - 1), 0);
      frame.pre_context = lines.slice(Math.max(0, sourceLine - linesOfContext), sourceLine).map((line) => string.snipLine(line, 0)), frame.context_line = string.snipLine(lines[Math.min(maxLines - 1, sourceLine)], frame.colno || 0), frame.post_context = lines.slice(Math.min(sourceLine + 1, maxLines), sourceLine + 1 + linesOfContext).map((line) => string.snipLine(line, 0));
    }
    function checkOrSetAlreadyCaught(exception) {
      if (exception && exception.__sentry_captured__)
        return !0;
      try {
        object.addNonEnumerableProperty(exception, "__sentry_captured__", !0);
      } catch {
      }
      return !1;
    }
    function arrayify(maybeArray) {
      return Array.isArray(maybeArray) ? maybeArray : [maybeArray];
    }
    exports.addContextToFrame = addContextToFrame;
    exports.addExceptionMechanism = addExceptionMechanism;
    exports.addExceptionTypeValue = addExceptionTypeValue;
    exports.arrayify = arrayify;
    exports.checkOrSetAlreadyCaught = checkOrSetAlreadyCaught;
    exports.getEventDescription = getEventDescription;
    exports.parseSemver = parseSemver;
    exports.uuid4 = uuid4;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/normalize.js
var require_normalize = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/normalize.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var is = require_is(), memo = require_memo(), object = require_object(), stacktrace = require_stacktrace();
    function normalize(input, depth = 100, maxProperties = 1 / 0) {
      try {
        return visit("", input, depth, maxProperties);
      } catch (err) {
        return { ERROR: `**non-serializable** (${err})` };
      }
    }
    function normalizeToSize(object2, depth = 3, maxSize = 100 * 1024) {
      let normalized = normalize(object2, depth);
      return jsonSize(normalized) > maxSize ? normalizeToSize(object2, depth - 1, maxSize) : normalized;
    }
    function visit(key, value, depth = 1 / 0, maxProperties = 1 / 0, memo$1 = memo.memoBuilder()) {
      let [memoize, unmemoize] = memo$1;
      if (value == null || // this matches null and undefined -> eqeq not eqeqeq
      ["number", "boolean", "string"].includes(typeof value) && !Number.isNaN(value))
        return value;
      let stringified = stringifyValue(key, value);
      if (!stringified.startsWith("[object "))
        return stringified;
      if (value.__sentry_skip_normalization__)
        return value;
      let remainingDepth = typeof value.__sentry_override_normalization_depth__ == "number" ? value.__sentry_override_normalization_depth__ : depth;
      if (remainingDepth === 0)
        return stringified.replace("object ", "");
      if (memoize(value))
        return "[Circular ~]";
      let valueWithToJSON = value;
      if (valueWithToJSON && typeof valueWithToJSON.toJSON == "function")
        try {
          let jsonValue = valueWithToJSON.toJSON();
          return visit("", jsonValue, remainingDepth - 1, maxProperties, memo$1);
        } catch {
        }
      let normalized = Array.isArray(value) ? [] : {}, numAdded = 0, visitable = object.convertToPlainObject(value);
      for (let visitKey in visitable) {
        if (!Object.prototype.hasOwnProperty.call(visitable, visitKey))
          continue;
        if (numAdded >= maxProperties) {
          normalized[visitKey] = "[MaxProperties ~]";
          break;
        }
        let visitValue = visitable[visitKey];
        normalized[visitKey] = visit(visitKey, visitValue, remainingDepth - 1, maxProperties, memo$1), numAdded++;
      }
      return unmemoize(value), normalized;
    }
    function stringifyValue(key, value) {
      try {
        if (key === "domain" && value && typeof value == "object" && value._events)
          return "[Domain]";
        if (key === "domainEmitter")
          return "[DomainEmitter]";
        if (typeof global < "u" && value === global)
          return "[Global]";
        if (typeof window < "u" && value === window)
          return "[Window]";
        if (typeof document < "u" && value === document)
          return "[Document]";
        if (is.isVueViewModel(value))
          return "[VueViewModel]";
        if (is.isSyntheticEvent(value))
          return "[SyntheticEvent]";
        if (typeof value == "number" && value !== value)
          return "[NaN]";
        if (typeof value == "function")
          return `[Function: ${stacktrace.getFunctionName(value)}]`;
        if (typeof value == "symbol")
          return `[${String(value)}]`;
        if (typeof value == "bigint")
          return `[BigInt: ${String(value)}]`;
        let objName = getConstructorName(value);
        return /^HTML(\w*)Element$/.test(objName) ? `[HTMLElement: ${objName}]` : `[object ${objName}]`;
      } catch (err) {
        return `**non-serializable** (${err})`;
      }
    }
    function getConstructorName(value) {
      let prototype = Object.getPrototypeOf(value);
      return prototype ? prototype.constructor.name : "null prototype";
    }
    function utf8Length(value) {
      return ~-encodeURI(value).split(/%..|./).length;
    }
    function jsonSize(value) {
      return utf8Length(JSON.stringify(value));
    }
    function normalizeUrlToBase(url, basePath) {
      let escapedBase = basePath.replace(/\\/g, "/").replace(/[|\\{}()[\]^$+*?.]/g, "\\$&"), newUrl = url;
      try {
        newUrl = decodeURI(url);
      } catch {
      }
      return newUrl.replace(/\\/g, "/").replace(/webpack:\/?/g, "").replace(new RegExp(`(file://)?/*${escapedBase}/*`, "ig"), "app:///");
    }
    exports.normalize = normalize;
    exports.normalizeToSize = normalizeToSize;
    exports.normalizeUrlToBase = normalizeUrlToBase;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/path.js
var require_path = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/path.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function normalizeArray(parts, allowAboveRoot) {
      let up = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        let last = parts[i];
        last === "." ? parts.splice(i, 1) : last === ".." ? (parts.splice(i, 1), up++) : up && (parts.splice(i, 1), up--);
      }
      if (allowAboveRoot)
        for (; up--; up)
          parts.unshift("..");
      return parts;
    }
    var splitPathRe = /^(\S+:\\|\/?)([\s\S]*?)((?:\.{1,2}|[^/\\]+?|)(\.[^./\\]*|))(?:[/\\]*)$/;
    function splitPath(filename) {
      let truncated = filename.length > 1024 ? `<truncated>${filename.slice(-1024)}` : filename, parts = splitPathRe.exec(truncated);
      return parts ? parts.slice(1) : [];
    }
    function resolve(...args) {
      let resolvedPath = "", resolvedAbsolute = !1;
      for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        let path = i >= 0 ? args[i] : "/";
        path && (resolvedPath = `${path}/${resolvedPath}`, resolvedAbsolute = path.charAt(0) === "/");
      }
      return resolvedPath = normalizeArray(
        resolvedPath.split("/").filter((p) => !!p),
        !resolvedAbsolute
      ).join("/"), (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
    }
    function trim(arr) {
      let start = 0;
      for (; start < arr.length && arr[start] === ""; start++)
        ;
      let end = arr.length - 1;
      for (; end >= 0 && arr[end] === ""; end--)
        ;
      return start > end ? [] : arr.slice(start, end - start + 1);
    }
    function relative(from, to) {
      from = resolve(from).slice(1), to = resolve(to).slice(1);
      let fromParts = trim(from.split("/")), toParts = trim(to.split("/")), length = Math.min(fromParts.length, toParts.length), samePartsLength = length;
      for (let i = 0; i < length; i++)
        if (fromParts[i] !== toParts[i]) {
          samePartsLength = i;
          break;
        }
      let outputParts = [];
      for (let i = samePartsLength; i < fromParts.length; i++)
        outputParts.push("..");
      return outputParts = outputParts.concat(toParts.slice(samePartsLength)), outputParts.join("/");
    }
    function normalizePath(path) {
      let isPathAbsolute = isAbsolute(path), trailingSlash = path.slice(-1) === "/", normalizedPath = normalizeArray(
        path.split("/").filter((p) => !!p),
        !isPathAbsolute
      ).join("/");
      return !normalizedPath && !isPathAbsolute && (normalizedPath = "."), normalizedPath && trailingSlash && (normalizedPath += "/"), (isPathAbsolute ? "/" : "") + normalizedPath;
    }
    function isAbsolute(path) {
      return path.charAt(0) === "/";
    }
    function join(...args) {
      return normalizePath(args.join("/"));
    }
    function dirname(path) {
      let result = splitPath(path), root = result[0], dir = result[1];
      return !root && !dir ? "." : (dir && (dir = dir.slice(0, dir.length - 1)), root + dir);
    }
    function basename(path, ext) {
      let f = splitPath(path)[2];
      return ext && f.slice(ext.length * -1) === ext && (f = f.slice(0, f.length - ext.length)), f;
    }
    exports.basename = basename;
    exports.dirname = dirname;
    exports.isAbsolute = isAbsolute;
    exports.join = join;
    exports.normalizePath = normalizePath;
    exports.relative = relative;
    exports.resolve = resolve;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/syncpromise.js
var require_syncpromise = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/syncpromise.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var is = require_is(), States;
    (function(States2) {
      States2[States2.PENDING = 0] = "PENDING";
      let RESOLVED = 1;
      States2[States2.RESOLVED = RESOLVED] = "RESOLVED";
      let REJECTED = 2;
      States2[States2.REJECTED = REJECTED] = "REJECTED";
    })(States || (States = {}));
    function resolvedSyncPromise(value) {
      return new SyncPromise((resolve) => {
        resolve(value);
      });
    }
    function rejectedSyncPromise(reason) {
      return new SyncPromise((_, reject) => {
        reject(reason);
      });
    }
    var SyncPromise = class _SyncPromise {
      constructor(executor) {
        _SyncPromise.prototype.__init.call(this), _SyncPromise.prototype.__init2.call(this), _SyncPromise.prototype.__init3.call(this), _SyncPromise.prototype.__init4.call(this), this._state = States.PENDING, this._handlers = [];
        try {
          executor(this._resolve, this._reject);
        } catch (e) {
          this._reject(e);
        }
      }
      /** JSDoc */
      then(onfulfilled, onrejected) {
        return new _SyncPromise((resolve, reject) => {
          this._handlers.push([
            !1,
            (result) => {
              if (!onfulfilled)
                resolve(result);
              else
                try {
                  resolve(onfulfilled(result));
                } catch (e) {
                  reject(e);
                }
            },
            (reason) => {
              if (!onrejected)
                reject(reason);
              else
                try {
                  resolve(onrejected(reason));
                } catch (e) {
                  reject(e);
                }
            }
          ]), this._executeHandlers();
        });
      }
      /** JSDoc */
      catch(onrejected) {
        return this.then((val) => val, onrejected);
      }
      /** JSDoc */
      finally(onfinally) {
        return new _SyncPromise((resolve, reject) => {
          let val, isRejected;
          return this.then(
            (value) => {
              isRejected = !1, val = value, onfinally && onfinally();
            },
            (reason) => {
              isRejected = !0, val = reason, onfinally && onfinally();
            }
          ).then(() => {
            if (isRejected) {
              reject(val);
              return;
            }
            resolve(val);
          });
        });
      }
      /** JSDoc */
      __init() {
        this._resolve = (value) => {
          this._setResult(States.RESOLVED, value);
        };
      }
      /** JSDoc */
      __init2() {
        this._reject = (reason) => {
          this._setResult(States.REJECTED, reason);
        };
      }
      /** JSDoc */
      __init3() {
        this._setResult = (state, value) => {
          if (this._state === States.PENDING) {
            if (is.isThenable(value)) {
              value.then(this._resolve, this._reject);
              return;
            }
            this._state = state, this._value = value, this._executeHandlers();
          }
        };
      }
      /** JSDoc */
      __init4() {
        this._executeHandlers = () => {
          if (this._state === States.PENDING)
            return;
          let cachedHandlers = this._handlers.slice();
          this._handlers = [], cachedHandlers.forEach((handler) => {
            handler[0] || (this._state === States.RESOLVED && handler[1](this._value), this._state === States.REJECTED && handler[2](this._value), handler[0] = !0);
          });
        };
      }
    };
    exports.SyncPromise = SyncPromise;
    exports.rejectedSyncPromise = rejectedSyncPromise;
    exports.resolvedSyncPromise = resolvedSyncPromise;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/promisebuffer.js
var require_promisebuffer = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/promisebuffer.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var error = require_error(), syncpromise = require_syncpromise();
    function makePromiseBuffer(limit) {
      let buffer = [];
      function isReady() {
        return limit === void 0 || buffer.length < limit;
      }
      function remove(task) {
        return buffer.splice(buffer.indexOf(task), 1)[0];
      }
      function add(taskProducer) {
        if (!isReady())
          return syncpromise.rejectedSyncPromise(new error.SentryError("Not adding Promise because buffer limit was reached."));
        let task = taskProducer();
        return buffer.indexOf(task) === -1 && buffer.push(task), task.then(() => remove(task)).then(
          null,
          () => remove(task).then(null, () => {
          })
        ), task;
      }
      function drain(timeout) {
        return new syncpromise.SyncPromise((resolve, reject) => {
          let counter = buffer.length;
          if (!counter)
            return resolve(!0);
          let capturedSetTimeout = setTimeout(() => {
            timeout && timeout > 0 && resolve(!1);
          }, timeout);
          buffer.forEach((item) => {
            syncpromise.resolvedSyncPromise(item).then(() => {
              --counter || (clearTimeout(capturedSetTimeout), resolve(!0));
            }, reject);
          });
        });
      }
      return {
        $: buffer,
        add,
        drain
      };
    }
    exports.makePromiseBuffer = makePromiseBuffer;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/cookie.js
var require_cookie = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/cookie.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function parseCookie(str) {
      let obj = {}, index = 0;
      for (; index < str.length; ) {
        let eqIdx = str.indexOf("=", index);
        if (eqIdx === -1)
          break;
        let endIdx = str.indexOf(";", index);
        if (endIdx === -1)
          endIdx = str.length;
        else if (endIdx < eqIdx) {
          index = str.lastIndexOf(";", eqIdx - 1) + 1;
          continue;
        }
        let key = str.slice(index, eqIdx).trim();
        if (obj[key] === void 0) {
          let val = str.slice(eqIdx + 1, endIdx).trim();
          val.charCodeAt(0) === 34 && (val = val.slice(1, -1));
          try {
            obj[key] = val.indexOf("%") !== -1 ? decodeURIComponent(val) : val;
          } catch {
            obj[key] = val;
          }
        }
        index = endIdx + 1;
      }
      return obj;
    }
    exports.parseCookie = parseCookie;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/url.js
var require_url = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/url.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function parseUrl(url) {
      if (!url)
        return {};
      let match = url.match(/^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/);
      if (!match)
        return {};
      let query = match[6] || "", fragment = match[8] || "";
      return {
        host: match[4],
        path: match[5],
        protocol: match[2],
        search: query,
        hash: fragment,
        relative: match[5] + query + fragment
        // everything minus origin
      };
    }
    function stripUrlQueryAndFragment(urlPath) {
      return urlPath.split(/[\?#]/, 1)[0];
    }
    function getNumberOfUrlSegments(url) {
      return url.split(/\\?\//).filter((s) => s.length > 0 && s !== ",").length;
    }
    function getSanitizedUrlString(url) {
      let { protocol, host, path } = url, filteredHost = host && host.replace(/^.*@/, "[filtered]:[filtered]@").replace(/(:80)$/, "").replace(/(:443)$/, "") || "";
      return `${protocol ? `${protocol}://` : ""}${filteredHost}${path}`;
    }
    exports.getNumberOfUrlSegments = getNumberOfUrlSegments;
    exports.getSanitizedUrlString = getSanitizedUrlString;
    exports.parseUrl = parseUrl;
    exports.stripUrlQueryAndFragment = stripUrlQueryAndFragment;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/requestdata.js
var require_requestdata = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/requestdata.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var cookie = require_cookie(), debugBuild = require_debug_build(), is = require_is(), logger = require_logger(), normalize = require_normalize(), url = require_url(), DEFAULT_INCLUDES = {
      ip: !1,
      request: !0,
      transaction: !0,
      user: !0
    }, DEFAULT_REQUEST_INCLUDES = ["cookies", "data", "headers", "method", "query_string", "url"], DEFAULT_USER_INCLUDES = ["id", "username", "email"];
    function extractPathForTransaction(req, options = {}) {
      let method = req.method && req.method.toUpperCase(), path = "", source = "url";
      options.customRoute || req.route ? (path = options.customRoute || `${req.baseUrl || ""}${req.route && req.route.path}`, source = "route") : (req.originalUrl || req.url) && (path = url.stripUrlQueryAndFragment(req.originalUrl || req.url || ""));
      let name = "";
      return options.method && method && (name += method), options.method && options.path && (name += " "), options.path && path && (name += path), [name, source];
    }
    function extractTransaction(req, type) {
      switch (type) {
        case "path":
          return extractPathForTransaction(req, { path: !0 })[0];
        case "handler":
          return req.route && req.route.stack && req.route.stack[0] && req.route.stack[0].name || "<anonymous>";
        case "methodPath":
        default: {
          let customRoute = req._reconstructedRoute ? req._reconstructedRoute : void 0;
          return extractPathForTransaction(req, { path: !0, method: !0, customRoute })[0];
        }
      }
    }
    function extractUserData(user, keys) {
      let extractedUser = {};
      return (Array.isArray(keys) ? keys : DEFAULT_USER_INCLUDES).forEach((key) => {
        user && key in user && (extractedUser[key] = user[key]);
      }), extractedUser;
    }
    function extractRequestData(req, options) {
      let { include = DEFAULT_REQUEST_INCLUDES } = options || {}, requestData = {}, headers = req.headers || {}, method = req.method, host = headers.host || req.hostname || req.host || "<no host>", protocol = req.protocol === "https" || req.socket && req.socket.encrypted ? "https" : "http", originalUrl = req.originalUrl || req.url || "", absoluteUrl = originalUrl.startsWith(protocol) ? originalUrl : `${protocol}://${host}${originalUrl}`;
      return include.forEach((key) => {
        switch (key) {
          case "headers": {
            requestData.headers = headers, include.includes("cookies") || delete requestData.headers.cookie;
            break;
          }
          case "method": {
            requestData.method = method;
            break;
          }
          case "url": {
            requestData.url = absoluteUrl;
            break;
          }
          case "cookies": {
            requestData.cookies = // TODO (v8 / #5257): We're only sending the empty object for backwards compatibility, so the last bit can
            // come off in v8
            req.cookies || headers.cookie && cookie.parseCookie(headers.cookie) || {};
            break;
          }
          case "query_string": {
            requestData.query_string = extractQueryParams(req);
            break;
          }
          case "data": {
            if (method === "GET" || method === "HEAD")
              break;
            req.body !== void 0 && (requestData.data = is.isString(req.body) ? req.body : JSON.stringify(normalize.normalize(req.body)));
            break;
          }
          default:
            ({}).hasOwnProperty.call(req, key) && (requestData[key] = req[key]);
        }
      }), requestData;
    }
    function addRequestDataToEvent(event, req, options) {
      let include = {
        ...DEFAULT_INCLUDES,
        ...options && options.include
      };
      if (include.request) {
        let extractedRequestData = Array.isArray(include.request) ? extractRequestData(req, { include: include.request }) : extractRequestData(req);
        event.request = {
          ...event.request,
          ...extractedRequestData
        };
      }
      if (include.user) {
        let extractedUser = req.user && is.isPlainObject(req.user) ? extractUserData(req.user, include.user) : {};
        Object.keys(extractedUser).length && (event.user = {
          ...event.user,
          ...extractedUser
        });
      }
      if (include.ip) {
        let ip = req.ip || req.socket && req.socket.remoteAddress;
        ip && (event.user = {
          ...event.user,
          ip_address: ip
        });
      }
      return include.transaction && !event.transaction && event.type === "transaction" && (event.transaction = extractTransaction(req, include.transaction)), event;
    }
    function extractQueryParams(req) {
      let originalUrl = req.originalUrl || req.url || "";
      if (originalUrl) {
        originalUrl.startsWith("/") && (originalUrl = `http://dogs.are.great${originalUrl}`);
        try {
          let queryParams = req.query || new URL(originalUrl).search.slice(1);
          return queryParams.length ? queryParams : void 0;
        } catch {
          return;
        }
      }
    }
    function winterCGHeadersToDict(winterCGHeaders) {
      let headers = {};
      try {
        winterCGHeaders.forEach((value, key) => {
          typeof value == "string" && (headers[key] = value);
        });
      } catch {
        debugBuild.DEBUG_BUILD && logger.logger.warn("Sentry failed extracting headers from a request object. If you see this, please file an issue.");
      }
      return headers;
    }
    function winterCGRequestToRequestData(req) {
      let headers = winterCGHeadersToDict(req.headers);
      return {
        method: req.method,
        url: req.url,
        headers
      };
    }
    exports.DEFAULT_USER_INCLUDES = DEFAULT_USER_INCLUDES;
    exports.addRequestDataToEvent = addRequestDataToEvent;
    exports.extractPathForTransaction = extractPathForTransaction;
    exports.extractRequestData = extractRequestData;
    exports.winterCGHeadersToDict = winterCGHeadersToDict;
    exports.winterCGRequestToRequestData = winterCGRequestToRequestData;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/severity.js
var require_severity = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/severity.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var validSeverityLevels = ["fatal", "error", "warning", "log", "info", "debug"];
    function severityLevelFromString(level) {
      return level === "warn" ? "warning" : validSeverityLevels.includes(level) ? level : "log";
    }
    exports.severityLevelFromString = severityLevelFromString;
    exports.validSeverityLevels = validSeverityLevels;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/node-stack-trace.js
var require_node_stack_trace = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/node-stack-trace.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var stacktrace = require_stacktrace();
    function filenameIsInApp(filename, isNative = !1) {
      return !(isNative || filename && // It's not internal if it's an absolute linux path
      !filename.startsWith("/") && // It's not internal if it's an absolute windows path
      !filename.match(/^[A-Z]:/) && // It's not internal if the path is starting with a dot
      !filename.startsWith(".") && // It's not internal if the frame has a protocol. In node, this is usually the case if the file got pre-processed with a bundler like webpack
      !filename.match(/^[a-zA-Z]([a-zA-Z0-9.\-+])*:\/\//)) && filename !== void 0 && !filename.includes("node_modules/");
    }
    function node(getModule) {
      let FILENAME_MATCH = /^\s*[-]{4,}$/, FULL_MATCH = /at (?:async )?(?:(.+?)\s+\()?(?:(.+):(\d+):(\d+)?|([^)]+))\)?/;
      return (line) => {
        let lineMatch = line.match(FULL_MATCH);
        if (lineMatch) {
          let object, method, functionName, typeName, methodName;
          if (lineMatch[1]) {
            functionName = lineMatch[1];
            let methodStart = functionName.lastIndexOf(".");
            if (functionName[methodStart - 1] === "." && methodStart--, methodStart > 0) {
              object = functionName.slice(0, methodStart), method = functionName.slice(methodStart + 1);
              let objectEnd = object.indexOf(".Module");
              objectEnd > 0 && (functionName = functionName.slice(objectEnd + 1), object = object.slice(0, objectEnd));
            }
            typeName = void 0;
          }
          method && (typeName = object, methodName = method), method === "<anonymous>" && (methodName = void 0, functionName = void 0), functionName === void 0 && (methodName = methodName || stacktrace.UNKNOWN_FUNCTION, functionName = typeName ? `${typeName}.${methodName}` : methodName);
          let filename = lineMatch[2] && lineMatch[2].startsWith("file://") ? lineMatch[2].slice(7) : lineMatch[2], isNative = lineMatch[5] === "native";
          return filename && filename.match(/\/[A-Z]:/) && (filename = filename.slice(1)), !filename && lineMatch[5] && !isNative && (filename = lineMatch[5]), {
            filename,
            module: getModule ? getModule(filename) : void 0,
            function: functionName,
            lineno: parseInt(lineMatch[3], 10) || void 0,
            colno: parseInt(lineMatch[4], 10) || void 0,
            in_app: filenameIsInApp(filename, isNative)
          };
        }
        if (line.match(FILENAME_MATCH))
          return {
            filename: line
          };
      };
    }
    function nodeStackLineParser(getModule) {
      return [90, node(getModule)];
    }
    exports.filenameIsInApp = filenameIsInApp;
    exports.node = node;
    exports.nodeStackLineParser = nodeStackLineParser;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/baggage.js
var require_baggage = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/baggage.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var debugBuild = require_debug_build(), is = require_is(), logger = require_logger(), BAGGAGE_HEADER_NAME = "baggage", SENTRY_BAGGAGE_KEY_PREFIX = "sentry-", SENTRY_BAGGAGE_KEY_PREFIX_REGEX = /^sentry-/, MAX_BAGGAGE_STRING_LENGTH = 8192;
    function baggageHeaderToDynamicSamplingContext(baggageHeader) {
      let baggageObject = parseBaggageHeader(baggageHeader);
      if (!baggageObject)
        return;
      let dynamicSamplingContext = Object.entries(baggageObject).reduce((acc, [key, value]) => {
        if (key.match(SENTRY_BAGGAGE_KEY_PREFIX_REGEX)) {
          let nonPrefixedKey = key.slice(SENTRY_BAGGAGE_KEY_PREFIX.length);
          acc[nonPrefixedKey] = value;
        }
        return acc;
      }, {});
      if (Object.keys(dynamicSamplingContext).length > 0)
        return dynamicSamplingContext;
    }
    function dynamicSamplingContextToSentryBaggageHeader(dynamicSamplingContext) {
      if (!dynamicSamplingContext)
        return;
      let sentryPrefixedDSC = Object.entries(dynamicSamplingContext).reduce(
        (acc, [dscKey, dscValue]) => (dscValue && (acc[`${SENTRY_BAGGAGE_KEY_PREFIX}${dscKey}`] = dscValue), acc),
        {}
      );
      return objectToBaggageHeader(sentryPrefixedDSC);
    }
    function parseBaggageHeader(baggageHeader) {
      if (!(!baggageHeader || !is.isString(baggageHeader) && !Array.isArray(baggageHeader)))
        return Array.isArray(baggageHeader) ? baggageHeader.reduce((acc, curr) => {
          let currBaggageObject = baggageHeaderToObject(curr);
          for (let key of Object.keys(currBaggageObject))
            acc[key] = currBaggageObject[key];
          return acc;
        }, {}) : baggageHeaderToObject(baggageHeader);
    }
    function baggageHeaderToObject(baggageHeader) {
      return baggageHeader.split(",").map((baggageEntry) => baggageEntry.split("=").map((keyOrValue) => decodeURIComponent(keyOrValue.trim()))).reduce((acc, [key, value]) => (acc[key] = value, acc), {});
    }
    function objectToBaggageHeader(object) {
      if (Object.keys(object).length !== 0)
        return Object.entries(object).reduce((baggageHeader, [objectKey, objectValue], currentIndex) => {
          let baggageEntry = `${encodeURIComponent(objectKey)}=${encodeURIComponent(objectValue)}`, newBaggageHeader = currentIndex === 0 ? baggageEntry : `${baggageHeader},${baggageEntry}`;
          return newBaggageHeader.length > MAX_BAGGAGE_STRING_LENGTH ? (debugBuild.DEBUG_BUILD && logger.logger.warn(
            `Not adding key: ${objectKey} with val: ${objectValue} to baggage header due to exceeding baggage size limits.`
          ), baggageHeader) : newBaggageHeader;
        }, "");
    }
    exports.BAGGAGE_HEADER_NAME = BAGGAGE_HEADER_NAME;
    exports.MAX_BAGGAGE_STRING_LENGTH = MAX_BAGGAGE_STRING_LENGTH;
    exports.SENTRY_BAGGAGE_KEY_PREFIX = SENTRY_BAGGAGE_KEY_PREFIX;
    exports.SENTRY_BAGGAGE_KEY_PREFIX_REGEX = SENTRY_BAGGAGE_KEY_PREFIX_REGEX;
    exports.baggageHeaderToDynamicSamplingContext = baggageHeaderToDynamicSamplingContext;
    exports.dynamicSamplingContextToSentryBaggageHeader = dynamicSamplingContextToSentryBaggageHeader;
    exports.parseBaggageHeader = parseBaggageHeader;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/tracing.js
var require_tracing = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/tracing.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var baggage = require_baggage(), misc = require_misc(), TRACEPARENT_REGEXP = new RegExp(
      "^[ \\t]*([0-9a-f]{32})?-?([0-9a-f]{16})?-?([01])?[ \\t]*$"
      // whitespace
    );
    function extractTraceparentData(traceparent) {
      if (!traceparent)
        return;
      let matches = traceparent.match(TRACEPARENT_REGEXP);
      if (!matches)
        return;
      let parentSampled;
      return matches[3] === "1" ? parentSampled = !0 : matches[3] === "0" && (parentSampled = !1), {
        traceId: matches[1],
        parentSampled,
        parentSpanId: matches[2]
      };
    }
    function propagationContextFromHeaders(sentryTrace, baggage$1) {
      let traceparentData = extractTraceparentData(sentryTrace), dynamicSamplingContext = baggage.baggageHeaderToDynamicSamplingContext(baggage$1), { traceId, parentSpanId, parentSampled } = traceparentData || {};
      return traceparentData ? {
        traceId: traceId || misc.uuid4(),
        parentSpanId: parentSpanId || misc.uuid4().substring(16),
        spanId: misc.uuid4().substring(16),
        sampled: parentSampled,
        dsc: dynamicSamplingContext || {}
        // If we have traceparent data but no DSC it means we are not head of trace and we must freeze it
      } : {
        traceId: traceId || misc.uuid4(),
        spanId: misc.uuid4().substring(16)
      };
    }
    function generateSentryTraceHeader(traceId = misc.uuid4(), spanId = misc.uuid4().substring(16), sampled) {
      let sampledString = "";
      return sampled !== void 0 && (sampledString = sampled ? "-1" : "-0"), `${traceId}-${spanId}${sampledString}`;
    }
    exports.TRACEPARENT_REGEXP = TRACEPARENT_REGEXP;
    exports.extractTraceparentData = extractTraceparentData;
    exports.generateSentryTraceHeader = generateSentryTraceHeader;
    exports.propagationContextFromHeaders = propagationContextFromHeaders;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/envelope.js
var require_envelope = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/envelope.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var dsn = require_dsn(), normalize = require_normalize(), object = require_object(), worldwide = require_worldwide();
    function createEnvelope(headers, items = []) {
      return [headers, items];
    }
    function addItemToEnvelope(envelope, newItem) {
      let [headers, items] = envelope;
      return [headers, [...items, newItem]];
    }
    function forEachEnvelopeItem(envelope, callback) {
      let envelopeItems = envelope[1];
      for (let envelopeItem of envelopeItems) {
        let envelopeItemType = envelopeItem[0].type;
        if (callback(envelopeItem, envelopeItemType))
          return !0;
      }
      return !1;
    }
    function envelopeContainsItemType(envelope, types) {
      return forEachEnvelopeItem(envelope, (_, type) => types.includes(type));
    }
    function encodeUTF8(input) {
      return worldwide.GLOBAL_OBJ.__SENTRY__ && worldwide.GLOBAL_OBJ.__SENTRY__.encodePolyfill ? worldwide.GLOBAL_OBJ.__SENTRY__.encodePolyfill(input) : new TextEncoder().encode(input);
    }
    function decodeUTF8(input) {
      return worldwide.GLOBAL_OBJ.__SENTRY__ && worldwide.GLOBAL_OBJ.__SENTRY__.decodePolyfill ? worldwide.GLOBAL_OBJ.__SENTRY__.decodePolyfill(input) : new TextDecoder().decode(input);
    }
    function serializeEnvelope(envelope) {
      let [envHeaders, items] = envelope, parts = JSON.stringify(envHeaders);
      function append(next) {
        typeof parts == "string" ? parts = typeof next == "string" ? parts + next : [encodeUTF8(parts), next] : parts.push(typeof next == "string" ? encodeUTF8(next) : next);
      }
      for (let item of items) {
        let [itemHeaders, payload] = item;
        if (append(`
${JSON.stringify(itemHeaders)}
`), typeof payload == "string" || payload instanceof Uint8Array)
          append(payload);
        else {
          let stringifiedPayload;
          try {
            stringifiedPayload = JSON.stringify(payload);
          } catch {
            stringifiedPayload = JSON.stringify(normalize.normalize(payload));
          }
          append(stringifiedPayload);
        }
      }
      return typeof parts == "string" ? parts : concatBuffers(parts);
    }
    function concatBuffers(buffers) {
      let totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0), merged = new Uint8Array(totalLength), offset = 0;
      for (let buffer of buffers)
        merged.set(buffer, offset), offset += buffer.length;
      return merged;
    }
    function parseEnvelope(env) {
      let buffer = typeof env == "string" ? encodeUTF8(env) : env;
      function readBinary(length) {
        let bin = buffer.subarray(0, length);
        return buffer = buffer.subarray(length + 1), bin;
      }
      function readJson() {
        let i = buffer.indexOf(10);
        return i < 0 && (i = buffer.length), JSON.parse(decodeUTF8(readBinary(i)));
      }
      let envelopeHeader = readJson(), items = [];
      for (; buffer.length; ) {
        let itemHeader = readJson(), binaryLength = typeof itemHeader.length == "number" ? itemHeader.length : void 0;
        items.push([itemHeader, binaryLength ? readBinary(binaryLength) : readJson()]);
      }
      return [envelopeHeader, items];
    }
    function createSpanEnvelopeItem(spanJson) {
      return [{
        type: "span"
      }, spanJson];
    }
    function createAttachmentEnvelopeItem(attachment) {
      let buffer = typeof attachment.data == "string" ? encodeUTF8(attachment.data) : attachment.data;
      return [
        object.dropUndefinedKeys({
          type: "attachment",
          length: buffer.length,
          filename: attachment.filename,
          content_type: attachment.contentType,
          attachment_type: attachment.attachmentType
        }),
        buffer
      ];
    }
    var ITEM_TYPE_TO_DATA_CATEGORY_MAP = {
      session: "session",
      sessions: "session",
      attachment: "attachment",
      transaction: "transaction",
      event: "error",
      client_report: "internal",
      user_report: "default",
      profile: "profile",
      profile_chunk: "profile",
      replay_event: "replay",
      replay_recording: "replay",
      check_in: "monitor",
      feedback: "feedback",
      span: "span",
      statsd: "metric_bucket"
    };
    function envelopeItemTypeToDataCategory(type) {
      return ITEM_TYPE_TO_DATA_CATEGORY_MAP[type];
    }
    function getSdkMetadataForEnvelopeHeader(metadataOrEvent) {
      if (!metadataOrEvent || !metadataOrEvent.sdk)
        return;
      let { name, version } = metadataOrEvent.sdk;
      return { name, version };
    }
    function createEventEnvelopeHeaders(event, sdkInfo, tunnel, dsn$1) {
      let dynamicSamplingContext = event.sdkProcessingMetadata && event.sdkProcessingMetadata.dynamicSamplingContext;
      return {
        event_id: event.event_id,
        sent_at: (/* @__PURE__ */ new Date()).toISOString(),
        ...sdkInfo && { sdk: sdkInfo },
        ...!!tunnel && dsn$1 && { dsn: dsn.dsnToString(dsn$1) },
        ...dynamicSamplingContext && {
          trace: object.dropUndefinedKeys({ ...dynamicSamplingContext })
        }
      };
    }
    exports.addItemToEnvelope = addItemToEnvelope;
    exports.createAttachmentEnvelopeItem = createAttachmentEnvelopeItem;
    exports.createEnvelope = createEnvelope;
    exports.createEventEnvelopeHeaders = createEventEnvelopeHeaders;
    exports.createSpanEnvelopeItem = createSpanEnvelopeItem;
    exports.envelopeContainsItemType = envelopeContainsItemType;
    exports.envelopeItemTypeToDataCategory = envelopeItemTypeToDataCategory;
    exports.forEachEnvelopeItem = forEachEnvelopeItem;
    exports.getSdkMetadataForEnvelopeHeader = getSdkMetadataForEnvelopeHeader;
    exports.parseEnvelope = parseEnvelope;
    exports.serializeEnvelope = serializeEnvelope;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/clientreport.js
var require_clientreport = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/clientreport.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var envelope = require_envelope(), time = require_time();
    function createClientReportEnvelope(discarded_events, dsn, timestamp) {
      let clientReportItem = [
        { type: "client_report" },
        {
          timestamp: timestamp || time.dateTimestampInSeconds(),
          discarded_events
        }
      ];
      return envelope.createEnvelope(dsn ? { dsn } : {}, [clientReportItem]);
    }
    exports.createClientReportEnvelope = createClientReportEnvelope;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/ratelimit.js
var require_ratelimit = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/ratelimit.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var DEFAULT_RETRY_AFTER = 60 * 1e3;
    function parseRetryAfterHeader(header, now = Date.now()) {
      let headerDelay = parseInt(`${header}`, 10);
      if (!isNaN(headerDelay))
        return headerDelay * 1e3;
      let headerDate = Date.parse(`${header}`);
      return isNaN(headerDate) ? DEFAULT_RETRY_AFTER : headerDate - now;
    }
    function disabledUntil(limits, dataCategory) {
      return limits[dataCategory] || limits.all || 0;
    }
    function isRateLimited(limits, dataCategory, now = Date.now()) {
      return disabledUntil(limits, dataCategory) > now;
    }
    function updateRateLimits(limits, { statusCode, headers }, now = Date.now()) {
      let updatedRateLimits = {
        ...limits
      }, rateLimitHeader = headers && headers["x-sentry-rate-limits"], retryAfterHeader = headers && headers["retry-after"];
      if (rateLimitHeader)
        for (let limit of rateLimitHeader.trim().split(",")) {
          let [retryAfter, categories, , , namespaces] = limit.split(":", 5), headerDelay = parseInt(retryAfter, 10), delay = (isNaN(headerDelay) ? 60 : headerDelay) * 1e3;
          if (!categories)
            updatedRateLimits.all = now + delay;
          else
            for (let category of categories.split(";"))
              category === "metric_bucket" ? (!namespaces || namespaces.split(";").includes("custom")) && (updatedRateLimits[category] = now + delay) : updatedRateLimits[category] = now + delay;
        }
      else retryAfterHeader ? updatedRateLimits.all = now + parseRetryAfterHeader(retryAfterHeader, now) : statusCode === 429 && (updatedRateLimits.all = now + 60 * 1e3);
      return updatedRateLimits;
    }
    exports.DEFAULT_RETRY_AFTER = DEFAULT_RETRY_AFTER;
    exports.disabledUntil = disabledUntil;
    exports.isRateLimited = isRateLimited;
    exports.parseRetryAfterHeader = parseRetryAfterHeader;
    exports.updateRateLimits = updateRateLimits;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/cache.js
var require_cache = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/cache.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function makeFifoCache(size) {
      let evictionOrder = [], cache = {};
      return {
        add(key, value) {
          for (; evictionOrder.length >= size; ) {
            let evictCandidate = evictionOrder.shift();
            evictCandidate !== void 0 && delete cache[evictCandidate];
          }
          cache[key] && this.delete(key), evictionOrder.push(key), cache[key] = value;
        },
        clear() {
          cache = {}, evictionOrder = [];
        },
        get(key) {
          return cache[key];
        },
        size() {
          return evictionOrder.length;
        },
        // Delete cache key and return true if it existed, false otherwise.
        delete(key) {
          if (!cache[key])
            return !1;
          delete cache[key];
          for (let i = 0; i < evictionOrder.length; i++)
            if (evictionOrder[i] === key) {
              evictionOrder.splice(i, 1);
              break;
            }
          return !0;
        }
      };
    }
    exports.makeFifoCache = makeFifoCache;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/eventbuilder.js
var require_eventbuilder = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/eventbuilder.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var is = require_is(), misc = require_misc(), normalize = require_normalize(), object = require_object();
    function parseStackFrames(stackParser, error) {
      return stackParser(error.stack || "", 1);
    }
    function exceptionFromError(stackParser, error) {
      let exception = {
        type: error.name || error.constructor.name,
        value: error.message
      }, frames = parseStackFrames(stackParser, error);
      return frames.length && (exception.stacktrace = { frames }), exception;
    }
    function getErrorPropertyFromObject(obj) {
      for (let prop in obj)
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
          let value = obj[prop];
          if (value instanceof Error)
            return value;
        }
    }
    function getMessageForObject(exception) {
      if ("name" in exception && typeof exception.name == "string") {
        let message = `'${exception.name}' captured as exception`;
        return "message" in exception && typeof exception.message == "string" && (message += ` with message '${exception.message}'`), message;
      } else if ("message" in exception && typeof exception.message == "string")
        return exception.message;
      let keys = object.extractExceptionKeysForMessage(exception);
      if (is.isErrorEvent(exception))
        return `Event \`ErrorEvent\` captured as exception with message \`${exception.message}\``;
      let className = getObjectClassName(exception);
      return `${className && className !== "Object" ? `'${className}'` : "Object"} captured as exception with keys: ${keys}`;
    }
    function getObjectClassName(obj) {
      try {
        let prototype = Object.getPrototypeOf(obj);
        return prototype ? prototype.constructor.name : void 0;
      } catch {
      }
    }
    function getException(client, mechanism, exception, hint) {
      if (is.isError(exception))
        return [exception, void 0];
      if (mechanism.synthetic = !0, is.isPlainObject(exception)) {
        let normalizeDepth = client && client.getOptions().normalizeDepth, extras = { __serialized__: normalize.normalizeToSize(exception, normalizeDepth) }, errorFromProp = getErrorPropertyFromObject(exception);
        if (errorFromProp)
          return [errorFromProp, extras];
        let message = getMessageForObject(exception), ex2 = hint && hint.syntheticException || new Error(message);
        return ex2.message = message, [ex2, extras];
      }
      let ex = hint && hint.syntheticException || new Error(exception);
      return ex.message = `${exception}`, [ex, void 0];
    }
    function eventFromUnknownInput(client, stackParser, exception, hint) {
      let mechanism = hint && hint.data && hint.data.mechanism || {
        handled: !0,
        type: "generic"
      }, [ex, extras] = getException(client, mechanism, exception, hint), event = {
        exception: {
          values: [exceptionFromError(stackParser, ex)]
        }
      };
      return extras && (event.extra = extras), misc.addExceptionTypeValue(event, void 0, void 0), misc.addExceptionMechanism(event, mechanism), {
        ...event,
        event_id: hint && hint.event_id
      };
    }
    function eventFromMessage(stackParser, message, level = "info", hint, attachStacktrace) {
      let event = {
        event_id: hint && hint.event_id,
        level
      };
      if (attachStacktrace && hint && hint.syntheticException) {
        let frames = parseStackFrames(stackParser, hint.syntheticException);
        frames.length && (event.exception = {
          values: [
            {
              value: message,
              stacktrace: { frames }
            }
          ]
        });
      }
      if (is.isParameterizedString(message)) {
        let { __sentry_template_string__, __sentry_template_values__ } = message;
        return event.logentry = {
          message: __sentry_template_string__,
          params: __sentry_template_values__
        }, event;
      }
      return event.message = message, event;
    }
    exports.eventFromMessage = eventFromMessage;
    exports.eventFromUnknownInput = eventFromUnknownInput;
    exports.exceptionFromError = exceptionFromError;
    exports.parseStackFrames = parseStackFrames;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/anr.js
var require_anr = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/anr.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var nodeStackTrace = require_node_stack_trace(), object = require_object(), stacktrace = require_stacktrace();
    function watchdogTimer(createTimer, pollInterval, anrThreshold, callback) {
      let timer = createTimer(), triggered = !1, enabled = !0;
      return setInterval(() => {
        let diffMs = timer.getTimeMs();
        triggered === !1 && diffMs > pollInterval + anrThreshold && (triggered = !0, enabled && callback()), diffMs < pollInterval + anrThreshold && (triggered = !1);
      }, 20), {
        poll: () => {
          timer.reset();
        },
        enabled: (state) => {
          enabled = state;
        }
      };
    }
    function callFrameToStackFrame(frame, url, getModuleFromFilename) {
      let filename = url ? url.replace(/^file:\/\//, "") : void 0, colno = frame.location.columnNumber ? frame.location.columnNumber + 1 : void 0, lineno = frame.location.lineNumber ? frame.location.lineNumber + 1 : void 0;
      return object.dropUndefinedKeys({
        filename,
        module: getModuleFromFilename(filename),
        function: frame.functionName || stacktrace.UNKNOWN_FUNCTION,
        colno,
        lineno,
        in_app: filename ? nodeStackTrace.filenameIsInApp(filename) : void 0
      });
    }
    exports.callFrameToStackFrame = callFrameToStackFrame;
    exports.watchdogTimer = watchdogTimer;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/lru.js
var require_lru = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/lru.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var LRUMap = class {
      constructor(_maxSize) {
        this._maxSize = _maxSize, this._cache = /* @__PURE__ */ new Map();
      }
      /** Get the current size of the cache */
      get size() {
        return this._cache.size;
      }
      /** Get an entry or undefined if it was not in the cache. Re-inserts to update the recently used order */
      get(key) {
        let value = this._cache.get(key);
        if (value !== void 0)
          return this._cache.delete(key), this._cache.set(key, value), value;
      }
      /** Insert an entry and evict an older entry if we've reached maxSize */
      set(key, value) {
        this._cache.size >= this._maxSize && this._cache.delete(this._cache.keys().next().value), this._cache.set(key, value);
      }
      /** Remove an entry and return the entry if it was in the cache */
      remove(key) {
        let value = this._cache.get(key);
        return value && this._cache.delete(key), value;
      }
      /** Clear all entries */
      clear() {
        this._cache.clear();
      }
      /** Get all the keys */
      keys() {
        return Array.from(this._cache.keys());
      }
      /** Get all the values */
      values() {
        let values = [];
        return this._cache.forEach((value) => values.push(value)), values;
      }
    };
    exports.LRUMap = LRUMap;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_nullishCoalesce.js
var require_nullishCoalesce = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_nullishCoalesce.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function _nullishCoalesce(lhs, rhsFn) {
      return lhs ?? rhsFn();
    }
    exports._nullishCoalesce = _nullishCoalesce;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_asyncNullishCoalesce.js
var require_asyncNullishCoalesce = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_asyncNullishCoalesce.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var _nullishCoalesce = require_nullishCoalesce();
    async function _asyncNullishCoalesce(lhs, rhsFn) {
      return _nullishCoalesce._nullishCoalesce(lhs, rhsFn);
    }
    exports._asyncNullishCoalesce = _asyncNullishCoalesce;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_asyncOptionalChain.js
var require_asyncOptionalChain = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_asyncOptionalChain.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    async function _asyncOptionalChain(ops) {
      let lastAccessLHS, value = ops[0], i = 1;
      for (; i < ops.length; ) {
        let op = ops[i], fn = ops[i + 1];
        if (i += 2, (op === "optionalAccess" || op === "optionalCall") && value == null)
          return;
        op === "access" || op === "optionalAccess" ? (lastAccessLHS = value, value = await fn(value)) : (op === "call" || op === "optionalCall") && (value = await fn((...args) => value.call(lastAccessLHS, ...args)), lastAccessLHS = void 0);
      }
      return value;
    }
    exports._asyncOptionalChain = _asyncOptionalChain;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_asyncOptionalChainDelete.js
var require_asyncOptionalChainDelete = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_asyncOptionalChainDelete.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var _asyncOptionalChain = require_asyncOptionalChain();
    async function _asyncOptionalChainDelete(ops) {
      let result = await _asyncOptionalChain._asyncOptionalChain(ops);
      return result ?? !0;
    }
    exports._asyncOptionalChainDelete = _asyncOptionalChainDelete;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_optionalChain.js
var require_optionalChain = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_optionalChain.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function _optionalChain(ops) {
      let lastAccessLHS, value = ops[0], i = 1;
      for (; i < ops.length; ) {
        let op = ops[i], fn = ops[i + 1];
        if (i += 2, (op === "optionalAccess" || op === "optionalCall") && value == null)
          return;
        op === "access" || op === "optionalAccess" ? (lastAccessLHS = value, value = fn(value)) : (op === "call" || op === "optionalCall") && (value = fn((...args) => value.call(lastAccessLHS, ...args)), lastAccessLHS = void 0);
      }
      return value;
    }
    exports._optionalChain = _optionalChain;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_optionalChainDelete.js
var require_optionalChainDelete = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/buildPolyfills/_optionalChainDelete.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var _optionalChain = require_optionalChain();
    function _optionalChainDelete(ops) {
      let result = _optionalChain._optionalChain(ops);
      return result ?? !0;
    }
    exports._optionalChainDelete = _optionalChainDelete;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/propagationContext.js
var require_propagationContext = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/propagationContext.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var misc = require_misc();
    function generatePropagationContext() {
      return {
        traceId: misc.uuid4(),
        spanId: misc.uuid4().substring(16)
      };
    }
    exports.generatePropagationContext = generatePropagationContext;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/vendor/escapeStringForRegex.js
var require_escapeStringForRegex = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/vendor/escapeStringForRegex.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function escapeStringForRegex(regexString) {
      return regexString.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
    }
    exports.escapeStringForRegex = escapeStringForRegex;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/vendor/supportsHistory.js
var require_supportsHistory = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/vendor/supportsHistory.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var worldwide = require_worldwide(), WINDOW = worldwide.GLOBAL_OBJ;
    function supportsHistory() {
      let chromeVar = WINDOW.chrome, isChromePackagedApp = chromeVar && chromeVar.app && chromeVar.app.runtime, hasHistoryApi = "history" in WINDOW && !!WINDOW.history.pushState && !!WINDOW.history.replaceState;
      return !isChromePackagedApp && hasHistoryApi;
    }
    exports.supportsHistory = supportsHistory;
  }
});

// ../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/index.js
var require_cjs = __commonJS({
  "../../node_modules/.pnpm/@sentry+utils@8.9.2/node_modules/@sentry/utils/cjs/index.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var aggregateErrors = require_aggregate_errors(), array = require_array(), browser = require_browser(), dsn = require_dsn(), error = require_error(), worldwide = require_worldwide(), console2 = require_console(), fetch2 = require_fetch(), globalError = require_globalError(), globalUnhandledRejection = require_globalUnhandledRejection(), handlers = require_handlers(), is = require_is(), isBrowser = require_isBrowser(), logger = require_logger(), memo = require_memo(), misc = require_misc(), node = require_node(), normalize = require_normalize(), object = require_object(), path = require_path(), promisebuffer = require_promisebuffer(), requestdata = require_requestdata(), severity = require_severity(), stacktrace = require_stacktrace(), nodeStackTrace = require_node_stack_trace(), string = require_string(), supports = require_supports(), syncpromise = require_syncpromise(), time = require_time(), tracing = require_tracing(), env = require_env(), envelope = require_envelope(), clientreport = require_clientreport(), ratelimit = require_ratelimit(), baggage = require_baggage(), url = require_url(), cache = require_cache(), eventbuilder = require_eventbuilder(), anr = require_anr(), lru = require_lru(), _asyncNullishCoalesce = require_asyncNullishCoalesce(), _asyncOptionalChain = require_asyncOptionalChain(), _asyncOptionalChainDelete = require_asyncOptionalChainDelete(), _nullishCoalesce = require_nullishCoalesce(), _optionalChain = require_optionalChain(), _optionalChainDelete = require_optionalChainDelete(), propagationContext = require_propagationContext(), version = require_version(), escapeStringForRegex = require_escapeStringForRegex(), supportsHistory = require_supportsHistory();
    exports.applyAggregateErrorsToEvent = aggregateErrors.applyAggregateErrorsToEvent;
    exports.flatten = array.flatten;
    exports.getComponentName = browser.getComponentName;
    exports.getDomElement = browser.getDomElement;
    exports.getLocationHref = browser.getLocationHref;
    exports.htmlTreeAsString = browser.htmlTreeAsString;
    exports.dsnFromString = dsn.dsnFromString;
    exports.dsnToString = dsn.dsnToString;
    exports.makeDsn = dsn.makeDsn;
    exports.SentryError = error.SentryError;
    exports.GLOBAL_OBJ = worldwide.GLOBAL_OBJ;
    exports.getGlobalSingleton = worldwide.getGlobalSingleton;
    exports.addConsoleInstrumentationHandler = console2.addConsoleInstrumentationHandler;
    exports.addFetchInstrumentationHandler = fetch2.addFetchInstrumentationHandler;
    exports.addGlobalErrorInstrumentationHandler = globalError.addGlobalErrorInstrumentationHandler;
    exports.addGlobalUnhandledRejectionInstrumentationHandler = globalUnhandledRejection.addGlobalUnhandledRejectionInstrumentationHandler;
    exports.addHandler = handlers.addHandler;
    exports.maybeInstrument = handlers.maybeInstrument;
    exports.resetInstrumentationHandlers = handlers.resetInstrumentationHandlers;
    exports.triggerHandlers = handlers.triggerHandlers;
    exports.isDOMError = is.isDOMError;
    exports.isDOMException = is.isDOMException;
    exports.isElement = is.isElement;
    exports.isError = is.isError;
    exports.isErrorEvent = is.isErrorEvent;
    exports.isEvent = is.isEvent;
    exports.isInstanceOf = is.isInstanceOf;
    exports.isParameterizedString = is.isParameterizedString;
    exports.isPlainObject = is.isPlainObject;
    exports.isPrimitive = is.isPrimitive;
    exports.isRegExp = is.isRegExp;
    exports.isString = is.isString;
    exports.isSyntheticEvent = is.isSyntheticEvent;
    exports.isThenable = is.isThenable;
    exports.isVueViewModel = is.isVueViewModel;
    exports.isBrowser = isBrowser.isBrowser;
    exports.CONSOLE_LEVELS = logger.CONSOLE_LEVELS;
    exports.consoleSandbox = logger.consoleSandbox;
    exports.logger = logger.logger;
    exports.originalConsoleMethods = logger.originalConsoleMethods;
    exports.memoBuilder = memo.memoBuilder;
    exports.addContextToFrame = misc.addContextToFrame;
    exports.addExceptionMechanism = misc.addExceptionMechanism;
    exports.addExceptionTypeValue = misc.addExceptionTypeValue;
    exports.arrayify = misc.arrayify;
    exports.checkOrSetAlreadyCaught = misc.checkOrSetAlreadyCaught;
    exports.getEventDescription = misc.getEventDescription;
    exports.parseSemver = misc.parseSemver;
    exports.uuid4 = misc.uuid4;
    exports.dynamicRequire = node.dynamicRequire;
    exports.isNodeEnv = node.isNodeEnv;
    exports.loadModule = node.loadModule;
    exports.normalize = normalize.normalize;
    exports.normalizeToSize = normalize.normalizeToSize;
    exports.normalizeUrlToBase = normalize.normalizeUrlToBase;
    exports.addNonEnumerableProperty = object.addNonEnumerableProperty;
    exports.convertToPlainObject = object.convertToPlainObject;
    exports.dropUndefinedKeys = object.dropUndefinedKeys;
    exports.extractExceptionKeysForMessage = object.extractExceptionKeysForMessage;
    exports.fill = object.fill;
    exports.getOriginalFunction = object.getOriginalFunction;
    exports.markFunctionWrapped = object.markFunctionWrapped;
    exports.objectify = object.objectify;
    exports.urlEncode = object.urlEncode;
    exports.basename = path.basename;
    exports.dirname = path.dirname;
    exports.isAbsolute = path.isAbsolute;
    exports.join = path.join;
    exports.normalizePath = path.normalizePath;
    exports.relative = path.relative;
    exports.resolve = path.resolve;
    exports.makePromiseBuffer = promisebuffer.makePromiseBuffer;
    exports.DEFAULT_USER_INCLUDES = requestdata.DEFAULT_USER_INCLUDES;
    exports.addRequestDataToEvent = requestdata.addRequestDataToEvent;
    exports.extractPathForTransaction = requestdata.extractPathForTransaction;
    exports.extractRequestData = requestdata.extractRequestData;
    exports.winterCGHeadersToDict = requestdata.winterCGHeadersToDict;
    exports.winterCGRequestToRequestData = requestdata.winterCGRequestToRequestData;
    exports.severityLevelFromString = severity.severityLevelFromString;
    exports.validSeverityLevels = severity.validSeverityLevels;
    exports.UNKNOWN_FUNCTION = stacktrace.UNKNOWN_FUNCTION;
    exports.createStackParser = stacktrace.createStackParser;
    exports.getFramesFromEvent = stacktrace.getFramesFromEvent;
    exports.getFunctionName = stacktrace.getFunctionName;
    exports.stackParserFromStackParserOptions = stacktrace.stackParserFromStackParserOptions;
    exports.stripSentryFramesAndReverse = stacktrace.stripSentryFramesAndReverse;
    exports.filenameIsInApp = nodeStackTrace.filenameIsInApp;
    exports.node = nodeStackTrace.node;
    exports.nodeStackLineParser = nodeStackTrace.nodeStackLineParser;
    exports.isMatchingPattern = string.isMatchingPattern;
    exports.safeJoin = string.safeJoin;
    exports.snipLine = string.snipLine;
    exports.stringMatchesSomePattern = string.stringMatchesSomePattern;
    exports.truncate = string.truncate;
    exports.isNativeFunction = supports.isNativeFunction;
    exports.supportsDOMError = supports.supportsDOMError;
    exports.supportsDOMException = supports.supportsDOMException;
    exports.supportsErrorEvent = supports.supportsErrorEvent;
    exports.supportsFetch = supports.supportsFetch;
    exports.supportsNativeFetch = supports.supportsNativeFetch;
    exports.supportsReferrerPolicy = supports.supportsReferrerPolicy;
    exports.supportsReportingObserver = supports.supportsReportingObserver;
    exports.SyncPromise = syncpromise.SyncPromise;
    exports.rejectedSyncPromise = syncpromise.rejectedSyncPromise;
    exports.resolvedSyncPromise = syncpromise.resolvedSyncPromise;
    Object.defineProperty(exports, "_browserPerformanceTimeOriginMode", {
      enumerable: !0,
      get: () => time._browserPerformanceTimeOriginMode
    });
    exports.browserPerformanceTimeOrigin = time.browserPerformanceTimeOrigin;
    exports.dateTimestampInSeconds = time.dateTimestampInSeconds;
    exports.timestampInSeconds = time.timestampInSeconds;
    exports.TRACEPARENT_REGEXP = tracing.TRACEPARENT_REGEXP;
    exports.extractTraceparentData = tracing.extractTraceparentData;
    exports.generateSentryTraceHeader = tracing.generateSentryTraceHeader;
    exports.propagationContextFromHeaders = tracing.propagationContextFromHeaders;
    exports.getSDKSource = env.getSDKSource;
    exports.isBrowserBundle = env.isBrowserBundle;
    exports.addItemToEnvelope = envelope.addItemToEnvelope;
    exports.createAttachmentEnvelopeItem = envelope.createAttachmentEnvelopeItem;
    exports.createEnvelope = envelope.createEnvelope;
    exports.createEventEnvelopeHeaders = envelope.createEventEnvelopeHeaders;
    exports.createSpanEnvelopeItem = envelope.createSpanEnvelopeItem;
    exports.envelopeContainsItemType = envelope.envelopeContainsItemType;
    exports.envelopeItemTypeToDataCategory = envelope.envelopeItemTypeToDataCategory;
    exports.forEachEnvelopeItem = envelope.forEachEnvelopeItem;
    exports.getSdkMetadataForEnvelopeHeader = envelope.getSdkMetadataForEnvelopeHeader;
    exports.parseEnvelope = envelope.parseEnvelope;
    exports.serializeEnvelope = envelope.serializeEnvelope;
    exports.createClientReportEnvelope = clientreport.createClientReportEnvelope;
    exports.DEFAULT_RETRY_AFTER = ratelimit.DEFAULT_RETRY_AFTER;
    exports.disabledUntil = ratelimit.disabledUntil;
    exports.isRateLimited = ratelimit.isRateLimited;
    exports.parseRetryAfterHeader = ratelimit.parseRetryAfterHeader;
    exports.updateRateLimits = ratelimit.updateRateLimits;
    exports.BAGGAGE_HEADER_NAME = baggage.BAGGAGE_HEADER_NAME;
    exports.MAX_BAGGAGE_STRING_LENGTH = baggage.MAX_BAGGAGE_STRING_LENGTH;
    exports.SENTRY_BAGGAGE_KEY_PREFIX = baggage.SENTRY_BAGGAGE_KEY_PREFIX;
    exports.SENTRY_BAGGAGE_KEY_PREFIX_REGEX = baggage.SENTRY_BAGGAGE_KEY_PREFIX_REGEX;
    exports.baggageHeaderToDynamicSamplingContext = baggage.baggageHeaderToDynamicSamplingContext;
    exports.dynamicSamplingContextToSentryBaggageHeader = baggage.dynamicSamplingContextToSentryBaggageHeader;
    exports.parseBaggageHeader = baggage.parseBaggageHeader;
    exports.getNumberOfUrlSegments = url.getNumberOfUrlSegments;
    exports.getSanitizedUrlString = url.getSanitizedUrlString;
    exports.parseUrl = url.parseUrl;
    exports.stripUrlQueryAndFragment = url.stripUrlQueryAndFragment;
    exports.makeFifoCache = cache.makeFifoCache;
    exports.eventFromMessage = eventbuilder.eventFromMessage;
    exports.eventFromUnknownInput = eventbuilder.eventFromUnknownInput;
    exports.exceptionFromError = eventbuilder.exceptionFromError;
    exports.parseStackFrames = eventbuilder.parseStackFrames;
    exports.callFrameToStackFrame = anr.callFrameToStackFrame;
    exports.watchdogTimer = anr.watchdogTimer;
    exports.LRUMap = lru.LRUMap;
    exports._asyncNullishCoalesce = _asyncNullishCoalesce._asyncNullishCoalesce;
    exports._asyncOptionalChain = _asyncOptionalChain._asyncOptionalChain;
    exports._asyncOptionalChainDelete = _asyncOptionalChainDelete._asyncOptionalChainDelete;
    exports._nullishCoalesce = _nullishCoalesce._nullishCoalesce;
    exports._optionalChain = _optionalChain._optionalChain;
    exports._optionalChainDelete = _optionalChainDelete._optionalChainDelete;
    exports.generatePropagationContext = propagationContext.generatePropagationContext;
    exports.SDK_VERSION = version.SDK_VERSION;
    exports.escapeStringForRegex = escapeStringForRegex.escapeStringForRegex;
    exports.supportsHistory = supportsHistory.supportsHistory;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/debug-build.js
var require_debug_build2 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/debug-build.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var DEBUG_BUILD = typeof __SENTRY_DEBUG__ > "u" || __SENTRY_DEBUG__;
    exports.DEBUG_BUILD = DEBUG_BUILD;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/carrier.js
var require_carrier = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/carrier.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs();
    function getMainCarrier() {
      return getSentryCarrier(utils.GLOBAL_OBJ), utils.GLOBAL_OBJ;
    }
    function getSentryCarrier(carrier) {
      let __SENTRY__ = carrier.__SENTRY__ = carrier.__SENTRY__ || {};
      return __SENTRY__.version = __SENTRY__.version || utils.SDK_VERSION, __SENTRY__[utils.SDK_VERSION] = __SENTRY__[utils.SDK_VERSION] || {};
    }
    exports.getMainCarrier = getMainCarrier;
    exports.getSentryCarrier = getSentryCarrier;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/session.js
var require_session = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/session.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs();
    function makeSession(context) {
      let startingTime = utils.timestampInSeconds(), session = {
        sid: utils.uuid4(),
        init: !0,
        timestamp: startingTime,
        started: startingTime,
        duration: 0,
        status: "ok",
        errors: 0,
        ignoreDuration: !1,
        toJSON: () => sessionToJSON(session)
      };
      return context && updateSession(session, context), session;
    }
    function updateSession(session, context = {}) {
      if (context.user && (!session.ipAddress && context.user.ip_address && (session.ipAddress = context.user.ip_address), !session.did && !context.did && (session.did = context.user.id || context.user.email || context.user.username)), session.timestamp = context.timestamp || utils.timestampInSeconds(), context.abnormal_mechanism && (session.abnormal_mechanism = context.abnormal_mechanism), context.ignoreDuration && (session.ignoreDuration = context.ignoreDuration), context.sid && (session.sid = context.sid.length === 32 ? context.sid : utils.uuid4()), context.init !== void 0 && (session.init = context.init), !session.did && context.did && (session.did = `${context.did}`), typeof context.started == "number" && (session.started = context.started), session.ignoreDuration)
        session.duration = void 0;
      else if (typeof context.duration == "number")
        session.duration = context.duration;
      else {
        let duration = session.timestamp - session.started;
        session.duration = duration >= 0 ? duration : 0;
      }
      context.release && (session.release = context.release), context.environment && (session.environment = context.environment), !session.ipAddress && context.ipAddress && (session.ipAddress = context.ipAddress), !session.userAgent && context.userAgent && (session.userAgent = context.userAgent), typeof context.errors == "number" && (session.errors = context.errors), context.status && (session.status = context.status);
    }
    function closeSession(session, status) {
      let context = {};
      status ? context = { status } : session.status === "ok" && (context = { status: "exited" }), updateSession(session, context);
    }
    function sessionToJSON(session) {
      return utils.dropUndefinedKeys({
        sid: `${session.sid}`,
        init: session.init,
        // Make sure that sec is converted to ms for date constructor
        started: new Date(session.started * 1e3).toISOString(),
        timestamp: new Date(session.timestamp * 1e3).toISOString(),
        status: session.status,
        errors: session.errors,
        did: typeof session.did == "number" || typeof session.did == "string" ? `${session.did}` : void 0,
        duration: session.duration,
        abnormal_mechanism: session.abnormal_mechanism,
        attrs: {
          release: session.release,
          environment: session.environment,
          ip_address: session.ipAddress,
          user_agent: session.userAgent
        }
      });
    }
    exports.closeSession = closeSession;
    exports.makeSession = makeSession;
    exports.updateSession = updateSession;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/spanOnScope.js
var require_spanOnScope = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/spanOnScope.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), SCOPE_SPAN_FIELD = "_sentrySpan";
    function _setSpanForScope(scope, span) {
      span ? utils.addNonEnumerableProperty(scope, SCOPE_SPAN_FIELD, span) : delete scope[SCOPE_SPAN_FIELD];
    }
    function _getSpanForScope(scope) {
      return scope[SCOPE_SPAN_FIELD];
    }
    exports._getSpanForScope = _getSpanForScope;
    exports._setSpanForScope = _setSpanForScope;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/scope.js
var require_scope = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/scope.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), session = require_session(), spanOnScope = require_spanOnScope(), DEFAULT_MAX_BREADCRUMBS = 100, ScopeClass = class _ScopeClass {
      /** Flag if notifying is happening. */
      /** Callback for client to receive scope changes. */
      /** Callback list that will be called during event processing. */
      /** Array of breadcrumbs. */
      /** User */
      /** Tags */
      /** Extra */
      /** Contexts */
      /** Attachments */
      /** Propagation Context for distributed tracing */
      /**
       * A place to stash data which is needed at some point in the SDK's event processing pipeline but which shouldn't get
       * sent to Sentry
       */
      /** Fingerprint */
      /** Severity */
      /**
       * Transaction Name
       *
       * IMPORTANT: The transaction name on the scope has nothing to do with root spans/transaction objects.
       * It's purpose is to assign a transaction to the scope that's added to non-transaction events.
       */
      /** Session */
      /** Request Mode Session Status */
      /** The client on this scope */
      /** Contains the last event id of a captured event.  */
      // NOTE: Any field which gets added here should get added not only to the constructor but also to the `clone` method.
      constructor() {
        this._notifyingListeners = !1, this._scopeListeners = [], this._eventProcessors = [], this._breadcrumbs = [], this._attachments = [], this._user = {}, this._tags = {}, this._extra = {}, this._contexts = {}, this._sdkProcessingMetadata = {}, this._propagationContext = utils.generatePropagationContext();
      }
      /**
       * @inheritDoc
       */
      clone() {
        let newScope = new _ScopeClass();
        return newScope._breadcrumbs = [...this._breadcrumbs], newScope._tags = { ...this._tags }, newScope._extra = { ...this._extra }, newScope._contexts = { ...this._contexts }, newScope._user = this._user, newScope._level = this._level, newScope._session = this._session, newScope._transactionName = this._transactionName, newScope._fingerprint = this._fingerprint, newScope._eventProcessors = [...this._eventProcessors], newScope._requestSession = this._requestSession, newScope._attachments = [...this._attachments], newScope._sdkProcessingMetadata = { ...this._sdkProcessingMetadata }, newScope._propagationContext = { ...this._propagationContext }, newScope._client = this._client, newScope._lastEventId = this._lastEventId, spanOnScope._setSpanForScope(newScope, spanOnScope._getSpanForScope(this)), newScope;
      }
      /**
       * @inheritDoc
       */
      setClient(client) {
        this._client = client;
      }
      /**
       * @inheritDoc
       */
      setLastEventId(lastEventId) {
        this._lastEventId = lastEventId;
      }
      /**
       * @inheritDoc
       */
      getClient() {
        return this._client;
      }
      /**
       * @inheritDoc
       */
      lastEventId() {
        return this._lastEventId;
      }
      /**
       * @inheritDoc
       */
      addScopeListener(callback) {
        this._scopeListeners.push(callback);
      }
      /**
       * @inheritDoc
       */
      addEventProcessor(callback) {
        return this._eventProcessors.push(callback), this;
      }
      /**
       * @inheritDoc
       */
      setUser(user) {
        return this._user = user || {
          email: void 0,
          id: void 0,
          ip_address: void 0,
          username: void 0
        }, this._session && session.updateSession(this._session, { user }), this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      getUser() {
        return this._user;
      }
      /**
       * @inheritDoc
       */
      getRequestSession() {
        return this._requestSession;
      }
      /**
       * @inheritDoc
       */
      setRequestSession(requestSession) {
        return this._requestSession = requestSession, this;
      }
      /**
       * @inheritDoc
       */
      setTags(tags) {
        return this._tags = {
          ...this._tags,
          ...tags
        }, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      setTag(key, value) {
        return this._tags = { ...this._tags, [key]: value }, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      setExtras(extras) {
        return this._extra = {
          ...this._extra,
          ...extras
        }, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      setExtra(key, extra) {
        return this._extra = { ...this._extra, [key]: extra }, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      setFingerprint(fingerprint) {
        return this._fingerprint = fingerprint, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      setLevel(level) {
        return this._level = level, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      setTransactionName(name) {
        return this._transactionName = name, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      setContext(key, context) {
        return context === null ? delete this._contexts[key] : this._contexts[key] = context, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      setSession(session2) {
        return session2 ? this._session = session2 : delete this._session, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      getSession() {
        return this._session;
      }
      /**
       * @inheritDoc
       */
      update(captureContext) {
        if (!captureContext)
          return this;
        let scopeToMerge = typeof captureContext == "function" ? captureContext(this) : captureContext, [scopeInstance, requestSession] = scopeToMerge instanceof Scope ? [scopeToMerge.getScopeData(), scopeToMerge.getRequestSession()] : utils.isPlainObject(scopeToMerge) ? [captureContext, captureContext.requestSession] : [], { tags, extra, user, contexts, level, fingerprint = [], propagationContext } = scopeInstance || {};
        return this._tags = { ...this._tags, ...tags }, this._extra = { ...this._extra, ...extra }, this._contexts = { ...this._contexts, ...contexts }, user && Object.keys(user).length && (this._user = user), level && (this._level = level), fingerprint.length && (this._fingerprint = fingerprint), propagationContext && (this._propagationContext = propagationContext), requestSession && (this._requestSession = requestSession), this;
      }
      /**
       * @inheritDoc
       */
      clear() {
        return this._breadcrumbs = [], this._tags = {}, this._extra = {}, this._user = {}, this._contexts = {}, this._level = void 0, this._transactionName = void 0, this._fingerprint = void 0, this._requestSession = void 0, this._session = void 0, spanOnScope._setSpanForScope(this, void 0), this._attachments = [], this._propagationContext = utils.generatePropagationContext(), this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      addBreadcrumb(breadcrumb, maxBreadcrumbs) {
        let maxCrumbs = typeof maxBreadcrumbs == "number" ? maxBreadcrumbs : DEFAULT_MAX_BREADCRUMBS;
        if (maxCrumbs <= 0)
          return this;
        let mergedBreadcrumb = {
          timestamp: utils.dateTimestampInSeconds(),
          ...breadcrumb
        }, breadcrumbs = this._breadcrumbs;
        return breadcrumbs.push(mergedBreadcrumb), this._breadcrumbs = breadcrumbs.length > maxCrumbs ? breadcrumbs.slice(-maxCrumbs) : breadcrumbs, this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      getLastBreadcrumb() {
        return this._breadcrumbs[this._breadcrumbs.length - 1];
      }
      /**
       * @inheritDoc
       */
      clearBreadcrumbs() {
        return this._breadcrumbs = [], this._notifyScopeListeners(), this;
      }
      /**
       * @inheritDoc
       */
      addAttachment(attachment) {
        return this._attachments.push(attachment), this;
      }
      /**
       * @inheritDoc
       */
      clearAttachments() {
        return this._attachments = [], this;
      }
      /** @inheritDoc */
      getScopeData() {
        return {
          breadcrumbs: this._breadcrumbs,
          attachments: this._attachments,
          contexts: this._contexts,
          tags: this._tags,
          extra: this._extra,
          user: this._user,
          level: this._level,
          fingerprint: this._fingerprint || [],
          eventProcessors: this._eventProcessors,
          propagationContext: this._propagationContext,
          sdkProcessingMetadata: this._sdkProcessingMetadata,
          transactionName: this._transactionName,
          span: spanOnScope._getSpanForScope(this)
        };
      }
      /**
       * @inheritDoc
       */
      setSDKProcessingMetadata(newData) {
        return this._sdkProcessingMetadata = { ...this._sdkProcessingMetadata, ...newData }, this;
      }
      /**
       * @inheritDoc
       */
      setPropagationContext(context) {
        return this._propagationContext = context, this;
      }
      /**
       * @inheritDoc
       */
      getPropagationContext() {
        return this._propagationContext;
      }
      /**
       * @inheritDoc
       */
      captureException(exception, hint) {
        let eventId = hint && hint.event_id ? hint.event_id : utils.uuid4();
        if (!this._client)
          return utils.logger.warn("No client configured on scope - will not capture exception!"), eventId;
        let syntheticException = new Error("Sentry syntheticException");
        return this._client.captureException(
          exception,
          {
            originalException: exception,
            syntheticException,
            ...hint,
            event_id: eventId
          },
          this
        ), eventId;
      }
      /**
       * @inheritDoc
       */
      captureMessage(message, level, hint) {
        let eventId = hint && hint.event_id ? hint.event_id : utils.uuid4();
        if (!this._client)
          return utils.logger.warn("No client configured on scope - will not capture message!"), eventId;
        let syntheticException = new Error(message);
        return this._client.captureMessage(
          message,
          level,
          {
            originalException: message,
            syntheticException,
            ...hint,
            event_id: eventId
          },
          this
        ), eventId;
      }
      /**
       * @inheritDoc
       */
      captureEvent(event, hint) {
        let eventId = hint && hint.event_id ? hint.event_id : utils.uuid4();
        return this._client ? (this._client.captureEvent(event, { ...hint, event_id: eventId }, this), eventId) : (utils.logger.warn("No client configured on scope - will not capture event!"), eventId);
      }
      /**
       * This will be called on every set call.
       */
      _notifyScopeListeners() {
        this._notifyingListeners || (this._notifyingListeners = !0, this._scopeListeners.forEach((callback) => {
          callback(this);
        }), this._notifyingListeners = !1);
      }
    }, Scope = ScopeClass;
    exports.Scope = Scope;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/defaultScopes.js
var require_defaultScopes = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/defaultScopes.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), scope = require_scope();
    function getDefaultCurrentScope() {
      return utils.getGlobalSingleton("defaultCurrentScope", () => new scope.Scope());
    }
    function getDefaultIsolationScope() {
      return utils.getGlobalSingleton("defaultIsolationScope", () => new scope.Scope());
    }
    exports.getDefaultCurrentScope = getDefaultCurrentScope;
    exports.getDefaultIsolationScope = getDefaultIsolationScope;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/asyncContext/stackStrategy.js
var require_stackStrategy = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/asyncContext/stackStrategy.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), defaultScopes = require_defaultScopes(), scope = require_scope(), carrier = require_carrier(), AsyncContextStack = class {
      constructor(scope$1, isolationScope) {
        let assignedScope;
        scope$1 ? assignedScope = scope$1 : assignedScope = new scope.Scope();
        let assignedIsolationScope;
        isolationScope ? assignedIsolationScope = isolationScope : assignedIsolationScope = new scope.Scope(), this._stack = [{ scope: assignedScope }], this._isolationScope = assignedIsolationScope;
      }
      /**
       * Fork a scope for the stack.
       */
      withScope(callback) {
        let scope2 = this._pushScope(), maybePromiseResult;
        try {
          maybePromiseResult = callback(scope2);
        } catch (e) {
          throw this._popScope(), e;
        }
        return utils.isThenable(maybePromiseResult) ? maybePromiseResult.then(
          (res) => (this._popScope(), res),
          (e) => {
            throw this._popScope(), e;
          }
        ) : (this._popScope(), maybePromiseResult);
      }
      /**
       * Get the client of the stack.
       */
      getClient() {
        return this.getStackTop().client;
      }
      /**
       * Returns the scope of the top stack.
       */
      getScope() {
        return this.getStackTop().scope;
      }
      /**
       * Get the isolation scope for the stack.
       */
      getIsolationScope() {
        return this._isolationScope;
      }
      /**
       * Returns the scope stack for domains or the process.
       */
      getStack() {
        return this._stack;
      }
      /**
       * Returns the topmost scope layer in the order domain > local > process.
       */
      getStackTop() {
        return this._stack[this._stack.length - 1];
      }
      /**
       * Push a scope to the stack.
       */
      _pushScope() {
        let scope2 = this.getScope().clone();
        return this.getStack().push({
          client: this.getClient(),
          scope: scope2
        }), scope2;
      }
      /**
       * Pop a scope from the stack.
       */
      _popScope() {
        return this.getStack().length <= 1 ? !1 : !!this.getStack().pop();
      }
    };
    function getAsyncContextStack() {
      let registry = carrier.getMainCarrier(), sentry = carrier.getSentryCarrier(registry);
      return sentry.stack = sentry.stack || new AsyncContextStack(defaultScopes.getDefaultCurrentScope(), defaultScopes.getDefaultIsolationScope());
    }
    function withScope(callback) {
      return getAsyncContextStack().withScope(callback);
    }
    function withSetScope(scope2, callback) {
      let stack = getAsyncContextStack();
      return stack.withScope(() => (stack.getStackTop().scope = scope2, callback(scope2)));
    }
    function withIsolationScope(callback) {
      return getAsyncContextStack().withScope(() => callback(getAsyncContextStack().getIsolationScope()));
    }
    function getStackAsyncContextStrategy() {
      return {
        withIsolationScope,
        withScope,
        withSetScope,
        withSetIsolationScope: (_isolationScope, callback) => withIsolationScope(callback),
        getCurrentScope: () => getAsyncContextStack().getScope(),
        getIsolationScope: () => getAsyncContextStack().getIsolationScope()
      };
    }
    exports.AsyncContextStack = AsyncContextStack;
    exports.getStackAsyncContextStrategy = getStackAsyncContextStrategy;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/asyncContext/index.js
var require_asyncContext = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/asyncContext/index.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var carrier = require_carrier(), stackStrategy = require_stackStrategy();
    function setAsyncContextStrategy(strategy) {
      let registry = carrier.getMainCarrier(), sentry = carrier.getSentryCarrier(registry);
      sentry.acs = strategy;
    }
    function getAsyncContextStrategy(carrier$1) {
      let sentry = carrier.getSentryCarrier(carrier$1);
      return sentry.acs ? sentry.acs : stackStrategy.getStackAsyncContextStrategy();
    }
    exports.getAsyncContextStrategy = getAsyncContextStrategy;
    exports.setAsyncContextStrategy = setAsyncContextStrategy;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/currentScopes.js
var require_currentScopes = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/currentScopes.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), index = require_asyncContext(), carrier = require_carrier(), scope = require_scope();
    function getCurrentScope() {
      let carrier$1 = carrier.getMainCarrier();
      return index.getAsyncContextStrategy(carrier$1).getCurrentScope();
    }
    function getIsolationScope() {
      let carrier$1 = carrier.getMainCarrier();
      return index.getAsyncContextStrategy(carrier$1).getIsolationScope();
    }
    function getGlobalScope() {
      return utils.getGlobalSingleton("globalScope", () => new scope.Scope());
    }
    function withScope(...rest) {
      let carrier$1 = carrier.getMainCarrier(), acs = index.getAsyncContextStrategy(carrier$1);
      if (rest.length === 2) {
        let [scope2, callback] = rest;
        return scope2 ? acs.withSetScope(scope2, callback) : acs.withScope(callback);
      }
      return acs.withScope(rest[0]);
    }
    function withIsolationScope(...rest) {
      let carrier$1 = carrier.getMainCarrier(), acs = index.getAsyncContextStrategy(carrier$1);
      if (rest.length === 2) {
        let [isolationScope, callback] = rest;
        return isolationScope ? acs.withSetIsolationScope(isolationScope, callback) : acs.withIsolationScope(callback);
      }
      return acs.withIsolationScope(rest[0]);
    }
    function getClient() {
      return getCurrentScope().getClient();
    }
    exports.getClient = getClient;
    exports.getCurrentScope = getCurrentScope;
    exports.getGlobalScope = getGlobalScope;
    exports.getIsolationScope = getIsolationScope;
    exports.withIsolationScope = withIsolationScope;
    exports.withScope = withScope;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/metric-summary.js
var require_metric_summary = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/metric-summary.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), METRICS_SPAN_FIELD = "_sentryMetrics";
    function getMetricSummaryJsonForSpan(span) {
      let storage = span[METRICS_SPAN_FIELD];
      if (!storage)
        return;
      let output = {};
      for (let [, [exportKey, summary]] of storage)
        output[exportKey] || (output[exportKey] = []), output[exportKey].push(utils.dropUndefinedKeys(summary));
      return output;
    }
    function updateMetricSummaryOnSpan(span, metricType, sanitizedName, value, unit, tags, bucketKey) {
      let storage = span[METRICS_SPAN_FIELD] || (span[METRICS_SPAN_FIELD] = /* @__PURE__ */ new Map()), exportKey = `${metricType}:${sanitizedName}@${unit}`, bucketItem = storage.get(bucketKey);
      if (bucketItem) {
        let [, summary] = bucketItem;
        storage.set(bucketKey, [
          exportKey,
          {
            min: Math.min(summary.min, value),
            max: Math.max(summary.max, value),
            count: summary.count += 1,
            sum: summary.sum += value,
            tags: summary.tags
          }
        ]);
      } else
        storage.set(bucketKey, [
          exportKey,
          {
            min: value,
            max: value,
            count: 1,
            sum: value,
            tags
          }
        ]);
    }
    exports.getMetricSummaryJsonForSpan = getMetricSummaryJsonForSpan;
    exports.updateMetricSummaryOnSpan = updateMetricSummaryOnSpan;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/semanticAttributes.js
var require_semanticAttributes = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/semanticAttributes.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var SEMANTIC_ATTRIBUTE_SENTRY_SOURCE = "sentry.source", SEMANTIC_ATTRIBUTE_SENTRY_SAMPLE_RATE = "sentry.sample_rate", SEMANTIC_ATTRIBUTE_SENTRY_OP = "sentry.op", SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN = "sentry.origin", SEMANTIC_ATTRIBUTE_SENTRY_IDLE_SPAN_FINISH_REASON = "sentry.idle_span_finish_reason", SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_UNIT = "sentry.measurement_unit", SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_VALUE = "sentry.measurement_value", SEMANTIC_ATTRIBUTE_PROFILE_ID = "sentry.profile_id", SEMANTIC_ATTRIBUTE_EXCLUSIVE_TIME = "sentry.exclusive_time", SEMANTIC_ATTRIBUTE_CACHE_HIT = "cache.hit", SEMANTIC_ATTRIBUTE_CACHE_KEY = "cache.key", SEMANTIC_ATTRIBUTE_CACHE_ITEM_SIZE = "cache.item_size";
    exports.SEMANTIC_ATTRIBUTE_CACHE_HIT = SEMANTIC_ATTRIBUTE_CACHE_HIT;
    exports.SEMANTIC_ATTRIBUTE_CACHE_ITEM_SIZE = SEMANTIC_ATTRIBUTE_CACHE_ITEM_SIZE;
    exports.SEMANTIC_ATTRIBUTE_CACHE_KEY = SEMANTIC_ATTRIBUTE_CACHE_KEY;
    exports.SEMANTIC_ATTRIBUTE_EXCLUSIVE_TIME = SEMANTIC_ATTRIBUTE_EXCLUSIVE_TIME;
    exports.SEMANTIC_ATTRIBUTE_PROFILE_ID = SEMANTIC_ATTRIBUTE_PROFILE_ID;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_IDLE_SPAN_FINISH_REASON = SEMANTIC_ATTRIBUTE_SENTRY_IDLE_SPAN_FINISH_REASON;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_UNIT = SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_UNIT;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_VALUE = SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_VALUE;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_OP = SEMANTIC_ATTRIBUTE_SENTRY_OP;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN = SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_SAMPLE_RATE = SEMANTIC_ATTRIBUTE_SENTRY_SAMPLE_RATE;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE = SEMANTIC_ATTRIBUTE_SENTRY_SOURCE;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/spanstatus.js
var require_spanstatus = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/spanstatus.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var SPAN_STATUS_UNSET = 0, SPAN_STATUS_OK = 1, SPAN_STATUS_ERROR = 2;
    function getSpanStatusFromHttpCode(httpStatus) {
      if (httpStatus < 400 && httpStatus >= 100)
        return { code: SPAN_STATUS_OK };
      if (httpStatus >= 400 && httpStatus < 500)
        switch (httpStatus) {
          case 401:
            return { code: SPAN_STATUS_ERROR, message: "unauthenticated" };
          case 403:
            return { code: SPAN_STATUS_ERROR, message: "permission_denied" };
          case 404:
            return { code: SPAN_STATUS_ERROR, message: "not_found" };
          case 409:
            return { code: SPAN_STATUS_ERROR, message: "already_exists" };
          case 413:
            return { code: SPAN_STATUS_ERROR, message: "failed_precondition" };
          case 429:
            return { code: SPAN_STATUS_ERROR, message: "resource_exhausted" };
          case 499:
            return { code: SPAN_STATUS_ERROR, message: "cancelled" };
          default:
            return { code: SPAN_STATUS_ERROR, message: "invalid_argument" };
        }
      if (httpStatus >= 500 && httpStatus < 600)
        switch (httpStatus) {
          case 501:
            return { code: SPAN_STATUS_ERROR, message: "unimplemented" };
          case 503:
            return { code: SPAN_STATUS_ERROR, message: "unavailable" };
          case 504:
            return { code: SPAN_STATUS_ERROR, message: "deadline_exceeded" };
          default:
            return { code: SPAN_STATUS_ERROR, message: "internal_error" };
        }
      return { code: SPAN_STATUS_ERROR, message: "unknown_error" };
    }
    function setHttpStatus(span, httpStatus) {
      span.setAttribute("http.response.status_code", httpStatus);
      let spanStatus = getSpanStatusFromHttpCode(httpStatus);
      spanStatus.message !== "unknown_error" && span.setStatus(spanStatus);
    }
    exports.SPAN_STATUS_ERROR = SPAN_STATUS_ERROR;
    exports.SPAN_STATUS_OK = SPAN_STATUS_OK;
    exports.SPAN_STATUS_UNSET = SPAN_STATUS_UNSET;
    exports.getSpanStatusFromHttpCode = getSpanStatusFromHttpCode;
    exports.setHttpStatus = setHttpStatus;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/spanUtils.js
var require_spanUtils = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/spanUtils.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), index = require_asyncContext(), carrier = require_carrier(), currentScopes = require_currentScopes(), metricSummary = require_metric_summary(), semanticAttributes = require_semanticAttributes(), spanstatus = require_spanstatus(), spanOnScope = require_spanOnScope(), TRACE_FLAG_NONE = 0, TRACE_FLAG_SAMPLED = 1;
    function spanToTransactionTraceContext(span) {
      let { spanId: span_id, traceId: trace_id } = span.spanContext(), { data, op, parent_span_id, status, origin } = spanToJSON(span);
      return utils.dropUndefinedKeys({
        parent_span_id,
        span_id,
        trace_id,
        data,
        op,
        status,
        origin
      });
    }
    function spanToTraceContext(span) {
      let { spanId: span_id, traceId: trace_id } = span.spanContext(), { parent_span_id } = spanToJSON(span);
      return utils.dropUndefinedKeys({ parent_span_id, span_id, trace_id });
    }
    function spanToTraceHeader(span) {
      let { traceId, spanId } = span.spanContext(), sampled = spanIsSampled(span);
      return utils.generateSentryTraceHeader(traceId, spanId, sampled);
    }
    function spanTimeInputToSeconds(input) {
      return typeof input == "number" ? ensureTimestampInSeconds(input) : Array.isArray(input) ? input[0] + input[1] / 1e9 : input instanceof Date ? ensureTimestampInSeconds(input.getTime()) : utils.timestampInSeconds();
    }
    function ensureTimestampInSeconds(timestamp) {
      return timestamp > 9999999999 ? timestamp / 1e3 : timestamp;
    }
    function spanToJSON(span) {
      if (spanIsSentrySpan(span))
        return span.getSpanJSON();
      try {
        let { spanId: span_id, traceId: trace_id } = span.spanContext();
        if (spanIsOpenTelemetrySdkTraceBaseSpan(span)) {
          let { attributes, startTime, name, endTime, parentSpanId, status } = span;
          return utils.dropUndefinedKeys({
            span_id,
            trace_id,
            data: attributes,
            description: name,
            parent_span_id: parentSpanId,
            start_timestamp: spanTimeInputToSeconds(startTime),
            // This is [0,0] by default in OTEL, in which case we want to interpret this as no end time
            timestamp: spanTimeInputToSeconds(endTime) || void 0,
            status: getStatusMessage(status),
            op: attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_OP],
            origin: attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN],
            _metrics_summary: metricSummary.getMetricSummaryJsonForSpan(span)
          });
        }
        return {
          span_id,
          trace_id
        };
      } catch {
        return {};
      }
    }
    function spanIsOpenTelemetrySdkTraceBaseSpan(span) {
      let castSpan = span;
      return !!castSpan.attributes && !!castSpan.startTime && !!castSpan.name && !!castSpan.endTime && !!castSpan.status;
    }
    function spanIsSentrySpan(span) {
      return typeof span.getSpanJSON == "function";
    }
    function spanIsSampled(span) {
      let { traceFlags } = span.spanContext();
      return traceFlags === TRACE_FLAG_SAMPLED;
    }
    function getStatusMessage(status) {
      if (!(!status || status.code === spanstatus.SPAN_STATUS_UNSET))
        return status.code === spanstatus.SPAN_STATUS_OK ? "ok" : status.message || "unknown_error";
    }
    var CHILD_SPANS_FIELD = "_sentryChildSpans", ROOT_SPAN_FIELD = "_sentryRootSpan";
    function addChildSpanToSpan(span, childSpan) {
      let rootSpan = span[ROOT_SPAN_FIELD] || span;
      utils.addNonEnumerableProperty(childSpan, ROOT_SPAN_FIELD, rootSpan), span[CHILD_SPANS_FIELD] ? span[CHILD_SPANS_FIELD].add(childSpan) : utils.addNonEnumerableProperty(span, CHILD_SPANS_FIELD, /* @__PURE__ */ new Set([childSpan]));
    }
    function removeChildSpanFromSpan(span, childSpan) {
      span[CHILD_SPANS_FIELD] && span[CHILD_SPANS_FIELD].delete(childSpan);
    }
    function getSpanDescendants(span) {
      let resultSet = /* @__PURE__ */ new Set();
      function addSpanChildren(span2) {
        if (!resultSet.has(span2) && spanIsSampled(span2)) {
          resultSet.add(span2);
          let childSpans = span2[CHILD_SPANS_FIELD] ? Array.from(span2[CHILD_SPANS_FIELD]) : [];
          for (let childSpan of childSpans)
            addSpanChildren(childSpan);
        }
      }
      return addSpanChildren(span), Array.from(resultSet);
    }
    function getRootSpan(span) {
      return span[ROOT_SPAN_FIELD] || span;
    }
    function getActiveSpan() {
      let carrier$1 = carrier.getMainCarrier(), acs = index.getAsyncContextStrategy(carrier$1);
      return acs.getActiveSpan ? acs.getActiveSpan() : spanOnScope._getSpanForScope(currentScopes.getCurrentScope());
    }
    function updateMetricSummaryOnActiveSpan(metricType, sanitizedName, value, unit, tags, bucketKey) {
      let span = getActiveSpan();
      span && metricSummary.updateMetricSummaryOnSpan(span, metricType, sanitizedName, value, unit, tags, bucketKey);
    }
    exports.TRACE_FLAG_NONE = TRACE_FLAG_NONE;
    exports.TRACE_FLAG_SAMPLED = TRACE_FLAG_SAMPLED;
    exports.addChildSpanToSpan = addChildSpanToSpan;
    exports.getActiveSpan = getActiveSpan;
    exports.getRootSpan = getRootSpan;
    exports.getSpanDescendants = getSpanDescendants;
    exports.getStatusMessage = getStatusMessage;
    exports.removeChildSpanFromSpan = removeChildSpanFromSpan;
    exports.spanIsSampled = spanIsSampled;
    exports.spanTimeInputToSeconds = spanTimeInputToSeconds;
    exports.spanToJSON = spanToJSON;
    exports.spanToTraceContext = spanToTraceContext;
    exports.spanToTraceHeader = spanToTraceHeader;
    exports.spanToTransactionTraceContext = spanToTransactionTraceContext;
    exports.updateMetricSummaryOnActiveSpan = updateMetricSummaryOnActiveSpan;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/errors.js
var require_errors = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/errors.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), debugBuild = require_debug_build2(), spanUtils = require_spanUtils(), spanstatus = require_spanstatus(), errorsInstrumented = !1;
    function registerSpanErrorInstrumentation() {
      errorsInstrumented || (errorsInstrumented = !0, utils.addGlobalErrorInstrumentationHandler(errorCallback), utils.addGlobalUnhandledRejectionInstrumentationHandler(errorCallback));
    }
    function errorCallback() {
      let activeSpan = spanUtils.getActiveSpan(), rootSpan = activeSpan && spanUtils.getRootSpan(activeSpan);
      if (rootSpan) {
        let message = "internal_error";
        debugBuild.DEBUG_BUILD && utils.logger.log(`[Tracing] Root span: ${message} -> Global error occured`), rootSpan.setStatus({ code: spanstatus.SPAN_STATUS_ERROR, message });
      }
    }
    errorCallback.tag = "sentry_tracingErrorCallback";
    exports.registerSpanErrorInstrumentation = registerSpanErrorInstrumentation;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/utils.js
var require_utils = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/utils.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), SCOPE_ON_START_SPAN_FIELD = "_sentryScope", ISOLATION_SCOPE_ON_START_SPAN_FIELD = "_sentryIsolationScope";
    function setCapturedScopesOnSpan(span, scope, isolationScope) {
      span && (utils.addNonEnumerableProperty(span, ISOLATION_SCOPE_ON_START_SPAN_FIELD, isolationScope), utils.addNonEnumerableProperty(span, SCOPE_ON_START_SPAN_FIELD, scope));
    }
    function getCapturedScopesOnSpan(span) {
      return {
        scope: span[SCOPE_ON_START_SPAN_FIELD],
        isolationScope: span[ISOLATION_SCOPE_ON_START_SPAN_FIELD]
      };
    }
    exports.stripUrlQueryAndFragment = utils.stripUrlQueryAndFragment;
    exports.getCapturedScopesOnSpan = getCapturedScopesOnSpan;
    exports.setCapturedScopesOnSpan = setCapturedScopesOnSpan;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/hubextensions.js
var require_hubextensions = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/hubextensions.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var errors = require_errors();
    function addTracingExtensions() {
      errors.registerSpanErrorInstrumentation();
    }
    exports.addTracingExtensions = addTracingExtensions;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/hasTracingEnabled.js
var require_hasTracingEnabled = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/hasTracingEnabled.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var currentScopes = require_currentScopes();
    function hasTracingEnabled(maybeOptions) {
      if (typeof __SENTRY_TRACING__ == "boolean" && !__SENTRY_TRACING__)
        return !1;
      let options = maybeOptions || getClientOptions();
      return !!options && (options.enableTracing || "tracesSampleRate" in options || "tracesSampler" in options);
    }
    function getClientOptions() {
      let client = currentScopes.getClient();
      return client && client.getOptions();
    }
    exports.hasTracingEnabled = hasTracingEnabled;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/sentryNonRecordingSpan.js
var require_sentryNonRecordingSpan = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/sentryNonRecordingSpan.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), spanUtils = require_spanUtils(), SentryNonRecordingSpan = class {
      constructor(spanContext = {}) {
        this._traceId = spanContext.traceId || utils.uuid4(), this._spanId = spanContext.spanId || utils.uuid4().substring(16);
      }
      /** @inheritdoc */
      spanContext() {
        return {
          spanId: this._spanId,
          traceId: this._traceId,
          traceFlags: spanUtils.TRACE_FLAG_NONE
        };
      }
      /** @inheritdoc */
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      end(_timestamp) {
      }
      /** @inheritdoc */
      setAttribute(_key, _value) {
        return this;
      }
      /** @inheritdoc */
      setAttributes(_values) {
        return this;
      }
      /** @inheritdoc */
      setStatus(_status) {
        return this;
      }
      /** @inheritdoc */
      updateName(_name) {
        return this;
      }
      /** @inheritdoc */
      isRecording() {
        return !1;
      }
      /** @inheritdoc */
      addEvent(_name, _attributesOrStartTime, _startTime) {
        return this;
      }
    };
    exports.SentryNonRecordingSpan = SentryNonRecordingSpan;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/handleCallbackErrors.js
var require_handleCallbackErrors = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/handleCallbackErrors.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs();
    function handleCallbackErrors(fn, onError, onFinally = () => {
    }) {
      let maybePromiseResult;
      try {
        maybePromiseResult = fn();
      } catch (e) {
        throw onError(e), onFinally(), e;
      }
      return maybeHandlePromiseRejection(maybePromiseResult, onError, onFinally);
    }
    function maybeHandlePromiseRejection(value, onError, onFinally) {
      return utils.isThenable(value) ? value.then(
        (res) => (onFinally(), res),
        (e) => {
          throw onError(e), onFinally(), e;
        }
      ) : (onFinally(), value);
    }
    exports.handleCallbackErrors = handleCallbackErrors;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/constants.js
var require_constants = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/constants.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var DEFAULT_ENVIRONMENT = "production";
    exports.DEFAULT_ENVIRONMENT = DEFAULT_ENVIRONMENT;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/dynamicSamplingContext.js
var require_dynamicSamplingContext = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/dynamicSamplingContext.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), constants = require_constants(), currentScopes = require_currentScopes(), semanticAttributes = require_semanticAttributes(), spanUtils = require_spanUtils(), FROZEN_DSC_FIELD = "_frozenDsc";
    function freezeDscOnSpan(span, dsc) {
      let spanWithMaybeDsc = span;
      utils.addNonEnumerableProperty(spanWithMaybeDsc, FROZEN_DSC_FIELD, dsc);
    }
    function getDynamicSamplingContextFromClient(trace_id, client) {
      let options = client.getOptions(), { publicKey: public_key } = client.getDsn() || {}, dsc = utils.dropUndefinedKeys({
        environment: options.environment || constants.DEFAULT_ENVIRONMENT,
        release: options.release,
        public_key,
        trace_id
      });
      return client.emit("createDsc", dsc), dsc;
    }
    function getDynamicSamplingContextFromSpan(span) {
      let client = currentScopes.getClient();
      if (!client)
        return {};
      let dsc = getDynamicSamplingContextFromClient(spanUtils.spanToJSON(span).trace_id || "", client), rootSpan = spanUtils.getRootSpan(span);
      if (!rootSpan)
        return dsc;
      let frozenDsc = rootSpan[FROZEN_DSC_FIELD];
      if (frozenDsc)
        return frozenDsc;
      let jsonSpan = spanUtils.spanToJSON(rootSpan), attributes = jsonSpan.data || {}, maybeSampleRate = attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_SAMPLE_RATE];
      maybeSampleRate != null && (dsc.sample_rate = `${maybeSampleRate}`);
      let source = attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE];
      return source && source !== "url" && (dsc.transaction = jsonSpan.description), dsc.sampled = String(spanUtils.spanIsSampled(rootSpan)), client.emit("createDsc", dsc), dsc;
    }
    function spanToBaggageHeader(span) {
      let dsc = getDynamicSamplingContextFromSpan(span);
      return utils.dynamicSamplingContextToSentryBaggageHeader(dsc);
    }
    exports.freezeDscOnSpan = freezeDscOnSpan;
    exports.getDynamicSamplingContextFromClient = getDynamicSamplingContextFromClient;
    exports.getDynamicSamplingContextFromSpan = getDynamicSamplingContextFromSpan;
    exports.spanToBaggageHeader = spanToBaggageHeader;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/logSpans.js
var require_logSpans = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/logSpans.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), debugBuild = require_debug_build2(), spanUtils = require_spanUtils();
    function logSpanStart(span) {
      if (!debugBuild.DEBUG_BUILD) return;
      let { description = "< unknown name >", op = "< unknown op >", parent_span_id: parentSpanId } = spanUtils.spanToJSON(span), { spanId } = span.spanContext(), sampled = spanUtils.spanIsSampled(span), rootSpan = spanUtils.getRootSpan(span), isRootSpan = rootSpan === span, header = `[Tracing] Starting ${sampled ? "sampled" : "unsampled"} ${isRootSpan ? "root " : ""}span`, infoParts = [`op: ${op}`, `name: ${description}`, `ID: ${spanId}`];
      if (parentSpanId && infoParts.push(`parent ID: ${parentSpanId}`), !isRootSpan) {
        let { op: op2, description: description2 } = spanUtils.spanToJSON(rootSpan);
        infoParts.push(`root ID: ${rootSpan.spanContext().spanId}`), op2 && infoParts.push(`root op: ${op2}`), description2 && infoParts.push(`root description: ${description2}`);
      }
      utils.logger.log(`${header}
  ${infoParts.join(`
  `)}`);
    }
    function logSpanEnd(span) {
      if (!debugBuild.DEBUG_BUILD) return;
      let { description = "< unknown name >", op = "< unknown op >" } = spanUtils.spanToJSON(span), { spanId } = span.spanContext(), isRootSpan = spanUtils.getRootSpan(span) === span, msg = `[Tracing] Finishing "${op}" ${isRootSpan ? "root " : ""}span "${description}" with ID ${spanId}`;
      utils.logger.log(msg);
    }
    exports.logSpanEnd = logSpanEnd;
    exports.logSpanStart = logSpanStart;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/parseSampleRate.js
var require_parseSampleRate = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/parseSampleRate.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), debugBuild = require_debug_build2();
    function parseSampleRate(sampleRate) {
      if (typeof sampleRate == "boolean")
        return Number(sampleRate);
      let rate = typeof sampleRate == "string" ? parseFloat(sampleRate) : sampleRate;
      if (typeof rate != "number" || isNaN(rate) || rate < 0 || rate > 1) {
        debugBuild.DEBUG_BUILD && utils.logger.warn(
          `[Tracing] Given sample rate is invalid. Sample rate must be a boolean or a number between 0 and 1. Got ${JSON.stringify(
            sampleRate
          )} of type ${JSON.stringify(typeof sampleRate)}.`
        );
        return;
      }
      return rate;
    }
    exports.parseSampleRate = parseSampleRate;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/sampling.js
var require_sampling = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/sampling.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), debugBuild = require_debug_build2(), hasTracingEnabled = require_hasTracingEnabled(), parseSampleRate = require_parseSampleRate();
    function sampleSpan(options, samplingContext) {
      if (!hasTracingEnabled.hasTracingEnabled(options))
        return [!1];
      let sampleRate;
      typeof options.tracesSampler == "function" ? sampleRate = options.tracesSampler(samplingContext) : samplingContext.parentSampled !== void 0 ? sampleRate = samplingContext.parentSampled : typeof options.tracesSampleRate < "u" ? sampleRate = options.tracesSampleRate : sampleRate = 1;
      let parsedSampleRate = parseSampleRate.parseSampleRate(sampleRate);
      return parsedSampleRate === void 0 ? (debugBuild.DEBUG_BUILD && utils.logger.warn("[Tracing] Discarding transaction because of invalid sample rate."), [!1]) : parsedSampleRate ? Math.random() < parsedSampleRate ? [!0, parsedSampleRate] : (debugBuild.DEBUG_BUILD && utils.logger.log(
        `[Tracing] Discarding transaction because it's not included in the random sample (sampling rate = ${Number(
          sampleRate
        )})`
      ), [!1, parsedSampleRate]) : (debugBuild.DEBUG_BUILD && utils.logger.log(
        `[Tracing] Discarding transaction because ${typeof options.tracesSampler == "function" ? "tracesSampler returned 0 or false" : "a negative sampling decision was inherited or tracesSampleRate is set to 0"}`
      ), [!1, parsedSampleRate]);
    }
    exports.sampleSpan = sampleSpan;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/envelope.js
var require_envelope2 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/envelope.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), dynamicSamplingContext = require_dynamicSamplingContext(), spanUtils = require_spanUtils();
    function enhanceEventWithSdkInfo(event, sdkInfo) {
      return sdkInfo && (event.sdk = event.sdk || {}, event.sdk.name = event.sdk.name || sdkInfo.name, event.sdk.version = event.sdk.version || sdkInfo.version, event.sdk.integrations = [...event.sdk.integrations || [], ...sdkInfo.integrations || []], event.sdk.packages = [...event.sdk.packages || [], ...sdkInfo.packages || []]), event;
    }
    function createSessionEnvelope(session, dsn, metadata, tunnel) {
      let sdkInfo = utils.getSdkMetadataForEnvelopeHeader(metadata), envelopeHeaders = {
        sent_at: (/* @__PURE__ */ new Date()).toISOString(),
        ...sdkInfo && { sdk: sdkInfo },
        ...!!tunnel && dsn && { dsn: utils.dsnToString(dsn) }
      }, envelopeItem = "aggregates" in session ? [{ type: "sessions" }, session] : [{ type: "session" }, session.toJSON()];
      return utils.createEnvelope(envelopeHeaders, [envelopeItem]);
    }
    function createEventEnvelope(event, dsn, metadata, tunnel) {
      let sdkInfo = utils.getSdkMetadataForEnvelopeHeader(metadata), eventType = event.type && event.type !== "replay_event" ? event.type : "event";
      enhanceEventWithSdkInfo(event, metadata && metadata.sdk);
      let envelopeHeaders = utils.createEventEnvelopeHeaders(event, sdkInfo, tunnel, dsn);
      delete event.sdkProcessingMetadata;
      let eventItem = [{ type: eventType }, event];
      return utils.createEnvelope(envelopeHeaders, [eventItem]);
    }
    function createSpanEnvelope(spans, client) {
      function dscHasRequiredProps(dsc2) {
        return !!dsc2.trace_id && !!dsc2.public_key;
      }
      let dsc = dynamicSamplingContext.getDynamicSamplingContextFromSpan(spans[0]), dsn = client && client.getDsn(), tunnel = client && client.getOptions().tunnel, headers = {
        sent_at: (/* @__PURE__ */ new Date()).toISOString(),
        ...dscHasRequiredProps(dsc) && { trace: dsc },
        ...!!tunnel && dsn && { dsn: utils.dsnToString(dsn) }
      }, beforeSendSpan = client && client.getOptions().beforeSendSpan, convertToSpanJSON = beforeSendSpan ? (span) => beforeSendSpan(spanUtils.spanToJSON(span)) : (span) => spanUtils.spanToJSON(span), items = [];
      for (let span of spans) {
        let spanJson = convertToSpanJSON(span);
        spanJson && items.push(utils.createSpanEnvelopeItem(spanJson));
      }
      return utils.createEnvelope(headers, items);
    }
    exports.createEventEnvelope = createEventEnvelope;
    exports.createSessionEnvelope = createSessionEnvelope;
    exports.createSpanEnvelope = createSpanEnvelope;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/measurement.js
var require_measurement = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/measurement.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var semanticAttributes = require_semanticAttributes(), spanUtils = require_spanUtils();
    function setMeasurement(name, value, unit) {
      let activeSpan = spanUtils.getActiveSpan(), rootSpan = activeSpan && spanUtils.getRootSpan(activeSpan);
      rootSpan && rootSpan.addEvent(name, {
        [semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_VALUE]: value,
        [semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_UNIT]: unit
      });
    }
    function timedEventsToMeasurements(events) {
      if (!events || events.length === 0)
        return;
      let measurements = {};
      return events.forEach((event) => {
        let attributes = event.attributes || {}, unit = attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_UNIT], value = attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_VALUE];
        typeof unit == "string" && typeof value == "number" && (measurements[event.name] = { value, unit });
      }), measurements;
    }
    exports.setMeasurement = setMeasurement;
    exports.timedEventsToMeasurements = timedEventsToMeasurements;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/sentrySpan.js
var require_sentrySpan = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/sentrySpan.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), debugBuild = require_debug_build2(), envelope = require_envelope2(), metricSummary = require_metric_summary(), semanticAttributes = require_semanticAttributes(), spanUtils = require_spanUtils(), dynamicSamplingContext = require_dynamicSamplingContext(), logSpans = require_logSpans(), measurement = require_measurement(), utils$1 = require_utils(), MAX_SPAN_COUNT = 1e3, SentrySpan = class {
      /** Epoch timestamp in seconds when the span started. */
      /** Epoch timestamp in seconds when the span ended. */
      /** Internal keeper of the status */
      /** The timed events added to this span. */
      /** if true, treat span as a standalone span (not part of a transaction) */
      /**
       * You should never call the constructor manually, always use `Sentry.startSpan()`
       * or other span methods.
       * @internal
       * @hideconstructor
       * @hidden
       */
      constructor(spanContext = {}) {
        this._traceId = spanContext.traceId || utils.uuid4(), this._spanId = spanContext.spanId || utils.uuid4().substring(16), this._startTime = spanContext.startTimestamp || utils.timestampInSeconds(), this._attributes = {}, this.setAttributes({
          [semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: "manual",
          [semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_OP]: spanContext.op,
          ...spanContext.attributes
        }), this._name = spanContext.name, spanContext.parentSpanId && (this._parentSpanId = spanContext.parentSpanId), "sampled" in spanContext && (this._sampled = spanContext.sampled), spanContext.endTimestamp && (this._endTime = spanContext.endTimestamp), this._events = [], this._isStandaloneSpan = spanContext.isStandalone, this._endTime && this._onSpanEnded();
      }
      /** @inheritdoc */
      spanContext() {
        let { _spanId: spanId, _traceId: traceId, _sampled: sampled } = this;
        return {
          spanId,
          traceId,
          traceFlags: sampled ? spanUtils.TRACE_FLAG_SAMPLED : spanUtils.TRACE_FLAG_NONE
        };
      }
      /** @inheritdoc */
      setAttribute(key, value) {
        value === void 0 ? delete this._attributes[key] : this._attributes[key] = value;
      }
      /** @inheritdoc */
      setAttributes(attributes) {
        Object.keys(attributes).forEach((key) => this.setAttribute(key, attributes[key]));
      }
      /**
       * This should generally not be used,
       * but we need it for browser tracing where we want to adjust the start time afterwards.
       * USE THIS WITH CAUTION!
       *
       * @hidden
       * @internal
       */
      updateStartTime(timeInput) {
        this._startTime = spanUtils.spanTimeInputToSeconds(timeInput);
      }
      /**
       * @inheritDoc
       */
      setStatus(value) {
        return this._status = value, this;
      }
      /**
       * @inheritDoc
       */
      updateName(name) {
        return this._name = name, this;
      }
      /** @inheritdoc */
      end(endTimestamp) {
        this._endTime || (this._endTime = spanUtils.spanTimeInputToSeconds(endTimestamp), logSpans.logSpanEnd(this), this._onSpanEnded());
      }
      /**
       * Get JSON representation of this span.
       *
       * @hidden
       * @internal This method is purely for internal purposes and should not be used outside
       * of SDK code. If you need to get a JSON representation of a span,
       * use `spanToJSON(span)` instead.
       */
      getSpanJSON() {
        return utils.dropUndefinedKeys({
          data: this._attributes,
          description: this._name,
          op: this._attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_OP],
          parent_span_id: this._parentSpanId,
          span_id: this._spanId,
          start_timestamp: this._startTime,
          status: spanUtils.getStatusMessage(this._status),
          timestamp: this._endTime,
          trace_id: this._traceId,
          origin: this._attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN],
          _metrics_summary: metricSummary.getMetricSummaryJsonForSpan(this),
          profile_id: this._attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_PROFILE_ID],
          exclusive_time: this._attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_EXCLUSIVE_TIME],
          measurements: measurement.timedEventsToMeasurements(this._events),
          is_segment: this._isStandaloneSpan && spanUtils.getRootSpan(this) === this || void 0,
          segment_id: this._isStandaloneSpan ? spanUtils.getRootSpan(this).spanContext().spanId : void 0
        });
      }
      /** @inheritdoc */
      isRecording() {
        return !this._endTime && !!this._sampled;
      }
      /**
       * @inheritdoc
       */
      addEvent(name, attributesOrStartTime, startTime) {
        debugBuild.DEBUG_BUILD && utils.logger.log("[Tracing] Adding an event to span:", name);
        let time = isSpanTimeInput(attributesOrStartTime) ? attributesOrStartTime : startTime || utils.timestampInSeconds(), attributes = isSpanTimeInput(attributesOrStartTime) ? {} : attributesOrStartTime || {}, event = {
          name,
          time: spanUtils.spanTimeInputToSeconds(time),
          attributes
        };
        return this._events.push(event), this;
      }
      /**
       * This method should generally not be used,
       * but for now we need a way to publicly check if the `_isStandaloneSpan` flag is set.
       * USE THIS WITH CAUTION!
       * @internal
       * @hidden
       * @experimental
       */
      isStandaloneSpan() {
        return !!this._isStandaloneSpan;
      }
      /** Emit `spanEnd` when the span is ended. */
      _onSpanEnded() {
        let client = currentScopes.getClient();
        if (client && client.emit("spanEnd", this), !(this._isStandaloneSpan || this === spanUtils.getRootSpan(this)))
          return;
        if (this._isStandaloneSpan) {
          sendSpanEnvelope(envelope.createSpanEnvelope([this], client));
          return;
        }
        let transactionEvent = this._convertSpanToTransaction();
        transactionEvent && (utils$1.getCapturedScopesOnSpan(this).scope || currentScopes.getCurrentScope()).captureEvent(transactionEvent);
      }
      /**
       * Finish the transaction & prepare the event to send to Sentry.
       */
      _convertSpanToTransaction() {
        if (!isFullFinishedSpan(spanUtils.spanToJSON(this)))
          return;
        this._name || (debugBuild.DEBUG_BUILD && utils.logger.warn("Transaction has no name, falling back to `<unlabeled transaction>`."), this._name = "<unlabeled transaction>");
        let { scope: capturedSpanScope, isolationScope: capturedSpanIsolationScope } = utils$1.getCapturedScopesOnSpan(this), client = (capturedSpanScope || currentScopes.getCurrentScope()).getClient() || currentScopes.getClient();
        if (this._sampled !== !0) {
          debugBuild.DEBUG_BUILD && utils.logger.log("[Tracing] Discarding transaction because its trace was not chosen to be sampled."), client && client.recordDroppedEvent("sample_rate", "transaction");
          return;
        }
        let spans = spanUtils.getSpanDescendants(this).filter((span) => span !== this && !isStandaloneSpan(span)).map((span) => spanUtils.spanToJSON(span)).filter(isFullFinishedSpan), source = this._attributes[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE], transaction = {
          contexts: {
            trace: spanUtils.spanToTransactionTraceContext(this)
          },
          spans: (
            // spans.sort() mutates the array, but `spans` is already a copy so we can safely do this here
            // we do not use spans anymore after this point
            spans.length > MAX_SPAN_COUNT ? spans.sort((a, b) => a.start_timestamp - b.start_timestamp).slice(0, MAX_SPAN_COUNT) : spans
          ),
          start_timestamp: this._startTime,
          timestamp: this._endTime,
          transaction: this._name,
          type: "transaction",
          sdkProcessingMetadata: {
            capturedSpanScope,
            capturedSpanIsolationScope,
            ...utils.dropUndefinedKeys({
              dynamicSamplingContext: dynamicSamplingContext.getDynamicSamplingContextFromSpan(this)
            })
          },
          _metrics_summary: metricSummary.getMetricSummaryJsonForSpan(this),
          ...source && {
            transaction_info: {
              source
            }
          }
        }, measurements = measurement.timedEventsToMeasurements(this._events);
        return measurements && Object.keys(measurements).length && (debugBuild.DEBUG_BUILD && utils.logger.log(
          "[Measurements] Adding measurements to transaction event",
          JSON.stringify(measurements, void 0, 2)
        ), transaction.measurements = measurements), transaction;
      }
    };
    function isSpanTimeInput(value) {
      return value && typeof value == "number" || value instanceof Date || Array.isArray(value);
    }
    function isFullFinishedSpan(input) {
      return !!input.start_timestamp && !!input.timestamp && !!input.span_id && !!input.trace_id;
    }
    function isStandaloneSpan(span) {
      return span instanceof SentrySpan && span.isStandaloneSpan();
    }
    function sendSpanEnvelope(envelope2) {
      let client = currentScopes.getClient();
      if (!client)
        return;
      let spanItems = envelope2[1];
      if (!spanItems || spanItems.length === 0) {
        client.recordDroppedEvent("before_send", "span");
        return;
      }
      let transport = client.getTransport();
      transport && transport.send(envelope2).then(null, (reason) => {
        debugBuild.DEBUG_BUILD && utils.logger.error("Error while sending span:", reason);
      });
    }
    exports.SentrySpan = SentrySpan;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/trace.js
var require_trace = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/trace.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), carrier = require_carrier(), currentScopes = require_currentScopes(), index = require_asyncContext(), debugBuild = require_debug_build2(), semanticAttributes = require_semanticAttributes(), handleCallbackErrors = require_handleCallbackErrors(), hasTracingEnabled = require_hasTracingEnabled(), spanOnScope = require_spanOnScope(), spanUtils = require_spanUtils(), dynamicSamplingContext = require_dynamicSamplingContext(), logSpans = require_logSpans(), sampling = require_sampling(), sentryNonRecordingSpan = require_sentryNonRecordingSpan(), sentrySpan = require_sentrySpan(), spanstatus = require_spanstatus(), utils$1 = require_utils(), SUPPRESS_TRACING_KEY = "__SENTRY_SUPPRESS_TRACING__";
    function startSpan(context, callback) {
      let acs = getAcs();
      if (acs.startSpan)
        return acs.startSpan(context, callback);
      let spanContext = normalizeContext(context);
      return currentScopes.withScope(context.scope, (scope) => {
        let parentSpan = getParentSpan(scope), activeSpan = context.onlyIfParent && !parentSpan ? new sentryNonRecordingSpan.SentryNonRecordingSpan() : createChildOrRootSpan({
          parentSpan,
          spanContext,
          forceTransaction: context.forceTransaction,
          scope
        });
        return spanOnScope._setSpanForScope(scope, activeSpan), handleCallbackErrors.handleCallbackErrors(
          () => callback(activeSpan),
          () => {
            let { status } = spanUtils.spanToJSON(activeSpan);
            activeSpan.isRecording() && (!status || status === "ok") && activeSpan.setStatus({ code: spanstatus.SPAN_STATUS_ERROR, message: "internal_error" });
          },
          () => activeSpan.end()
        );
      });
    }
    function startSpanManual(context, callback) {
      let acs = getAcs();
      if (acs.startSpanManual)
        return acs.startSpanManual(context, callback);
      let spanContext = normalizeContext(context);
      return currentScopes.withScope(context.scope, (scope) => {
        let parentSpan = getParentSpan(scope), activeSpan = context.onlyIfParent && !parentSpan ? new sentryNonRecordingSpan.SentryNonRecordingSpan() : createChildOrRootSpan({
          parentSpan,
          spanContext,
          forceTransaction: context.forceTransaction,
          scope
        });
        spanOnScope._setSpanForScope(scope, activeSpan);
        function finishAndSetSpan() {
          activeSpan.end();
        }
        return handleCallbackErrors.handleCallbackErrors(
          () => callback(activeSpan, finishAndSetSpan),
          () => {
            let { status } = spanUtils.spanToJSON(activeSpan);
            activeSpan.isRecording() && (!status || status === "ok") && activeSpan.setStatus({ code: spanstatus.SPAN_STATUS_ERROR, message: "internal_error" });
          }
        );
      });
    }
    function startInactiveSpan(context) {
      let acs = getAcs();
      if (acs.startInactiveSpan)
        return acs.startInactiveSpan(context);
      let spanContext = normalizeContext(context), scope = context.scope || currentScopes.getCurrentScope(), parentSpan = getParentSpan(scope);
      return context.onlyIfParent && !parentSpan ? new sentryNonRecordingSpan.SentryNonRecordingSpan() : createChildOrRootSpan({
        parentSpan,
        spanContext,
        forceTransaction: context.forceTransaction,
        scope
      });
    }
    var continueTrace = ({
      sentryTrace,
      baggage
    }, callback) => currentScopes.withScope((scope) => {
      let propagationContext = utils.propagationContextFromHeaders(sentryTrace, baggage);
      return scope.setPropagationContext(propagationContext), callback();
    });
    function withActiveSpan(span, callback) {
      let acs = getAcs();
      return acs.withActiveSpan ? acs.withActiveSpan(span, callback) : currentScopes.withScope((scope) => (spanOnScope._setSpanForScope(scope, span || void 0), callback(scope)));
    }
    function suppressTracing(callback) {
      let acs = getAcs();
      return acs.suppressTracing ? acs.suppressTracing(callback) : currentScopes.withScope((scope) => (scope.setSDKProcessingMetadata({ [SUPPRESS_TRACING_KEY]: !0 }), callback()));
    }
    function startNewTrace(callback) {
      return currentScopes.withScope((scope) => (scope.setPropagationContext(utils.generatePropagationContext()), debugBuild.DEBUG_BUILD && utils.logger.info(`Starting a new trace with id ${scope.getPropagationContext().traceId}`), withActiveSpan(null, callback)));
    }
    function createChildOrRootSpan({
      parentSpan,
      spanContext,
      forceTransaction,
      scope
    }) {
      if (!hasTracingEnabled.hasTracingEnabled())
        return new sentryNonRecordingSpan.SentryNonRecordingSpan();
      let isolationScope = currentScopes.getIsolationScope(), span;
      if (parentSpan && !forceTransaction)
        span = _startChildSpan(parentSpan, scope, spanContext), spanUtils.addChildSpanToSpan(parentSpan, span);
      else if (parentSpan) {
        let dsc = dynamicSamplingContext.getDynamicSamplingContextFromSpan(parentSpan), { traceId, spanId: parentSpanId } = parentSpan.spanContext(), parentSampled = spanUtils.spanIsSampled(parentSpan);
        span = _startRootSpan(
          {
            traceId,
            parentSpanId,
            ...spanContext
          },
          scope,
          parentSampled
        ), dynamicSamplingContext.freezeDscOnSpan(span, dsc);
      } else {
        let {
          traceId,
          dsc,
          parentSpanId,
          sampled: parentSampled
        } = {
          ...isolationScope.getPropagationContext(),
          ...scope.getPropagationContext()
        };
        span = _startRootSpan(
          {
            traceId,
            parentSpanId,
            ...spanContext
          },
          scope,
          parentSampled
        ), dsc && dynamicSamplingContext.freezeDscOnSpan(span, dsc);
      }
      return logSpans.logSpanStart(span), utils$1.setCapturedScopesOnSpan(span, scope, isolationScope), span;
    }
    function normalizeContext(context) {
      let initialCtx = {
        isStandalone: (context.experimental || {}).standalone,
        ...context
      };
      if (context.startTime) {
        let ctx = { ...initialCtx };
        return ctx.startTimestamp = spanUtils.spanTimeInputToSeconds(context.startTime), delete ctx.startTime, ctx;
      }
      return initialCtx;
    }
    function getAcs() {
      let carrier$1 = carrier.getMainCarrier();
      return index.getAsyncContextStrategy(carrier$1);
    }
    function _startRootSpan(spanArguments, scope, parentSampled) {
      let client = currentScopes.getClient(), options = client && client.getOptions() || {}, { name = "", attributes } = spanArguments, [sampled, sampleRate] = scope.getScopeData().sdkProcessingMetadata[SUPPRESS_TRACING_KEY] ? [!1] : sampling.sampleSpan(options, {
        name,
        parentSampled,
        attributes,
        transactionContext: {
          name,
          parentSampled
        }
      }), rootSpan = new sentrySpan.SentrySpan({
        ...spanArguments,
        attributes: {
          [semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: "custom",
          ...spanArguments.attributes
        },
        sampled
      });
      return sampleRate !== void 0 && rootSpan.setAttribute(semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_SAMPLE_RATE, sampleRate), client && client.emit("spanStart", rootSpan), rootSpan;
    }
    function _startChildSpan(parentSpan, scope, spanArguments) {
      let { spanId, traceId } = parentSpan.spanContext(), sampled = scope.getScopeData().sdkProcessingMetadata[SUPPRESS_TRACING_KEY] ? !1 : spanUtils.spanIsSampled(parentSpan), childSpan = sampled ? new sentrySpan.SentrySpan({
        ...spanArguments,
        parentSpanId: spanId,
        traceId,
        sampled
      }) : new sentryNonRecordingSpan.SentryNonRecordingSpan({ traceId });
      spanUtils.addChildSpanToSpan(parentSpan, childSpan);
      let client = currentScopes.getClient();
      return client && (client.emit("spanStart", childSpan), spanArguments.endTimestamp && client.emit("spanEnd", childSpan)), childSpan;
    }
    function getParentSpan(scope) {
      let span = spanOnScope._getSpanForScope(scope);
      if (!span)
        return;
      let client = currentScopes.getClient();
      return (client ? client.getOptions() : {}).parentSpanIsAlwaysRootSpan ? spanUtils.getRootSpan(span) : span;
    }
    exports.continueTrace = continueTrace;
    exports.startInactiveSpan = startInactiveSpan;
    exports.startNewTrace = startNewTrace;
    exports.startSpan = startSpan;
    exports.startSpanManual = startSpanManual;
    exports.suppressTracing = suppressTracing;
    exports.withActiveSpan = withActiveSpan;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/idleSpan.js
var require_idleSpan = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/tracing/idleSpan.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), debugBuild = require_debug_build2(), semanticAttributes = require_semanticAttributes(), hasTracingEnabled = require_hasTracingEnabled(), spanOnScope = require_spanOnScope(), spanUtils = require_spanUtils(), sentryNonRecordingSpan = require_sentryNonRecordingSpan(), spanstatus = require_spanstatus(), trace = require_trace(), TRACING_DEFAULTS = {
      idleTimeout: 1e3,
      finalTimeout: 3e4,
      childSpanTimeout: 15e3
    }, FINISH_REASON_HEARTBEAT_FAILED = "heartbeatFailed", FINISH_REASON_IDLE_TIMEOUT = "idleTimeout", FINISH_REASON_FINAL_TIMEOUT = "finalTimeout", FINISH_REASON_EXTERNAL_FINISH = "externalFinish";
    function startIdleSpan(startSpanOptions, options = {}) {
      let activities = /* @__PURE__ */ new Map(), _finished = !1, _idleTimeoutID, _finishReason = FINISH_REASON_EXTERNAL_FINISH, _autoFinishAllowed = !options.disableAutoFinish, {
        idleTimeout = TRACING_DEFAULTS.idleTimeout,
        finalTimeout = TRACING_DEFAULTS.finalTimeout,
        childSpanTimeout = TRACING_DEFAULTS.childSpanTimeout,
        beforeSpanEnd
      } = options, client = currentScopes.getClient();
      if (!client || !hasTracingEnabled.hasTracingEnabled())
        return new sentryNonRecordingSpan.SentryNonRecordingSpan();
      let scope = currentScopes.getCurrentScope(), previousActiveSpan = spanUtils.getActiveSpan(), span = _startIdleSpan(startSpanOptions);
      span.end = new Proxy(span.end, {
        apply(target, thisArg, args) {
          beforeSpanEnd && beforeSpanEnd(span);
          let [definedEndTimestamp, ...rest] = args, timestamp = definedEndTimestamp || utils.timestampInSeconds(), spanEndTimestamp = spanUtils.spanTimeInputToSeconds(timestamp), spans = spanUtils.getSpanDescendants(span).filter((child) => child !== span);
          if (!spans.length)
            return onIdleSpanEnded(spanEndTimestamp), Reflect.apply(target, thisArg, [spanEndTimestamp, ...rest]);
          let childEndTimestamps = spans.map((span2) => spanUtils.spanToJSON(span2).timestamp).filter((timestamp2) => !!timestamp2), latestSpanEndTimestamp = childEndTimestamps.length ? Math.max(...childEndTimestamps) : void 0, spanStartTimestamp = spanUtils.spanToJSON(span).start_timestamp, endTimestamp = Math.min(
            spanStartTimestamp ? spanStartTimestamp + finalTimeout / 1e3 : 1 / 0,
            Math.max(spanStartTimestamp || -1 / 0, Math.min(spanEndTimestamp, latestSpanEndTimestamp || 1 / 0))
          );
          return onIdleSpanEnded(endTimestamp), Reflect.apply(target, thisArg, [endTimestamp, ...rest]);
        }
      });
      function _cancelIdleTimeout() {
        _idleTimeoutID && (clearTimeout(_idleTimeoutID), _idleTimeoutID = void 0);
      }
      function _restartIdleTimeout(endTimestamp) {
        _cancelIdleTimeout(), _idleTimeoutID = setTimeout(() => {
          !_finished && activities.size === 0 && _autoFinishAllowed && (_finishReason = FINISH_REASON_IDLE_TIMEOUT, span.end(endTimestamp));
        }, idleTimeout);
      }
      function _restartChildSpanTimeout(endTimestamp) {
        _idleTimeoutID = setTimeout(() => {
          !_finished && _autoFinishAllowed && (_finishReason = FINISH_REASON_HEARTBEAT_FAILED, span.end(endTimestamp));
        }, childSpanTimeout);
      }
      function _pushActivity(spanId) {
        _cancelIdleTimeout(), activities.set(spanId, !0);
        let endTimestamp = utils.timestampInSeconds();
        _restartChildSpanTimeout(endTimestamp + childSpanTimeout / 1e3);
      }
      function _popActivity(spanId) {
        if (activities.has(spanId) && activities.delete(spanId), activities.size === 0) {
          let endTimestamp = utils.timestampInSeconds();
          _restartIdleTimeout(endTimestamp + idleTimeout / 1e3);
        }
      }
      function onIdleSpanEnded(endTimestamp) {
        _finished = !0, activities.clear(), spanOnScope._setSpanForScope(scope, previousActiveSpan);
        let spanJSON = spanUtils.spanToJSON(span), { start_timestamp: startTimestamp } = spanJSON;
        if (!startTimestamp)
          return;
        (spanJSON.data || {})[semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_IDLE_SPAN_FINISH_REASON] || span.setAttribute(semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_IDLE_SPAN_FINISH_REASON, _finishReason), utils.logger.log(`[Tracing] Idle span "${spanJSON.op}" finished`);
        let childSpans = spanUtils.getSpanDescendants(span).filter((child) => child !== span), discardedSpans = 0;
        childSpans.forEach((childSpan) => {
          childSpan.isRecording() && (childSpan.setStatus({ code: spanstatus.SPAN_STATUS_ERROR, message: "cancelled" }), childSpan.end(endTimestamp), debugBuild.DEBUG_BUILD && utils.logger.log("[Tracing] Cancelling span since span ended early", JSON.stringify(childSpan, void 0, 2)));
          let childSpanJSON = spanUtils.spanToJSON(childSpan), { timestamp: childEndTimestamp = 0, start_timestamp: childStartTimestamp = 0 } = childSpanJSON, spanStartedBeforeIdleSpanEnd = childStartTimestamp <= endTimestamp, timeoutWithMarginOfError = (finalTimeout + idleTimeout) / 1e3, spanEndedBeforeFinalTimeout = childEndTimestamp - childStartTimestamp <= timeoutWithMarginOfError;
          if (debugBuild.DEBUG_BUILD) {
            let stringifiedSpan = JSON.stringify(childSpan, void 0, 2);
            spanStartedBeforeIdleSpanEnd ? spanEndedBeforeFinalTimeout || utils.logger.log("[Tracing] Discarding span since it finished after idle span final timeout", stringifiedSpan) : utils.logger.log("[Tracing] Discarding span since it happened after idle span was finished", stringifiedSpan);
          }
          (!spanEndedBeforeFinalTimeout || !spanStartedBeforeIdleSpanEnd) && (spanUtils.removeChildSpanFromSpan(span, childSpan), discardedSpans++);
        }), discardedSpans > 0 && span.setAttribute("sentry.idle_span_discarded_spans", discardedSpans);
      }
      return client.on("spanStart", (startedSpan) => {
        if (_finished || startedSpan === span || spanUtils.spanToJSON(startedSpan).timestamp)
          return;
        spanUtils.getSpanDescendants(span).includes(startedSpan) && _pushActivity(startedSpan.spanContext().spanId);
      }), client.on("spanEnd", (endedSpan) => {
        _finished || _popActivity(endedSpan.spanContext().spanId);
      }), client.on("idleSpanEnableAutoFinish", (spanToAllowAutoFinish) => {
        spanToAllowAutoFinish === span && (_autoFinishAllowed = !0, _restartIdleTimeout(), activities.size && _restartChildSpanTimeout());
      }), options.disableAutoFinish || _restartIdleTimeout(), setTimeout(() => {
        _finished || (span.setStatus({ code: spanstatus.SPAN_STATUS_ERROR, message: "deadline_exceeded" }), _finishReason = FINISH_REASON_FINAL_TIMEOUT, span.end());
      }, finalTimeout), span;
    }
    function _startIdleSpan(options) {
      let span = trace.startInactiveSpan(options);
      return spanOnScope._setSpanForScope(currentScopes.getCurrentScope(), span), debugBuild.DEBUG_BUILD && utils.logger.log("[Tracing] Started span is an idle span"), span;
    }
    exports.TRACING_DEFAULTS = TRACING_DEFAULTS;
    exports.startIdleSpan = startIdleSpan;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/eventProcessors.js
var require_eventProcessors = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/eventProcessors.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), debugBuild = require_debug_build2();
    function notifyEventProcessors(processors, event, hint, index = 0) {
      return new utils.SyncPromise((resolve, reject) => {
        let processor = processors[index];
        if (event === null || typeof processor != "function")
          resolve(event);
        else {
          let result = processor({ ...event }, hint);
          debugBuild.DEBUG_BUILD && processor.id && result === null && utils.logger.log(`Event processor "${processor.id}" dropped event`), utils.isThenable(result) ? result.then((final) => notifyEventProcessors(processors, final, hint, index + 1).then(resolve)).then(null, reject) : notifyEventProcessors(processors, result, hint, index + 1).then(resolve).then(null, reject);
        }
      });
    }
    exports.notifyEventProcessors = notifyEventProcessors;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/applyScopeDataToEvent.js
var require_applyScopeDataToEvent = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/applyScopeDataToEvent.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), dynamicSamplingContext = require_dynamicSamplingContext(), spanUtils = require_spanUtils();
    function applyScopeDataToEvent(event, data) {
      let { fingerprint, span, breadcrumbs, sdkProcessingMetadata } = data;
      applyDataToEvent(event, data), span && applySpanToEvent(event, span), applyFingerprintToEvent(event, fingerprint), applyBreadcrumbsToEvent(event, breadcrumbs), applySdkMetadataToEvent(event, sdkProcessingMetadata);
    }
    function mergeScopeData(data, mergeData) {
      let {
        extra,
        tags,
        user,
        contexts,
        level,
        sdkProcessingMetadata,
        breadcrumbs,
        fingerprint,
        eventProcessors,
        attachments,
        propagationContext,
        transactionName,
        span
      } = mergeData;
      mergeAndOverwriteScopeData(data, "extra", extra), mergeAndOverwriteScopeData(data, "tags", tags), mergeAndOverwriteScopeData(data, "user", user), mergeAndOverwriteScopeData(data, "contexts", contexts), mergeAndOverwriteScopeData(data, "sdkProcessingMetadata", sdkProcessingMetadata), level && (data.level = level), transactionName && (data.transactionName = transactionName), span && (data.span = span), breadcrumbs.length && (data.breadcrumbs = [...data.breadcrumbs, ...breadcrumbs]), fingerprint.length && (data.fingerprint = [...data.fingerprint, ...fingerprint]), eventProcessors.length && (data.eventProcessors = [...data.eventProcessors, ...eventProcessors]), attachments.length && (data.attachments = [...data.attachments, ...attachments]), data.propagationContext = { ...data.propagationContext, ...propagationContext };
    }
    function mergeAndOverwriteScopeData(data, prop, mergeVal) {
      if (mergeVal && Object.keys(mergeVal).length) {
        data[prop] = { ...data[prop] };
        for (let key in mergeVal)
          Object.prototype.hasOwnProperty.call(mergeVal, key) && (data[prop][key] = mergeVal[key]);
      }
    }
    function applyDataToEvent(event, data) {
      let { extra, tags, user, contexts, level, transactionName } = data, cleanedExtra = utils.dropUndefinedKeys(extra);
      cleanedExtra && Object.keys(cleanedExtra).length && (event.extra = { ...cleanedExtra, ...event.extra });
      let cleanedTags = utils.dropUndefinedKeys(tags);
      cleanedTags && Object.keys(cleanedTags).length && (event.tags = { ...cleanedTags, ...event.tags });
      let cleanedUser = utils.dropUndefinedKeys(user);
      cleanedUser && Object.keys(cleanedUser).length && (event.user = { ...cleanedUser, ...event.user });
      let cleanedContexts = utils.dropUndefinedKeys(contexts);
      cleanedContexts && Object.keys(cleanedContexts).length && (event.contexts = { ...cleanedContexts, ...event.contexts }), level && (event.level = level), transactionName && event.type !== "transaction" && (event.transaction = transactionName);
    }
    function applyBreadcrumbsToEvent(event, breadcrumbs) {
      let mergedBreadcrumbs = [...event.breadcrumbs || [], ...breadcrumbs];
      event.breadcrumbs = mergedBreadcrumbs.length ? mergedBreadcrumbs : void 0;
    }
    function applySdkMetadataToEvent(event, sdkProcessingMetadata) {
      event.sdkProcessingMetadata = {
        ...event.sdkProcessingMetadata,
        ...sdkProcessingMetadata
      };
    }
    function applySpanToEvent(event, span) {
      event.contexts = {
        trace: spanUtils.spanToTraceContext(span),
        ...event.contexts
      }, event.sdkProcessingMetadata = {
        dynamicSamplingContext: dynamicSamplingContext.getDynamicSamplingContextFromSpan(span),
        ...event.sdkProcessingMetadata
      };
      let rootSpan = spanUtils.getRootSpan(span), transactionName = spanUtils.spanToJSON(rootSpan).description;
      transactionName && !event.transaction && event.type === "transaction" && (event.transaction = transactionName);
    }
    function applyFingerprintToEvent(event, fingerprint) {
      event.fingerprint = event.fingerprint ? utils.arrayify(event.fingerprint) : [], fingerprint && (event.fingerprint = event.fingerprint.concat(fingerprint)), event.fingerprint && !event.fingerprint.length && delete event.fingerprint;
    }
    exports.applyScopeDataToEvent = applyScopeDataToEvent;
    exports.mergeAndOverwriteScopeData = mergeAndOverwriteScopeData;
    exports.mergeScopeData = mergeScopeData;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/prepareEvent.js
var require_prepareEvent = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/prepareEvent.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), constants = require_constants(), currentScopes = require_currentScopes(), eventProcessors = require_eventProcessors(), scope = require_scope(), applyScopeDataToEvent = require_applyScopeDataToEvent();
    function prepareEvent(options, event, hint, scope2, client, isolationScope) {
      let { normalizeDepth = 3, normalizeMaxBreadth = 1e3 } = options, prepared = {
        ...event,
        event_id: event.event_id || hint.event_id || utils.uuid4(),
        timestamp: event.timestamp || utils.dateTimestampInSeconds()
      }, integrations = hint.integrations || options.integrations.map((i) => i.name);
      applyClientOptions(prepared, options), applyIntegrationsMetadata(prepared, integrations), event.type === void 0 && applyDebugIds(prepared, options.stackParser);
      let finalScope = getFinalScope(scope2, hint.captureContext);
      hint.mechanism && utils.addExceptionMechanism(prepared, hint.mechanism);
      let clientEventProcessors = client ? client.getEventProcessors() : [], data = currentScopes.getGlobalScope().getScopeData();
      if (isolationScope) {
        let isolationData = isolationScope.getScopeData();
        applyScopeDataToEvent.mergeScopeData(data, isolationData);
      }
      if (finalScope) {
        let finalScopeData = finalScope.getScopeData();
        applyScopeDataToEvent.mergeScopeData(data, finalScopeData);
      }
      let attachments = [...hint.attachments || [], ...data.attachments];
      attachments.length && (hint.attachments = attachments), applyScopeDataToEvent.applyScopeDataToEvent(prepared, data);
      let eventProcessors$1 = [
        ...clientEventProcessors,
        // Run scope event processors _after_ all other processors
        ...data.eventProcessors
      ];
      return eventProcessors.notifyEventProcessors(eventProcessors$1, prepared, hint).then((evt) => (evt && applyDebugMeta(evt), typeof normalizeDepth == "number" && normalizeDepth > 0 ? normalizeEvent(evt, normalizeDepth, normalizeMaxBreadth) : evt));
    }
    function applyClientOptions(event, options) {
      let { environment, release, dist, maxValueLength = 250 } = options;
      "environment" in event || (event.environment = "environment" in options ? environment : constants.DEFAULT_ENVIRONMENT), event.release === void 0 && release !== void 0 && (event.release = release), event.dist === void 0 && dist !== void 0 && (event.dist = dist), event.message && (event.message = utils.truncate(event.message, maxValueLength));
      let exception = event.exception && event.exception.values && event.exception.values[0];
      exception && exception.value && (exception.value = utils.truncate(exception.value, maxValueLength));
      let request = event.request;
      request && request.url && (request.url = utils.truncate(request.url, maxValueLength));
    }
    var debugIdStackParserCache = /* @__PURE__ */ new WeakMap();
    function applyDebugIds(event, stackParser) {
      let debugIdMap = utils.GLOBAL_OBJ._sentryDebugIds;
      if (!debugIdMap)
        return;
      let debugIdStackFramesCache, cachedDebugIdStackFrameCache = debugIdStackParserCache.get(stackParser);
      cachedDebugIdStackFrameCache ? debugIdStackFramesCache = cachedDebugIdStackFrameCache : (debugIdStackFramesCache = /* @__PURE__ */ new Map(), debugIdStackParserCache.set(stackParser, debugIdStackFramesCache));
      let filenameDebugIdMap = Object.keys(debugIdMap).reduce((acc, debugIdStackTrace) => {
        let parsedStack, cachedParsedStack = debugIdStackFramesCache.get(debugIdStackTrace);
        cachedParsedStack ? parsedStack = cachedParsedStack : (parsedStack = stackParser(debugIdStackTrace), debugIdStackFramesCache.set(debugIdStackTrace, parsedStack));
        for (let i = parsedStack.length - 1; i >= 0; i--) {
          let stackFrame = parsedStack[i];
          if (stackFrame.filename) {
            acc[stackFrame.filename] = debugIdMap[debugIdStackTrace];
            break;
          }
        }
        return acc;
      }, {});
      try {
        event.exception.values.forEach((exception) => {
          exception.stacktrace.frames.forEach((frame) => {
            frame.filename && (frame.debug_id = filenameDebugIdMap[frame.filename]);
          });
        });
      } catch {
      }
    }
    function applyDebugMeta(event) {
      let filenameDebugIdMap = {};
      try {
        event.exception.values.forEach((exception) => {
          exception.stacktrace.frames.forEach((frame) => {
            frame.debug_id && (frame.abs_path ? filenameDebugIdMap[frame.abs_path] = frame.debug_id : frame.filename && (filenameDebugIdMap[frame.filename] = frame.debug_id), delete frame.debug_id);
          });
        });
      } catch {
      }
      if (Object.keys(filenameDebugIdMap).length === 0)
        return;
      event.debug_meta = event.debug_meta || {}, event.debug_meta.images = event.debug_meta.images || [];
      let images = event.debug_meta.images;
      Object.keys(filenameDebugIdMap).forEach((filename) => {
        images.push({
          type: "sourcemap",
          code_file: filename,
          debug_id: filenameDebugIdMap[filename]
        });
      });
    }
    function applyIntegrationsMetadata(event, integrationNames) {
      integrationNames.length > 0 && (event.sdk = event.sdk || {}, event.sdk.integrations = [...event.sdk.integrations || [], ...integrationNames]);
    }
    function normalizeEvent(event, depth, maxBreadth) {
      if (!event)
        return null;
      let normalized = {
        ...event,
        ...event.breadcrumbs && {
          breadcrumbs: event.breadcrumbs.map((b) => ({
            ...b,
            ...b.data && {
              data: utils.normalize(b.data, depth, maxBreadth)
            }
          }))
        },
        ...event.user && {
          user: utils.normalize(event.user, depth, maxBreadth)
        },
        ...event.contexts && {
          contexts: utils.normalize(event.contexts, depth, maxBreadth)
        },
        ...event.extra && {
          extra: utils.normalize(event.extra, depth, maxBreadth)
        }
      };
      return event.contexts && event.contexts.trace && normalized.contexts && (normalized.contexts.trace = event.contexts.trace, event.contexts.trace.data && (normalized.contexts.trace.data = utils.normalize(event.contexts.trace.data, depth, maxBreadth))), event.spans && (normalized.spans = event.spans.map((span) => ({
        ...span,
        ...span.data && {
          data: utils.normalize(span.data, depth, maxBreadth)
        }
      }))), normalized;
    }
    function getFinalScope(scope$1, captureContext) {
      if (!captureContext)
        return scope$1;
      let finalScope = scope$1 ? scope$1.clone() : new scope.Scope();
      return finalScope.update(captureContext), finalScope;
    }
    function parseEventHintOrCaptureContext(hint) {
      if (hint)
        return hintIsScopeOrFunction(hint) ? { captureContext: hint } : hintIsScopeContext(hint) ? {
          captureContext: hint
        } : hint;
    }
    function hintIsScopeOrFunction(hint) {
      return hint instanceof scope.Scope || typeof hint == "function";
    }
    var captureContextKeys = [
      "user",
      "level",
      "extra",
      "contexts",
      "tags",
      "fingerprint",
      "requestSession",
      "propagationContext"
    ];
    function hintIsScopeContext(hint) {
      return Object.keys(hint).some((key) => captureContextKeys.includes(key));
    }
    exports.applyDebugIds = applyDebugIds;
    exports.applyDebugMeta = applyDebugMeta;
    exports.parseEventHintOrCaptureContext = parseEventHintOrCaptureContext;
    exports.prepareEvent = prepareEvent;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/exports.js
var require_exports = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/exports.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), constants = require_constants(), currentScopes = require_currentScopes(), debugBuild = require_debug_build2(), session = require_session(), prepareEvent = require_prepareEvent();
    function captureException(exception, hint) {
      return currentScopes.getCurrentScope().captureException(exception, prepareEvent.parseEventHintOrCaptureContext(hint));
    }
    function captureMessage(message, captureContext) {
      let level = typeof captureContext == "string" ? captureContext : void 0, context = typeof captureContext != "string" ? { captureContext } : void 0;
      return currentScopes.getCurrentScope().captureMessage(message, level, context);
    }
    function captureEvent(event, hint) {
      return currentScopes.getCurrentScope().captureEvent(event, hint);
    }
    function setContext(name, context) {
      currentScopes.getIsolationScope().setContext(name, context);
    }
    function setExtras(extras) {
      currentScopes.getIsolationScope().setExtras(extras);
    }
    function setExtra(key, extra) {
      currentScopes.getIsolationScope().setExtra(key, extra);
    }
    function setTags(tags) {
      currentScopes.getIsolationScope().setTags(tags);
    }
    function setTag(key, value) {
      currentScopes.getIsolationScope().setTag(key, value);
    }
    function setUser(user) {
      currentScopes.getIsolationScope().setUser(user);
    }
    function lastEventId() {
      return currentScopes.getIsolationScope().lastEventId();
    }
    function captureCheckIn(checkIn, upsertMonitorConfig) {
      let scope = currentScopes.getCurrentScope(), client = currentScopes.getClient();
      if (!client)
        debugBuild.DEBUG_BUILD && utils.logger.warn("Cannot capture check-in. No client defined.");
      else if (!client.captureCheckIn)
        debugBuild.DEBUG_BUILD && utils.logger.warn("Cannot capture check-in. Client does not support sending check-ins.");
      else
        return client.captureCheckIn(checkIn, upsertMonitorConfig, scope);
      return utils.uuid4();
    }
    function withMonitor(monitorSlug, callback, upsertMonitorConfig) {
      let checkInId = captureCheckIn({ monitorSlug, status: "in_progress" }, upsertMonitorConfig), now = utils.timestampInSeconds();
      function finishCheckIn(status) {
        captureCheckIn({ monitorSlug, status, checkInId, duration: utils.timestampInSeconds() - now });
      }
      return currentScopes.withIsolationScope(() => {
        let maybePromiseResult;
        try {
          maybePromiseResult = callback();
        } catch (e) {
          throw finishCheckIn("error"), e;
        }
        return utils.isThenable(maybePromiseResult) ? Promise.resolve(maybePromiseResult).then(
          () => {
            finishCheckIn("ok");
          },
          () => {
            finishCheckIn("error");
          }
        ) : finishCheckIn("ok"), maybePromiseResult;
      });
    }
    async function flush(timeout) {
      let client = currentScopes.getClient();
      return client ? client.flush(timeout) : (debugBuild.DEBUG_BUILD && utils.logger.warn("Cannot flush events. No client defined."), Promise.resolve(!1));
    }
    async function close(timeout) {
      let client = currentScopes.getClient();
      return client ? client.close(timeout) : (debugBuild.DEBUG_BUILD && utils.logger.warn("Cannot flush events and disable SDK. No client defined."), Promise.resolve(!1));
    }
    function isInitialized() {
      return !!currentScopes.getClient();
    }
    function isEnabled() {
      let client = currentScopes.getClient();
      return !!client && client.getOptions().enabled !== !1 && !!client.getTransport();
    }
    function addEventProcessor(callback) {
      currentScopes.getIsolationScope().addEventProcessor(callback);
    }
    function startSession(context) {
      let client = currentScopes.getClient(), isolationScope = currentScopes.getIsolationScope(), currentScope = currentScopes.getCurrentScope(), { release, environment = constants.DEFAULT_ENVIRONMENT } = client && client.getOptions() || {}, { userAgent } = utils.GLOBAL_OBJ.navigator || {}, session$1 = session.makeSession({
        release,
        environment,
        user: currentScope.getUser() || isolationScope.getUser(),
        ...userAgent && { userAgent },
        ...context
      }), currentSession = isolationScope.getSession();
      return currentSession && currentSession.status === "ok" && session.updateSession(currentSession, { status: "exited" }), endSession(), isolationScope.setSession(session$1), currentScope.setSession(session$1), session$1;
    }
    function endSession() {
      let isolationScope = currentScopes.getIsolationScope(), currentScope = currentScopes.getCurrentScope(), session$1 = currentScope.getSession() || isolationScope.getSession();
      session$1 && session.closeSession(session$1), _sendSessionUpdate(), isolationScope.setSession(), currentScope.setSession();
    }
    function _sendSessionUpdate() {
      let isolationScope = currentScopes.getIsolationScope(), currentScope = currentScopes.getCurrentScope(), client = currentScopes.getClient(), session2 = currentScope.getSession() || isolationScope.getSession();
      session2 && client && client.captureSession(session2);
    }
    function captureSession(end = !1) {
      if (end) {
        endSession();
        return;
      }
      _sendSessionUpdate();
    }
    exports.addEventProcessor = addEventProcessor;
    exports.captureCheckIn = captureCheckIn;
    exports.captureEvent = captureEvent;
    exports.captureException = captureException;
    exports.captureMessage = captureMessage;
    exports.captureSession = captureSession;
    exports.close = close;
    exports.endSession = endSession;
    exports.flush = flush;
    exports.isEnabled = isEnabled;
    exports.isInitialized = isInitialized;
    exports.lastEventId = lastEventId;
    exports.setContext = setContext;
    exports.setExtra = setExtra;
    exports.setExtras = setExtras;
    exports.setTag = setTag;
    exports.setTags = setTags;
    exports.setUser = setUser;
    exports.startSession = startSession;
    exports.withMonitor = withMonitor;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/sessionflusher.js
var require_sessionflusher = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/sessionflusher.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), SessionFlusher = class {
      // Cast to any so that it can use Node.js timeout
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(client, attrs) {
        this._client = client, this.flushTimeout = 60, this._pendingAggregates = {}, this._isEnabled = !0, this._intervalId = setInterval(() => this.flush(), this.flushTimeout * 1e3), this._intervalId.unref && this._intervalId.unref(), this._sessionAttrs = attrs;
      }
      /** Checks if `pendingAggregates` has entries, and if it does flushes them by calling `sendSession` */
      flush() {
        let sessionAggregates = this.getSessionAggregates();
        sessionAggregates.aggregates.length !== 0 && (this._pendingAggregates = {}, this._client.sendSession(sessionAggregates));
      }
      /** Massages the entries in `pendingAggregates` and returns aggregated sessions */
      getSessionAggregates() {
        let aggregates = Object.keys(this._pendingAggregates).map((key) => this._pendingAggregates[parseInt(key)]), sessionAggregates = {
          attrs: this._sessionAttrs,
          aggregates
        };
        return utils.dropUndefinedKeys(sessionAggregates);
      }
      /** JSDoc */
      close() {
        clearInterval(this._intervalId), this._isEnabled = !1, this.flush();
      }
      /**
       * Wrapper function for _incrementSessionStatusCount that checks if the instance of SessionFlusher is enabled then
       * fetches the session status of the request from `Scope.getRequestSession().status` on the scope and passes them to
       * `_incrementSessionStatusCount` along with the start date
       */
      incrementSessionStatusCount() {
        if (!this._isEnabled)
          return;
        let isolationScope = currentScopes.getIsolationScope(), requestSession = isolationScope.getRequestSession();
        requestSession && requestSession.status && (this._incrementSessionStatusCount(requestSession.status, /* @__PURE__ */ new Date()), isolationScope.setRequestSession(void 0));
      }
      /**
       * Increments status bucket in pendingAggregates buffer (internal state) corresponding to status of
       * the session received
       */
      _incrementSessionStatusCount(status, date) {
        let sessionStartedTrunc = new Date(date).setSeconds(0, 0);
        this._pendingAggregates[sessionStartedTrunc] = this._pendingAggregates[sessionStartedTrunc] || {};
        let aggregationCounts = this._pendingAggregates[sessionStartedTrunc];
        switch (aggregationCounts.started || (aggregationCounts.started = new Date(sessionStartedTrunc).toISOString()), status) {
          case "errored":
            return aggregationCounts.errored = (aggregationCounts.errored || 0) + 1, aggregationCounts.errored;
          case "ok":
            return aggregationCounts.exited = (aggregationCounts.exited || 0) + 1, aggregationCounts.exited;
          default:
            return aggregationCounts.crashed = (aggregationCounts.crashed || 0) + 1, aggregationCounts.crashed;
        }
      }
    };
    exports.SessionFlusher = SessionFlusher;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/api.js
var require_api = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/api.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), SENTRY_API_VERSION = "7";
    function getBaseApiEndpoint(dsn) {
      let protocol = dsn.protocol ? `${dsn.protocol}:` : "", port = dsn.port ? `:${dsn.port}` : "";
      return `${protocol}//${dsn.host}${port}${dsn.path ? `/${dsn.path}` : ""}/api/`;
    }
    function _getIngestEndpoint(dsn) {
      return `${getBaseApiEndpoint(dsn)}${dsn.projectId}/envelope/`;
    }
    function _encodedAuth(dsn, sdkInfo) {
      return utils.urlEncode({
        // We send only the minimum set of required information. See
        // https://github.com/getsentry/sentry-javascript/issues/2572.
        sentry_key: dsn.publicKey,
        sentry_version: SENTRY_API_VERSION,
        ...sdkInfo && { sentry_client: `${sdkInfo.name}/${sdkInfo.version}` }
      });
    }
    function getEnvelopeEndpointWithUrlEncodedAuth(dsn, tunnel, sdkInfo) {
      return tunnel || `${_getIngestEndpoint(dsn)}?${_encodedAuth(dsn, sdkInfo)}`;
    }
    function getReportDialogEndpoint(dsnLike, dialogOptions) {
      let dsn = utils.makeDsn(dsnLike);
      if (!dsn)
        return "";
      let endpoint = `${getBaseApiEndpoint(dsn)}embed/error-page/`, encodedOptions = `dsn=${utils.dsnToString(dsn)}`;
      for (let key in dialogOptions)
        if (key !== "dsn" && key !== "onClose")
          if (key === "user") {
            let user = dialogOptions.user;
            if (!user)
              continue;
            user.name && (encodedOptions += `&name=${encodeURIComponent(user.name)}`), user.email && (encodedOptions += `&email=${encodeURIComponent(user.email)}`);
          } else
            encodedOptions += `&${encodeURIComponent(key)}=${encodeURIComponent(dialogOptions[key])}`;
      return `${endpoint}?${encodedOptions}`;
    }
    exports.getEnvelopeEndpointWithUrlEncodedAuth = getEnvelopeEndpointWithUrlEncodedAuth;
    exports.getReportDialogEndpoint = getReportDialogEndpoint;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integration.js
var require_integration = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integration.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), debugBuild = require_debug_build2(), installedIntegrations = [];
    function filterDuplicates(integrations) {
      let integrationsByName = {};
      return integrations.forEach((currentInstance) => {
        let { name } = currentInstance, existingInstance = integrationsByName[name];
        existingInstance && !existingInstance.isDefaultInstance && currentInstance.isDefaultInstance || (integrationsByName[name] = currentInstance);
      }), Object.keys(integrationsByName).map((k) => integrationsByName[k]);
    }
    function getIntegrationsToSetup(options) {
      let defaultIntegrations = options.defaultIntegrations || [], userIntegrations = options.integrations;
      defaultIntegrations.forEach((integration) => {
        integration.isDefaultInstance = !0;
      });
      let integrations;
      Array.isArray(userIntegrations) ? integrations = [...defaultIntegrations, ...userIntegrations] : typeof userIntegrations == "function" ? integrations = utils.arrayify(userIntegrations(defaultIntegrations)) : integrations = defaultIntegrations;
      let finalIntegrations = filterDuplicates(integrations), debugIndex = findIndex(finalIntegrations, (integration) => integration.name === "Debug");
      if (debugIndex !== -1) {
        let [debugInstance] = finalIntegrations.splice(debugIndex, 1);
        finalIntegrations.push(debugInstance);
      }
      return finalIntegrations;
    }
    function setupIntegrations(client, integrations) {
      let integrationIndex = {};
      return integrations.forEach((integration) => {
        integration && setupIntegration(client, integration, integrationIndex);
      }), integrationIndex;
    }
    function afterSetupIntegrations(client, integrations) {
      for (let integration of integrations)
        integration && integration.afterAllSetup && integration.afterAllSetup(client);
    }
    function setupIntegration(client, integration, integrationIndex) {
      if (integrationIndex[integration.name]) {
        debugBuild.DEBUG_BUILD && utils.logger.log(`Integration skipped because it was already installed: ${integration.name}`);
        return;
      }
      if (integrationIndex[integration.name] = integration, installedIntegrations.indexOf(integration.name) === -1 && typeof integration.setupOnce == "function" && (integration.setupOnce(), installedIntegrations.push(integration.name)), integration.setup && typeof integration.setup == "function" && integration.setup(client), typeof integration.preprocessEvent == "function") {
        let callback = integration.preprocessEvent.bind(integration);
        client.on("preprocessEvent", (event, hint) => callback(event, hint, client));
      }
      if (typeof integration.processEvent == "function") {
        let callback = integration.processEvent.bind(integration), processor = Object.assign((event, hint) => callback(event, hint, client), {
          id: integration.name
        });
        client.addEventProcessor(processor);
      }
      debugBuild.DEBUG_BUILD && utils.logger.log(`Integration installed: ${integration.name}`);
    }
    function addIntegration(integration) {
      let client = currentScopes.getClient();
      if (!client) {
        debugBuild.DEBUG_BUILD && utils.logger.warn(`Cannot add integration "${integration.name}" because no SDK Client is available.`);
        return;
      }
      client.addIntegration(integration);
    }
    function findIndex(arr, callback) {
      for (let i = 0; i < arr.length; i++)
        if (callback(arr[i]) === !0)
          return i;
      return -1;
    }
    function defineIntegration(fn) {
      return fn;
    }
    exports.addIntegration = addIntegration;
    exports.afterSetupIntegrations = afterSetupIntegrations;
    exports.defineIntegration = defineIntegration;
    exports.getIntegrationsToSetup = getIntegrationsToSetup;
    exports.installedIntegrations = installedIntegrations;
    exports.setupIntegration = setupIntegration;
    exports.setupIntegrations = setupIntegrations;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/baseclient.js
var require_baseclient = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/baseclient.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), api = require_api(), currentScopes = require_currentScopes(), debugBuild = require_debug_build2(), envelope = require_envelope2(), integration = require_integration(), session = require_session(), dynamicSamplingContext = require_dynamicSamplingContext(), parseSampleRate = require_parseSampleRate(), prepareEvent = require_prepareEvent(), ALREADY_SEEN_ERROR = "Not capturing exception because it's already been captured.", BaseClient = class {
      /** Options passed to the SDK. */
      /** The client Dsn, if specified in options. Without this Dsn, the SDK will be disabled. */
      /** Array of set up integrations. */
      /** Number of calls being processed */
      /** Holds flushable  */
      // eslint-disable-next-line @typescript-eslint/ban-types
      /**
       * Initializes this client instance.
       *
       * @param options Options for the client.
       */
      constructor(options) {
        if (this._options = options, this._integrations = {}, this._numProcessing = 0, this._outcomes = {}, this._hooks = {}, this._eventProcessors = [], options.dsn ? this._dsn = utils.makeDsn(options.dsn) : debugBuild.DEBUG_BUILD && utils.logger.warn("No DSN provided, client will not send events."), this._dsn) {
          let url = api.getEnvelopeEndpointWithUrlEncodedAuth(
            this._dsn,
            options.tunnel,
            options._metadata ? options._metadata.sdk : void 0
          );
          this._transport = options.transport({
            tunnel: this._options.tunnel,
            recordDroppedEvent: this.recordDroppedEvent.bind(this),
            ...options.transportOptions,
            url
          });
        }
      }
      /**
       * @inheritDoc
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      captureException(exception, hint, scope) {
        let eventId = utils.uuid4();
        if (utils.checkOrSetAlreadyCaught(exception))
          return debugBuild.DEBUG_BUILD && utils.logger.log(ALREADY_SEEN_ERROR), eventId;
        let hintWithEventId = {
          event_id: eventId,
          ...hint
        };
        return this._process(
          this.eventFromException(exception, hintWithEventId).then(
            (event) => this._captureEvent(event, hintWithEventId, scope)
          )
        ), hintWithEventId.event_id;
      }
      /**
       * @inheritDoc
       */
      captureMessage(message, level, hint, currentScope) {
        let hintWithEventId = {
          event_id: utils.uuid4(),
          ...hint
        }, eventMessage = utils.isParameterizedString(message) ? message : String(message), promisedEvent = utils.isPrimitive(message) ? this.eventFromMessage(eventMessage, level, hintWithEventId) : this.eventFromException(message, hintWithEventId);
        return this._process(promisedEvent.then((event) => this._captureEvent(event, hintWithEventId, currentScope))), hintWithEventId.event_id;
      }
      /**
       * @inheritDoc
       */
      captureEvent(event, hint, currentScope) {
        let eventId = utils.uuid4();
        if (hint && hint.originalException && utils.checkOrSetAlreadyCaught(hint.originalException))
          return debugBuild.DEBUG_BUILD && utils.logger.log(ALREADY_SEEN_ERROR), eventId;
        let hintWithEventId = {
          event_id: eventId,
          ...hint
        }, capturedSpanScope = (event.sdkProcessingMetadata || {}).capturedSpanScope;
        return this._process(this._captureEvent(event, hintWithEventId, capturedSpanScope || currentScope)), hintWithEventId.event_id;
      }
      /**
       * @inheritDoc
       */
      captureSession(session$1) {
        typeof session$1.release != "string" ? debugBuild.DEBUG_BUILD && utils.logger.warn("Discarded session because of missing or non-string release") : (this.sendSession(session$1), session.updateSession(session$1, { init: !1 }));
      }
      /**
       * @inheritDoc
       */
      getDsn() {
        return this._dsn;
      }
      /**
       * @inheritDoc
       */
      getOptions() {
        return this._options;
      }
      /**
       * @see SdkMetadata in @sentry/types
       *
       * @return The metadata of the SDK
       */
      getSdkMetadata() {
        return this._options._metadata;
      }
      /**
       * @inheritDoc
       */
      getTransport() {
        return this._transport;
      }
      /**
       * @inheritDoc
       */
      flush(timeout) {
        let transport = this._transport;
        return transport ? (this.emit("flush"), this._isClientDoneProcessing(timeout).then((clientFinished) => transport.flush(timeout).then((transportFlushed) => clientFinished && transportFlushed))) : utils.resolvedSyncPromise(!0);
      }
      /**
       * @inheritDoc
       */
      close(timeout) {
        return this.flush(timeout).then((result) => (this.getOptions().enabled = !1, this.emit("close"), result));
      }
      /** Get all installed event processors. */
      getEventProcessors() {
        return this._eventProcessors;
      }
      /** @inheritDoc */
      addEventProcessor(eventProcessor) {
        this._eventProcessors.push(eventProcessor);
      }
      /** @inheritdoc */
      init() {
        this._isEnabled() && this._setupIntegrations();
      }
      /**
       * Gets an installed integration by its name.
       *
       * @returns The installed integration or `undefined` if no integration with that `name` was installed.
       */
      getIntegrationByName(integrationName) {
        return this._integrations[integrationName];
      }
      /**
       * @inheritDoc
       */
      addIntegration(integration$1) {
        let isAlreadyInstalled = this._integrations[integration$1.name];
        integration.setupIntegration(this, integration$1, this._integrations), isAlreadyInstalled || integration.afterSetupIntegrations(this, [integration$1]);
      }
      /**
       * @inheritDoc
       */
      sendEvent(event, hint = {}) {
        this.emit("beforeSendEvent", event, hint);
        let env = envelope.createEventEnvelope(event, this._dsn, this._options._metadata, this._options.tunnel);
        for (let attachment of hint.attachments || [])
          env = utils.addItemToEnvelope(env, utils.createAttachmentEnvelopeItem(attachment));
        let promise = this.sendEnvelope(env);
        promise && promise.then((sendResponse) => this.emit("afterSendEvent", event, sendResponse), null);
      }
      /**
       * @inheritDoc
       */
      sendSession(session2) {
        let env = envelope.createSessionEnvelope(session2, this._dsn, this._options._metadata, this._options.tunnel);
        this.sendEnvelope(env);
      }
      /**
       * @inheritDoc
       */
      recordDroppedEvent(reason, category, _event) {
        if (this._options.sendClientReports) {
          let key = `${reason}:${category}`;
          debugBuild.DEBUG_BUILD && utils.logger.log(`Adding outcome: "${key}"`), this._outcomes[key] = this._outcomes[key] + 1 || 1;
        }
      }
      // Keep on() & emit() signatures in sync with types' client.ts interface
      /* eslint-disable @typescript-eslint/unified-signatures */
      /** @inheritdoc */
      /** @inheritdoc */
      on(hook, callback) {
        this._hooks[hook] || (this._hooks[hook] = []), this._hooks[hook].push(callback);
      }
      /** @inheritdoc */
      /** @inheritdoc */
      emit(hook, ...rest) {
        this._hooks[hook] && this._hooks[hook].forEach((callback) => callback(...rest));
      }
      /**
       * @inheritdoc
       */
      sendEnvelope(envelope2) {
        return this.emit("beforeEnvelope", envelope2), this._isEnabled() && this._transport ? this._transport.send(envelope2).then(null, (reason) => (debugBuild.DEBUG_BUILD && utils.logger.error("Error while sending event:", reason), reason)) : (debugBuild.DEBUG_BUILD && utils.logger.error("Transport disabled"), utils.resolvedSyncPromise({}));
      }
      /* eslint-enable @typescript-eslint/unified-signatures */
      /** Setup integrations for this client. */
      _setupIntegrations() {
        let { integrations } = this._options;
        this._integrations = integration.setupIntegrations(this, integrations), integration.afterSetupIntegrations(this, integrations);
      }
      /** Updates existing session based on the provided event */
      _updateSessionFromEvent(session$1, event) {
        let crashed = !1, errored = !1, exceptions = event.exception && event.exception.values;
        if (exceptions) {
          errored = !0;
          for (let ex of exceptions) {
            let mechanism = ex.mechanism;
            if (mechanism && mechanism.handled === !1) {
              crashed = !0;
              break;
            }
          }
        }
        let sessionNonTerminal = session$1.status === "ok";
        (sessionNonTerminal && session$1.errors === 0 || sessionNonTerminal && crashed) && (session.updateSession(session$1, {
          ...crashed && { status: "crashed" },
          errors: session$1.errors || Number(errored || crashed)
        }), this.captureSession(session$1));
      }
      /**
       * Determine if the client is finished processing. Returns a promise because it will wait `timeout` ms before saying
       * "no" (resolving to `false`) in order to give the client a chance to potentially finish first.
       *
       * @param timeout The time, in ms, after which to resolve to `false` if the client is still busy. Passing `0` (or not
       * passing anything) will make the promise wait as long as it takes for processing to finish before resolving to
       * `true`.
       * @returns A promise which will resolve to `true` if processing is already done or finishes before the timeout, and
       * `false` otherwise
       */
      _isClientDoneProcessing(timeout) {
        return new utils.SyncPromise((resolve) => {
          let ticked = 0, tick = 1, interval = setInterval(() => {
            this._numProcessing == 0 ? (clearInterval(interval), resolve(!0)) : (ticked += tick, timeout && ticked >= timeout && (clearInterval(interval), resolve(!1)));
          }, tick);
        });
      }
      /** Determines whether this SDK is enabled and a transport is present. */
      _isEnabled() {
        return this.getOptions().enabled !== !1 && this._transport !== void 0;
      }
      /**
       * Adds common information to events.
       *
       * The information includes release and environment from `options`,
       * breadcrumbs and context (extra, tags and user) from the scope.
       *
       * Information that is already present in the event is never overwritten. For
       * nested objects, such as the context, keys are merged.
       *
       * @param event The original event.
       * @param hint May contain additional information about the original exception.
       * @param currentScope A scope containing event metadata.
       * @returns A new event with more information.
       */
      _prepareEvent(event, hint, currentScope, isolationScope = currentScopes.getIsolationScope()) {
        let options = this.getOptions(), integrations = Object.keys(this._integrations);
        return !hint.integrations && integrations.length > 0 && (hint.integrations = integrations), this.emit("preprocessEvent", event, hint), event.type || isolationScope.setLastEventId(event.event_id || hint.event_id), prepareEvent.prepareEvent(options, event, hint, currentScope, this, isolationScope).then((evt) => {
          if (evt === null)
            return evt;
          let propagationContext = {
            ...isolationScope.getPropagationContext(),
            ...currentScope ? currentScope.getPropagationContext() : void 0
          };
          if (!(evt.contexts && evt.contexts.trace) && propagationContext) {
            let { traceId: trace_id, spanId, parentSpanId, dsc } = propagationContext;
            evt.contexts = {
              trace: utils.dropUndefinedKeys({
                trace_id,
                span_id: spanId,
                parent_span_id: parentSpanId
              }),
              ...evt.contexts
            };
            let dynamicSamplingContext$1 = dsc || dynamicSamplingContext.getDynamicSamplingContextFromClient(trace_id, this);
            evt.sdkProcessingMetadata = {
              dynamicSamplingContext: dynamicSamplingContext$1,
              ...evt.sdkProcessingMetadata
            };
          }
          return evt;
        });
      }
      /**
       * Processes the event and logs an error in case of rejection
       * @param event
       * @param hint
       * @param scope
       */
      _captureEvent(event, hint = {}, scope) {
        return this._processEvent(event, hint, scope).then(
          (finalEvent) => finalEvent.event_id,
          (reason) => {
            if (debugBuild.DEBUG_BUILD) {
              let sentryError = reason;
              sentryError.logLevel === "log" ? utils.logger.log(sentryError.message) : utils.logger.warn(sentryError);
            }
          }
        );
      }
      /**
       * Processes an event (either error or message) and sends it to Sentry.
       *
       * This also adds breadcrumbs and context information to the event. However,
       * platform specific meta data (such as the User's IP address) must be added
       * by the SDK implementor.
       *
       *
       * @param event The event to send to Sentry.
       * @param hint May contain additional information about the original exception.
       * @param currentScope A scope containing event metadata.
       * @returns A SyncPromise that resolves with the event or rejects in case event was/will not be send.
       */
      _processEvent(event, hint, currentScope) {
        let options = this.getOptions(), { sampleRate } = options, isTransaction = isTransactionEvent(event), isError = isErrorEvent(event), eventType = event.type || "error", beforeSendLabel = `before send for type \`${eventType}\``, parsedSampleRate = typeof sampleRate > "u" ? void 0 : parseSampleRate.parseSampleRate(sampleRate);
        if (isError && typeof parsedSampleRate == "number" && Math.random() > parsedSampleRate)
          return this.recordDroppedEvent("sample_rate", "error", event), utils.rejectedSyncPromise(
            new utils.SentryError(
              `Discarding event because it's not included in the random sample (sampling rate = ${sampleRate})`,
              "log"
            )
          );
        let dataCategory = eventType === "replay_event" ? "replay" : eventType, capturedSpanIsolationScope = (event.sdkProcessingMetadata || {}).capturedSpanIsolationScope;
        return this._prepareEvent(event, hint, currentScope, capturedSpanIsolationScope).then((prepared) => {
          if (prepared === null)
            throw this.recordDroppedEvent("event_processor", dataCategory, event), new utils.SentryError("An event processor returned `null`, will not send event.", "log");
          if (hint.data && hint.data.__sentry__ === !0)
            return prepared;
          let result = processBeforeSend(options, prepared, hint);
          return _validateBeforeSendResult(result, beforeSendLabel);
        }).then((processedEvent) => {
          if (processedEvent === null)
            throw this.recordDroppedEvent("before_send", dataCategory, event), new utils.SentryError(`${beforeSendLabel} returned \`null\`, will not send event.`, "log");
          let session2 = currentScope && currentScope.getSession();
          !isTransaction && session2 && this._updateSessionFromEvent(session2, processedEvent);
          let transactionInfo = processedEvent.transaction_info;
          if (isTransaction && transactionInfo && processedEvent.transaction !== event.transaction) {
            let source = "custom";
            processedEvent.transaction_info = {
              ...transactionInfo,
              source
            };
          }
          return this.sendEvent(processedEvent, hint), processedEvent;
        }).then(null, (reason) => {
          throw reason instanceof utils.SentryError ? reason : (this.captureException(reason, {
            data: {
              __sentry__: !0
            },
            originalException: reason
          }), new utils.SentryError(
            `Event processing pipeline threw an error, original event will not be sent. Details have been sent as a new event.
Reason: ${reason}`
          ));
        });
      }
      /**
       * Occupies the client with processing and event
       */
      _process(promise) {
        this._numProcessing++, promise.then(
          (value) => (this._numProcessing--, value),
          (reason) => (this._numProcessing--, reason)
        );
      }
      /**
       * Clears outcomes on this client and returns them.
       */
      _clearOutcomes() {
        let outcomes = this._outcomes;
        return this._outcomes = {}, Object.keys(outcomes).map((key) => {
          let [reason, category] = key.split(":");
          return {
            reason,
            category,
            quantity: outcomes[key]
          };
        });
      }
      /**
       * @inheritDoc
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    };
    function _validateBeforeSendResult(beforeSendResult, beforeSendLabel) {
      let invalidValueError = `${beforeSendLabel} must return \`null\` or a valid event.`;
      if (utils.isThenable(beforeSendResult))
        return beforeSendResult.then(
          (event) => {
            if (!utils.isPlainObject(event) && event !== null)
              throw new utils.SentryError(invalidValueError);
            return event;
          },
          (e) => {
            throw new utils.SentryError(`${beforeSendLabel} rejected with ${e}`);
          }
        );
      if (!utils.isPlainObject(beforeSendResult) && beforeSendResult !== null)
        throw new utils.SentryError(invalidValueError);
      return beforeSendResult;
    }
    function processBeforeSend(options, event, hint) {
      let { beforeSend, beforeSendTransaction, beforeSendSpan } = options;
      if (isErrorEvent(event) && beforeSend)
        return beforeSend(event, hint);
      if (isTransactionEvent(event)) {
        if (event.spans && beforeSendSpan) {
          let processedSpans = [];
          for (let span of event.spans) {
            let processedSpan = beforeSendSpan(span);
            processedSpan && processedSpans.push(processedSpan);
          }
          event.spans = processedSpans;
        }
        if (beforeSendTransaction)
          return beforeSendTransaction(event, hint);
      }
      return event;
    }
    function isErrorEvent(event) {
      return event.type === void 0;
    }
    function isTransactionEvent(event) {
      return event.type === "transaction";
    }
    exports.BaseClient = BaseClient;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/checkin.js
var require_checkin = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/checkin.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs();
    function createCheckInEnvelope(checkIn, dynamicSamplingContext, metadata, tunnel, dsn) {
      let headers = {
        sent_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      metadata && metadata.sdk && (headers.sdk = {
        name: metadata.sdk.name,
        version: metadata.sdk.version
      }), tunnel && dsn && (headers.dsn = utils.dsnToString(dsn)), dynamicSamplingContext && (headers.trace = utils.dropUndefinedKeys(dynamicSamplingContext));
      let item = createCheckInEnvelopeItem(checkIn);
      return utils.createEnvelope(headers, [item]);
    }
    function createCheckInEnvelopeItem(checkIn) {
      return [{
        type: "check_in"
      }, checkIn];
    }
    exports.createCheckInEnvelope = createCheckInEnvelope;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/server-runtime-client.js
var require_server_runtime_client = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/server-runtime-client.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), baseclient = require_baseclient(), checkin = require_checkin(), currentScopes = require_currentScopes(), debugBuild = require_debug_build2(), sessionflusher = require_sessionflusher(), errors = require_errors(), spanOnScope = require_spanOnScope(), spanUtils = require_spanUtils(), dynamicSamplingContext = require_dynamicSamplingContext(), ServerRuntimeClient = class extends baseclient.BaseClient {
      /**
       * Creates a new Edge SDK instance.
       * @param options Configuration options for this SDK.
       */
      constructor(options) {
        errors.registerSpanErrorInstrumentation(), super(options);
      }
      /**
       * @inheritDoc
       */
      eventFromException(exception, hint) {
        return utils.resolvedSyncPromise(utils.eventFromUnknownInput(this, this._options.stackParser, exception, hint));
      }
      /**
       * @inheritDoc
       */
      eventFromMessage(message, level = "info", hint) {
        return utils.resolvedSyncPromise(
          utils.eventFromMessage(this._options.stackParser, message, level, hint, this._options.attachStacktrace)
        );
      }
      /**
       * @inheritDoc
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      captureException(exception, hint, scope) {
        if (this._options.autoSessionTracking && this._sessionFlusher) {
          let requestSession = currentScopes.getIsolationScope().getRequestSession();
          requestSession && requestSession.status === "ok" && (requestSession.status = "errored");
        }
        return super.captureException(exception, hint, scope);
      }
      /**
       * @inheritDoc
       */
      captureEvent(event, hint, scope) {
        if (this._options.autoSessionTracking && this._sessionFlusher && (event.type || "exception") === "exception" && event.exception && event.exception.values && event.exception.values.length > 0) {
          let requestSession = currentScopes.getIsolationScope().getRequestSession();
          requestSession && requestSession.status === "ok" && (requestSession.status = "errored");
        }
        return super.captureEvent(event, hint, scope);
      }
      /**
       *
       * @inheritdoc
       */
      close(timeout) {
        return this._sessionFlusher && this._sessionFlusher.close(), super.close(timeout);
      }
      /** Method that initialises an instance of SessionFlusher on Client */
      initSessionFlusher() {
        let { release, environment } = this._options;
        release ? this._sessionFlusher = new sessionflusher.SessionFlusher(this, {
          release,
          environment
        }) : debugBuild.DEBUG_BUILD && utils.logger.warn("Cannot initialise an instance of SessionFlusher if no release is provided!");
      }
      /**
       * Create a cron monitor check in and send it to Sentry.
       *
       * @param checkIn An object that describes a check in.
       * @param upsertMonitorConfig An optional object that describes a monitor config. Use this if you want
       * to create a monitor automatically when sending a check in.
       */
      captureCheckIn(checkIn, monitorConfig, scope) {
        let id = "checkInId" in checkIn && checkIn.checkInId ? checkIn.checkInId : utils.uuid4();
        if (!this._isEnabled())
          return debugBuild.DEBUG_BUILD && utils.logger.warn("SDK not enabled, will not capture checkin."), id;
        let options = this.getOptions(), { release, environment, tunnel } = options, serializedCheckIn = {
          check_in_id: id,
          monitor_slug: checkIn.monitorSlug,
          status: checkIn.status,
          release,
          environment
        };
        "duration" in checkIn && (serializedCheckIn.duration = checkIn.duration), monitorConfig && (serializedCheckIn.monitor_config = {
          schedule: monitorConfig.schedule,
          checkin_margin: monitorConfig.checkinMargin,
          max_runtime: monitorConfig.maxRuntime,
          timezone: monitorConfig.timezone,
          failure_issue_threshold: monitorConfig.failureIssueThreshold,
          recovery_threshold: monitorConfig.recoveryThreshold
        });
        let [dynamicSamplingContext2, traceContext] = this._getTraceInfoFromScope(scope);
        traceContext && (serializedCheckIn.contexts = {
          trace: traceContext
        });
        let envelope = checkin.createCheckInEnvelope(
          serializedCheckIn,
          dynamicSamplingContext2,
          this.getSdkMetadata(),
          tunnel,
          this.getDsn()
        );
        return debugBuild.DEBUG_BUILD && utils.logger.info("Sending checkin:", checkIn.monitorSlug, checkIn.status), this.sendEnvelope(envelope), id;
      }
      /**
       * Method responsible for capturing/ending a request session by calling `incrementSessionStatusCount` to increment
       * appropriate session aggregates bucket
       */
      _captureRequestSession() {
        this._sessionFlusher ? this._sessionFlusher.incrementSessionStatusCount() : debugBuild.DEBUG_BUILD && utils.logger.warn("Discarded request mode session because autoSessionTracking option was disabled");
      }
      /**
       * @inheritDoc
       */
      _prepareEvent(event, hint, scope, isolationScope) {
        return this._options.platform && (event.platform = event.platform || this._options.platform), this._options.runtime && (event.contexts = {
          ...event.contexts,
          runtime: (event.contexts || {}).runtime || this._options.runtime
        }), this._options.serverName && (event.server_name = event.server_name || this._options.serverName), super._prepareEvent(event, hint, scope, isolationScope);
      }
      /** Extract trace information from scope */
      _getTraceInfoFromScope(scope) {
        if (!scope)
          return [void 0, void 0];
        let span = spanOnScope._getSpanForScope(scope);
        if (span) {
          let rootSpan = spanUtils.getRootSpan(span);
          return [dynamicSamplingContext.getDynamicSamplingContextFromSpan(rootSpan), spanUtils.spanToTraceContext(rootSpan)];
        }
        let { traceId, spanId, parentSpanId, dsc } = scope.getPropagationContext(), traceContext = {
          trace_id: traceId,
          span_id: spanId,
          parent_span_id: parentSpanId
        };
        return dsc ? [dsc, traceContext] : [dynamicSamplingContext.getDynamicSamplingContextFromClient(traceId, this), traceContext];
      }
    };
    exports.ServerRuntimeClient = ServerRuntimeClient;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/sdk.js
var require_sdk = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/sdk.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), debugBuild = require_debug_build2();
    function initAndBind(clientClass, options) {
      options.debug === !0 && (debugBuild.DEBUG_BUILD ? utils.logger.enable() : utils.consoleSandbox(() => {
        console.warn("[Sentry] Cannot initialize SDK with `debug` option using a non-debug bundle.");
      })), currentScopes.getCurrentScope().update(options.initialScope);
      let client = new clientClass(options);
      setCurrentClient(client), client.init();
    }
    function setCurrentClient(client) {
      currentScopes.getCurrentScope().setClient(client);
    }
    exports.initAndBind = initAndBind;
    exports.setCurrentClient = setCurrentClient;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/transports/base.js
var require_base = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/transports/base.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), debugBuild = require_debug_build2(), DEFAULT_TRANSPORT_BUFFER_SIZE = 64;
    function createTransport(options, makeRequest, buffer = utils.makePromiseBuffer(
      options.bufferSize || DEFAULT_TRANSPORT_BUFFER_SIZE
    )) {
      let rateLimits = {}, flush = (timeout) => buffer.drain(timeout);
      function send(envelope) {
        let filteredEnvelopeItems = [];
        if (utils.forEachEnvelopeItem(envelope, (item, type) => {
          let dataCategory = utils.envelopeItemTypeToDataCategory(type);
          if (utils.isRateLimited(rateLimits, dataCategory)) {
            let event = getEventForEnvelopeItem(item, type);
            options.recordDroppedEvent("ratelimit_backoff", dataCategory, event);
          } else
            filteredEnvelopeItems.push(item);
        }), filteredEnvelopeItems.length === 0)
          return utils.resolvedSyncPromise({});
        let filteredEnvelope = utils.createEnvelope(envelope[0], filteredEnvelopeItems), recordEnvelopeLoss = (reason) => {
          utils.forEachEnvelopeItem(filteredEnvelope, (item, type) => {
            let event = getEventForEnvelopeItem(item, type);
            options.recordDroppedEvent(reason, utils.envelopeItemTypeToDataCategory(type), event);
          });
        }, requestTask = () => makeRequest({ body: utils.serializeEnvelope(filteredEnvelope) }).then(
          (response) => (response.statusCode !== void 0 && (response.statusCode < 200 || response.statusCode >= 300) && debugBuild.DEBUG_BUILD && utils.logger.warn(`Sentry responded with status code ${response.statusCode} to sent event.`), rateLimits = utils.updateRateLimits(rateLimits, response), response),
          (error) => {
            throw recordEnvelopeLoss("network_error"), error;
          }
        );
        return buffer.add(requestTask).then(
          (result) => result,
          (error) => {
            if (error instanceof utils.SentryError)
              return debugBuild.DEBUG_BUILD && utils.logger.error("Skipped sending event because buffer is full."), recordEnvelopeLoss("queue_overflow"), utils.resolvedSyncPromise({});
            throw error;
          }
        );
      }
      return {
        send,
        flush
      };
    }
    function getEventForEnvelopeItem(item, type) {
      if (!(type !== "event" && type !== "transaction"))
        return Array.isArray(item) ? item[1] : void 0;
    }
    exports.DEFAULT_TRANSPORT_BUFFER_SIZE = DEFAULT_TRANSPORT_BUFFER_SIZE;
    exports.createTransport = createTransport;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/transports/offline.js
var require_offline = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/transports/offline.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), debugBuild = require_debug_build2(), MIN_DELAY = 100, START_DELAY = 5e3, MAX_DELAY = 36e5;
    function makeOfflineTransport(createTransport) {
      function log(...args) {
        debugBuild.DEBUG_BUILD && utils.logger.info("[Offline]:", ...args);
      }
      return (options) => {
        let transport = createTransport(options);
        if (!options.createStore)
          throw new Error("No `createStore` function was provided");
        let store = options.createStore(options), retryDelay = START_DELAY, flushTimer;
        function shouldQueue(env, error, retryDelay2) {
          return utils.envelopeContainsItemType(env, ["client_report"]) ? !1 : options.shouldStore ? options.shouldStore(env, error, retryDelay2) : !0;
        }
        function flushIn(delay) {
          flushTimer && clearTimeout(flushTimer), flushTimer = setTimeout(async () => {
            flushTimer = void 0;
            let found = await store.shift();
            found && (log("Attempting to send previously queued event"), found[0].sent_at = (/* @__PURE__ */ new Date()).toISOString(), send(found, !0).catch((e) => {
              log("Failed to retry sending", e);
            }));
          }, delay), typeof flushTimer != "number" && flushTimer.unref && flushTimer.unref();
        }
        function flushWithBackOff() {
          flushTimer || (flushIn(retryDelay), retryDelay = Math.min(retryDelay * 2, MAX_DELAY));
        }
        async function send(envelope, isRetry = !1) {
          if (!isRetry && utils.envelopeContainsItemType(envelope, ["replay_event", "replay_recording"]))
            return await store.push(envelope), flushIn(MIN_DELAY), {};
          try {
            let result = await transport.send(envelope), delay = MIN_DELAY;
            if (result) {
              if (result.headers && result.headers["retry-after"])
                delay = utils.parseRetryAfterHeader(result.headers["retry-after"]);
              else if (result.headers && result.headers["x-sentry-rate-limits"])
                delay = 6e4;
              else if ((result.statusCode || 0) >= 400)
                return result;
            }
            return flushIn(delay), retryDelay = START_DELAY, result;
          } catch (e) {
            if (await shouldQueue(envelope, e, retryDelay))
              return isRetry ? await store.unshift(envelope) : await store.push(envelope), flushWithBackOff(), log("Error sending. Event queued.", e), {};
            throw e;
          }
        }
        return options.flushAtStartup && flushWithBackOff(), {
          send,
          flush: (t) => transport.flush(t)
        };
      };
    }
    exports.MIN_DELAY = MIN_DELAY;
    exports.START_DELAY = START_DELAY;
    exports.makeOfflineTransport = makeOfflineTransport;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/transports/multiplexed.js
var require_multiplexed = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/transports/multiplexed.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), api = require_api();
    function eventFromEnvelope(env, types) {
      let event;
      return utils.forEachEnvelopeItem(env, (item, type) => (types.includes(type) && (event = Array.isArray(item) ? item[1] : void 0), !!event)), event;
    }
    function makeOverrideReleaseTransport(createTransport, release) {
      return (options) => {
        let transport = createTransport(options);
        return {
          ...transport,
          send: async (envelope) => {
            let event = eventFromEnvelope(envelope, ["event", "transaction", "profile", "replay_event"]);
            return event && (event.release = release), transport.send(envelope);
          }
        };
      };
    }
    function overrideDsn(envelope, dsn) {
      return utils.createEnvelope(
        dsn ? {
          ...envelope[0],
          dsn
        } : envelope[0],
        envelope[1]
      );
    }
    function makeMultiplexedTransport(createTransport, matcher) {
      return (options) => {
        let fallbackTransport = createTransport(options), otherTransports = /* @__PURE__ */ new Map();
        function getTransport(dsn, release) {
          let key = release ? `${dsn}:${release}` : dsn, transport = otherTransports.get(key);
          if (!transport) {
            let validatedDsn = utils.dsnFromString(dsn);
            if (!validatedDsn)
              return;
            let url = api.getEnvelopeEndpointWithUrlEncodedAuth(validatedDsn, options.tunnel);
            transport = release ? makeOverrideReleaseTransport(createTransport, release)({ ...options, url }) : createTransport({ ...options, url }), otherTransports.set(key, transport);
          }
          return [dsn, transport];
        }
        async function send(envelope) {
          function getEvent(types) {
            let eventTypes = types && types.length ? types : ["event"];
            return eventFromEnvelope(envelope, eventTypes);
          }
          let transports = matcher({ envelope, getEvent }).map((result) => typeof result == "string" ? getTransport(result, void 0) : getTransport(result.dsn, result.release)).filter((t) => !!t);
          return transports.length === 0 && transports.push(["", fallbackTransport]), (await Promise.all(
            transports.map(([dsn, transport]) => transport.send(overrideDsn(envelope, dsn)))
          ))[0];
        }
        async function flush(timeout) {
          let allTransports = [...otherTransports.values(), fallbackTransport];
          return (await Promise.all(allTransports.map((transport) => transport.flush(timeout)))).every((r) => r);
        }
        return {
          send,
          flush
        };
      };
    }
    exports.eventFromEnvelope = eventFromEnvelope;
    exports.makeMultiplexedTransport = makeMultiplexedTransport;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/isSentryRequestUrl.js
var require_isSentryRequestUrl = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/isSentryRequestUrl.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function isSentryRequestUrl(url, client) {
      let dsn = client && client.getDsn(), tunnel = client && client.getOptions().tunnel;
      return checkDsn(url, dsn) || checkTunnel(url, tunnel);
    }
    function checkTunnel(url, tunnel) {
      return tunnel ? removeTrailingSlash(url) === removeTrailingSlash(tunnel) : !1;
    }
    function checkDsn(url, dsn) {
      return dsn ? url.includes(dsn.host) : !1;
    }
    function removeTrailingSlash(str) {
      return str[str.length - 1] === "/" ? str.slice(0, -1) : str;
    }
    exports.isSentryRequestUrl = isSentryRequestUrl;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/parameterize.js
var require_parameterize = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/parameterize.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function parameterize(strings, ...values) {
      let formatted = new String(String.raw(strings, ...values));
      return formatted.__sentry_template_string__ = strings.join("\0").replace(/%/g, "%%").replace(/\0/g, "%s"), formatted.__sentry_template_values__ = values, formatted;
    }
    exports.parameterize = parameterize;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/sdkMetadata.js
var require_sdkMetadata = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/utils/sdkMetadata.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs();
    function applySdkMetadata(options, name, names = [name], source = "npm") {
      let metadata = options._metadata || {};
      metadata.sdk || (metadata.sdk = {
        name: `sentry.javascript.${name}`,
        packages: names.map((name2) => ({
          name: `${source}:@sentry/${name2}`,
          version: utils.SDK_VERSION
        })),
        version: utils.SDK_VERSION
      }), options._metadata = metadata;
    }
    exports.applySdkMetadata = applySdkMetadata;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/breadcrumbs.js
var require_breadcrumbs = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/breadcrumbs.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), DEFAULT_BREADCRUMBS = 100;
    function addBreadcrumb(breadcrumb, hint) {
      let client = currentScopes.getClient(), isolationScope = currentScopes.getIsolationScope();
      if (!client) return;
      let { beforeBreadcrumb = null, maxBreadcrumbs = DEFAULT_BREADCRUMBS } = client.getOptions();
      if (maxBreadcrumbs <= 0) return;
      let mergedBreadcrumb = { timestamp: utils.dateTimestampInSeconds(), ...breadcrumb }, finalBreadcrumb = beforeBreadcrumb ? utils.consoleSandbox(() => beforeBreadcrumb(mergedBreadcrumb, hint)) : mergedBreadcrumb;
      finalBreadcrumb !== null && (client.emit && client.emit("beforeAddBreadcrumb", finalBreadcrumb, hint), isolationScope.addBreadcrumb(finalBreadcrumb, maxBreadcrumbs));
    }
    exports.addBreadcrumb = addBreadcrumb;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/functiontostring.js
var require_functiontostring = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/functiontostring.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), integration = require_integration(), originalFunctionToString, INTEGRATION_NAME = "FunctionToString", SETUP_CLIENTS = /* @__PURE__ */ new WeakMap(), _functionToStringIntegration = () => ({
      name: INTEGRATION_NAME,
      setupOnce() {
        originalFunctionToString = Function.prototype.toString;
        try {
          Function.prototype.toString = function(...args) {
            let originalFunction = utils.getOriginalFunction(this), context = SETUP_CLIENTS.has(currentScopes.getClient()) && originalFunction !== void 0 ? originalFunction : this;
            return originalFunctionToString.apply(context, args);
          };
        } catch {
        }
      },
      setup(client) {
        SETUP_CLIENTS.set(client, !0);
      }
    }), functionToStringIntegration = integration.defineIntegration(_functionToStringIntegration);
    exports.functionToStringIntegration = functionToStringIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/inboundfilters.js
var require_inboundfilters = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/inboundfilters.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), debugBuild = require_debug_build2(), integration = require_integration(), DEFAULT_IGNORE_ERRORS = [
      /^Script error\.?$/,
      /^Javascript error: Script error\.? on line 0$/,
      /^ResizeObserver loop completed with undelivered notifications.$/,
      // The browser logs this when a ResizeObserver handler takes a bit longer. Usually this is not an actual issue though. It indicates slowness.
      /^Cannot redefine property: googletag$/,
      // This is thrown when google tag manager is used in combination with an ad blocker
      "undefined is not an object (evaluating 'a.L')",
      // Random error that happens but not actionable or noticeable to end-users.
      `can't redefine non-configurable property "solana"`,
      // Probably a browser extension or custom browser (Brave) throwing this error
      "vv().getRestrictions is not a function. (In 'vv().getRestrictions(1,a)', 'vv().getRestrictions' is undefined)",
      // Error thrown by GTM, seemingly not affecting end-users
      "Can't find variable: _AutofillCallbackHandler"
      // Unactionable error in instagram webview https://developers.facebook.com/community/threads/320013549791141/
    ], INTEGRATION_NAME = "InboundFilters", _inboundFiltersIntegration = (options = {}) => ({
      name: INTEGRATION_NAME,
      processEvent(event, _hint, client) {
        let clientOptions = client.getOptions(), mergedOptions = _mergeOptions(options, clientOptions);
        return _shouldDropEvent(event, mergedOptions) ? null : event;
      }
    }), inboundFiltersIntegration = integration.defineIntegration(_inboundFiltersIntegration);
    function _mergeOptions(internalOptions = {}, clientOptions = {}) {
      return {
        allowUrls: [...internalOptions.allowUrls || [], ...clientOptions.allowUrls || []],
        denyUrls: [...internalOptions.denyUrls || [], ...clientOptions.denyUrls || []],
        ignoreErrors: [
          ...internalOptions.ignoreErrors || [],
          ...clientOptions.ignoreErrors || [],
          ...internalOptions.disableErrorDefaults ? [] : DEFAULT_IGNORE_ERRORS
        ],
        ignoreTransactions: [...internalOptions.ignoreTransactions || [], ...clientOptions.ignoreTransactions || []],
        ignoreInternal: internalOptions.ignoreInternal !== void 0 ? internalOptions.ignoreInternal : !0
      };
    }
    function _shouldDropEvent(event, options) {
      return options.ignoreInternal && _isSentryError(event) ? (debugBuild.DEBUG_BUILD && utils.logger.warn(`Event dropped due to being internal Sentry Error.
Event: ${utils.getEventDescription(event)}`), !0) : _isIgnoredError(event, options.ignoreErrors) ? (debugBuild.DEBUG_BUILD && utils.logger.warn(
        `Event dropped due to being matched by \`ignoreErrors\` option.
Event: ${utils.getEventDescription(event)}`
      ), !0) : _isUselessError(event) ? (debugBuild.DEBUG_BUILD && utils.logger.warn(
        `Event dropped due to not having an error message, error type or stacktrace.
Event: ${utils.getEventDescription(
          event
        )}`
      ), !0) : _isIgnoredTransaction(event, options.ignoreTransactions) ? (debugBuild.DEBUG_BUILD && utils.logger.warn(
        `Event dropped due to being matched by \`ignoreTransactions\` option.
Event: ${utils.getEventDescription(event)}`
      ), !0) : _isDeniedUrl(event, options.denyUrls) ? (debugBuild.DEBUG_BUILD && utils.logger.warn(
        `Event dropped due to being matched by \`denyUrls\` option.
Event: ${utils.getEventDescription(
          event
        )}.
Url: ${_getEventFilterUrl(event)}`
      ), !0) : _isAllowedUrl(event, options.allowUrls) ? !1 : (debugBuild.DEBUG_BUILD && utils.logger.warn(
        `Event dropped due to not being matched by \`allowUrls\` option.
Event: ${utils.getEventDescription(
          event
        )}.
Url: ${_getEventFilterUrl(event)}`
      ), !0);
    }
    function _isIgnoredError(event, ignoreErrors) {
      return event.type || !ignoreErrors || !ignoreErrors.length ? !1 : _getPossibleEventMessages(event).some((message) => utils.stringMatchesSomePattern(message, ignoreErrors));
    }
    function _isIgnoredTransaction(event, ignoreTransactions) {
      if (event.type !== "transaction" || !ignoreTransactions || !ignoreTransactions.length)
        return !1;
      let name = event.transaction;
      return name ? utils.stringMatchesSomePattern(name, ignoreTransactions) : !1;
    }
    function _isDeniedUrl(event, denyUrls) {
      if (!denyUrls || !denyUrls.length)
        return !1;
      let url = _getEventFilterUrl(event);
      return url ? utils.stringMatchesSomePattern(url, denyUrls) : !1;
    }
    function _isAllowedUrl(event, allowUrls) {
      if (!allowUrls || !allowUrls.length)
        return !0;
      let url = _getEventFilterUrl(event);
      return url ? utils.stringMatchesSomePattern(url, allowUrls) : !0;
    }
    function _getPossibleEventMessages(event) {
      let possibleMessages = [];
      event.message && possibleMessages.push(event.message);
      let lastException;
      try {
        lastException = event.exception.values[event.exception.values.length - 1];
      } catch {
      }
      return lastException && lastException.value && (possibleMessages.push(lastException.value), lastException.type && possibleMessages.push(`${lastException.type}: ${lastException.value}`)), possibleMessages;
    }
    function _isSentryError(event) {
      try {
        return event.exception.values[0].type === "SentryError";
      } catch {
      }
      return !1;
    }
    function _getLastValidUrl(frames = []) {
      for (let i = frames.length - 1; i >= 0; i--) {
        let frame = frames[i];
        if (frame && frame.filename !== "<anonymous>" && frame.filename !== "[native code]")
          return frame.filename || null;
      }
      return null;
    }
    function _getEventFilterUrl(event) {
      try {
        let frames;
        try {
          frames = event.exception.values[0].stacktrace.frames;
        } catch {
        }
        return frames ? _getLastValidUrl(frames) : null;
      } catch {
        return debugBuild.DEBUG_BUILD && utils.logger.error(`Cannot extract url for event ${utils.getEventDescription(event)}`), null;
      }
    }
    function _isUselessError(event) {
      return event.type || !event.exception || !event.exception.values || event.exception.values.length === 0 ? !1 : (
        // No top-level message
        !event.message && // There are no exception values that have a stacktrace, a non-generic-Error type or value
        !event.exception.values.some((value) => value.stacktrace || value.type && value.type !== "Error" || value.value)
      );
    }
    exports.inboundFiltersIntegration = inboundFiltersIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/linkederrors.js
var require_linkederrors = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/linkederrors.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), DEFAULT_KEY = "cause", DEFAULT_LIMIT = 5, INTEGRATION_NAME = "LinkedErrors", _linkedErrorsIntegration = (options = {}) => {
      let limit = options.limit || DEFAULT_LIMIT, key = options.key || DEFAULT_KEY;
      return {
        name: INTEGRATION_NAME,
        preprocessEvent(event, hint, client) {
          let options2 = client.getOptions();
          utils.applyAggregateErrorsToEvent(
            utils.exceptionFromError,
            options2.stackParser,
            options2.maxValueLength,
            key,
            limit,
            event,
            hint
          );
        }
      };
    }, linkedErrorsIntegration = integration.defineIntegration(_linkedErrorsIntegration);
    exports.linkedErrorsIntegration = linkedErrorsIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metadata.js
var require_metadata = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metadata.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), filenameMetadataMap = /* @__PURE__ */ new Map(), parsedStacks = /* @__PURE__ */ new Set();
    function ensureMetadataStacksAreParsed(parser) {
      if (utils.GLOBAL_OBJ._sentryModuleMetadata)
        for (let stack of Object.keys(utils.GLOBAL_OBJ._sentryModuleMetadata)) {
          let metadata = utils.GLOBAL_OBJ._sentryModuleMetadata[stack];
          if (parsedStacks.has(stack))
            continue;
          parsedStacks.add(stack);
          let frames = parser(stack);
          for (let frame of frames.reverse())
            if (frame.filename) {
              filenameMetadataMap.set(frame.filename, metadata);
              break;
            }
        }
    }
    function getMetadataForUrl(parser, filename) {
      return ensureMetadataStacksAreParsed(parser), filenameMetadataMap.get(filename);
    }
    function addMetadataToStackFrames(parser, event) {
      try {
        event.exception.values.forEach((exception) => {
          if (exception.stacktrace)
            for (let frame of exception.stacktrace.frames || []) {
              if (!frame.filename || frame.module_metadata)
                continue;
              let metadata = getMetadataForUrl(parser, frame.filename);
              metadata && (frame.module_metadata = metadata);
            }
        });
      } catch {
      }
    }
    function stripMetadataFromStackFrames(event) {
      try {
        event.exception.values.forEach((exception) => {
          if (exception.stacktrace)
            for (let frame of exception.stacktrace.frames || [])
              delete frame.module_metadata;
        });
      } catch {
      }
    }
    exports.addMetadataToStackFrames = addMetadataToStackFrames;
    exports.getMetadataForUrl = getMetadataForUrl;
    exports.stripMetadataFromStackFrames = stripMetadataFromStackFrames;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/metadata.js
var require_metadata2 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/metadata.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), metadata = require_metadata(), INTEGRATION_NAME = "ModuleMetadata", _moduleMetadataIntegration = () => ({
      name: INTEGRATION_NAME,
      setup(client) {
        client.on("beforeEnvelope", (envelope) => {
          utils.forEachEnvelopeItem(envelope, (item, type) => {
            if (type === "event") {
              let event = Array.isArray(item) ? item[1] : void 0;
              event && (metadata.stripMetadataFromStackFrames(event), item[1] = event);
            }
          });
        });
      },
      processEvent(event, _hint, client) {
        let stackParser = client.getOptions().stackParser;
        return metadata.addMetadataToStackFrames(stackParser, event), event;
      }
    }), moduleMetadataIntegration = integration.defineIntegration(_moduleMetadataIntegration);
    exports.moduleMetadataIntegration = moduleMetadataIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/requestdata.js
var require_requestdata2 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/requestdata.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), DEFAULT_OPTIONS = {
      include: {
        cookies: !0,
        data: !0,
        headers: !0,
        ip: !1,
        query_string: !0,
        url: !0,
        user: {
          id: !0,
          username: !0,
          email: !0
        }
      },
      transactionNamingScheme: "methodPath"
    }, INTEGRATION_NAME = "RequestData", _requestDataIntegration = (options = {}) => {
      let _options = {
        ...DEFAULT_OPTIONS,
        ...options,
        include: {
          ...DEFAULT_OPTIONS.include,
          ...options.include,
          user: options.include && typeof options.include.user == "boolean" ? options.include.user : {
            ...DEFAULT_OPTIONS.include.user,
            // Unclear why TS still thinks `options.include.user` could be a boolean at this point
            ...(options.include || {}).user
          }
        }
      };
      return {
        name: INTEGRATION_NAME,
        processEvent(event) {
          let { sdkProcessingMetadata = {} } = event, req = sdkProcessingMetadata.request;
          if (!req)
            return event;
          let addRequestDataOptions = convertReqDataIntegrationOptsToAddReqDataOpts(_options);
          return utils.addRequestDataToEvent(event, req, addRequestDataOptions);
        }
      };
    }, requestDataIntegration = integration.defineIntegration(_requestDataIntegration);
    function convertReqDataIntegrationOptsToAddReqDataOpts(integrationOptions) {
      let {
        transactionNamingScheme,
        include: { ip, user, ...requestOptions }
      } = integrationOptions, requestIncludeKeys = ["method"];
      for (let [key, value] of Object.entries(requestOptions))
        value && requestIncludeKeys.push(key);
      let addReqDataUserOpt;
      if (user === void 0)
        addReqDataUserOpt = !0;
      else if (typeof user == "boolean")
        addReqDataUserOpt = user;
      else {
        let userIncludeKeys = [];
        for (let [key, value] of Object.entries(user))
          value && userIncludeKeys.push(key);
        addReqDataUserOpt = userIncludeKeys;
      }
      return {
        include: {
          ip,
          user: addReqDataUserOpt,
          request: requestIncludeKeys.length !== 0 ? requestIncludeKeys : void 0,
          transaction: transactionNamingScheme
        }
      };
    }
    exports.requestDataIntegration = requestDataIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/captureconsole.js
var require_captureconsole = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/captureconsole.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), exports$1 = require_exports(), integration = require_integration(), INTEGRATION_NAME = "CaptureConsole", _captureConsoleIntegration = (options = {}) => {
      let levels = options.levels || utils.CONSOLE_LEVELS;
      return {
        name: INTEGRATION_NAME,
        setup(client) {
          "console" in utils.GLOBAL_OBJ && utils.addConsoleInstrumentationHandler(({ args, level }) => {
            currentScopes.getClient() !== client || !levels.includes(level) || consoleHandler(args, level);
          });
        }
      };
    }, captureConsoleIntegration = integration.defineIntegration(_captureConsoleIntegration);
    function consoleHandler(args, level) {
      let captureContext = {
        level: utils.severityLevelFromString(level),
        extra: {
          arguments: args
        }
      };
      currentScopes.withScope((scope) => {
        if (scope.addEventProcessor((event) => (event.logger = "console", utils.addExceptionMechanism(event, {
          handled: !1,
          type: "console"
        }), event)), level === "assert") {
          if (!args[0]) {
            let message2 = `Assertion failed: ${utils.safeJoin(args.slice(1), " ") || "console.assert"}`;
            scope.setExtra("arguments", args.slice(1)), exports$1.captureMessage(message2, captureContext);
          }
          return;
        }
        let error = args.find((arg) => arg instanceof Error);
        if (error) {
          exports$1.captureException(error, captureContext);
          return;
        }
        let message = utils.safeJoin(args, " ");
        exports$1.captureMessage(message, captureContext);
      });
    }
    exports.captureConsoleIntegration = captureConsoleIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/debug.js
var require_debug = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/debug.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), INTEGRATION_NAME = "Debug", _debugIntegration = (options = {}) => {
      let _options = {
        debugger: !1,
        stringify: !1,
        ...options
      };
      return {
        name: INTEGRATION_NAME,
        setup(client) {
          client.on("beforeSendEvent", (event, hint) => {
            if (_options.debugger)
              debugger;
            utils.consoleSandbox(() => {
              _options.stringify ? (console.log(JSON.stringify(event, null, 2)), hint && Object.keys(hint).length && console.log(JSON.stringify(hint, null, 2))) : (console.log(event), hint && Object.keys(hint).length && console.log(hint));
            });
          });
        }
      };
    }, debugIntegration = integration.defineIntegration(_debugIntegration);
    exports.debugIntegration = debugIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/dedupe.js
var require_dedupe = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/dedupe.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), debugBuild = require_debug_build2(), INTEGRATION_NAME = "Dedupe", _dedupeIntegration = () => {
      let previousEvent;
      return {
        name: INTEGRATION_NAME,
        processEvent(currentEvent) {
          if (currentEvent.type)
            return currentEvent;
          try {
            if (_shouldDropEvent(currentEvent, previousEvent))
              return debugBuild.DEBUG_BUILD && utils.logger.warn("Event dropped due to being a duplicate of previously captured event."), null;
          } catch {
          }
          return previousEvent = currentEvent;
        }
      };
    }, dedupeIntegration = integration.defineIntegration(_dedupeIntegration);
    function _shouldDropEvent(currentEvent, previousEvent) {
      return previousEvent ? !!(_isSameMessageEvent(currentEvent, previousEvent) || _isSameExceptionEvent(currentEvent, previousEvent)) : !1;
    }
    function _isSameMessageEvent(currentEvent, previousEvent) {
      let currentMessage = currentEvent.message, previousMessage = previousEvent.message;
      return !(!currentMessage && !previousMessage || currentMessage && !previousMessage || !currentMessage && previousMessage || currentMessage !== previousMessage || !_isSameFingerprint(currentEvent, previousEvent) || !_isSameStacktrace(currentEvent, previousEvent));
    }
    function _isSameExceptionEvent(currentEvent, previousEvent) {
      let previousException = _getExceptionFromEvent(previousEvent), currentException = _getExceptionFromEvent(currentEvent);
      return !(!previousException || !currentException || previousException.type !== currentException.type || previousException.value !== currentException.value || !_isSameFingerprint(currentEvent, previousEvent) || !_isSameStacktrace(currentEvent, previousEvent));
    }
    function _isSameStacktrace(currentEvent, previousEvent) {
      let currentFrames = utils.getFramesFromEvent(currentEvent), previousFrames = utils.getFramesFromEvent(previousEvent);
      if (!currentFrames && !previousFrames)
        return !0;
      if (currentFrames && !previousFrames || !currentFrames && previousFrames || (currentFrames = currentFrames, previousFrames = previousFrames, previousFrames.length !== currentFrames.length))
        return !1;
      for (let i = 0; i < previousFrames.length; i++) {
        let frameA = previousFrames[i], frameB = currentFrames[i];
        if (frameA.filename !== frameB.filename || frameA.lineno !== frameB.lineno || frameA.colno !== frameB.colno || frameA.function !== frameB.function)
          return !1;
      }
      return !0;
    }
    function _isSameFingerprint(currentEvent, previousEvent) {
      let currentFingerprint = currentEvent.fingerprint, previousFingerprint = previousEvent.fingerprint;
      if (!currentFingerprint && !previousFingerprint)
        return !0;
      if (currentFingerprint && !previousFingerprint || !currentFingerprint && previousFingerprint)
        return !1;
      currentFingerprint = currentFingerprint, previousFingerprint = previousFingerprint;
      try {
        return currentFingerprint.join("") === previousFingerprint.join("");
      } catch {
        return !1;
      }
    }
    function _getExceptionFromEvent(event) {
      return event.exception && event.exception.values && event.exception.values[0];
    }
    exports._shouldDropEvent = _shouldDropEvent;
    exports.dedupeIntegration = dedupeIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/extraerrordata.js
var require_extraerrordata = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/extraerrordata.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), debugBuild = require_debug_build2(), INTEGRATION_NAME = "ExtraErrorData", _extraErrorDataIntegration = (options = {}) => {
      let { depth = 3, captureErrorCause = !0 } = options;
      return {
        name: INTEGRATION_NAME,
        processEvent(event, hint) {
          return _enhanceEventWithErrorData(event, hint, depth, captureErrorCause);
        }
      };
    }, extraErrorDataIntegration = integration.defineIntegration(_extraErrorDataIntegration);
    function _enhanceEventWithErrorData(event, hint = {}, depth, captureErrorCause) {
      if (!hint.originalException || !utils.isError(hint.originalException))
        return event;
      let exceptionName = hint.originalException.name || hint.originalException.constructor.name, errorData = _extractErrorData(hint.originalException, captureErrorCause);
      if (errorData) {
        let contexts = {
          ...event.contexts
        }, normalizedErrorData = utils.normalize(errorData, depth);
        return utils.isPlainObject(normalizedErrorData) && (utils.addNonEnumerableProperty(normalizedErrorData, "__sentry_skip_normalization__", !0), contexts[exceptionName] = normalizedErrorData), {
          ...event,
          contexts
        };
      }
      return event;
    }
    function _extractErrorData(error, captureErrorCause) {
      try {
        let nativeKeys = [
          "name",
          "message",
          "stack",
          "line",
          "column",
          "fileName",
          "lineNumber",
          "columnNumber",
          "toJSON"
        ], extraErrorInfo = {};
        for (let key of Object.keys(error)) {
          if (nativeKeys.indexOf(key) !== -1)
            continue;
          let value = error[key];
          extraErrorInfo[key] = utils.isError(value) ? value.toString() : value;
        }
        if (captureErrorCause && error.cause !== void 0 && (extraErrorInfo.cause = utils.isError(error.cause) ? error.cause.toString() : error.cause), typeof error.toJSON == "function") {
          let serializedError = error.toJSON();
          for (let key of Object.keys(serializedError)) {
            let value = serializedError[key];
            extraErrorInfo[key] = utils.isError(value) ? value.toString() : value;
          }
        }
        return extraErrorInfo;
      } catch (oO) {
        debugBuild.DEBUG_BUILD && utils.logger.error("Unable to extract extra data from the Error object:", oO);
      }
      return null;
    }
    exports.extraErrorDataIntegration = extraErrorDataIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/rewriteframes.js
var require_rewriteframes = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/rewriteframes.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), INTEGRATION_NAME = "RewriteFrames", rewriteFramesIntegration2 = integration.defineIntegration((options = {}) => {
      let root = options.root, prefix = options.prefix || "app:///", isBrowser = "window" in utils.GLOBAL_OBJ && utils.GLOBAL_OBJ.window !== void 0, iteratee = options.iteratee || generateIteratee({ isBrowser, root, prefix });
      function _processExceptionsEvent(event) {
        try {
          return {
            ...event,
            exception: {
              ...event.exception,
              // The check for this is performed inside `process` call itself, safe to skip here
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              values: event.exception.values.map((value) => ({
                ...value,
                ...value.stacktrace && { stacktrace: _processStacktrace(value.stacktrace) }
              }))
            }
          };
        } catch {
          return event;
        }
      }
      function _processStacktrace(stacktrace) {
        return {
          ...stacktrace,
          frames: stacktrace && stacktrace.frames && stacktrace.frames.map((f) => iteratee(f))
        };
      }
      return {
        name: INTEGRATION_NAME,
        processEvent(originalEvent) {
          let processedEvent = originalEvent;
          return originalEvent.exception && Array.isArray(originalEvent.exception.values) && (processedEvent = _processExceptionsEvent(processedEvent)), processedEvent;
        }
      };
    });
    function generateIteratee({
      isBrowser,
      root,
      prefix
    }) {
      return (frame) => {
        if (!frame.filename)
          return frame;
        let isWindowsFrame = /^[a-zA-Z]:\\/.test(frame.filename) || // or the presence of a backslash without a forward slash (which are not allowed on Windows)
        frame.filename.includes("\\") && !frame.filename.includes("/"), startsWithSlash = /^\//.test(frame.filename);
        if (isBrowser) {
          if (root) {
            let oldFilename = frame.filename;
            oldFilename.indexOf(root) === 0 && (frame.filename = oldFilename.replace(root, prefix));
          }
        } else if (isWindowsFrame || startsWithSlash) {
          let filename = isWindowsFrame ? frame.filename.replace(/^[a-zA-Z]:/, "").replace(/\\/g, "/") : frame.filename, base = root ? utils.relative(root, filename) : utils.basename(filename);
          frame.filename = `${prefix}${base}`;
        }
        return frame;
      };
    }
    exports.generateIteratee = generateIteratee;
    exports.rewriteFramesIntegration = rewriteFramesIntegration2;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/sessiontiming.js
var require_sessiontiming = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/sessiontiming.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), INTEGRATION_NAME = "SessionTiming", _sessionTimingIntegration = () => {
      let startTime = utils.timestampInSeconds() * 1e3;
      return {
        name: INTEGRATION_NAME,
        processEvent(event) {
          let now = utils.timestampInSeconds() * 1e3;
          return {
            ...event,
            extra: {
              ...event.extra,
              "session:start": startTime,
              "session:duration": now - startTime,
              "session:end": now
            }
          };
        }
      };
    }, sessionTimingIntegration = integration.defineIntegration(_sessionTimingIntegration);
    exports.sessionTimingIntegration = sessionTimingIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/zoderrors.js
var require_zoderrors = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/zoderrors.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), DEFAULT_LIMIT = 10, INTEGRATION_NAME = "ZodErrors";
    function originalExceptionIsZodError(originalException) {
      return utils.isError(originalException) && originalException.name === "ZodError" && Array.isArray(originalException.errors);
    }
    function formatIssueTitle(issue) {
      return {
        ...issue,
        path: "path" in issue && Array.isArray(issue.path) ? issue.path.join(".") : void 0,
        keys: "keys" in issue ? JSON.stringify(issue.keys) : void 0,
        unionErrors: "unionErrors" in issue ? JSON.stringify(issue.unionErrors) : void 0
      };
    }
    function formatIssueMessage(zodError) {
      let errorKeyMap = /* @__PURE__ */ new Set();
      for (let iss of zodError.issues)
        iss.path && errorKeyMap.add(iss.path[0]);
      let errorKeys = Array.from(errorKeyMap);
      return `Failed to validate keys: ${utils.truncate(errorKeys.join(", "), 100)}`;
    }
    function applyZodErrorsToEvent(limit, event, hint) {
      return !event.exception || !event.exception.values || !hint || !hint.originalException || !originalExceptionIsZodError(hint.originalException) || hint.originalException.issues.length === 0 ? event : {
        ...event,
        exception: {
          ...event.exception,
          values: [
            {
              ...event.exception.values[0],
              value: formatIssueMessage(hint.originalException)
            },
            ...event.exception.values.slice(1)
          ]
        },
        extra: {
          ...event.extra,
          "zoderror.issues": hint.originalException.errors.slice(0, limit).map(formatIssueTitle)
        }
      };
    }
    var _zodErrorsIntegration = (options = {}) => {
      let limit = options.limit || DEFAULT_LIMIT;
      return {
        name: INTEGRATION_NAME,
        processEvent(originalEvent, hint) {
          return applyZodErrorsToEvent(limit, originalEvent, hint);
        }
      };
    }, zodErrorsIntegration = integration.defineIntegration(_zodErrorsIntegration);
    exports.applyZodErrorsToEvent = applyZodErrorsToEvent;
    exports.zodErrorsIntegration = zodErrorsIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/third-party-errors-filter.js
var require_third_party_errors_filter = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/integrations/third-party-errors-filter.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), integration = require_integration(), metadata = require_metadata(), thirdPartyErrorFilterIntegration = integration.defineIntegration((options) => ({
      name: "ThirdPartyErrorsFilter",
      setup(client) {
        client.on("beforeEnvelope", (envelope) => {
          utils.forEachEnvelopeItem(envelope, (item, type) => {
            if (type === "event") {
              let event = Array.isArray(item) ? item[1] : void 0;
              event && (metadata.stripMetadataFromStackFrames(event), item[1] = event);
            }
          });
        });
      },
      processEvent(event, _hint, client) {
        let stackParser = client.getOptions().stackParser;
        metadata.addMetadataToStackFrames(stackParser, event);
        let frameKeys = getBundleKeysForAllFramesWithFilenames(event);
        if (frameKeys) {
          let arrayMethod = options.behaviour === "drop-error-if-contains-third-party-frames" || options.behaviour === "apply-tag-if-contains-third-party-frames" ? "some" : "every";
          if (frameKeys[arrayMethod]((keys) => !keys.some((key) => options.filterKeys.includes(key)))) {
            if (options.behaviour === "drop-error-if-contains-third-party-frames" || options.behaviour === "drop-error-if-exclusively-contains-third-party-frames")
              return null;
            event.tags = {
              ...event.tags,
              third_party_code: !0
            };
          }
        }
        return event;
      }
    }));
    function getBundleKeysForAllFramesWithFilenames(event) {
      let frames = utils.getFramesFromEvent(event);
      if (frames)
        return frames.filter((frame) => !!frame.filename).map((frame) => frame.module_metadata ? Object.keys(frame.module_metadata).filter((key) => key.startsWith(BUNDLER_PLUGIN_APP_KEY_PREFIX)).map((key) => key.slice(BUNDLER_PLUGIN_APP_KEY_PREFIX.length)) : []);
    }
    var BUNDLER_PLUGIN_APP_KEY_PREFIX = "_sentryBundlerPluginAppKey:";
    exports.thirdPartyErrorFilterIntegration = thirdPartyErrorFilterIntegration;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/constants.js
var require_constants2 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/constants.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var COUNTER_METRIC_TYPE = "c", GAUGE_METRIC_TYPE = "g", SET_METRIC_TYPE = "s", DISTRIBUTION_METRIC_TYPE = "d", DEFAULT_BROWSER_FLUSH_INTERVAL = 5e3, DEFAULT_FLUSH_INTERVAL = 1e4, MAX_WEIGHT = 1e4;
    exports.COUNTER_METRIC_TYPE = COUNTER_METRIC_TYPE;
    exports.DEFAULT_BROWSER_FLUSH_INTERVAL = DEFAULT_BROWSER_FLUSH_INTERVAL;
    exports.DEFAULT_FLUSH_INTERVAL = DEFAULT_FLUSH_INTERVAL;
    exports.DISTRIBUTION_METRIC_TYPE = DISTRIBUTION_METRIC_TYPE;
    exports.GAUGE_METRIC_TYPE = GAUGE_METRIC_TYPE;
    exports.MAX_WEIGHT = MAX_WEIGHT;
    exports.SET_METRIC_TYPE = SET_METRIC_TYPE;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/exports.js
var require_exports2 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/exports.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), debugBuild = require_debug_build2();
    require_errors();
    var spanUtils = require_spanUtils(), trace = require_trace(), handleCallbackErrors = require_handleCallbackErrors(), constants = require_constants2();
    function getMetricsAggregatorForClient(client, Aggregator) {
      let globalMetricsAggregators = utils.getGlobalSingleton(
        "globalMetricsAggregators",
        () => /* @__PURE__ */ new WeakMap()
      ), aggregator = globalMetricsAggregators.get(client);
      if (aggregator)
        return aggregator;
      let newAggregator = new Aggregator(client);
      return client.on("flush", () => newAggregator.flush()), client.on("close", () => newAggregator.close()), globalMetricsAggregators.set(client, newAggregator), newAggregator;
    }
    function addToMetricsAggregator(Aggregator, metricType, name, value, data = {}) {
      let client = data.client || currentScopes.getClient();
      if (!client)
        return;
      let span = spanUtils.getActiveSpan(), rootSpan = span ? spanUtils.getRootSpan(span) : void 0, transactionName = rootSpan && spanUtils.spanToJSON(rootSpan).description, { unit, tags, timestamp } = data, { release, environment } = client.getOptions(), metricTags = {};
      release && (metricTags.release = release), environment && (metricTags.environment = environment), transactionName && (metricTags.transaction = transactionName), debugBuild.DEBUG_BUILD && utils.logger.log(`Adding value of ${value} to ${metricType} metric ${name}`), getMetricsAggregatorForClient(client, Aggregator).add(metricType, name, value, unit, { ...metricTags, ...tags }, timestamp);
    }
    function increment(aggregator, name, value = 1, data) {
      addToMetricsAggregator(aggregator, constants.COUNTER_METRIC_TYPE, name, ensureNumber(value), data);
    }
    function distribution(aggregator, name, value, data) {
      addToMetricsAggregator(aggregator, constants.DISTRIBUTION_METRIC_TYPE, name, ensureNumber(value), data);
    }
    function timing(aggregator, name, value, unit = "second", data) {
      if (typeof value == "function") {
        let startTime = utils.timestampInSeconds();
        return trace.startSpanManual(
          {
            op: "metrics.timing",
            name,
            startTime,
            onlyIfParent: !0
          },
          (span) => handleCallbackErrors.handleCallbackErrors(
            () => value(),
            () => {
            },
            () => {
              let endTime = utils.timestampInSeconds(), timeDiff = endTime - startTime;
              distribution(aggregator, name, timeDiff, { ...data, unit: "second" }), span.end(endTime);
            }
          )
        );
      }
      distribution(aggregator, name, value, { ...data, unit });
    }
    function set(aggregator, name, value, data) {
      addToMetricsAggregator(aggregator, constants.SET_METRIC_TYPE, name, value, data);
    }
    function gauge(aggregator, name, value, data) {
      addToMetricsAggregator(aggregator, constants.GAUGE_METRIC_TYPE, name, ensureNumber(value), data);
    }
    var metrics = {
      increment,
      distribution,
      set,
      gauge,
      timing,
      /**
       * @ignore This is for internal use only.
       */
      getMetricsAggregatorForClient
    };
    function ensureNumber(number) {
      return typeof number == "string" ? parseInt(number) : number;
    }
    exports.metrics = metrics;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/utils.js
var require_utils2 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/utils.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs();
    function getBucketKey(metricType, name, unit, tags) {
      let stringifiedTags = Object.entries(utils.dropUndefinedKeys(tags)).sort((a, b) => a[0].localeCompare(b[0]));
      return `${metricType}${name}${unit}${stringifiedTags}`;
    }
    function simpleHash(s) {
      let rv = 0;
      for (let i = 0; i < s.length; i++) {
        let c = s.charCodeAt(i);
        rv = (rv << 5) - rv + c, rv &= rv;
      }
      return rv >>> 0;
    }
    function serializeMetricBuckets(metricBucketItems) {
      let out = "";
      for (let item of metricBucketItems) {
        let tagEntries = Object.entries(item.tags), maybeTags = tagEntries.length > 0 ? `|#${tagEntries.map(([key, value]) => `${key}:${value}`).join(",")}` : "";
        out += `${item.name}@${item.unit}:${item.metric}|${item.metricType}${maybeTags}|T${item.timestamp}
`;
      }
      return out;
    }
    function sanitizeUnit(unit) {
      return unit.replace(/[^\w]+/gi, "_");
    }
    function sanitizeMetricKey(key) {
      return key.replace(/[^\w\-.]+/gi, "_");
    }
    function sanitizeTagKey(key) {
      return key.replace(/[^\w\-./]+/gi, "");
    }
    var tagValueReplacements = [
      [`
`, "\\n"],
      ["\r", "\\r"],
      ["	", "\\t"],
      ["\\", "\\\\"],
      ["|", "\\u{7c}"],
      [",", "\\u{2c}"]
    ];
    function getCharOrReplacement(input) {
      for (let [search, replacement] of tagValueReplacements)
        if (input === search)
          return replacement;
      return input;
    }
    function sanitizeTagValue(value) {
      return [...value].reduce((acc, char) => acc + getCharOrReplacement(char), "");
    }
    function sanitizeTags(unsanitizedTags) {
      let tags = {};
      for (let key in unsanitizedTags)
        if (Object.prototype.hasOwnProperty.call(unsanitizedTags, key)) {
          let sanitizedKey = sanitizeTagKey(key);
          tags[sanitizedKey] = sanitizeTagValue(String(unsanitizedTags[key]));
        }
      return tags;
    }
    exports.getBucketKey = getBucketKey;
    exports.sanitizeMetricKey = sanitizeMetricKey;
    exports.sanitizeTags = sanitizeTags;
    exports.sanitizeUnit = sanitizeUnit;
    exports.serializeMetricBuckets = serializeMetricBuckets;
    exports.simpleHash = simpleHash;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/envelope.js
var require_envelope3 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/envelope.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), utils$1 = require_utils2();
    function captureAggregateMetrics(client, metricBucketItems) {
      utils.logger.log(`Flushing aggregated metrics, number of metrics: ${metricBucketItems.length}`);
      let dsn = client.getDsn(), metadata = client.getSdkMetadata(), tunnel = client.getOptions().tunnel, metricsEnvelope = createMetricEnvelope(metricBucketItems, dsn, metadata, tunnel);
      client.sendEnvelope(metricsEnvelope);
    }
    function createMetricEnvelope(metricBucketItems, dsn, metadata, tunnel) {
      let headers = {
        sent_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      metadata && metadata.sdk && (headers.sdk = {
        name: metadata.sdk.name,
        version: metadata.sdk.version
      }), tunnel && dsn && (headers.dsn = utils.dsnToString(dsn));
      let item = createMetricEnvelopeItem(metricBucketItems);
      return utils.createEnvelope(headers, [item]);
    }
    function createMetricEnvelopeItem(metricBucketItems) {
      let payload = utils$1.serializeMetricBuckets(metricBucketItems);
      return [{
        type: "statsd",
        length: payload.length
      }, payload];
    }
    exports.captureAggregateMetrics = captureAggregateMetrics;
    exports.createMetricEnvelope = createMetricEnvelope;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/instance.js
var require_instance = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/instance.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var constants = require_constants2(), utils = require_utils2(), CounterMetric = class {
      constructor(_value) {
        this._value = _value;
      }
      /** @inheritDoc */
      get weight() {
        return 1;
      }
      /** @inheritdoc */
      add(value) {
        this._value += value;
      }
      /** @inheritdoc */
      toString() {
        return `${this._value}`;
      }
    }, GaugeMetric = class {
      constructor(value) {
        this._last = value, this._min = value, this._max = value, this._sum = value, this._count = 1;
      }
      /** @inheritDoc */
      get weight() {
        return 5;
      }
      /** @inheritdoc */
      add(value) {
        this._last = value, value < this._min && (this._min = value), value > this._max && (this._max = value), this._sum += value, this._count++;
      }
      /** @inheritdoc */
      toString() {
        return `${this._last}:${this._min}:${this._max}:${this._sum}:${this._count}`;
      }
    }, DistributionMetric = class {
      constructor(first) {
        this._value = [first];
      }
      /** @inheritDoc */
      get weight() {
        return this._value.length;
      }
      /** @inheritdoc */
      add(value) {
        this._value.push(value);
      }
      /** @inheritdoc */
      toString() {
        return this._value.join(":");
      }
    }, SetMetric = class {
      constructor(first) {
        this.first = first, this._value = /* @__PURE__ */ new Set([first]);
      }
      /** @inheritDoc */
      get weight() {
        return this._value.size;
      }
      /** @inheritdoc */
      add(value) {
        this._value.add(value);
      }
      /** @inheritdoc */
      toString() {
        return Array.from(this._value).map((val) => typeof val == "string" ? utils.simpleHash(val) : val).join(":");
      }
    }, METRIC_MAP = {
      [constants.COUNTER_METRIC_TYPE]: CounterMetric,
      [constants.GAUGE_METRIC_TYPE]: GaugeMetric,
      [constants.DISTRIBUTION_METRIC_TYPE]: DistributionMetric,
      [constants.SET_METRIC_TYPE]: SetMetric
    };
    exports.CounterMetric = CounterMetric;
    exports.DistributionMetric = DistributionMetric;
    exports.GaugeMetric = GaugeMetric;
    exports.METRIC_MAP = METRIC_MAP;
    exports.SetMetric = SetMetric;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/aggregator.js
var require_aggregator = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/aggregator.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils$1 = require_cjs(), spanUtils = require_spanUtils(), constants = require_constants2(), envelope = require_envelope3(), instance = require_instance(), utils = require_utils2(), MetricsAggregator = class {
      // TODO(@anonrig): Use FinalizationRegistry to have a proper way of flushing the buckets
      // when the aggregator is garbage collected.
      // Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry
      // Different metrics have different weights. We use this to limit the number of metrics
      // that we store in memory.
      // Cast to any so that it can use Node.js timeout
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // SDKs are required to shift the flush interval by random() * rollup_in_seconds.
      // That shift is determined once per startup to create jittering.
      // An SDK is required to perform force flushing ahead of scheduled time if the memory
      // pressure is too high. There is no rule for this other than that SDKs should be tracking
      // abstract aggregation complexity (eg: a counter only carries a single float, whereas a
      // distribution is a float per emission).
      //
      // Force flush is used on either shutdown, flush() or when we exceed the max weight.
      constructor(_client) {
        this._client = _client, this._buckets = /* @__PURE__ */ new Map(), this._bucketsTotalWeight = 0, this._interval = setInterval(() => this._flush(), constants.DEFAULT_FLUSH_INTERVAL), this._interval.unref && this._interval.unref(), this._flushShift = Math.floor(Math.random() * constants.DEFAULT_FLUSH_INTERVAL / 1e3), this._forceFlush = !1;
      }
      /**
       * @inheritDoc
       */
      add(metricType, unsanitizedName, value, unsanitizedUnit = "none", unsanitizedTags = {}, maybeFloatTimestamp = utils$1.timestampInSeconds()) {
        let timestamp = Math.floor(maybeFloatTimestamp), name = utils.sanitizeMetricKey(unsanitizedName), tags = utils.sanitizeTags(unsanitizedTags), unit = utils.sanitizeUnit(unsanitizedUnit), bucketKey = utils.getBucketKey(metricType, name, unit, tags), bucketItem = this._buckets.get(bucketKey), previousWeight = bucketItem && metricType === constants.SET_METRIC_TYPE ? bucketItem.metric.weight : 0;
        bucketItem ? (bucketItem.metric.add(value), bucketItem.timestamp < timestamp && (bucketItem.timestamp = timestamp)) : (bucketItem = {
          // @ts-expect-error we don't need to narrow down the type of value here, saves bundle size.
          metric: new instance.METRIC_MAP[metricType](value),
          timestamp,
          metricType,
          name,
          unit,
          tags
        }, this._buckets.set(bucketKey, bucketItem));
        let val = typeof value == "string" ? bucketItem.metric.weight - previousWeight : value;
        spanUtils.updateMetricSummaryOnActiveSpan(metricType, name, val, unit, unsanitizedTags, bucketKey), this._bucketsTotalWeight += bucketItem.metric.weight, this._bucketsTotalWeight >= constants.MAX_WEIGHT && this.flush();
      }
      /**
       * Flushes the current metrics to the transport via the transport.
       */
      flush() {
        this._forceFlush = !0, this._flush();
      }
      /**
       * Shuts down metrics aggregator and clears all metrics.
       */
      close() {
        this._forceFlush = !0, clearInterval(this._interval), this._flush();
      }
      /**
       * Flushes the buckets according to the internal state of the aggregator.
       * If it is a force flush, which happens on shutdown, it will flush all buckets.
       * Otherwise, it will only flush buckets that are older than the flush interval,
       * and according to the flush shift.
       *
       * This function mutates `_forceFlush` and `_bucketsTotalWeight` properties.
       */
      _flush() {
        if (this._forceFlush) {
          this._forceFlush = !1, this._bucketsTotalWeight = 0, this._captureMetrics(this._buckets), this._buckets.clear();
          return;
        }
        let cutoffSeconds = Math.floor(utils$1.timestampInSeconds()) - constants.DEFAULT_FLUSH_INTERVAL / 1e3 - this._flushShift, flushedBuckets = /* @__PURE__ */ new Map();
        for (let [key, bucket] of this._buckets)
          bucket.timestamp <= cutoffSeconds && (flushedBuckets.set(key, bucket), this._bucketsTotalWeight -= bucket.metric.weight);
        for (let [key] of flushedBuckets)
          this._buckets.delete(key);
        this._captureMetrics(flushedBuckets);
      }
      /**
       * Only captures a subset of the buckets passed to this function.
       * @param flushedBuckets
       */
      _captureMetrics(flushedBuckets) {
        if (flushedBuckets.size > 0) {
          let buckets = Array.from(flushedBuckets).map(([, bucketItem]) => bucketItem);
          envelope.captureAggregateMetrics(this._client, buckets);
        }
      }
    };
    exports.MetricsAggregator = MetricsAggregator;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/exports-default.js
var require_exports_default = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/exports-default.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var aggregator = require_aggregator(), exports$1 = require_exports2();
    function increment(name, value = 1, data) {
      exports$1.metrics.increment(aggregator.MetricsAggregator, name, value, data);
    }
    function distribution(name, value, data) {
      exports$1.metrics.distribution(aggregator.MetricsAggregator, name, value, data);
    }
    function set(name, value, data) {
      exports$1.metrics.set(aggregator.MetricsAggregator, name, value, data);
    }
    function gauge(name, value, data) {
      exports$1.metrics.gauge(aggregator.MetricsAggregator, name, value, data);
    }
    function timing(name, value, unit = "second", data) {
      return exports$1.metrics.timing(aggregator.MetricsAggregator, name, value, unit, data);
    }
    function getMetricsAggregatorForClient(client) {
      return exports$1.metrics.getMetricsAggregatorForClient(client, aggregator.MetricsAggregator);
    }
    var metricsDefault = {
      increment,
      distribution,
      set,
      gauge,
      timing,
      /**
       * @ignore This is for internal use only.
       */
      getMetricsAggregatorForClient
    };
    exports.metricsDefault = metricsDefault;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/browser-aggregator.js
var require_browser_aggregator = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/metrics/browser-aggregator.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils$1 = require_cjs(), spanUtils = require_spanUtils(), constants = require_constants2(), envelope = require_envelope3(), instance = require_instance(), utils = require_utils2(), BrowserMetricsAggregator = class {
      // TODO(@anonrig): Use FinalizationRegistry to have a proper way of flushing the buckets
      // when the aggregator is garbage collected.
      // Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry
      constructor(_client) {
        this._client = _client, this._buckets = /* @__PURE__ */ new Map(), this._interval = setInterval(() => this.flush(), constants.DEFAULT_BROWSER_FLUSH_INTERVAL);
      }
      /**
       * @inheritDoc
       */
      add(metricType, unsanitizedName, value, unsanitizedUnit = "none", unsanitizedTags = {}, maybeFloatTimestamp = utils$1.timestampInSeconds()) {
        let timestamp = Math.floor(maybeFloatTimestamp), name = utils.sanitizeMetricKey(unsanitizedName), tags = utils.sanitizeTags(unsanitizedTags), unit = utils.sanitizeUnit(unsanitizedUnit), bucketKey = utils.getBucketKey(metricType, name, unit, tags), bucketItem = this._buckets.get(bucketKey), previousWeight = bucketItem && metricType === constants.SET_METRIC_TYPE ? bucketItem.metric.weight : 0;
        bucketItem ? (bucketItem.metric.add(value), bucketItem.timestamp < timestamp && (bucketItem.timestamp = timestamp)) : (bucketItem = {
          // @ts-expect-error we don't need to narrow down the type of value here, saves bundle size.
          metric: new instance.METRIC_MAP[metricType](value),
          timestamp,
          metricType,
          name,
          unit,
          tags
        }, this._buckets.set(bucketKey, bucketItem));
        let val = typeof value == "string" ? bucketItem.metric.weight - previousWeight : value;
        spanUtils.updateMetricSummaryOnActiveSpan(metricType, name, val, unit, unsanitizedTags, bucketKey);
      }
      /**
       * @inheritDoc
       */
      flush() {
        if (this._buckets.size === 0)
          return;
        let metricBuckets = Array.from(this._buckets.values());
        envelope.captureAggregateMetrics(this._client, metricBuckets), this._buckets.clear();
      }
      /**
       * @inheritDoc
       */
      close() {
        clearInterval(this._interval), this.flush();
      }
    };
    exports.BrowserMetricsAggregator = BrowserMetricsAggregator;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/fetch.js
var require_fetch2 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/fetch.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), semanticAttributes = require_semanticAttributes();
    require_errors();
    require_debug_build2();
    var hasTracingEnabled = require_hasTracingEnabled(), spanUtils = require_spanUtils(), sentryNonRecordingSpan = require_sentryNonRecordingSpan(), spanstatus = require_spanstatus(), trace = require_trace(), dynamicSamplingContext = require_dynamicSamplingContext();
    function instrumentFetchRequest(handlerData, shouldCreateSpan, shouldAttachHeaders, spans, spanOrigin = "auto.http.browser") {
      if (!handlerData.fetchData)
        return;
      let shouldCreateSpanResult = hasTracingEnabled.hasTracingEnabled() && shouldCreateSpan(handlerData.fetchData.url);
      if (handlerData.endTimestamp && shouldCreateSpanResult) {
        let spanId = handlerData.fetchData.__span;
        if (!spanId) return;
        let span2 = spans[spanId];
        span2 && (endSpan(span2, handlerData), delete spans[spanId]);
        return;
      }
      let scope = currentScopes.getCurrentScope(), client = currentScopes.getClient(), { method, url } = handlerData.fetchData, fullUrl = getFullURL(url), host = fullUrl ? utils.parseUrl(fullUrl).host : void 0, hasParent = !!spanUtils.getActiveSpan(), span = shouldCreateSpanResult && hasParent ? trace.startInactiveSpan({
        name: `${method} ${url}`,
        attributes: {
          url,
          type: "fetch",
          "http.method": method,
          "http.url": fullUrl,
          "server.address": host,
          [semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: spanOrigin,
          [semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_OP]: "http.client"
        }
      }) : new sentryNonRecordingSpan.SentryNonRecordingSpan();
      if (handlerData.fetchData.__span = span.spanContext().spanId, spans[span.spanContext().spanId] = span, shouldAttachHeaders(handlerData.fetchData.url) && client) {
        let request = handlerData.args[0];
        handlerData.args[1] = handlerData.args[1] || {};
        let options = handlerData.args[1];
        options.headers = addTracingHeadersToFetchRequest(
          request,
          client,
          scope,
          options,
          // If performance is disabled (TWP) or there's no active root span (pageload/navigation/interaction),
          // we do not want to use the span as base for the trace headers,
          // which means that the headers will be generated from the scope and the sampling decision is deferred
          hasTracingEnabled.hasTracingEnabled() && hasParent ? span : void 0
        );
      }
      return span;
    }
    function addTracingHeadersToFetchRequest(request, client, scope, options, span) {
      let isolationScope = currentScopes.getIsolationScope(), { traceId, spanId, sampled, dsc } = {
        ...isolationScope.getPropagationContext(),
        ...scope.getPropagationContext()
      }, sentryTraceHeader = span ? spanUtils.spanToTraceHeader(span) : utils.generateSentryTraceHeader(traceId, spanId, sampled), sentryBaggageHeader = utils.dynamicSamplingContextToSentryBaggageHeader(
        dsc || (span ? dynamicSamplingContext.getDynamicSamplingContextFromSpan(span) : dynamicSamplingContext.getDynamicSamplingContextFromClient(traceId, client))
      ), headers = options.headers || (typeof Request < "u" && utils.isInstanceOf(request, Request) ? request.headers : void 0);
      if (headers)
        if (typeof Headers < "u" && utils.isInstanceOf(headers, Headers)) {
          let newHeaders = new Headers(headers);
          return newHeaders.append("sentry-trace", sentryTraceHeader), sentryBaggageHeader && newHeaders.append(utils.BAGGAGE_HEADER_NAME, sentryBaggageHeader), newHeaders;
        } else if (Array.isArray(headers)) {
          let newHeaders = [...headers, ["sentry-trace", sentryTraceHeader]];
          return sentryBaggageHeader && newHeaders.push([utils.BAGGAGE_HEADER_NAME, sentryBaggageHeader]), newHeaders;
        } else {
          let existingBaggageHeader = "baggage" in headers ? headers.baggage : void 0, newBaggageHeaders = [];
          return Array.isArray(existingBaggageHeader) ? newBaggageHeaders.push(...existingBaggageHeader) : existingBaggageHeader && newBaggageHeaders.push(existingBaggageHeader), sentryBaggageHeader && newBaggageHeaders.push(sentryBaggageHeader), {
            ...headers,
            "sentry-trace": sentryTraceHeader,
            baggage: newBaggageHeaders.length > 0 ? newBaggageHeaders.join(",") : void 0
          };
        }
      else return { "sentry-trace": sentryTraceHeader, baggage: sentryBaggageHeader };
    }
    function getFullURL(url) {
      try {
        return new URL(url).href;
      } catch {
        return;
      }
    }
    function endSpan(span, handlerData) {
      if (handlerData.response) {
        spanstatus.setHttpStatus(span, handlerData.response.status);
        let contentLength = handlerData.response && handlerData.response.headers && handlerData.response.headers.get("content-length");
        if (contentLength) {
          let contentLengthNum = parseInt(contentLength);
          contentLengthNum > 0 && span.setAttribute("http.response_content_length", contentLengthNum);
        }
      } else handlerData.error && span.setStatus({ code: spanstatus.SPAN_STATUS_ERROR, message: "internal_error" });
      span.end();
    }
    exports.addTracingHeadersToFetchRequest = addTracingHeadersToFetchRequest;
    exports.instrumentFetchRequest = instrumentFetchRequest;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/trpc.js
var require_trpc = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/trpc.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes(), exports$1 = require_exports(), semanticAttributes = require_semanticAttributes();
    require_errors();
    require_debug_build2();
    var trace = require_trace(), trpcCaptureContext = { mechanism: { handled: !1, data: { function: "trpcMiddleware" } } };
    function trpcMiddleware(options = {}) {
      return function(opts) {
        let { path, type, next, rawInput } = opts, client = currentScopes.getClient(), clientOptions = client && client.getOptions(), trpcContext = {
          procedure_type: type
        };
        (options.attachRpcInput !== void 0 ? options.attachRpcInput : clientOptions && clientOptions.sendDefaultPii) && (trpcContext.input = utils.normalize(rawInput)), exports$1.setContext("trpc", trpcContext);
        function captureIfError(nextResult) {
          typeof nextResult == "object" && nextResult !== null && "ok" in nextResult && !nextResult.ok && "error" in nextResult && exports$1.captureException(nextResult.error, trpcCaptureContext);
        }
        return trace.startSpanManual(
          {
            name: `trpc/${path}`,
            op: "rpc.server",
            attributes: {
              [semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: "route",
              [semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN]: "auto.rpc.trpc"
            }
          },
          (span) => {
            let maybePromiseResult;
            try {
              maybePromiseResult = next();
            } catch (e) {
              throw exports$1.captureException(e, trpcCaptureContext), span.end(), e;
            }
            return utils.isThenable(maybePromiseResult) ? maybePromiseResult.then(
              (nextResult) => (captureIfError(nextResult), span.end(), nextResult),
              (e) => {
                throw exports$1.captureException(e, trpcCaptureContext), span.end(), e;
              }
            ) : (captureIfError(maybePromiseResult), span.end(), maybePromiseResult);
          }
        );
      };
    }
    exports.trpcMiddleware = trpcMiddleware;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/feedback.js
var require_feedback = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/feedback.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var utils = require_cjs(), currentScopes = require_currentScopes();
    function captureFeedback(feedbackParams, hint = {}, scope = currentScopes.getCurrentScope()) {
      let { message, name, email, url, source, associatedEventId } = feedbackParams, feedbackEvent = {
        contexts: {
          feedback: utils.dropUndefinedKeys({
            contact_email: email,
            name,
            message,
            url,
            source,
            associated_event_id: associatedEventId
          })
        },
        type: "feedback",
        level: "info"
      }, client = scope && scope.getClient() || currentScopes.getClient();
      return client && client.emit("beforeSendFeedback", feedbackEvent, hint), scope.captureEvent(feedbackEvent, hint);
    }
    exports.captureFeedback = captureFeedback;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/getCurrentHubShim.js
var require_getCurrentHubShim = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/getCurrentHubShim.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var breadcrumbs = require_breadcrumbs(), currentScopes = require_currentScopes(), exports$1 = require_exports();
    function getCurrentHubShim() {
      return {
        bindClient(client) {
          currentScopes.getCurrentScope().setClient(client);
        },
        withScope: currentScopes.withScope,
        getClient: () => currentScopes.getClient(),
        getScope: currentScopes.getCurrentScope,
        getIsolationScope: currentScopes.getIsolationScope,
        captureException: (exception, hint) => currentScopes.getCurrentScope().captureException(exception, hint),
        captureMessage: (message, level, hint) => currentScopes.getCurrentScope().captureMessage(message, level, hint),
        captureEvent: exports$1.captureEvent,
        addBreadcrumb: breadcrumbs.addBreadcrumb,
        setUser: exports$1.setUser,
        setTags: exports$1.setTags,
        setTag: exports$1.setTag,
        setExtra: exports$1.setExtra,
        setExtras: exports$1.setExtras,
        setContext: exports$1.setContext,
        getIntegration(integration) {
          let client = currentScopes.getClient();
          return client && client.getIntegrationByName(integration.id) || null;
        },
        startSession: exports$1.startSession,
        endSession: exports$1.endSession,
        captureSession(end) {
          if (end)
            return exports$1.endSession();
          _sendSessionUpdate();
        }
      };
    }
    var getCurrentHub = getCurrentHubShim;
    function _sendSessionUpdate() {
      let scope = currentScopes.getCurrentScope(), client = currentScopes.getClient(), session = scope.getSession();
      client && session && client.captureSession(session);
    }
    exports.getCurrentHub = getCurrentHub;
    exports.getCurrentHubShim = getCurrentHubShim;
  }
});

// ../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/index.js
var require_cjs2 = __commonJS({
  "../../node_modules/.pnpm/@sentry+core@8.9.2/node_modules/@sentry/core/cjs/index.js"(exports) {
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var errors = require_errors(), utils$1 = require_utils(), hubextensions = require_hubextensions(), idleSpan = require_idleSpan(), sentrySpan = require_sentrySpan(), sentryNonRecordingSpan = require_sentryNonRecordingSpan(), spanstatus = require_spanstatus(), trace = require_trace(), dynamicSamplingContext = require_dynamicSamplingContext(), measurement = require_measurement(), sampling = require_sampling(), logSpans = require_logSpans(), semanticAttributes = require_semanticAttributes(), envelope = require_envelope2(), exports$1 = require_exports(), currentScopes = require_currentScopes(), defaultScopes = require_defaultScopes(), index = require_asyncContext(), carrier = require_carrier(), session = require_session(), sessionflusher = require_sessionflusher(), scope = require_scope(), eventProcessors = require_eventProcessors(), api = require_api(), baseclient = require_baseclient(), serverRuntimeClient = require_server_runtime_client(), sdk = require_sdk(), base = require_base(), offline = require_offline(), multiplexed = require_multiplexed(), integration = require_integration(), applyScopeDataToEvent = require_applyScopeDataToEvent(), prepareEvent = require_prepareEvent(), checkin = require_checkin(), hasTracingEnabled = require_hasTracingEnabled(), isSentryRequestUrl = require_isSentryRequestUrl(), handleCallbackErrors = require_handleCallbackErrors(), parameterize = require_parameterize(), spanUtils = require_spanUtils(), parseSampleRate = require_parseSampleRate(), sdkMetadata = require_sdkMetadata(), constants = require_constants(), breadcrumbs = require_breadcrumbs(), functiontostring = require_functiontostring(), inboundfilters = require_inboundfilters(), linkederrors = require_linkederrors(), metadata = require_metadata2(), requestdata = require_requestdata2(), captureconsole = require_captureconsole(), debug = require_debug(), dedupe = require_dedupe(), extraerrordata = require_extraerrordata(), rewriteframes = require_rewriteframes(), sessiontiming = require_sessiontiming(), zoderrors = require_zoderrors(), thirdPartyErrorsFilter = require_third_party_errors_filter(), exports$2 = require_exports2(), exportsDefault = require_exports_default(), browserAggregator = require_browser_aggregator(), metricSummary = require_metric_summary(), fetch2 = require_fetch2(), trpc = require_trpc(), feedback = require_feedback(), getCurrentHubShim = require_getCurrentHubShim(), utils = require_cjs();
    exports.registerSpanErrorInstrumentation = errors.registerSpanErrorInstrumentation;
    exports.getCapturedScopesOnSpan = utils$1.getCapturedScopesOnSpan;
    exports.setCapturedScopesOnSpan = utils$1.setCapturedScopesOnSpan;
    exports.addTracingExtensions = hubextensions.addTracingExtensions;
    exports.TRACING_DEFAULTS = idleSpan.TRACING_DEFAULTS;
    exports.startIdleSpan = idleSpan.startIdleSpan;
    exports.SentrySpan = sentrySpan.SentrySpan;
    exports.SentryNonRecordingSpan = sentryNonRecordingSpan.SentryNonRecordingSpan;
    exports.SPAN_STATUS_ERROR = spanstatus.SPAN_STATUS_ERROR;
    exports.SPAN_STATUS_OK = spanstatus.SPAN_STATUS_OK;
    exports.SPAN_STATUS_UNSET = spanstatus.SPAN_STATUS_UNSET;
    exports.getSpanStatusFromHttpCode = spanstatus.getSpanStatusFromHttpCode;
    exports.setHttpStatus = spanstatus.setHttpStatus;
    exports.continueTrace = trace.continueTrace;
    exports.startInactiveSpan = trace.startInactiveSpan;
    exports.startNewTrace = trace.startNewTrace;
    exports.startSpan = trace.startSpan;
    exports.startSpanManual = trace.startSpanManual;
    exports.suppressTracing = trace.suppressTracing;
    exports.withActiveSpan = trace.withActiveSpan;
    exports.getDynamicSamplingContextFromClient = dynamicSamplingContext.getDynamicSamplingContextFromClient;
    exports.getDynamicSamplingContextFromSpan = dynamicSamplingContext.getDynamicSamplingContextFromSpan;
    exports.spanToBaggageHeader = dynamicSamplingContext.spanToBaggageHeader;
    exports.setMeasurement = measurement.setMeasurement;
    exports.timedEventsToMeasurements = measurement.timedEventsToMeasurements;
    exports.sampleSpan = sampling.sampleSpan;
    exports.logSpanEnd = logSpans.logSpanEnd;
    exports.logSpanStart = logSpans.logSpanStart;
    exports.SEMANTIC_ATTRIBUTE_CACHE_HIT = semanticAttributes.SEMANTIC_ATTRIBUTE_CACHE_HIT;
    exports.SEMANTIC_ATTRIBUTE_CACHE_ITEM_SIZE = semanticAttributes.SEMANTIC_ATTRIBUTE_CACHE_ITEM_SIZE;
    exports.SEMANTIC_ATTRIBUTE_CACHE_KEY = semanticAttributes.SEMANTIC_ATTRIBUTE_CACHE_KEY;
    exports.SEMANTIC_ATTRIBUTE_EXCLUSIVE_TIME = semanticAttributes.SEMANTIC_ATTRIBUTE_EXCLUSIVE_TIME;
    exports.SEMANTIC_ATTRIBUTE_PROFILE_ID = semanticAttributes.SEMANTIC_ATTRIBUTE_PROFILE_ID;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_IDLE_SPAN_FINISH_REASON = semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_IDLE_SPAN_FINISH_REASON;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_UNIT = semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_UNIT;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_VALUE = semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_MEASUREMENT_VALUE;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_OP = semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_OP;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN = semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_SAMPLE_RATE = semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_SAMPLE_RATE;
    exports.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE = semanticAttributes.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE;
    exports.createEventEnvelope = envelope.createEventEnvelope;
    exports.createSessionEnvelope = envelope.createSessionEnvelope;
    exports.createSpanEnvelope = envelope.createSpanEnvelope;
    exports.addEventProcessor = exports$1.addEventProcessor;
    exports.captureCheckIn = exports$1.captureCheckIn;
    exports.captureEvent = exports$1.captureEvent;
    exports.captureException = exports$1.captureException;
    exports.captureMessage = exports$1.captureMessage;
    exports.captureSession = exports$1.captureSession;
    exports.close = exports$1.close;
    exports.endSession = exports$1.endSession;
    exports.flush = exports$1.flush;
    exports.isEnabled = exports$1.isEnabled;
    exports.isInitialized = exports$1.isInitialized;
    exports.lastEventId = exports$1.lastEventId;
    exports.setContext = exports$1.setContext;
    exports.setExtra = exports$1.setExtra;
    exports.setExtras = exports$1.setExtras;
    exports.setTag = exports$1.setTag;
    exports.setTags = exports$1.setTags;
    exports.setUser = exports$1.setUser;
    exports.startSession = exports$1.startSession;
    exports.withMonitor = exports$1.withMonitor;
    exports.getClient = currentScopes.getClient;
    exports.getCurrentScope = currentScopes.getCurrentScope;
    exports.getGlobalScope = currentScopes.getGlobalScope;
    exports.getIsolationScope = currentScopes.getIsolationScope;
    exports.withIsolationScope = currentScopes.withIsolationScope;
    exports.withScope = currentScopes.withScope;
    exports.getDefaultCurrentScope = defaultScopes.getDefaultCurrentScope;
    exports.getDefaultIsolationScope = defaultScopes.getDefaultIsolationScope;
    exports.setAsyncContextStrategy = index.setAsyncContextStrategy;
    exports.getMainCarrier = carrier.getMainCarrier;
    exports.closeSession = session.closeSession;
    exports.makeSession = session.makeSession;
    exports.updateSession = session.updateSession;
    exports.SessionFlusher = sessionflusher.SessionFlusher;
    exports.Scope = scope.Scope;
    exports.notifyEventProcessors = eventProcessors.notifyEventProcessors;
    exports.getEnvelopeEndpointWithUrlEncodedAuth = api.getEnvelopeEndpointWithUrlEncodedAuth;
    exports.getReportDialogEndpoint = api.getReportDialogEndpoint;
    exports.BaseClient = baseclient.BaseClient;
    exports.ServerRuntimeClient = serverRuntimeClient.ServerRuntimeClient;
    exports.initAndBind = sdk.initAndBind;
    exports.setCurrentClient = sdk.setCurrentClient;
    exports.createTransport = base.createTransport;
    exports.makeOfflineTransport = offline.makeOfflineTransport;
    exports.makeMultiplexedTransport = multiplexed.makeMultiplexedTransport;
    exports.addIntegration = integration.addIntegration;
    exports.defineIntegration = integration.defineIntegration;
    exports.getIntegrationsToSetup = integration.getIntegrationsToSetup;
    exports.applyScopeDataToEvent = applyScopeDataToEvent.applyScopeDataToEvent;
    exports.mergeScopeData = applyScopeDataToEvent.mergeScopeData;
    exports.prepareEvent = prepareEvent.prepareEvent;
    exports.createCheckInEnvelope = checkin.createCheckInEnvelope;
    exports.hasTracingEnabled = hasTracingEnabled.hasTracingEnabled;
    exports.isSentryRequestUrl = isSentryRequestUrl.isSentryRequestUrl;
    exports.handleCallbackErrors = handleCallbackErrors.handleCallbackErrors;
    exports.parameterize = parameterize.parameterize;
    exports.addChildSpanToSpan = spanUtils.addChildSpanToSpan;
    exports.getActiveSpan = spanUtils.getActiveSpan;
    exports.getRootSpan = spanUtils.getRootSpan;
    exports.getSpanDescendants = spanUtils.getSpanDescendants;
    exports.getStatusMessage = spanUtils.getStatusMessage;
    exports.spanIsSampled = spanUtils.spanIsSampled;
    exports.spanToJSON = spanUtils.spanToJSON;
    exports.spanToTraceContext = spanUtils.spanToTraceContext;
    exports.spanToTraceHeader = spanUtils.spanToTraceHeader;
    exports.parseSampleRate = parseSampleRate.parseSampleRate;
    exports.applySdkMetadata = sdkMetadata.applySdkMetadata;
    exports.DEFAULT_ENVIRONMENT = constants.DEFAULT_ENVIRONMENT;
    exports.addBreadcrumb = breadcrumbs.addBreadcrumb;
    exports.functionToStringIntegration = functiontostring.functionToStringIntegration;
    exports.inboundFiltersIntegration = inboundfilters.inboundFiltersIntegration;
    exports.linkedErrorsIntegration = linkederrors.linkedErrorsIntegration;
    exports.moduleMetadataIntegration = metadata.moduleMetadataIntegration;
    exports.requestDataIntegration = requestdata.requestDataIntegration;
    exports.captureConsoleIntegration = captureconsole.captureConsoleIntegration;
    exports.debugIntegration = debug.debugIntegration;
    exports.dedupeIntegration = dedupe.dedupeIntegration;
    exports.extraErrorDataIntegration = extraerrordata.extraErrorDataIntegration;
    exports.rewriteFramesIntegration = rewriteframes.rewriteFramesIntegration;
    exports.sessionTimingIntegration = sessiontiming.sessionTimingIntegration;
    exports.zodErrorsIntegration = zoderrors.zodErrorsIntegration;
    exports.thirdPartyErrorFilterIntegration = thirdPartyErrorsFilter.thirdPartyErrorFilterIntegration;
    exports.metrics = exports$2.metrics;
    exports.metricsDefault = exportsDefault.metricsDefault;
    exports.BrowserMetricsAggregator = browserAggregator.BrowserMetricsAggregator;
    exports.getMetricSummaryJsonForSpan = metricSummary.getMetricSummaryJsonForSpan;
    exports.addTracingHeadersToFetchRequest = fetch2.addTracingHeadersToFetchRequest;
    exports.instrumentFetchRequest = fetch2.instrumentFetchRequest;
    exports.trpcMiddleware = trpc.trpcMiddleware;
    exports.captureFeedback = feedback.captureFeedback;
    exports.getCurrentHub = getCurrentHubShim.getCurrentHub;
    exports.getCurrentHubShim = getCurrentHubShim.getCurrentHubShim;
    exports.SDK_VERSION = utils.SDK_VERSION;
  }
});

// ../../node_modules/.pnpm/toucan-js@4.0.0_patch_hash=qxsfpdzvzbhq2ecirbu5xq4vlq/node_modules/toucan-js/dist/index.cjs.js
var require_index_cjs = __commonJS({
  "../../node_modules/.pnpm/toucan-js@4.0.0_patch_hash=qxsfpdzvzbhq2ecirbu5xq4vlq/node_modules/toucan-js/dist/index.cjs.js"(exports) {
    "use strict";
    var utils = require_cjs(), core = require_cjs2();
    function isObject(value) {
      return typeof value == "object" && value !== null;
    }
    function isMechanism(value) {
      return isObject(value) && "handled" in value && typeof value.handled == "boolean" && "type" in value && typeof value.type == "string";
    }
    function containsMechanism(value) {
      return isObject(value) && "mechanism" in value && isMechanism(value.mechanism);
    }
    function getSentryRelease() {
      if (utils.GLOBAL_OBJ.SENTRY_RELEASE && utils.GLOBAL_OBJ.SENTRY_RELEASE.id)
        return utils.GLOBAL_OBJ.SENTRY_RELEASE.id;
    }
    function setOnOptional(target, entry) {
      return target !== void 0 ? (target[entry[0]] = entry[1], target) : { [entry[0]]: entry[1] };
    }
    function parseStackFrames(stackParser, error) {
      return stackParser(error.stack || "", 1);
    }
    function extractMessage(ex) {
      let message = ex && ex.message;
      return message ? message.error && typeof message.error.message == "string" ? message.error.message : message : "No error message";
    }
    function exceptionFromError(stackParser, error) {
      let exception = {
        type: error.name || error.constructor.name,
        value: extractMessage(error)
      }, frames = parseStackFrames(stackParser, error);
      return frames.length && (exception.stacktrace = { frames }), exception.type === void 0 && exception.value === "" && (exception.value = "Unrecoverable error caught"), exception;
    }
    function eventFromUnknownInput(sdk, stackParser, exception, hint) {
      let ex, mechanism = (hint && hint.data && containsMechanism(hint.data) ? hint.data.mechanism : void 0) ?? {
        handled: !0,
        type: "generic"
      };
      if (utils.isError(exception))
        ex = exception;
      else {
        if (utils.isPlainObject(exception)) {
          let message = `Non-Error exception captured with keys: ${utils.extractExceptionKeysForMessage(exception)}`, client = sdk?.getClient(), normalizeDepth = client && client.getOptions().normalizeDepth;
          sdk?.setExtra("__serialized__", utils.normalizeToSize(exception, normalizeDepth)), ex = hint && hint.syntheticException || new Error(message), ex.message = message;
        } else
          ex = hint && hint.syntheticException || new Error(exception), ex.message = exception;
        mechanism.synthetic = !0;
      }
      let event = {
        exception: {
          values: [exceptionFromError(stackParser, ex)]
        }
      };
      return utils.addExceptionTypeValue(event, void 0, void 0), utils.addExceptionMechanism(event, mechanism), {
        ...event,
        event_id: hint && hint.event_id
      };
    }
    function eventFromMessage(stackParser, message, level = "info", hint, attachStacktrace) {
      let event = {
        event_id: hint && hint.event_id,
        level,
        message
      };
      if (attachStacktrace && hint && hint.syntheticException) {
        let frames = parseStackFrames(stackParser, hint.syntheticException);
        frames.length && (event.exception = {
          values: [
            {
              value: message,
              stacktrace: { frames }
            }
          ]
        });
      }
      return event;
    }
    var DEFAULT_LIMIT = 5, linkedErrorsIntegration = core.defineIntegration((options = { limit: DEFAULT_LIMIT }) => ({
      name: "LinkedErrors",
      processEvent: (event, hint, client) => handler(client.getOptions().stackParser, options.limit, event, hint)
    }));
    function handler(parser, limit, event, hint) {
      if (!event.exception || !event.exception.values || !hint || !utils.isInstanceOf(hint.originalException, Error))
        return event;
      let linkedErrors = walkErrorTree(parser, limit, hint.originalException);
      return event.exception.values = [...linkedErrors, ...event.exception.values], event;
    }
    function walkErrorTree(parser, limit, error, stack = []) {
      if (!utils.isInstanceOf(error.cause, Error) || stack.length + 1 >= limit)
        return stack;
      let exception = exceptionFromError(parser, error.cause);
      return walkErrorTree(parser, limit, error.cause, [
        exception,
        ...stack
      ]);
    }
    var defaultRequestDataOptions = {
      allowedHeaders: ["CF-RAY", "CF-Worker"]
    }, requestDataIntegration = core.defineIntegration((userOptions = {}) => {
      let options = { ...defaultRequestDataOptions, ...userOptions };
      return {
        name: "RequestData",
        preprocessEvent: (event) => {
          let { sdkProcessingMetadata } = event;
          return sdkProcessingMetadata && ("request" in sdkProcessingMetadata && sdkProcessingMetadata.request instanceof Request && (event.request = toEventRequest(sdkProcessingMetadata.request, options), event.user = toEventUser(event.user ?? {}, sdkProcessingMetadata.request, options)), "requestData" in sdkProcessingMetadata && (event.request ? event.request.data = sdkProcessingMetadata.requestData : event.request = {
            data: sdkProcessingMetadata.requestData
          })), event;
        }
      };
    });
    function toEventUser(user, request, options) {
      let ip_address = request.headers.get("CF-Connecting-IP"), { allowedIps } = options, newUser = { ...user };
      return !("ip_address" in user) && // If ip_address is already set from explicitly called setUser, we don't want to overwrite it
      ip_address && allowedIps !== void 0 && testAllowlist(ip_address, allowedIps) && (newUser.ip_address = ip_address), Object.keys(newUser).length > 0 ? newUser : void 0;
    }
    function toEventRequest(request, options) {
      let cookieString = request.headers.get("cookie"), cookies;
      if (cookieString)
        try {
          cookies = parseCookie(cookieString);
        } catch {
        }
      let headers = {};
      for (let [k, v] of request.headers.entries())
        k !== "cookie" && (headers[k] = v);
      let eventRequest = {
        method: request.method,
        cookies,
        headers
      };
      try {
        let url = new URL(request.url);
        eventRequest.url = `${url.protocol}//${url.hostname}${url.pathname}`, eventRequest.query_string = url.search;
      } catch {
        let qi = request.url.indexOf("?");
        qi < 0 ? eventRequest.url = request.url : (eventRequest.url = request.url.substr(0, qi), eventRequest.query_string = request.url.substr(qi + 1));
      }
      let { allowedHeaders, allowedCookies, allowedSearchParams } = options;
      if (allowedHeaders !== void 0 && eventRequest.headers ? (eventRequest.headers = applyAllowlistToObject(eventRequest.headers, allowedHeaders), Object.keys(eventRequest.headers).length === 0 && delete eventRequest.headers) : delete eventRequest.headers, allowedCookies !== void 0 && eventRequest.cookies ? (eventRequest.cookies = applyAllowlistToObject(eventRequest.cookies, allowedCookies), Object.keys(eventRequest.cookies).length === 0 && delete eventRequest.cookies) : delete eventRequest.cookies, allowedSearchParams !== void 0) {
        let params = Object.fromEntries(new URLSearchParams(eventRequest.query_string)), allowedParams = new URLSearchParams();
        Object.keys(applyAllowlistToObject(params, allowedSearchParams)).forEach((allowedKey) => {
          allowedParams.set(allowedKey, params[allowedKey]);
        }), eventRequest.query_string = allowedParams.toString();
      } else
        delete eventRequest.query_string;
      return eventRequest;
    }
    function testAllowlist(target, allowlist) {
      return typeof allowlist == "boolean" ? allowlist : allowlist instanceof RegExp ? allowlist.test(target) : Array.isArray(allowlist) ? allowlist.map((item) => item.toLowerCase()).includes(target) : !1;
    }
    function applyAllowlistToObject(target, allowlist) {
      let predicate = () => !1;
      if (typeof allowlist == "boolean")
        return allowlist ? target : {};
      if (allowlist instanceof RegExp)
        predicate = (item) => allowlist.test(item);
      else if (Array.isArray(allowlist)) {
        let allowlistLowercased = allowlist.map((item) => item.toLowerCase());
        predicate = (item) => allowlistLowercased.includes(item.toLowerCase());
      } else
        return {};
      return Object.keys(target).filter(predicate).reduce((allowed, key) => (allowed[key] = target[key], allowed), {});
    }
    function parseCookie(cookieString) {
      if (typeof cookieString != "string")
        return {};
      try {
        return cookieString.split(";").map((part) => part.split("=")).reduce((acc, [cookieKey, cookieValue]) => (acc[decodeURIComponent(cookieKey.trim())] = decodeURIComponent(cookieValue.trim()), acc), {});
      } catch {
        return {};
      }
    }
    function setupIntegrations(integrations, sdk) {
      let integrationIndex = {};
      return integrations.forEach((integration) => {
        integrationIndex[integration.name] = integration, typeof integration.setupOnce == "function" && integration.setupOnce();
        let client = sdk.getClient();
        if (client) {
          if (typeof integration.setup == "function" && integration.setup(client), typeof integration.preprocessEvent == "function") {
            let callback = integration.preprocessEvent.bind(integration);
            client.on("preprocessEvent", (event, hint) => callback(event, hint, client));
          }
          if (typeof integration.processEvent == "function") {
            let callback = integration.processEvent.bind(integration), processor = Object.assign((event, hint) => callback(event, hint, client), {
              id: integration.name
            });
            client.addEventProcessor(processor);
          }
        }
      }), integrationIndex;
    }
    var ToucanClient = class extends core.ServerRuntimeClient {
      /**
       * Some functions need to access the scope (Toucan instance) this client is bound to,
       * but calling 'getCurrentHub()' is unsafe because it uses globals.
       * So we store a reference to the Hub after binding to it and provide it to methods that need it.
       */
      #sdk = null;
      #integrationsInitialized = !1;
      /**
       * Creates a new Toucan SDK instance.
       * @param options Configuration options for this SDK.
       */
      constructor(options) {
        options._metadata = options._metadata || {}, options._metadata.sdk = options._metadata.sdk || {
          name: "toucan-js",
          packages: [
            {
              name: "npm:toucan-js",
              version: "4.0.0"
            }
          ],
          version: "4.0.0"
        }, super(options);
      }
      /**
       * By default, integrations are stored in a global. We want to store them in a local instance because they may have contextual data, such as event request.
       */
      setupIntegrations() {
        this._isEnabled() && !this.#integrationsInitialized && this.#sdk && (this._integrations = setupIntegrations(this._options.integrations, this.#sdk), this.#integrationsInitialized = !0);
      }
      eventFromException(exception, hint) {
        return utils.resolvedSyncPromise(eventFromUnknownInput(this.#sdk, this._options.stackParser, exception, hint));
      }
      eventFromMessage(message, level = "info", hint) {
        return utils.resolvedSyncPromise(eventFromMessage(this._options.stackParser, message, level, hint, this._options.attachStacktrace));
      }
      _prepareEvent(event, hint, scope) {
        return event.platform = event.platform || "javascript", this.getOptions().request && (event.sdkProcessingMetadata = setOnOptional(event.sdkProcessingMetadata, [
          "request",
          this.getOptions().request
        ])), this.getOptions().requestData && (event.sdkProcessingMetadata = setOnOptional(event.sdkProcessingMetadata, [
          "requestData",
          this.getOptions().requestData
        ])), super._prepareEvent(event, hint, scope);
      }
      getSdk() {
        return this.#sdk;
      }
      setSdk(sdk) {
        this.#sdk = sdk;
      }
      /**
       * Sets the request body context on all future events.
       *
       * @param body Request body.
       * @example
       * const body = await request.text();
       * toucan.setRequestBody(body);
       */
      setRequestBody(body) {
        this.getOptions().requestData = body;
      }
      /**
       * Enable/disable the SDK.
       *
       * @param enabled
       */
      setEnabled(enabled) {
        this.getOptions().enabled = enabled;
      }
    };
    function workersStackLineParser(getModule2) {
      let [arg1, arg2] = utils.nodeStackLineParser(getModule2);
      return [arg1, (line) => {
        let result = arg2(line);
        if (result) {
          let filename = result.filename;
          result.abs_path = filename !== void 0 && !filename.startsWith("/") ? `/${filename}` : filename, result.in_app = filename !== void 0;
        }
        return result;
      }];
    }
    function getModule(filename) {
      if (filename)
        return utils.basename(filename, ".js");
    }
    var defaultStackParser = utils.createStackParser(workersStackLineParser(getModule));
    function makeFetchTransport(options) {
      function makeRequest({ body }) {
        try {
          let request = (options.fetcher ?? fetch)(options.url, {
            method: "POST",
            headers: options.headers,
            body
          }).then((response) => ({
            statusCode: response.status,
            headers: {
              "retry-after": response.headers.get("Retry-After"),
              "x-sentry-rate-limits": response.headers.get("X-Sentry-Rate-Limits")
            }
          }));
          return options.context && options.context.waitUntil(request), request;
        } catch (e) {
          return utils.rejectedSyncPromise(e);
        }
      }
      return core.createTransport(options, makeRequest);
    }
    var Toucan2 = class _Toucan extends core.Scope {
      #options;
      constructor(options) {
        if (super(), options.defaultIntegrations = options.defaultIntegrations === !1 ? [] : [
          ...Array.isArray(options.defaultIntegrations) ? options.defaultIntegrations : [
            requestDataIntegration(options.requestDataOptions),
            linkedErrorsIntegration()
          ]
        ], options.release === void 0) {
          let detectedRelease = getSentryRelease();
          detectedRelease !== void 0 && (options.release = detectedRelease);
        }
        this.#options = options, this.attachNewClient();
      }
      /**
       * Creates new ToucanClient and links it to this instance.
       */
      attachNewClient() {
        let client = new ToucanClient({
          ...this.#options,
          transport: makeFetchTransport,
          integrations: core.getIntegrationsToSetup(this.#options),
          stackParser: utils.stackParserFromStackParserOptions(this.#options.stackParser || defaultStackParser),
          transportOptions: {
            ...this.#options.transportOptions,
            context: this.#options.context
          }
        });
        this.setClient(client), client.setSdk(this), client.setupIntegrations();
      }
      /**
       * Sets the request body context on all future events.
       *
       * @param body Request body.
       * @example
       * const body = await request.text();
       * toucan.setRequestBody(body);
       */
      setRequestBody(body) {
        this.getClient()?.setRequestBody(body);
      }
      /**
       * Enable/disable the SDK.
       *
       * @param enabled
       */
      setEnabled(enabled) {
        this.getClient()?.setEnabled(enabled);
      }
      /**
       * Create a cron monitor check in and send it to Sentry.
       *
       * @param checkIn An object that describes a check in.
       * @param upsertMonitorConfig An optional object that describes a monitor config. Use this if you want
       * to create a monitor automatically when sending a check in.
       */
      captureCheckIn(checkIn, monitorConfig, scope) {
        return checkIn.status === "in_progress" && this.setContext("monitor", { slug: checkIn.monitorSlug }), this.getClient().captureCheckIn(checkIn, monitorConfig, scope);
      }
      /**
       * Add a breadcrumb to the current scope.
       */
      addBreadcrumb(breadcrumb, maxBreadcrumbs = 100) {
        let max = this.getClient().getOptions().maxBreadcrumbs || maxBreadcrumbs;
        return super.addBreadcrumb(breadcrumb, max);
      }
      /**
       * Clone all data from this instance into a new Toucan instance.
       *
       * @override
       * @returns New Toucan instance.
       */
      clone() {
        let toucan = new _Toucan({ ...this.#options });
        return toucan._breadcrumbs = [...this._breadcrumbs], toucan._tags = { ...this._tags }, toucan._extra = { ...this._extra }, toucan._contexts = { ...this._contexts }, toucan._user = this._user, toucan._level = this._level, toucan._session = this._session, toucan._transactionName = this._transactionName, toucan._fingerprint = this._fingerprint, toucan._eventProcessors = [...this._eventProcessors], toucan._requestSession = this._requestSession, toucan._attachments = [...this._attachments], toucan._sdkProcessingMetadata = { ...this._sdkProcessingMetadata }, toucan._propagationContext = { ...this._propagationContext }, toucan._lastEventId = this._lastEventId, toucan;
      }
      /**
       * Creates a new scope with and executes the given operation within.
       * The scope is automatically removed once the operation
       * finishes or throws.
       */
      withScope(callback) {
        let toucan = this.clone();
        return callback(toucan);
      }
    };
    Object.defineProperty(exports, "dedupeIntegration", {
      enumerable: !0,
      get: function() {
        return core.dedupeIntegration;
      }
    });
    Object.defineProperty(exports, "extraErrorDataIntegration", {
      enumerable: !0,
      get: function() {
        return core.extraErrorDataIntegration;
      }
    });
    Object.defineProperty(exports, "rewriteFramesIntegration", {
      enumerable: !0,
      get: function() {
        return core.rewriteFramesIntegration;
      }
    });
    Object.defineProperty(exports, "sessionTimingIntegration", {
      enumerable: !0,
      get: function() {
        return core.sessionTimingIntegration;
      }
    });
    exports.Toucan = Toucan2;
    exports.linkedErrorsIntegration = linkedErrorsIntegration;
    exports.requestDataIntegration = requestDataIntegration;
  }
});

// ../workers-shared/asset-worker/src/worker.ts
import { WorkerEntrypoint } from "cloudflare:workers";

// ../workers-shared/utils/performance.ts
var PerformanceTimer = class {
  constructor(performanceTimer) {
    this.performanceTimer = performanceTimer;
  }
  now() {
    return this.performanceTimer ? this.performanceTimer.timeOrigin + this.performanceTimer.now() : Date.now();
  }
};

// ../workers-shared/utils/sentry.ts
var import_toucan_js = __toESM(require_index_cjs());
function setupSentry(request, context, dsn, clientId, clientSecret, coloMetadata, versionMetadata, accountId, scriptId) {
  if (!(dsn && clientId && clientSecret))
    return;
  let sentry = new import_toucan_js.Toucan({
    dsn,
    request,
    context,
    sampleRate: 1,
    release: versionMetadata?.tag,
    integrations: [
      (0, import_toucan_js.rewriteFramesIntegration)({
        iteratee(frame) {
          return frame.filename = "/index.js", frame;
        }
      })
    ],
    requestDataOptions: {
      allowedHeaders: [
        "user-agent",
        "cf-challenge",
        "accept-encoding",
        "accept-language",
        "cf-ray",
        "content-length",
        "content-type",
        "host"
      ],
      allowedSearchParams: /(.*)/
    },
    transportOptions: {
      headers: {
        "CF-Access-Client-ID": clientId,
        "CF-Access-Client-Secret": clientSecret
      }
    }
  });
  return coloMetadata && (sentry.setTag("colo", coloMetadata.coloId), sentry.setTag("metal", coloMetadata.metalId)), accountId && scriptId && (sentry.setTag("accountId", accountId), sentry.setTag("scriptId", scriptId)), sentry.setUser({ id: accountId?.toString() }), sentry;
}

// ../workers-shared/utils/tracing.ts
function mockJaegerBindingSpan() {
  return {
    addLogs: () => {
    },
    setTags: () => {
    },
    end: () => {
    },
    isRecording: !0
  };
}
function mockJaegerBinding() {
  return {
    enterSpan: (_, span, ...args) => span(mockJaegerBindingSpan(), ...args),
    getSpanContext: () => ({
      traceId: "test-trace",
      spanId: "test-span",
      parentSpanId: "test-parent-span",
      traceFlags: 0
    }),
    runWithSpanContext: (_, callback, ...args) => callback(...args),
    traceId: "test-trace",
    spanId: "test-span",
    parentSpanId: "test-parent-span",
    cfTraceIdHeader: "test-trace:test-span:0"
  };
}

// ../workers-shared/asset-worker/src/analytics.ts
var COMPATIBILITY_FLAG_MASKS = {
  assets_navigation_prefers_asset_serving: 1
  // next_one: 1 << 1
  // one_after_that: 1 << 2
  // etc: 1 << 3
}, Analytics = class {
  constructor(readyAnalytics) {
    this.data = {};
    this.readyAnalytics = readyAnalytics;
  }
  setData(newData) {
    this.data = { ...this.data, ...newData };
  }
  getData(key) {
    return this.data[key];
  }
  write() {
    if (!this.readyAnalytics)
      return;
    let compatibilityFlagsBitmask = 0;
    for (let compatibilityFlag of this.data.compatibilityFlags || []) {
      let mask = COMPATIBILITY_FLAG_MASKS[compatibilityFlag];
      mask && (compatibilityFlagsBitmask += mask);
    }
    this.readyAnalytics.logEvent({
      version: 1,
      accountId: this.data.accountId,
      indexId: this.data.scriptId?.toString(),
      doubles: [
        this.data.requestTime ?? -1,
        // double1
        this.data.coloId ?? -1,
        // double2
        this.data.metalId ?? -1,
        // double3
        this.data.coloTier ?? -1,
        // double4
        this.data.status ?? -1,
        // double5
        compatibilityFlagsBitmask
        // double6
      ],
      blobs: [
        this.data.hostname?.substring(0, 256),
        // blob1 - trim to 256 bytes
        this.data.userAgent?.substring(0, 256),
        // blob2 - trim to 256 bytes
        this.data.htmlHandling,
        // blob3
        this.data.notFoundHandling,
        // blob4
        this.data.error?.substring(0, 256),
        // blob5 - trim to 256 bytes
        this.data.version,
        // blob6
        this.data.coloRegion,
        // blob7
        this.data.cacheStatus
        // blob8
      ]
    });
  }
};

// ../workers-shared/asset-worker/src/assets-manifest.ts
var AssetsManifest = class {
  constructor(data) {
    this.data = new Uint8Array(data);
  }
  async get(pathname) {
    let pathHash = await hashPath(pathname), entry = binarySearch(this.data, pathHash);
    return entry ? Uint8ToHexString(entry) : null;
  }
}, hashPath = async (path) => {
  let data = new TextEncoder().encode(path), hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data.buffer
  );
  return new Uint8Array(hashBuffer, 0, 16);
}, binarySearch = (manifest, pathHash) => {
  if (pathHash.byteLength !== 16)
    throw new TypeError(
      `Search value should have a length of ${16}`
    );
  let numberOfEntries = (manifest.byteLength - 20) / 40;
  if (numberOfEntries === 0)
    return !1;
  let lowIndex = 0, highIndex = numberOfEntries - 1;
  for (; lowIndex <= highIndex; ) {
    let middleIndex = lowIndex + highIndex >> 1, cmp = comparePathHashWithEntry(pathHash, manifest, middleIndex);
    if (cmp < 0) {
      highIndex = middleIndex - 1;
      continue;
    }
    if (cmp > 0) {
      lowIndex = middleIndex + 1;
      continue;
    }
    return new Uint8Array(
      manifest.buffer,
      20 + middleIndex * 40 + 16,
      16
    );
  }
  return !1;
};
function comparePathHashWithEntry(searchValue, manifest, entryIndex) {
  let pathHashOffset = 20 + entryIndex * 40 + 0;
  for (let offset = 0; offset < 16; offset++, pathHashOffset++) {
    let s = searchValue[offset], e = manifest[pathHashOffset];
    if (s < e)
      return -1;
    if (s > e)
      return 1;
  }
  return 0;
}
var Uint8ToHexString = (array) => [...array].map((b) => b.toString(16).padStart(2, "0")).join("");

// ../workers-shared/asset-worker/src/compatibility-flags.ts
var SEC_FETCH_MODE_NAVIGATE_HEADER_PREFERS_ASSET_SERVING = {
  enable: "assets_navigation_prefers_asset_serving",
  disable: "assets_navigation_has_no_effect",
  onByDefaultAfter: "2025-04-01"
}, COMPATIBILITY_FLAGS = [
  SEC_FETCH_MODE_NAVIGATE_HEADER_PREFERS_ASSET_SERVING
], resolveCompatibilityOptions = (configuration) => {
  let compatibilityDate = configuration?.compatibility_date ?? "2021-11-02", resolvedCompatibilityFlags = configuration?.compatibility_flags ?? [];
  for (let compatibilityFlag of COMPATIBILITY_FLAGS)
    compatibilityFlag.onByDefaultAfter && compatibilityDate >= compatibilityFlag.onByDefaultAfter && !resolvedCompatibilityFlags.find(
      (flag) => flag === compatibilityFlag.disable
    ) && !resolvedCompatibilityFlags.find(
      (flag) => flag === compatibilityFlag.enable
    ) && resolvedCompatibilityFlags.push(compatibilityFlag.enable);
  return {
    compatibilityDate,
    compatibilityFlags: resolvedCompatibilityFlags
  };
}, flagIsEnabled = (configuration, compatibilityFlag) => !!configuration.compatibility_flags.find(
  (flag) => flag === compatibilityFlag.enable
);

// ../workers-shared/asset-worker/src/configuration.ts
var normalizeConfiguration = (configuration) => {
  let compatibilityOptions = resolveCompatibilityOptions(configuration);
  return {
    compatibility_date: compatibilityOptions.compatibilityDate,
    compatibility_flags: compatibilityOptions.compatibilityFlags,
    html_handling: configuration?.html_handling ?? "auto-trailing-slash",
    not_found_handling: configuration?.not_found_handling ?? "none",
    redirects: configuration?.redirects ?? {
      version: 1,
      staticRules: {},
      rules: {}
    },
    headers: configuration?.headers ?? {
      version: 2,
      rules: {}
    },
    has_static_routing: configuration?.has_static_routing ?? !1,
    account_id: configuration?.account_id ?? -1,
    script_id: configuration?.script_id ?? -1,
    debug: configuration?.debug ?? !1
  };
};

// ../workers-shared/asset-worker/src/experiment-analytics.ts
var ExperimentAnalytics = class {
  constructor(readyAnalytics) {
    this.data = {};
    this.readyAnalytics = readyAnalytics;
  }
  setData(newData) {
    this.data = { ...this.data, ...newData };
  }
  getData(key) {
    return this.data[key];
  }
  write() {
    this.readyAnalytics && this.readyAnalytics.logEvent({
      version: 1,
      accountId: this.data.accountId,
      indexId: this.data.experimentName,
      doubles: [
        this.data.manifestReadTime ?? -1
        // double1
      ],
      blobs: [
        this.data.binarySearchVersion
        // blob1
      ]
    });
  }
};

// ../workers-shared/utils/responses.ts
var OkResponse = class _OkResponse extends Response {
  static {
    this.status = 200;
  }
  constructor(body, init) {
    super(body, {
      ...init,
      status: _OkResponse.status
    });
  }
}, NotFoundResponse = class _NotFoundResponse extends Response {
  static {
    this.status = 404;
  }
  constructor(...[body, init]) {
    super(body, {
      ...init,
      status: _NotFoundResponse.status,
      statusText: "Not Found"
    });
  }
}, NoIntentResponse = class extends NotFoundResponse {
  constructor() {
    super();
  }
}, MethodNotAllowedResponse = class _MethodNotAllowedResponse extends Response {
  static {
    this.status = 405;
  }
  constructor(...[body, init]) {
    super(body, {
      ...init,
      status: _MethodNotAllowedResponse.status,
      statusText: "Method Not Allowed"
    });
  }
}, InternalServerErrorResponse = class _InternalServerErrorResponse extends Response {
  static {
    this.status = 500;
  }
  constructor(_, init) {
    super(null, {
      ...init,
      status: _InternalServerErrorResponse.status
    });
  }
}, NotModifiedResponse = class _NotModifiedResponse extends Response {
  static {
    this.status = 304;
  }
  constructor(...[_body, init]) {
    super(null, {
      ...init,
      status: _NotModifiedResponse.status,
      statusText: "Not Modified"
    });
  }
}, MovedPermanentlyResponse = class _MovedPermanentlyResponse extends Response {
  static {
    this.status = 301;
  }
  constructor(location, init) {
    super(null, {
      ...init,
      status: _MovedPermanentlyResponse.status,
      statusText: "Moved Permanently",
      headers: {
        ...init?.headers,
        Location: location
      }
    });
  }
}, FoundResponse = class _FoundResponse extends Response {
  static {
    this.status = 302;
  }
  constructor(location, init) {
    super(null, {
      ...init,
      status: _FoundResponse.status,
      statusText: "Found",
      headers: {
        ...init?.headers,
        Location: location
      }
    });
  }
}, SeeOtherResponse = class _SeeOtherResponse extends Response {
  static {
    this.status = 303;
  }
  constructor(location, init) {
    super(null, {
      ...init,
      status: _SeeOtherResponse.status,
      statusText: "See Other",
      headers: {
        ...init?.headers,
        Location: location
      }
    });
  }
}, TemporaryRedirectResponse = class _TemporaryRedirectResponse extends Response {
  static {
    this.status = 307;
  }
  constructor(location, init) {
    super(null, {
      ...init,
      status: _TemporaryRedirectResponse.status,
      statusText: "Temporary Redirect",
      headers: {
        ...init?.headers,
        Location: location
      }
    });
  }
}, PermanentRedirectResponse = class _PermanentRedirectResponse extends Response {
  static {
    this.status = 308;
  }
  constructor(location, init) {
    super(null, {
      ...init,
      status: _PermanentRedirectResponse.status,
      statusText: "Permanent Redirect",
      headers: {
        ...init?.headers,
        Location: location
      }
    });
  }
};

// ../workers-shared/asset-worker/src/constants.ts
var CACHE_CONTROL_BROWSER = "public, max-age=0, must-revalidate";

// ../workers-shared/asset-worker/src/utils/rules-engine.ts
var ESCAPE_REGEX_CHARACTERS = /[-/\\^$*+?.()|[\]{}]/g, escapeRegex = (str) => str.replace(ESCAPE_REGEX_CHARACTERS, "\\$&"), HOST_PLACEHOLDER_REGEX = /(?<=^https:\\\/\\\/[^/]*?):([A-Za-z]\w*)(?=\\)/g, PLACEHOLDER_REGEX = /:([A-Za-z]\w*)/g, replacer = (str, replacements) => {
  for (let [replacement, value] of Object.entries(replacements))
    str = str.replaceAll(`:${replacement}`, value);
  return str;
};
var generateRuleRegExp = (rule) => {
  rule = rule.split("*").map(escapeRegex).join("(?<splat>.*)");
  let host_matches = rule.matchAll(HOST_PLACEHOLDER_REGEX);
  for (let host_match of host_matches)
    rule = rule.split(host_match[0]).join(`(?<${host_match[1]}>[^/.]+)`);
  let path_matches = rule.matchAll(PLACEHOLDER_REGEX);
  for (let path_match of path_matches)
    rule = rule.split(path_match[0]).join(`(?<${path_match[1]}>[^/]+)`);
  return rule = "^" + rule + "$", RegExp(rule);
}, generateRulesMatcher = (rules, replacerFn = (match) => match) => {
  if (!rules)
    return () => [];
  let compiledRules = Object.entries(rules).map(([rule, match]) => {
    let crossHost = rule.startsWith("https://");
    try {
      let regExp = generateRuleRegExp(rule);
      return [{ crossHost, regExp }, match];
    } catch {
    }
  }).filter((value) => value !== void 0);
  return ({ request }) => {
    let { pathname, hostname } = new URL(request.url);
    return compiledRules.map(([{ crossHost, regExp }, match]) => {
      let test = crossHost ? `https://${hostname}${pathname}` : pathname, result = regExp.exec(test);
      if (result)
        return replacerFn(match, result.groups || {});
    }).filter((value) => value !== void 0);
  };
}, staticRedirectsMatcher = (configuration, host, pathname) => {
  let withHostMatch = configuration.redirects.staticRules[`https://${host}${pathname}`], withoutHostMatch = configuration.redirects.staticRules[pathname];
  return withHostMatch && withoutHostMatch ? withHostMatch.lineNumber < withoutHostMatch.lineNumber ? withHostMatch : withoutHostMatch : withHostMatch || withoutHostMatch;
}, generateRedirectsMatcher = (configuration) => generateRulesMatcher(
  configuration.redirects.version === REDIRECTS_VERSION ? configuration.redirects.rules : {},
  ({ status, to }, replacements) => {
    let target = replacer(to, replacements).trim();
    return /^(\w+:\/\/)/.test(target) ? {
      status,
      to: target
    } : {
      status,
      to: target.replace(/\/+/g, "/")
    };
  }
);

// ../workers-shared/asset-worker/src/utils/headers.ts
function getAssetHeaders({ eTag, resolver }, contentType, cacheStatus, request, configuration) {
  let headers = new Headers({
    ETag: `"${eTag}"`
  });
  return contentType !== void 0 && headers.append("Content-Type", contentType), isCacheable(request) && headers.append("Cache-Control", CACHE_CONTROL_BROWSER), headers.append("CF-Cache-Status", cacheStatus), configuration.debug && resolver === "not-found" && flagIsEnabled(
    configuration,
    SEC_FETCH_MODE_NAVIGATE_HEADER_PREFERS_ASSET_SERVING
  ) && headers.append(
    "X-Mf-Additional-Response-Log",
    "`Sec-Fetch-Mode: navigate` header present - using `not_found_handling` behavior"
  ), headers;
}
function isCacheable(request) {
  return !request.headers.has("Authorization") && !request.headers.has("Range");
}
function attachCustomHeaders(request, response, configuration, env) {
  return (env.JAEGER ?? mockJaegerBinding()).enterSpan("add_headers", (span) => {
    let matches = generateRulesMatcher(
      configuration.headers?.version === HEADERS_VERSION ? configuration.headers.rules : {},
      ({ set = {}, unset = [] }, replacements) => {
        let replacedSet = {};
        return Object.entries(set).forEach(([key, value]) => {
          replacedSet[key] = replacer(value, replacements);
        }), {
          set: replacedSet,
          unset
        };
      }
    )({ request }), setMap = /* @__PURE__ */ new Set();
    return matches.forEach(({ set = {}, unset = [] }) => {
      unset.forEach((key) => {
        response.headers.delete(key), span.addLogs({ remove_header: key });
      }), Object.entries(set).forEach(([key, value]) => {
        setMap.has(key.toLowerCase()) ? (response.headers.append(key, value), span.addLogs({ append_header: key })) : (response.headers.set(key, value), setMap.add(key.toLowerCase()), span.addLogs({ add_header: key }));
      });
    }), response;
  });
}

// ../workers-shared/asset-worker/src/handler.ts
var REDIRECTS_VERSION = 1, HEADERS_VERSION = 2, getResponseOrAssetIntent = async (request, env, configuration, exists) => {
  let url = new URL(request.url), { search } = url, redirectResult = handleRedirects(
    env,
    request,
    configuration,
    url.host,
    url.pathname,
    search
  );
  if (redirectResult instanceof Response)
    return redirectResult;
  let { proxied, pathname } = redirectResult, decodedPathname = decodePath(pathname), intent = await getIntent(
    decodedPathname,
    request,
    configuration,
    exists
  );
  if (!intent) {
    let response = proxied ? new NotFoundResponse() : new NoIntentResponse();
    return env.JAEGER.enterSpan("no_intent", (span) => (span.setTags({
      decodedPathname,
      configuration: JSON.stringify(configuration),
      proxied,
      status: response.status
    }), response));
  }
  let method = request.method.toUpperCase();
  if (!["GET", "HEAD"].includes(method))
    return env.JAEGER.enterSpan("method_not_allowed", (span) => (span.setTags({
      method,
      status: MethodNotAllowedResponse.status
    }), new MethodNotAllowedResponse()));
  let decodedDestination = intent.redirect ?? decodedPathname, encodedDestination = encodePath(decodedDestination);
  return encodedDestination !== pathname && intent.asset || intent.redirect ? env.JAEGER.enterSpan("redirect", (span) => (span.setTags({
    originalPath: pathname,
    location: encodedDestination !== pathname ? encodedDestination : intent.redirect ?? "<unknown>",
    status: TemporaryRedirectResponse.status
  }), new TemporaryRedirectResponse(encodedDestination + search))) : intent.asset ? { ...intent.asset, resolver: intent.resolver } : env.JAEGER.enterSpan("unknown_action", (span) => (span.setTags({
    pathname,
    status: InternalServerErrorResponse.status
  }), new InternalServerErrorResponse(new Error("Unknown action"))));
}, resolveAssetIntentToResponse = async (assetIntent, request, env, configuration, getByETag, analytics) => {
  let { pathname } = new URL(request.url), method = request.method.toUpperCase(), asset = await env.JAEGER.enterSpan("getByETag", async (span) => (span.setTags({
    pathname,
    eTag: assetIntent.eTag,
    status: assetIntent.status
  }), await getByETag(assetIntent.eTag, request))), headers = getAssetHeaders(
    assetIntent,
    asset.contentType,
    asset.cacheStatus,
    request,
    configuration
  );
  analytics.setData({ cacheStatus: asset.cacheStatus });
  let strongETag = `"${assetIntent.eTag}"`, weakETag = `W/${strongETag}`, ifNoneMatch = request.headers.get("If-None-Match") || "";
  return [weakETag, strongETag].includes(ifNoneMatch) ? env.JAEGER.enterSpan("matched_etag", (span) => (span.setTags({
    matchedEtag: ifNoneMatch,
    status: NotModifiedResponse.status
  }), new NotModifiedResponse(null, { headers }))) : env.JAEGER.enterSpan("response", (span) => {
    span.setTags({
      etag: assetIntent.eTag,
      status: assetIntent.status,
      head: method === "HEAD"
    });
    let body = method === "HEAD" ? null : asset.readableStream;
    switch (assetIntent.status) {
      case NotFoundResponse.status:
        return new NotFoundResponse(body, { headers });
      case OkResponse.status:
        return new OkResponse(body, { headers });
    }
  });
}, canFetch = async (request, env, configuration, exists) => (configuration.has_static_routing || flagIsEnabled(
  configuration,
  SEC_FETCH_MODE_NAVIGATE_HEADER_PREFERS_ASSET_SERVING
) && request.headers.get("Sec-Fetch-Mode") === "navigate" || (configuration = {
  ...configuration,
  not_found_handling: "none"
}), !(await getResponseOrAssetIntent(
  request,
  env,
  configuration,
  exists
) instanceof NoIntentResponse)), handleRequest = async (request, env, configuration, exists, getByETag, analytics) => {
  let responseOrAssetIntent = await getResponseOrAssetIntent(
    request,
    env,
    configuration,
    exists
  ), response = responseOrAssetIntent instanceof Response ? responseOrAssetIntent : await resolveAssetIntentToResponse(
    responseOrAssetIntent,
    request,
    env,
    configuration,
    getByETag,
    analytics
  );
  return attachCustomHeaders(request, response, configuration, env);
}, getIntent = async (pathname, request, configuration, exists, skipRedirects = !1) => {
  switch (configuration.html_handling) {
    case "auto-trailing-slash":
      return htmlHandlingAutoTrailingSlash(
        pathname,
        request,
        configuration,
        exists,
        skipRedirects
      );
    case "force-trailing-slash":
      return htmlHandlingForceTrailingSlash(
        pathname,
        request,
        configuration,
        exists,
        skipRedirects
      );
    case "drop-trailing-slash":
      return htmlHandlingDropTrailingSlash(
        pathname,
        request,
        configuration,
        exists,
        skipRedirects
      );
    case "none":
      return htmlHandlingNone(pathname, request, configuration, exists);
  }
}, htmlHandlingAutoTrailingSlash = async (pathname, request, configuration, exists, skipRedirects) => {
  let redirectResult = null, eTagResult = null, exactETag = await exists(pathname, request);
  if (pathname.endsWith("/index")) {
    if (exactETag)
      return {
        asset: {
          eTag: exactETag,
          status: OkResponse.status
        },
        redirect: null,
        resolver: "html-handling"
      };
    if (redirectResult = await safeRedirect(
      `${pathname}.html`,
      request,
      pathname.slice(0, -5),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
    if (redirectResult = await safeRedirect(
      `${pathname.slice(0, -6)}.html`,
      request,
      pathname.slice(0, -6),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
  } else if (pathname.endsWith("/index.html")) {
    if (redirectResult = await safeRedirect(
      pathname,
      request,
      pathname.slice(0, -10),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
    if (redirectResult = await safeRedirect(
      `${pathname.slice(0, -11)}.html`,
      request,
      pathname.slice(0, -11),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
  } else if (pathname.endsWith("/")) {
    if (eTagResult = await exists(`${pathname}index.html`, request))
      return {
        asset: { eTag: eTagResult, status: OkResponse.status },
        redirect: null,
        resolver: "html-handling"
      };
    if (redirectResult = await safeRedirect(
      `${pathname.slice(0, -1)}.html`,
      request,
      pathname.slice(0, -1),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
  } else if (pathname.endsWith(".html")) {
    if (redirectResult = await safeRedirect(
      pathname,
      request,
      pathname.slice(0, -5),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
    if (redirectResult = await safeRedirect(
      `${pathname.slice(0, -5)}/index.html`,
      request,
      `${pathname.slice(0, -5)}/`,
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
  }
  return exactETag ? {
    asset: { eTag: exactETag, status: OkResponse.status },
    redirect: null,
    resolver: "html-handling"
  } : (eTagResult = await exists(`${pathname}.html`, request)) ? {
    asset: { eTag: eTagResult, status: OkResponse.status },
    redirect: null,
    resolver: "html-handling"
  } : (redirectResult = await safeRedirect(
    `${pathname}/index.html`,
    request,
    `${pathname}/`,
    configuration,
    exists,
    skipRedirects,
    "html-handling"
  )) ? redirectResult : notFound(pathname, request, configuration, exists);
}, htmlHandlingForceTrailingSlash = async (pathname, request, configuration, exists, skipRedirects) => {
  let redirectResult = null, eTagResult = null, exactETag = await exists(pathname, request);
  if (pathname.endsWith("/index")) {
    if (exactETag)
      return {
        asset: { eTag: exactETag, status: OkResponse.status },
        redirect: null,
        resolver: "html-handling"
      };
    if (redirectResult = await safeRedirect(
      `${pathname}.html`,
      request,
      pathname.slice(0, -5),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
    if (redirectResult = await safeRedirect(
      `${pathname.slice(0, -6)}.html`,
      request,
      pathname.slice(0, -5),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
  } else if (pathname.endsWith("/index.html")) {
    if (redirectResult = await safeRedirect(
      pathname,
      request,
      pathname.slice(0, -10),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
    if (redirectResult = await safeRedirect(
      `${pathname.slice(0, -11)}.html`,
      request,
      pathname.slice(0, -10),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
  } else if (pathname.endsWith("/")) {
    if (eTagResult = await exists(`${pathname}index.html`, request))
      return {
        asset: { eTag: eTagResult, status: OkResponse.status },
        redirect: null,
        resolver: "html-handling"
      };
    if (eTagResult = await exists(
      `${pathname.slice(0, -1)}.html`,
      request
    ))
      return {
        asset: { eTag: eTagResult, status: OkResponse.status },
        redirect: null,
        resolver: "html-handling"
      };
  } else if (pathname.endsWith(".html")) {
    if (redirectResult = await safeRedirect(
      pathname,
      request,
      `${pathname.slice(0, -5)}/`,
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
    if (exactETag)
      return {
        asset: { eTag: exactETag, status: OkResponse.status },
        redirect: null,
        resolver: "html-handling"
      };
    if (redirectResult = await safeRedirect(
      `${pathname.slice(0, -5)}/index.html`,
      request,
      `${pathname.slice(0, -5)}/`,
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
  }
  return exactETag ? {
    asset: { eTag: exactETag, status: OkResponse.status },
    redirect: null,
    resolver: "html-handling"
  } : (redirectResult = await safeRedirect(
    `${pathname}.html`,
    request,
    `${pathname}/`,
    configuration,
    exists,
    skipRedirects,
    "html-handling"
  )) || (redirectResult = await safeRedirect(
    `${pathname}/index.html`,
    request,
    `${pathname}/`,
    configuration,
    exists,
    skipRedirects,
    "html-handling"
  )) ? redirectResult : notFound(pathname, request, configuration, exists);
}, htmlHandlingDropTrailingSlash = async (pathname, request, configuration, exists, skipRedirects) => {
  let redirectResult = null, eTagResult = null, exactETag = await exists(pathname, request);
  if (pathname.endsWith("/index")) {
    if (exactETag)
      return {
        asset: { eTag: exactETag, status: OkResponse.status },
        redirect: null,
        resolver: "html-handling"
      };
    if (pathname === "/index") {
      if (redirectResult = await safeRedirect(
        "/index.html",
        request,
        "/",
        configuration,
        exists,
        skipRedirects,
        "html-handling"
      ))
        return redirectResult;
    } else {
      if (redirectResult = await safeRedirect(
        `${pathname.slice(0, -6)}.html`,
        request,
        pathname.slice(0, -6),
        configuration,
        exists,
        skipRedirects,
        "html-handling"
      ))
        return redirectResult;
      if (redirectResult = await safeRedirect(
        `${pathname}.html`,
        request,
        pathname.slice(0, -6),
        configuration,
        exists,
        skipRedirects,
        "html-handling"
      ))
        return redirectResult;
    }
  } else if (pathname.endsWith("/index.html"))
    if (pathname === "/index.html") {
      if (redirectResult = await safeRedirect(
        "/index.html",
        request,
        "/",
        configuration,
        exists,
        skipRedirects,
        "html-handling"
      ))
        return redirectResult;
    } else {
      if (redirectResult = await safeRedirect(
        pathname,
        request,
        pathname.slice(0, -11),
        configuration,
        exists,
        skipRedirects,
        "html-handling"
      ))
        return redirectResult;
      if (exactETag)
        return {
          asset: { eTag: exactETag, status: OkResponse.status },
          redirect: null,
          resolver: "html-handling"
        };
      if (redirectResult = await safeRedirect(
        `${pathname.slice(0, -11)}.html`,
        request,
        pathname.slice(0, -11),
        configuration,
        exists,
        skipRedirects,
        "html-handling"
      ))
        return redirectResult;
    }
  else if (pathname.endsWith("/"))
    if (pathname === "/") {
      if (eTagResult = await exists("/index.html", request))
        return {
          asset: { eTag: eTagResult, status: OkResponse.status },
          redirect: null,
          resolver: "html-handling"
        };
    } else {
      if (redirectResult = await safeRedirect(
        `${pathname.slice(0, -1)}.html`,
        request,
        pathname.slice(0, -1),
        configuration,
        exists,
        skipRedirects,
        "html-handling"
      ))
        return redirectResult;
      if (redirectResult = await safeRedirect(
        `${pathname.slice(0, -1)}/index.html`,
        request,
        pathname.slice(0, -1),
        configuration,
        exists,
        skipRedirects,
        "html-handling"
      ))
        return redirectResult;
    }
  else if (pathname.endsWith(".html")) {
    if (redirectResult = await safeRedirect(
      pathname,
      request,
      pathname.slice(0, -5),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
    if (redirectResult = await safeRedirect(
      `${pathname.slice(0, -5)}/index.html`,
      request,
      pathname.slice(0, -5),
      configuration,
      exists,
      skipRedirects,
      "html-handling"
    ))
      return redirectResult;
  }
  return exactETag ? {
    asset: { eTag: exactETag, status: OkResponse.status },
    redirect: null,
    resolver: "html-handling"
  } : (eTagResult = await exists(`${pathname}.html`, request)) ? {
    asset: { eTag: eTagResult, status: OkResponse.status },
    redirect: null,
    resolver: "html-handling"
  } : (eTagResult = await exists(`${pathname}/index.html`, request)) ? {
    asset: { eTag: eTagResult, status: OkResponse.status },
    redirect: null,
    resolver: "html-handling"
  } : notFound(pathname, request, configuration, exists);
}, htmlHandlingNone = async (pathname, request, configuration, exists) => {
  let exactETag = await exists(pathname, request);
  return exactETag ? {
    asset: { eTag: exactETag, status: OkResponse.status },
    redirect: null,
    resolver: "html-handling"
  } : notFound(pathname, request, configuration, exists);
}, notFound = async (pathname, request, configuration, exists) => {
  switch (configuration.not_found_handling) {
    case "single-page-application": {
      let eTag = await exists("/index.html", request);
      return eTag ? {
        asset: { eTag, status: OkResponse.status },
        redirect: null,
        resolver: "not-found"
      } : null;
    }
    case "404-page": {
      let cwd = pathname;
      for (; cwd; ) {
        cwd = cwd.slice(0, cwd.lastIndexOf("/"));
        let eTag = await exists(`${cwd}/404.html`, request);
        if (eTag)
          return {
            asset: { eTag, status: NotFoundResponse.status },
            redirect: null,
            resolver: "not-found"
          };
      }
      return null;
    }
    case "none":
    default:
      return null;
  }
}, safeRedirect = async (file, request, destination, configuration, exists, skip, resolver) => {
  if (skip)
    return null;
  if (!await exists(destination, request)) {
    let intent = await getIntent(
      destination,
      request,
      configuration,
      exists,
      !0
    );
    if (intent?.asset && intent.asset.eTag === await exists(file, request))
      return {
        asset: null,
        redirect: destination,
        resolver
      };
  }
  return null;
}, decodePath = (pathname) => pathname.split("/").map((x) => {
  try {
    return decodeURIComponent(x);
  } catch {
    return x;
  }
}).join("/").replace(/\/+/g, "/"), encodePath = (pathname) => pathname.split("/").map((x) => {
  try {
    return encodeURIComponent(x);
  } catch {
    return x;
  }
}).join("/"), handleRedirects = (env, request, configuration, host, pathname, search) => (env.JAEGER ?? mockJaegerBinding()).enterSpan("handle_redirects", (span) => {
  let redirectMatch = staticRedirectsMatcher(configuration, host, pathname) || generateRedirectsMatcher(configuration)({ request })[0], proxied = !1;
  if (redirectMatch)
    if (redirectMatch.status === 200)
      pathname = new URL(redirectMatch.to, request.url).pathname, proxied = !0, span.setTags({
        matched: !0,
        proxied: !0,
        new_path: pathname,
        status: redirectMatch.status
      });
    else {
      let { status, to } = redirectMatch, destination = new URL(to, request.url), location = destination.origin === new URL(request.url).origin ? `${destination.pathname}${destination.search || search}${destination.hash}` : `${destination.href.slice(0, destination.href.length - (destination.search.length + destination.hash.length))}${destination.search ? destination.search : search}${destination.hash}`;
      switch (span.setTags({
        matched: !0,
        destination: location,
        status
      }), status) {
        case MovedPermanentlyResponse.status:
          return new MovedPermanentlyResponse(location);
        case SeeOtherResponse.status:
          return new SeeOtherResponse(location);
        case TemporaryRedirectResponse.status:
          return new TemporaryRedirectResponse(location);
        case PermanentRedirectResponse.status:
          return new PermanentRedirectResponse(location);
        case FoundResponse.status:
        default:
          return new FoundResponse(location);
      }
    }
  else
    span.setTags({
      matched: !1
    });
  return { proxied, pathname };
});

// ../workers-shared/asset-worker/src/utils/final-operations.ts
function handleError(sentry, analytics, err) {
  try {
    let response = new InternalServerErrorResponse(err);
    return sentry && sentry.captureException(err), err instanceof Error && analytics.setData({ error: err.message }), response;
  } catch (e) {
    return console.error("Error handling error", e), new InternalServerErrorResponse(e);
  }
}
function submitMetrics(analytics, performance, startTimeMs) {
  try {
    analytics.setData({ requestTime: performance.now() - startTimeMs }), analytics.write();
  } catch (e) {
    console.error("Error submitting metrics", e);
  }
}

// ../workers-shared/asset-worker/src/utils/kv.ts
async function getAssetWithMetadataFromKV(assetsKVNamespace, assetKey, sentry, retries = 1) {
  let attempts = 0;
  for (; attempts <= retries; )
    try {
      let asset = await assetsKVNamespace.getWithMetadata(
        assetKey,
        {
          type: "stream",
          cacheTtl: 31536e3
          // 1 year
        }
      );
      if (asset.value === null) {
        let retriedAsset = await assetsKVNamespace.getWithMetadata(assetKey, {
          type: "stream",
          cacheTtl: 60
          // Minimum value allowed
        });
        return retriedAsset.value !== null && sentry && sentry.captureException(
          new Error(
            `Initial request for asset ${assetKey} failed, but subsequent request succeeded.`
          )
        ), retriedAsset;
      }
      return asset;
    } catch (err) {
      if (attempts >= retries) {
        let message = `KV GET ${assetKey} failed.`;
        throw err instanceof Error && (message = `KV GET ${assetKey} failed: ${err.message}`), new Error(message);
      }
      await new Promise(
        (resolvePromise) => setTimeout(resolvePromise, Math.pow(2, attempts++) * 1e3)
      );
    }
}

// ../workers-shared/asset-worker/src/worker.ts
var worker_default = class extends WorkerEntrypoint {
  async fetch(request) {
    let sentry, analytics = new Analytics(this.env.ANALYTICS), performance = new PerformanceTimer(this.env.UNSAFE_PERFORMANCE), startTimeMs = performance.now();
    try {
      this.env.JAEGER ??= mockJaegerBinding(), sentry = setupSentry(
        request,
        this.ctx,
        this.env.SENTRY_DSN,
        this.env.SENTRY_ACCESS_CLIENT_ID,
        this.env.SENTRY_ACCESS_CLIENT_SECRET,
        this.env.COLO_METADATA,
        this.env.VERSION_METADATA,
        this.env.CONFIG?.account_id,
        this.env.CONFIG?.script_id
      );
      let config = normalizeConfiguration(this.env.CONFIG);
      sentry?.setContext("compatibilityOptions", {
        compatibilityDate: config.compatibility_date,
        compatibilityFlags: config.compatibility_flags,
        originalCompatibilityFlags: this.env.CONFIG.compatibility_flags
      });
      let userAgent = request.headers.get("user-agent") ?? "UA UNKNOWN", url = new URL(request.url);
      return this.env.COLO_METADATA && this.env.VERSION_METADATA && this.env.CONFIG && analytics.setData({
        accountId: this.env.CONFIG.account_id,
        scriptId: this.env.CONFIG.script_id,
        coloId: this.env.COLO_METADATA.coloId,
        metalId: this.env.COLO_METADATA.metalId,
        coloTier: this.env.COLO_METADATA.coloTier,
        coloRegion: this.env.COLO_METADATA.coloRegion,
        version: this.env.VERSION_METADATA.tag,
        hostname: url.hostname,
        htmlHandling: config.html_handling,
        notFoundHandling: config.not_found_handling,
        compatibilityFlags: config.compatibility_flags,
        userAgent
      }), await this.env.JAEGER.enterSpan("handleRequest", async (span) => {
        span.setTags({
          hostname: url.hostname,
          eyeballPath: url.pathname,
          env: this.env.ENVIRONMENT,
          version: this.env.VERSION_METADATA?.id
        });
        let response = await handleRequest(
          request,
          this.env,
          config,
          this.unstable_exists.bind(this),
          this.unstable_getByETag.bind(this),
          analytics
        );
        return analytics.setData({ status: response.status }), response;
      });
    } catch (err) {
      return handleError(sentry, analytics, err);
    } finally {
      submitMetrics(analytics, performance, startTimeMs);
    }
  }
  async unstable_canFetch(request) {
    return this.env.JAEGER ??= mockJaegerBinding(), canFetch(
      request,
      this.env,
      normalizeConfiguration(this.env.CONFIG),
      this.unstable_exists.bind(this)
    );
  }
  async unstable_getByETag(eTag, _request) {
    let performance = new PerformanceTimer(this.env.UNSAFE_PERFORMANCE);
    return (this.env.JAEGER ?? mockJaegerBinding()).enterSpan("unstable_getByETag", async (span) => {
      let startTime = performance.now(), asset = await getAssetWithMetadataFromKV(
        this.env.ASSETS_KV_NAMESPACE,
        eTag
      ), assetFetchTime = performance.now() - startTime;
      if (!asset || !asset.value)
        throw span.setTags({
          error: !0
        }), span.addLogs({
          error: `Requested asset ${eTag} exists in the asset manifest but not in the KV namespace.`
        }), new Error(
          `Requested asset ${eTag} exists in the asset manifest but not in the KV namespace.`
        );
      let cacheStatus = assetFetchTime <= 100 ? "HIT" : "MISS";
      return span.setTags({
        etag: eTag,
        contentType: asset.metadata?.contentType ?? "unknown",
        cacheStatus
      }), {
        readableStream: asset.value,
        contentType: asset.metadata?.contentType,
        cacheStatus
      };
    });
  }
  async unstable_getByPathname(pathname, request) {
    return (this.env.JAEGER ?? mockJaegerBinding()).enterSpan("unstable_getByPathname", async (span) => {
      let eTag = await this.unstable_exists(pathname, request);
      return span.setTags({
        path: pathname,
        found: eTag !== null
      }), eTag ? this.unstable_getByETag(eTag, request) : null;
    });
  }
  async unstable_exists(pathname, _request) {
    let analytics = new ExperimentAnalytics(this.env.EXPERIMENT_ANALYTICS), performance = new PerformanceTimer(this.env.UNSAFE_PERFORMANCE);
    return (this.env.JAEGER ?? mockJaegerBinding()).enterSpan("unstable_exists", async (span) => {
      this.env.COLO_METADATA && this.env.VERSION_METADATA && this.env.CONFIG && analytics.setData({
        accountId: this.env.CONFIG.account_id,
        experimentName: "manifest-read-timing"
      });
      let startTimeMs = performance.now();
      try {
        let eTag = await new AssetsManifest(this.env.ASSETS_MANIFEST).get(pathname);
        return span.setTags({
          path: pathname,
          found: eTag !== null,
          etag: eTag ?? ""
        }), eTag;
      } finally {
        analytics.setData({
          manifestReadTime: performance.now() - startTimeMs
        }), analytics.write();
      }
    });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=assets.worker.js.map
