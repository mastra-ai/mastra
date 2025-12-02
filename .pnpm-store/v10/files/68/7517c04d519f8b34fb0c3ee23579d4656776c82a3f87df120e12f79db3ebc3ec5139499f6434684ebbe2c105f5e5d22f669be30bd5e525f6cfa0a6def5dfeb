"use strict";
var convex = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // browser-bundle.js
  var browser_bundle_exports = {};
  __export(browser_bundle_exports, {
    BaseConvexClient: () => BaseConvexClient,
    ConvexClient: () => ConvexClient,
    ConvexHttpClient: () => ConvexHttpClient,
    anyApi: () => anyApi
  });

  // src/index.ts
  var version = "1.29.3";

  // src/values/base64.ts
  var base64_exports = {};
  __export(base64_exports, {
    byteLength: () => byteLength,
    fromByteArray: () => fromByteArray,
    fromByteArrayUrlSafeNoPadding: () => fromByteArrayUrlSafeNoPadding,
    toByteArray: () => toByteArray
  });
  var lookup = [];
  var revLookup = [];
  var Arr = Uint8Array;
  var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }
  var i;
  var len;
  revLookup["-".charCodeAt(0)] = 62;
  revLookup["_".charCodeAt(0)] = 63;
  function getLens(b64) {
    var len = b64.length;
    if (len % 4 > 0) {
      throw new Error("Invalid string. Length must be a multiple of 4");
    }
    var validLen = b64.indexOf("=");
    if (validLen === -1) validLen = len;
    var placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
    return [validLen, placeHoldersLen];
  }
  function byteLength(b64) {
    var lens = getLens(b64);
    var validLen = lens[0];
    var placeHoldersLen = lens[1];
    return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
  }
  function _byteLength(_b64, validLen, placeHoldersLen) {
    return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
  }
  function toByteArray(b64) {
    var tmp;
    var lens = getLens(b64);
    var validLen = lens[0];
    var placeHoldersLen = lens[1];
    var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
    var curByte = 0;
    var len = placeHoldersLen > 0 ? validLen - 4 : validLen;
    var i;
    for (i = 0; i < len; i += 4) {
      tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
      arr[curByte++] = tmp >> 16 & 255;
      arr[curByte++] = tmp >> 8 & 255;
      arr[curByte++] = tmp & 255;
    }
    if (placeHoldersLen === 2) {
      tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
      arr[curByte++] = tmp & 255;
    }
    if (placeHoldersLen === 1) {
      tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
      arr[curByte++] = tmp >> 8 & 255;
      arr[curByte++] = tmp & 255;
    }
    return arr;
  }
  function tripletToBase64(num) {
    return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
  }
  function encodeChunk(uint8, start, end) {
    var tmp;
    var output = [];
    for (var i = start; i < end; i += 3) {
      tmp = (uint8[i] << 16 & 16711680) + (uint8[i + 1] << 8 & 65280) + (uint8[i + 2] & 255);
      output.push(tripletToBase64(tmp));
    }
    return output.join("");
  }
  function fromByteArray(uint8) {
    var tmp;
    var len = uint8.length;
    var extraBytes = len % 3;
    var parts = [];
    var maxChunkLength = 16383;
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(
        encodeChunk(
          uint8,
          i,
          i + maxChunkLength > len2 ? len2 : i + maxChunkLength
        )
      );
    }
    if (extraBytes === 1) {
      tmp = uint8[len - 1];
      parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==");
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + uint8[len - 1];
      parts.push(
        lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
      );
    }
    return parts.join("");
  }
  function fromByteArrayUrlSafeNoPadding(uint8) {
    return fromByteArray(uint8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  // src/common/index.ts
  function parseArgs(args) {
    if (args === void 0) {
      return {};
    }
    if (!isSimpleObject(args)) {
      throw new Error(
        `The arguments to a Convex function must be an object. Received: ${args}`
      );
    }
    return args;
  }
  function validateDeploymentUrl(deploymentUrl) {
    if (typeof deploymentUrl === "undefined") {
      throw new Error(
        `Client created with undefined deployment address. If you used an environment variable, check that it's set.`
      );
    }
    if (typeof deploymentUrl !== "string") {
      throw new Error(
        `Invalid deployment address: found ${deploymentUrl}".`
      );
    }
    if (!(deploymentUrl.startsWith("http:") || deploymentUrl.startsWith("https:"))) {
      throw new Error(
        `Invalid deployment address: Must start with "https://" or "http://". Found "${deploymentUrl}".`
      );
    }
    try {
      new URL(deploymentUrl);
    } catch {
      throw new Error(
        `Invalid deployment address: "${deploymentUrl}" is not a valid URL. If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`
      );
    }
    if (deploymentUrl.endsWith(".convex.site")) {
      throw new Error(
        `Invalid deployment address: "${deploymentUrl}" ends with .convex.site, which is used for HTTP Actions. Convex deployment URLs typically end with .convex.cloud? If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`
      );
    }
  }
  function isSimpleObject(value) {
    const isObject = typeof value === "object";
    const prototype = Object.getPrototypeOf(value);
    const isSimple = prototype === null || prototype === Object.prototype || // Objects generated from other contexts (e.g. across Node.js `vm` modules) will not satisfy the previous
    // conditions but are still simple objects.
    prototype?.constructor?.name === "Object";
    return isObject && isSimple;
  }

  // src/values/value.ts
  var LITTLE_ENDIAN = true;
  var MIN_INT64 = BigInt("-9223372036854775808");
  var MAX_INT64 = BigInt("9223372036854775807");
  var ZERO = BigInt("0");
  var EIGHT = BigInt("8");
  var TWOFIFTYSIX = BigInt("256");
  function isSpecial(n) {
    return Number.isNaN(n) || !Number.isFinite(n) || Object.is(n, -0);
  }
  function slowBigIntToBase64(value) {
    if (value < ZERO) {
      value -= MIN_INT64 + MIN_INT64;
    }
    let hex = value.toString(16);
    if (hex.length % 2 === 1) hex = "0" + hex;
    const bytes = new Uint8Array(new ArrayBuffer(8));
    let i = 0;
    for (const hexByte of hex.match(/.{2}/g).reverse()) {
      bytes.set([parseInt(hexByte, 16)], i++);
      value >>= EIGHT;
    }
    return fromByteArray(bytes);
  }
  function slowBase64ToBigInt(encoded) {
    const integerBytes = toByteArray(encoded);
    if (integerBytes.byteLength !== 8) {
      throw new Error(
        `Received ${integerBytes.byteLength} bytes, expected 8 for $integer`
      );
    }
    let value = ZERO;
    let power = ZERO;
    for (const byte of integerBytes) {
      value += BigInt(byte) * TWOFIFTYSIX ** power;
      power++;
    }
    if (value > MAX_INT64) {
      value += MIN_INT64 + MIN_INT64;
    }
    return value;
  }
  function modernBigIntToBase64(value) {
    if (value < MIN_INT64 || MAX_INT64 < value) {
      throw new Error(
        `BigInt ${value} does not fit into a 64-bit signed integer.`
      );
    }
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigInt64(0, value, true);
    return fromByteArray(new Uint8Array(buffer));
  }
  function modernBase64ToBigInt(encoded) {
    const integerBytes = toByteArray(encoded);
    if (integerBytes.byteLength !== 8) {
      throw new Error(
        `Received ${integerBytes.byteLength} bytes, expected 8 for $integer`
      );
    }
    const intBytesView = new DataView(integerBytes.buffer);
    return intBytesView.getBigInt64(0, true);
  }
  var bigIntToBase64 = DataView.prototype.setBigInt64 ? modernBigIntToBase64 : slowBigIntToBase64;
  var base64ToBigInt = DataView.prototype.getBigInt64 ? modernBase64ToBigInt : slowBase64ToBigInt;
  var MAX_IDENTIFIER_LEN = 1024;
  function validateObjectField(k) {
    if (k.length > MAX_IDENTIFIER_LEN) {
      throw new Error(
        `Field name ${k} exceeds maximum field name length ${MAX_IDENTIFIER_LEN}.`
      );
    }
    if (k.startsWith("$")) {
      throw new Error(`Field name ${k} starts with a '$', which is reserved.`);
    }
    for (let i = 0; i < k.length; i += 1) {
      const charCode = k.charCodeAt(i);
      if (charCode < 32 || charCode >= 127) {
        throw new Error(
          `Field name ${k} has invalid character '${k[i]}': Field names can only contain non-control ASCII characters`
        );
      }
    }
  }
  function jsonToConvex(value) {
    if (value === null) {
      return value;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((value2) => jsonToConvex(value2));
    }
    if (typeof value !== "object") {
      throw new Error(`Unexpected type of ${value}`);
    }
    const entries = Object.entries(value);
    if (entries.length === 1) {
      const key = entries[0][0];
      if (key === "$bytes") {
        if (typeof value.$bytes !== "string") {
          throw new Error(`Malformed $bytes field on ${value}`);
        }
        return toByteArray(value.$bytes).buffer;
      }
      if (key === "$integer") {
        if (typeof value.$integer !== "string") {
          throw new Error(`Malformed $integer field on ${value}`);
        }
        return base64ToBigInt(value.$integer);
      }
      if (key === "$float") {
        if (typeof value.$float !== "string") {
          throw new Error(`Malformed $float field on ${value}`);
        }
        const floatBytes = toByteArray(value.$float);
        if (floatBytes.byteLength !== 8) {
          throw new Error(
            `Received ${floatBytes.byteLength} bytes, expected 8 for $float`
          );
        }
        const floatBytesView = new DataView(floatBytes.buffer);
        const float = floatBytesView.getFloat64(0, LITTLE_ENDIAN);
        if (!isSpecial(float)) {
          throw new Error(`Float ${float} should be encoded as a number`);
        }
        return float;
      }
      if (key === "$set") {
        throw new Error(
          `Received a Set which is no longer supported as a Convex type.`
        );
      }
      if (key === "$map") {
        throw new Error(
          `Received a Map which is no longer supported as a Convex type.`
        );
      }
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      validateObjectField(k);
      out[k] = jsonToConvex(v);
    }
    return out;
  }
  var MAX_VALUE_FOR_ERROR_LEN = 16384;
  function stringifyValueForError(value) {
    const str = JSON.stringify(value, (_key, value2) => {
      if (value2 === void 0) {
        return "undefined";
      }
      if (typeof value2 === "bigint") {
        return `${value2.toString()}n`;
      }
      return value2;
    });
    if (str.length > MAX_VALUE_FOR_ERROR_LEN) {
      const rest = "[...truncated]";
      let truncateAt = MAX_VALUE_FOR_ERROR_LEN - rest.length;
      const codePoint = str.codePointAt(truncateAt - 1);
      if (codePoint !== void 0 && codePoint > 65535) {
        truncateAt -= 1;
      }
      return str.substring(0, truncateAt) + rest;
    }
    return str;
  }
  function convexToJsonInternal(value, originalValue, context, includeTopLevelUndefined) {
    if (value === void 0) {
      const contextText = context && ` (present at path ${context} in original object ${stringifyValueForError(
        originalValue
      )})`;
      throw new Error(
        `undefined is not a valid Convex value${contextText}. To learn about Convex's supported types, see https://docs.convex.dev/using/types.`
      );
    }
    if (value === null) {
      return value;
    }
    if (typeof value === "bigint") {
      if (value < MIN_INT64 || MAX_INT64 < value) {
        throw new Error(
          `BigInt ${value} does not fit into a 64-bit signed integer.`
        );
      }
      return { $integer: bigIntToBase64(value) };
    }
    if (typeof value === "number") {
      if (isSpecial(value)) {
        const buffer = new ArrayBuffer(8);
        new DataView(buffer).setFloat64(0, value, LITTLE_ENDIAN);
        return { $float: fromByteArray(new Uint8Array(buffer)) };
      } else {
        return value;
      }
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value;
    }
    if (value instanceof ArrayBuffer) {
      return { $bytes: fromByteArray(new Uint8Array(value)) };
    }
    if (Array.isArray(value)) {
      return value.map(
        (value2, i) => convexToJsonInternal(value2, originalValue, context + `[${i}]`, false)
      );
    }
    if (value instanceof Set) {
      throw new Error(
        errorMessageForUnsupportedType(context, "Set", [...value], originalValue)
      );
    }
    if (value instanceof Map) {
      throw new Error(
        errorMessageForUnsupportedType(context, "Map", [...value], originalValue)
      );
    }
    if (!isSimpleObject(value)) {
      const theType = value?.constructor?.name;
      const typeName = theType ? `${theType} ` : "";
      throw new Error(
        errorMessageForUnsupportedType(context, typeName, value, originalValue)
      );
    }
    const out = {};
    const entries = Object.entries(value);
    entries.sort(([k1, _v1], [k2, _v2]) => k1 === k2 ? 0 : k1 < k2 ? -1 : 1);
    for (const [k, v] of entries) {
      if (v !== void 0) {
        validateObjectField(k);
        out[k] = convexToJsonInternal(v, originalValue, context + `.${k}`, false);
      } else if (includeTopLevelUndefined) {
        validateObjectField(k);
        out[k] = convexOrUndefinedToJsonInternal(
          v,
          originalValue,
          context + `.${k}`
        );
      }
    }
    return out;
  }
  function errorMessageForUnsupportedType(context, typeName, value, originalValue) {
    if (context) {
      return `${typeName}${stringifyValueForError(
        value
      )} is not a supported Convex type (present at path ${context} in original object ${stringifyValueForError(
        originalValue
      )}). To learn about Convex's supported types, see https://docs.convex.dev/using/types.`;
    } else {
      return `${typeName}${stringifyValueForError(
        value
      )} is not a supported Convex type.`;
    }
  }
  function convexOrUndefinedToJsonInternal(value, originalValue, context) {
    if (value === void 0) {
      return { $undefined: null };
    } else {
      if (originalValue === void 0) {
        throw new Error(
          `Programming error. Current value is ${stringifyValueForError(
            value
          )} but original value is undefined`
        );
      }
      return convexToJsonInternal(value, originalValue, context, false);
    }
  }
  function convexToJson(value) {
    return convexToJsonInternal(value, value, "", false);
  }

  // src/values/errors.ts
  var IDENTIFYING_FIELD = Symbol.for("ConvexError");
  var ConvexError = class extends Error {
    name = "ConvexError";
    data;
    [IDENTIFYING_FIELD] = true;
    constructor(data) {
      super(typeof data === "string" ? data : stringifyValueForError(data));
      this.data = data;
    }
  };

  // src/browser/logging.ts
  var INFO_COLOR = "color:rgb(0, 145, 255)";
  function prefix_for_source(source) {
    switch (source) {
      case "query":
        return "Q";
      case "mutation":
        return "M";
      case "action":
        return "A";
      case "any":
        return "?";
    }
  }
  var DefaultLogger = class {
    _onLogLineFuncs;
    _verbose;
    constructor(options) {
      this._onLogLineFuncs = {};
      this._verbose = options.verbose;
    }
    addLogLineListener(func) {
      let id = Math.random().toString(36).substring(2, 15);
      for (let i = 0; i < 10; i++) {
        if (this._onLogLineFuncs[id] === void 0) {
          break;
        }
        id = Math.random().toString(36).substring(2, 15);
      }
      this._onLogLineFuncs[id] = func;
      return () => {
        delete this._onLogLineFuncs[id];
      };
    }
    logVerbose(...args) {
      if (this._verbose) {
        for (const func of Object.values(this._onLogLineFuncs)) {
          func("debug", `${(/* @__PURE__ */ new Date()).toISOString()}`, ...args);
        }
      }
    }
    log(...args) {
      for (const func of Object.values(this._onLogLineFuncs)) {
        func("info", ...args);
      }
    }
    warn(...args) {
      for (const func of Object.values(this._onLogLineFuncs)) {
        func("warn", ...args);
      }
    }
    error(...args) {
      for (const func of Object.values(this._onLogLineFuncs)) {
        func("error", ...args);
      }
    }
  };
  function instantiateDefaultLogger(options) {
    const logger = new DefaultLogger(options);
    logger.addLogLineListener((level, ...args) => {
      switch (level) {
        case "debug":
          console.debug(...args);
          break;
        case "info":
          console.log(...args);
          break;
        case "warn":
          console.warn(...args);
          break;
        case "error":
          console.error(...args);
          break;
        default: {
          level;
          console.log(...args);
        }
      }
    });
    return logger;
  }
  function instantiateNoopLogger(options) {
    return new DefaultLogger(options);
  }
  function logForFunction(logger, type, source, udfPath, message) {
    const prefix = prefix_for_source(source);
    if (typeof message === "object") {
      message = `ConvexError ${JSON.stringify(message.errorData, null, 2)}`;
    }
    if (type === "info") {
      const match = message.match(/^\[.*?\] /);
      if (match === null) {
        logger.error(
          `[CONVEX ${prefix}(${udfPath})] Could not parse console.log`
        );
        return;
      }
      const level = message.slice(1, match[0].length - 2);
      const args = message.slice(match[0].length);
      logger.log(`%c[CONVEX ${prefix}(${udfPath})] [${level}]`, INFO_COLOR, args);
    } else {
      logger.error(`[CONVEX ${prefix}(${udfPath})] ${message}`);
    }
  }
  function logFatalError(logger, message) {
    const errorMessage = `[CONVEX FATAL ERROR] ${message}`;
    logger.error(errorMessage);
    return new Error(errorMessage);
  }
  function createHybridErrorStacktrace(source, udfPath, result) {
    const prefix = prefix_for_source(source);
    return `[CONVEX ${prefix}(${udfPath})] ${result.errorMessage}
  Called by client`;
  }
  function forwardData(result, error) {
    error.data = result.errorData;
    return error;
  }

  // src/browser/sync/udf_path_utils.ts
  function canonicalizeUdfPath(udfPath) {
    const pieces = udfPath.split(":");
    let moduleName;
    let functionName2;
    if (pieces.length === 1) {
      moduleName = pieces[0];
      functionName2 = "default";
    } else {
      moduleName = pieces.slice(0, pieces.length - 1).join(":");
      functionName2 = pieces[pieces.length - 1];
    }
    if (moduleName.endsWith(".js")) {
      moduleName = moduleName.slice(0, -3);
    }
    return `${moduleName}:${functionName2}`;
  }
  function serializePathAndArgs(udfPath, args) {
    return JSON.stringify({
      udfPath: canonicalizeUdfPath(udfPath),
      args: convexToJson(args)
    });
  }

  // src/browser/sync/local_state.ts
  var LocalSyncState = class {
    nextQueryId;
    querySetVersion;
    querySet;
    queryIdToToken;
    identityVersion;
    auth;
    outstandingQueriesOlderThanRestart;
    outstandingAuthOlderThanRestart;
    paused;
    pendingQuerySetModifications;
    constructor() {
      this.nextQueryId = 0;
      this.querySetVersion = 0;
      this.identityVersion = 0;
      this.querySet = /* @__PURE__ */ new Map();
      this.queryIdToToken = /* @__PURE__ */ new Map();
      this.outstandingQueriesOlderThanRestart = /* @__PURE__ */ new Set();
      this.outstandingAuthOlderThanRestart = false;
      this.paused = false;
      this.pendingQuerySetModifications = /* @__PURE__ */ new Map();
    }
    hasSyncedPastLastReconnect() {
      return this.outstandingQueriesOlderThanRestart.size === 0 && !this.outstandingAuthOlderThanRestart;
    }
    markAuthCompletion() {
      this.outstandingAuthOlderThanRestart = false;
    }
    subscribe(udfPath, args, journal, componentPath) {
      const canonicalizedUdfPath = canonicalizeUdfPath(udfPath);
      const queryToken = serializePathAndArgs(canonicalizedUdfPath, args);
      const existingEntry = this.querySet.get(queryToken);
      if (existingEntry !== void 0) {
        existingEntry.numSubscribers += 1;
        return {
          queryToken,
          modification: null,
          unsubscribe: () => this.removeSubscriber(queryToken)
        };
      } else {
        const queryId = this.nextQueryId++;
        const query = {
          id: queryId,
          canonicalizedUdfPath,
          args,
          numSubscribers: 1,
          journal,
          componentPath
        };
        this.querySet.set(queryToken, query);
        this.queryIdToToken.set(queryId, queryToken);
        const baseVersion = this.querySetVersion;
        const newVersion = this.querySetVersion + 1;
        const add = {
          type: "Add",
          queryId,
          udfPath: canonicalizedUdfPath,
          args: [convexToJson(args)],
          journal,
          componentPath
        };
        if (this.paused) {
          this.pendingQuerySetModifications.set(queryId, add);
        } else {
          this.querySetVersion = newVersion;
        }
        const modification = {
          type: "ModifyQuerySet",
          baseVersion,
          newVersion,
          modifications: [add]
        };
        return {
          queryToken,
          modification,
          unsubscribe: () => this.removeSubscriber(queryToken)
        };
      }
    }
    transition(transition) {
      for (const modification of transition.modifications) {
        switch (modification.type) {
          case "QueryUpdated":
          case "QueryFailed": {
            this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
            const journal = modification.journal;
            if (journal !== void 0) {
              const queryToken = this.queryIdToToken.get(modification.queryId);
              if (queryToken !== void 0) {
                this.querySet.get(queryToken).journal = journal;
              }
            }
            break;
          }
          case "QueryRemoved": {
            this.outstandingQueriesOlderThanRestart.delete(modification.queryId);
            break;
          }
          default: {
            modification;
            throw new Error(`Invalid modification ${modification.type}`);
          }
        }
      }
    }
    queryId(udfPath, args) {
      const canonicalizedUdfPath = canonicalizeUdfPath(udfPath);
      const queryToken = serializePathAndArgs(canonicalizedUdfPath, args);
      const existingEntry = this.querySet.get(queryToken);
      if (existingEntry !== void 0) {
        return existingEntry.id;
      }
      return null;
    }
    isCurrentOrNewerAuthVersion(version2) {
      return version2 >= this.identityVersion;
    }
    getAuth() {
      return this.auth;
    }
    setAuth(value) {
      this.auth = {
        tokenType: "User",
        value
      };
      const baseVersion = this.identityVersion;
      if (!this.paused) {
        this.identityVersion = baseVersion + 1;
      }
      return {
        type: "Authenticate",
        baseVersion,
        ...this.auth
      };
    }
    setAdminAuth(value, actingAs) {
      const auth = {
        tokenType: "Admin",
        value,
        impersonating: actingAs
      };
      this.auth = auth;
      const baseVersion = this.identityVersion;
      if (!this.paused) {
        this.identityVersion = baseVersion + 1;
      }
      return {
        type: "Authenticate",
        baseVersion,
        ...auth
      };
    }
    clearAuth() {
      this.auth = void 0;
      this.markAuthCompletion();
      const baseVersion = this.identityVersion;
      if (!this.paused) {
        this.identityVersion = baseVersion + 1;
      }
      return {
        type: "Authenticate",
        tokenType: "None",
        baseVersion
      };
    }
    hasAuth() {
      return !!this.auth;
    }
    isNewAuth(value) {
      return this.auth?.value !== value;
    }
    queryPath(queryId) {
      const pathAndArgs = this.queryIdToToken.get(queryId);
      if (pathAndArgs) {
        return this.querySet.get(pathAndArgs).canonicalizedUdfPath;
      }
      return null;
    }
    queryArgs(queryId) {
      const pathAndArgs = this.queryIdToToken.get(queryId);
      if (pathAndArgs) {
        return this.querySet.get(pathAndArgs).args;
      }
      return null;
    }
    queryToken(queryId) {
      return this.queryIdToToken.get(queryId) ?? null;
    }
    queryJournal(queryToken) {
      return this.querySet.get(queryToken)?.journal;
    }
    restart(oldRemoteQueryResults) {
      this.unpause();
      this.outstandingQueriesOlderThanRestart.clear();
      const modifications = [];
      for (const localQuery of this.querySet.values()) {
        const add = {
          type: "Add",
          queryId: localQuery.id,
          udfPath: localQuery.canonicalizedUdfPath,
          args: [convexToJson(localQuery.args)],
          journal: localQuery.journal,
          componentPath: localQuery.componentPath
        };
        modifications.push(add);
        if (!oldRemoteQueryResults.has(localQuery.id)) {
          this.outstandingQueriesOlderThanRestart.add(localQuery.id);
        }
      }
      this.querySetVersion = 1;
      const querySet = {
        type: "ModifyQuerySet",
        baseVersion: 0,
        newVersion: 1,
        modifications
      };
      if (!this.auth) {
        this.identityVersion = 0;
        return [querySet, void 0];
      }
      this.outstandingAuthOlderThanRestart = true;
      const authenticate = {
        type: "Authenticate",
        baseVersion: 0,
        ...this.auth
      };
      this.identityVersion = 1;
      return [querySet, authenticate];
    }
    pause() {
      this.paused = true;
    }
    resume() {
      const querySet = this.pendingQuerySetModifications.size > 0 ? {
        type: "ModifyQuerySet",
        baseVersion: this.querySetVersion,
        newVersion: ++this.querySetVersion,
        modifications: Array.from(
          this.pendingQuerySetModifications.values()
        )
      } : void 0;
      const authenticate = this.auth !== void 0 ? {
        type: "Authenticate",
        baseVersion: this.identityVersion++,
        ...this.auth
      } : void 0;
      this.unpause();
      return [querySet, authenticate];
    }
    unpause() {
      this.paused = false;
      this.pendingQuerySetModifications.clear();
    }
    removeSubscriber(queryToken) {
      const localQuery = this.querySet.get(queryToken);
      if (localQuery.numSubscribers > 1) {
        localQuery.numSubscribers -= 1;
        return null;
      } else {
        this.querySet.delete(queryToken);
        this.queryIdToToken.delete(localQuery.id);
        this.outstandingQueriesOlderThanRestart.delete(localQuery.id);
        const baseVersion = this.querySetVersion;
        const newVersion = this.querySetVersion + 1;
        const remove = {
          type: "Remove",
          queryId: localQuery.id
        };
        if (this.paused) {
          if (this.pendingQuerySetModifications.has(localQuery.id)) {
            this.pendingQuerySetModifications.delete(localQuery.id);
          } else {
            this.pendingQuerySetModifications.set(localQuery.id, remove);
          }
        } else {
          this.querySetVersion = newVersion;
        }
        return {
          type: "ModifyQuerySet",
          baseVersion,
          newVersion,
          modifications: [remove]
        };
      }
    }
  };

  // src/browser/sync/request_manager.ts
  var RequestManager = class {
    constructor(logger, markConnectionStateDirty) {
      this.logger = logger;
      this.markConnectionStateDirty = markConnectionStateDirty;
      this.inflightRequests = /* @__PURE__ */ new Map();
      this.requestsOlderThanRestart = /* @__PURE__ */ new Set();
    }
    inflightRequests;
    requestsOlderThanRestart;
    inflightMutationsCount = 0;
    inflightActionsCount = 0;
    request(message, sent) {
      const result = new Promise((resolve) => {
        const status = sent ? "Requested" : "NotSent";
        this.inflightRequests.set(message.requestId, {
          message,
          status: { status, requestedAt: /* @__PURE__ */ new Date(), onResult: resolve }
        });
        if (message.type === "Mutation") {
          this.inflightMutationsCount++;
        } else if (message.type === "Action") {
          this.inflightActionsCount++;
        }
      });
      this.markConnectionStateDirty();
      return result;
    }
    /**
     * Update the state after receiving a response.
     *
     * @returns A RequestId if the request is complete and its optimistic update
     * can be dropped, null otherwise.
     */
    onResponse(response) {
      const requestInfo = this.inflightRequests.get(response.requestId);
      if (requestInfo === void 0) {
        return null;
      }
      if (requestInfo.status.status === "Completed") {
        return null;
      }
      const udfType = requestInfo.message.type === "Mutation" ? "mutation" : "action";
      const udfPath = requestInfo.message.udfPath;
      for (const line of response.logLines) {
        logForFunction(this.logger, "info", udfType, udfPath, line);
      }
      const status = requestInfo.status;
      let result;
      let onResolve;
      if (response.success) {
        result = {
          success: true,
          logLines: response.logLines,
          value: jsonToConvex(response.result)
        };
        onResolve = () => status.onResult(result);
      } else {
        const errorMessage = response.result;
        const { errorData } = response;
        logForFunction(this.logger, "error", udfType, udfPath, errorMessage);
        result = {
          success: false,
          errorMessage,
          errorData: errorData !== void 0 ? jsonToConvex(errorData) : void 0,
          logLines: response.logLines
        };
        onResolve = () => status.onResult(result);
      }
      if (response.type === "ActionResponse" || !response.success) {
        onResolve();
        this.inflightRequests.delete(response.requestId);
        this.requestsOlderThanRestart.delete(response.requestId);
        if (requestInfo.message.type === "Action") {
          this.inflightActionsCount--;
        } else if (requestInfo.message.type === "Mutation") {
          this.inflightMutationsCount--;
        }
        this.markConnectionStateDirty();
        return { requestId: response.requestId, result };
      }
      requestInfo.status = {
        status: "Completed",
        result,
        ts: response.ts,
        onResolve
      };
      return null;
    }
    // Remove and returns completed requests.
    removeCompleted(ts) {
      const completeRequests = /* @__PURE__ */ new Map();
      for (const [requestId, requestInfo] of this.inflightRequests.entries()) {
        const status = requestInfo.status;
        if (status.status === "Completed" && status.ts.lessThanOrEqual(ts)) {
          status.onResolve();
          completeRequests.set(requestId, status.result);
          if (requestInfo.message.type === "Mutation") {
            this.inflightMutationsCount--;
          } else if (requestInfo.message.type === "Action") {
            this.inflightActionsCount--;
          }
          this.inflightRequests.delete(requestId);
          this.requestsOlderThanRestart.delete(requestId);
        }
      }
      if (completeRequests.size > 0) {
        this.markConnectionStateDirty();
      }
      return completeRequests;
    }
    restart() {
      this.requestsOlderThanRestart = new Set(this.inflightRequests.keys());
      const allMessages = [];
      for (const [requestId, value] of this.inflightRequests) {
        if (value.status.status === "NotSent") {
          value.status.status = "Requested";
          allMessages.push(value.message);
          continue;
        }
        if (value.message.type === "Mutation") {
          allMessages.push(value.message);
        } else if (value.message.type === "Action") {
          this.inflightRequests.delete(requestId);
          this.requestsOlderThanRestart.delete(requestId);
          this.inflightActionsCount--;
          if (value.status.status === "Completed") {
            throw new Error("Action should never be in 'Completed' state");
          }
          value.status.onResult({
            success: false,
            errorMessage: "Connection lost while action was in flight",
            logLines: []
          });
        }
      }
      this.markConnectionStateDirty();
      return allMessages;
    }
    resume() {
      const allMessages = [];
      for (const [, value] of this.inflightRequests) {
        if (value.status.status === "NotSent") {
          value.status.status = "Requested";
          allMessages.push(value.message);
          continue;
        }
      }
      return allMessages;
    }
    /**
     * @returns true if there are any requests that have been requested but have
     * not be completed yet.
     */
    hasIncompleteRequests() {
      for (const requestInfo of this.inflightRequests.values()) {
        if (requestInfo.status.status === "Requested") {
          return true;
        }
      }
      return false;
    }
    /**
     * @returns true if there are any inflight requests, including ones that have
     * completed on the server, but have not been applied.
     */
    hasInflightRequests() {
      return this.inflightRequests.size > 0;
    }
    /**
     * @returns true if there are any inflight requests, that have been hanging around
     * since prior to the most recent restart.
     */
    hasSyncedPastLastReconnect() {
      return this.requestsOlderThanRestart.size === 0;
    }
    timeOfOldestInflightRequest() {
      if (this.inflightRequests.size === 0) {
        return null;
      }
      let oldestInflightRequest = Date.now();
      for (const request of this.inflightRequests.values()) {
        if (request.status.status !== "Completed") {
          if (request.status.requestedAt.getTime() < oldestInflightRequest) {
            oldestInflightRequest = request.status.requestedAt.getTime();
          }
        }
      }
      return new Date(oldestInflightRequest);
    }
    /**
     * @returns The number of mutations currently in flight.
     */
    inflightMutations() {
      return this.inflightMutationsCount;
    }
    /**
     * @returns The number of actions currently in flight.
     */
    inflightActions() {
      return this.inflightActionsCount;
    }
  };

  // src/server/functionName.ts
  var functionName = Symbol.for("functionName");

  // src/server/components/paths.ts
  var toReferencePath = Symbol.for("toReferencePath");
  function extractReferencePath(reference) {
    return reference[toReferencePath] ?? null;
  }
  function isFunctionHandle(s) {
    return s.startsWith("function://");
  }
  function getFunctionAddress(functionReference) {
    let functionAddress;
    if (typeof functionReference === "string") {
      if (isFunctionHandle(functionReference)) {
        functionAddress = { functionHandle: functionReference };
      } else {
        functionAddress = { name: functionReference };
      }
    } else if (functionReference[functionName]) {
      functionAddress = { name: functionReference[functionName] };
    } else {
      const referencePath = extractReferencePath(functionReference);
      if (!referencePath) {
        throw new Error(`${functionReference} is not a functionReference`);
      }
      functionAddress = { reference: referencePath };
    }
    return functionAddress;
  }

  // src/server/api.ts
  function getFunctionName(functionReference) {
    const address = getFunctionAddress(functionReference);
    if (address.name === void 0) {
      if (address.functionHandle !== void 0) {
        throw new Error(
          `Expected function reference like "api.file.func" or "internal.file.func", but received function handle ${address.functionHandle}`
        );
      } else if (address.reference !== void 0) {
        throw new Error(
          `Expected function reference in the current component like "api.file.func" or "internal.file.func", but received reference ${address.reference}`
        );
      }
      throw new Error(
        `Expected function reference like "api.file.func" or "internal.file.func", but received ${JSON.stringify(address)}`
      );
    }
    if (typeof functionReference === "string") return functionReference;
    const name = functionReference[functionName];
    if (!name) {
      throw new Error(`${functionReference} is not a functionReference`);
    }
    return name;
  }
  function createApi(pathParts = []) {
    const handler = {
      get(_, prop) {
        if (typeof prop === "string") {
          const newParts = [...pathParts, prop];
          return createApi(newParts);
        } else if (prop === functionName) {
          if (pathParts.length < 2) {
            const found = ["api", ...pathParts].join(".");
            throw new Error(
              `API path is expected to be of the form \`api.moduleName.functionName\`. Found: \`${found}\``
            );
          }
          const path = pathParts.slice(0, -1).join("/");
          const exportName = pathParts[pathParts.length - 1];
          if (exportName === "default") {
            return path;
          } else {
            return path + ":" + exportName;
          }
        } else if (prop === Symbol.toStringTag) {
          return "FunctionReference";
        } else {
          return void 0;
        }
      }
    };
    return new Proxy({}, handler);
  }
  var anyApi = createApi();

  // src/browser/sync/optimistic_updates_impl.ts
  var OptimisticLocalStoreImpl = class _OptimisticLocalStoreImpl {
    // A references of the query results in OptimisticQueryResults
    queryResults;
    // All of the queries modified by this class
    modifiedQueries;
    constructor(queryResults) {
      this.queryResults = queryResults;
      this.modifiedQueries = [];
    }
    getQuery(query, ...args) {
      const queryArgs = parseArgs(args[0]);
      const name = getFunctionName(query);
      const queryResult = this.queryResults.get(
        serializePathAndArgs(name, queryArgs)
      );
      if (queryResult === void 0) {
        return void 0;
      }
      return _OptimisticLocalStoreImpl.queryValue(queryResult.result);
    }
    getAllQueries(query) {
      const queriesWithName = [];
      const name = getFunctionName(query);
      for (const queryResult of this.queryResults.values()) {
        if (queryResult.udfPath === canonicalizeUdfPath(name)) {
          queriesWithName.push({
            args: queryResult.args,
            value: _OptimisticLocalStoreImpl.queryValue(queryResult.result)
          });
        }
      }
      return queriesWithName;
    }
    setQuery(queryReference, args, value) {
      const queryArgs = parseArgs(args);
      const name = getFunctionName(queryReference);
      const queryToken = serializePathAndArgs(name, queryArgs);
      let result;
      if (value === void 0) {
        result = void 0;
      } else {
        result = {
          success: true,
          value,
          // It's an optimistic update, so there are no function logs to show.
          logLines: []
        };
      }
      const query = {
        udfPath: name,
        args: queryArgs,
        result
      };
      this.queryResults.set(queryToken, query);
      this.modifiedQueries.push(queryToken);
    }
    static queryValue(result) {
      if (result === void 0) {
        return void 0;
      } else if (result.success) {
        return result.value;
      } else {
        return void 0;
      }
    }
  };
  var OptimisticQueryResults = class {
    queryResults;
    optimisticUpdates;
    constructor() {
      this.queryResults = /* @__PURE__ */ new Map();
      this.optimisticUpdates = [];
    }
    /**
     * Apply all optimistic updates on top of server query results
     */
    ingestQueryResultsFromServer(serverQueryResults, optimisticUpdatesToDrop) {
      this.optimisticUpdates = this.optimisticUpdates.filter((updateAndId) => {
        return !optimisticUpdatesToDrop.has(updateAndId.mutationId);
      });
      const oldQueryResults = this.queryResults;
      this.queryResults = new Map(serverQueryResults);
      const localStore = new OptimisticLocalStoreImpl(this.queryResults);
      for (const updateAndId of this.optimisticUpdates) {
        updateAndId.update(localStore);
      }
      const changedQueries = [];
      for (const [queryToken, query] of this.queryResults) {
        const oldQuery = oldQueryResults.get(queryToken);
        if (oldQuery === void 0 || oldQuery.result !== query.result) {
          changedQueries.push(queryToken);
        }
      }
      return changedQueries;
    }
    applyOptimisticUpdate(update, mutationId) {
      this.optimisticUpdates.push({
        update,
        mutationId
      });
      const localStore = new OptimisticLocalStoreImpl(this.queryResults);
      update(localStore);
      return localStore.modifiedQueries;
    }
    /**
     * @internal
     */
    rawQueryResult(queryToken) {
      return this.queryResults.get(queryToken);
    }
    queryResult(queryToken) {
      const query = this.queryResults.get(queryToken);
      if (query === void 0) {
        return void 0;
      }
      const result = query.result;
      if (result === void 0) {
        return void 0;
      } else if (result.success) {
        return result.value;
      } else {
        if (result.errorData !== void 0) {
          throw forwardData(
            result,
            new ConvexError(
              createHybridErrorStacktrace("query", query.udfPath, result)
            )
          );
        }
        throw new Error(
          createHybridErrorStacktrace("query", query.udfPath, result)
        );
      }
    }
    hasQueryResult(queryToken) {
      return this.queryResults.get(queryToken) !== void 0;
    }
    /**
     * @internal
     */
    queryLogs(queryToken) {
      const query = this.queryResults.get(queryToken);
      return query?.result?.logLines;
    }
  };

  // src/vendor/long.ts
  var Long = class _Long {
    low;
    high;
    __isUnsignedLong__;
    static isLong(obj) {
      return (obj && obj.__isUnsignedLong__) === true;
    }
    constructor(low, high) {
      this.low = low | 0;
      this.high = high | 0;
      this.__isUnsignedLong__ = true;
    }
    // prettier-ignore
    static fromBytesLE(bytes) {
      return new _Long(
        bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24,
        bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24
      );
    }
    // prettier-ignore
    toBytesLE() {
      const hi = this.high;
      const lo = this.low;
      return [
        lo & 255,
        lo >>> 8 & 255,
        lo >>> 16 & 255,
        lo >>> 24,
        hi & 255,
        hi >>> 8 & 255,
        hi >>> 16 & 255,
        hi >>> 24
      ];
    }
    static fromNumber(value) {
      if (isNaN(value)) return UZERO;
      if (value < 0) return UZERO;
      if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
      return new _Long(value % TWO_PWR_32_DBL | 0, value / TWO_PWR_32_DBL | 0);
    }
    toString() {
      return (BigInt(this.high) * BigInt(TWO_PWR_32_DBL) + BigInt(this.low)).toString();
    }
    equals(other) {
      if (!_Long.isLong(other)) other = _Long.fromValue(other);
      if (this.high >>> 31 === 1 && other.high >>> 31 === 1) return false;
      return this.high === other.high && this.low === other.low;
    }
    notEquals(other) {
      return !this.equals(other);
    }
    comp(other) {
      if (!_Long.isLong(other)) other = _Long.fromValue(other);
      if (this.equals(other)) return 0;
      return other.high >>> 0 > this.high >>> 0 || other.high === this.high && other.low >>> 0 > this.low >>> 0 ? -1 : 1;
    }
    lessThanOrEqual(other) {
      return this.comp(
        /* validates */
        other
      ) <= 0;
    }
    static fromValue(val) {
      if (typeof val === "number") return _Long.fromNumber(val);
      return new _Long(val.low, val.high);
    }
  };
  var UZERO = new Long(0, 0);
  var TWO_PWR_16_DBL = 1 << 16;
  var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
  var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
  var MAX_UNSIGNED_VALUE = new Long(4294967295 | 0, 4294967295 | 0);

  // src/browser/sync/remote_query_set.ts
  var RemoteQuerySet = class {
    version;
    remoteQuerySet;
    queryPath;
    logger;
    constructor(queryPath, logger) {
      this.version = { querySet: 0, ts: Long.fromNumber(0), identity: 0 };
      this.remoteQuerySet = /* @__PURE__ */ new Map();
      this.queryPath = queryPath;
      this.logger = logger;
    }
    transition(transition) {
      const start = transition.startVersion;
      if (this.version.querySet !== start.querySet || this.version.ts.notEquals(start.ts) || this.version.identity !== start.identity) {
        throw new Error(
          `Invalid start version: ${start.ts.toString()}:${start.querySet}:${start.identity}, transitioning from ${this.version.ts.toString()}:${this.version.querySet}:${this.version.identity}`
        );
      }
      for (const modification of transition.modifications) {
        switch (modification.type) {
          case "QueryUpdated": {
            const queryPath = this.queryPath(modification.queryId);
            if (queryPath) {
              for (const line of modification.logLines) {
                logForFunction(this.logger, "info", "query", queryPath, line);
              }
            }
            const value = jsonToConvex(modification.value ?? null);
            this.remoteQuerySet.set(modification.queryId, {
              success: true,
              value,
              logLines: modification.logLines
            });
            break;
          }
          case "QueryFailed": {
            const queryPath = this.queryPath(modification.queryId);
            if (queryPath) {
              for (const line of modification.logLines) {
                logForFunction(this.logger, "info", "query", queryPath, line);
              }
            }
            const { errorData } = modification;
            this.remoteQuerySet.set(modification.queryId, {
              success: false,
              errorMessage: modification.errorMessage,
              errorData: errorData !== void 0 ? jsonToConvex(errorData) : void 0,
              logLines: modification.logLines
            });
            break;
          }
          case "QueryRemoved": {
            this.remoteQuerySet.delete(modification.queryId);
            break;
          }
          default: {
            modification;
            throw new Error(`Invalid modification ${modification.type}`);
          }
        }
      }
      this.version = transition.endVersion;
    }
    remoteQueryResults() {
      return this.remoteQuerySet;
    }
    timestamp() {
      return this.version.ts;
    }
  };

  // src/browser/sync/protocol.ts
  function u64ToLong(encoded) {
    const integerBytes = base64_exports.toByteArray(encoded);
    return Long.fromBytesLE(Array.from(integerBytes));
  }
  function longToU64(raw) {
    const integerBytes = new Uint8Array(raw.toBytesLE());
    return base64_exports.fromByteArray(integerBytes);
  }
  function parseServerMessage(encoded) {
    switch (encoded.type) {
      case "FatalError":
      case "AuthError":
      case "ActionResponse":
      case "TransitionChunk":
      case "Ping": {
        return { ...encoded };
      }
      case "MutationResponse": {
        if (encoded.success) {
          return { ...encoded, ts: u64ToLong(encoded.ts) };
        } else {
          return { ...encoded };
        }
      }
      case "Transition": {
        return {
          ...encoded,
          startVersion: {
            ...encoded.startVersion,
            ts: u64ToLong(encoded.startVersion.ts)
          },
          endVersion: {
            ...encoded.endVersion,
            ts: u64ToLong(encoded.endVersion.ts)
          }
        };
      }
      default: {
        encoded;
      }
    }
    return void 0;
  }
  function encodeClientMessage(message) {
    switch (message.type) {
      case "Authenticate":
      case "ModifyQuerySet":
      case "Mutation":
      case "Action":
      case "Event": {
        return { ...message };
      }
      case "Connect": {
        if (message.maxObservedTimestamp !== void 0) {
          return {
            ...message,
            maxObservedTimestamp: longToU64(message.maxObservedTimestamp)
          };
        } else {
          return { ...message, maxObservedTimestamp: void 0 };
        }
      }
      default: {
        message;
      }
    }
    return void 0;
  }

  // src/browser/sync/web_socket_manager.ts
  var CLOSE_NORMAL = 1e3;
  var CLOSE_GOING_AWAY = 1001;
  var CLOSE_NO_STATUS = 1005;
  var CLOSE_NOT_FOUND = 4040;
  var firstTime;
  function monotonicMillis() {
    if (firstTime === void 0) {
      firstTime = Date.now();
    }
    if (typeof performance === "undefined" || !performance.now) {
      return Date.now();
    }
    return Math.round(firstTime + performance.now());
  }
  function prettyNow() {
    return `t=${Math.round((monotonicMillis() - firstTime) / 100) / 10}s`;
  }
  var serverDisconnectErrors = {
    // A known error, e.g. during a restart or push
    InternalServerError: { timeout: 1e3 },
    // ErrorMetadata::overloaded() messages that we realy should back off
    SubscriptionsWorkerFullError: { timeout: 3e3 },
    TooManyConcurrentRequests: { timeout: 3e3 },
    CommitterFullError: { timeout: 3e3 },
    AwsTooManyRequestsException: { timeout: 3e3 },
    ExecuteFullError: { timeout: 3e3 },
    SystemTimeoutError: { timeout: 3e3 },
    ExpiredInQueue: { timeout: 3e3 },
    // ErrorMetadata::feature_temporarily_unavailable() that typically indicate a deploy just happened
    VectorIndexesUnavailable: { timeout: 1e3 },
    SearchIndexesUnavailable: { timeout: 1e3 },
    TableSummariesUnavailable: { timeout: 1e3 },
    // More ErrorMetadata::overloaded()
    VectorIndexTooLarge: { timeout: 3e3 },
    SearchIndexTooLarge: { timeout: 3e3 },
    TooManyWritesInTimePeriod: { timeout: 3e3 }
  };
  function classifyDisconnectError(s) {
    if (s === void 0) return "Unknown";
    for (const prefix of Object.keys(
      serverDisconnectErrors
    )) {
      if (s.startsWith(prefix)) {
        return prefix;
      }
    }
    return "Unknown";
  }
  var WebSocketManager = class {
    constructor(uri, callbacks, webSocketConstructor, logger, markConnectionStateDirty, debug) {
      this.markConnectionStateDirty = markConnectionStateDirty;
      this.debug = debug;
      this.webSocketConstructor = webSocketConstructor;
      this.socket = { state: "disconnected" };
      this.connectionCount = 0;
      this.lastCloseReason = "InitialConnect";
      this.defaultInitialBackoff = 1e3;
      this.maxBackoff = 16e3;
      this.retries = 0;
      this.serverInactivityThreshold = 6e4;
      this.reconnectDueToServerInactivityTimeout = null;
      this.uri = uri;
      this.onOpen = callbacks.onOpen;
      this.onResume = callbacks.onResume;
      this.onMessage = callbacks.onMessage;
      this.onServerDisconnectError = callbacks.onServerDisconnectError;
      this.logger = logger;
      this.connect();
    }
    socket;
    connectionCount;
    _hasEverConnected = false;
    lastCloseReason;
    // State for assembling the split-up Transition currently being received.
    transitionChunkBuffer = null;
    /** Upon HTTPS/WSS failure, the first jittered backoff duration, in ms. */
    defaultInitialBackoff;
    /** We backoff exponentially, but we need to cap that--this is the jittered max. */
    maxBackoff;
    /** How many times have we failed consecutively? */
    retries;
    /** How long before lack of server response causes us to initiate a reconnect,
     * in ms */
    serverInactivityThreshold;
    reconnectDueToServerInactivityTimeout;
    uri;
    onOpen;
    onResume;
    onMessage;
    webSocketConstructor;
    logger;
    onServerDisconnectError;
    setSocketState(state) {
      this.socket = state;
      this._logVerbose(
        `socket state changed: ${this.socket.state}, paused: ${"paused" in this.socket ? this.socket.paused : void 0}`
      );
      this.markConnectionStateDirty();
    }
    assembleTransition(chunk) {
      if (chunk.partNumber < 0 || chunk.partNumber >= chunk.totalParts || chunk.totalParts === 0 || this.transitionChunkBuffer && (this.transitionChunkBuffer.totalParts !== chunk.totalParts || this.transitionChunkBuffer.transitionId !== chunk.transitionId)) {
        this.transitionChunkBuffer = null;
        throw new Error("Invalid TransitionChunk");
      }
      if (this.transitionChunkBuffer === null) {
        this.transitionChunkBuffer = {
          chunks: [],
          totalParts: chunk.totalParts,
          transitionId: chunk.transitionId
        };
      }
      if (chunk.partNumber !== this.transitionChunkBuffer.chunks.length) {
        const expectedLength = this.transitionChunkBuffer.chunks.length;
        this.transitionChunkBuffer = null;
        throw new Error(
          `TransitionChunk received out of order: expected part ${expectedLength}, got ${chunk.partNumber}`
        );
      }
      this.transitionChunkBuffer.chunks.push(chunk.chunk);
      if (this.transitionChunkBuffer.chunks.length === chunk.totalParts) {
        const fullJson = this.transitionChunkBuffer.chunks.join("");
        this.transitionChunkBuffer = null;
        const transition = parseServerMessage(JSON.parse(fullJson));
        if (transition.type !== "Transition") {
          throw new Error(
            `Expected Transition, got ${transition.type} after assembling chunks`
          );
        }
        return transition;
      }
      return null;
    }
    connect() {
      if (this.socket.state === "terminated") {
        return;
      }
      if (this.socket.state !== "disconnected" && this.socket.state !== "stopped") {
        throw new Error(
          "Didn't start connection from disconnected state: " + this.socket.state
        );
      }
      const ws = new this.webSocketConstructor(this.uri);
      this._logVerbose("constructed WebSocket");
      this.setSocketState({
        state: "connecting",
        ws,
        paused: "no"
      });
      this.resetServerInactivityTimeout();
      ws.onopen = () => {
        this.logger.logVerbose("begin ws.onopen");
        if (this.socket.state !== "connecting") {
          throw new Error("onopen called with socket not in connecting state");
        }
        this.setSocketState({
          state: "ready",
          ws,
          paused: this.socket.paused === "yes" ? "uninitialized" : "no"
        });
        this.resetServerInactivityTimeout();
        if (this.socket.paused === "no") {
          this._hasEverConnected = true;
          this.onOpen({
            connectionCount: this.connectionCount,
            lastCloseReason: this.lastCloseReason,
            clientTs: monotonicMillis()
          });
        }
        if (this.lastCloseReason !== "InitialConnect") {
          if (this.lastCloseReason) {
            this.logger.log(
              "WebSocket reconnected at",
              prettyNow(),
              "after disconnect due to",
              this.lastCloseReason
            );
          } else {
            this.logger.log("WebSocket reconnected at", prettyNow());
          }
        }
        this.connectionCount += 1;
        this.lastCloseReason = null;
      };
      ws.onerror = (error) => {
        this.transitionChunkBuffer = null;
        const message = error.message;
        if (message) {
          this.logger.log(`WebSocket error message: ${message}`);
        }
      };
      ws.onmessage = (message) => {
        this.resetServerInactivityTimeout();
        const messageLength = message.data.length;
        let serverMessage = parseServerMessage(JSON.parse(message.data));
        this._logVerbose(`received ws message with type ${serverMessage.type}`);
        if (serverMessage.type === "Ping") {
          return;
        }
        if (serverMessage.type === "TransitionChunk") {
          const transition = this.assembleTransition(serverMessage);
          if (!transition) {
            return;
          }
          serverMessage = transition;
          this._logVerbose(
            `assembled full ws message of type ${serverMessage.type}`
          );
        }
        if (this.transitionChunkBuffer !== null) {
          this.transitionChunkBuffer = null;
          this.logger.log(
            `Received unexpected ${serverMessage.type} while buffering TransitionChunks`
          );
        }
        if (serverMessage.type === "Transition") {
          this.reportLargeTransition({
            messageLength,
            transition: serverMessage
          });
        }
        const response = this.onMessage(serverMessage);
        if (response.hasSyncedPastLastReconnect) {
          this.retries = 0;
          this.markConnectionStateDirty();
        }
      };
      ws.onclose = (event) => {
        this._logVerbose("begin ws.onclose");
        this.transitionChunkBuffer = null;
        if (this.lastCloseReason === null) {
          this.lastCloseReason = event.reason || `closed with code ${event.code}`;
        }
        if (event.code !== CLOSE_NORMAL && event.code !== CLOSE_GOING_AWAY && // This commonly gets fired on mobile apps when the app is backgrounded
        event.code !== CLOSE_NO_STATUS && event.code !== CLOSE_NOT_FOUND) {
          let msg = `WebSocket closed with code ${event.code}`;
          if (event.reason) {
            msg += `: ${event.reason}`;
          }
          this.logger.log(msg);
          if (this.onServerDisconnectError && event.reason) {
            this.onServerDisconnectError(msg);
          }
        }
        const reason = classifyDisconnectError(event.reason);
        this.scheduleReconnect(reason);
        return;
      };
    }
    /**
     * @returns The state of the {@link Socket}.
     */
    socketState() {
      return this.socket.state;
    }
    /**
     * @param message - A ClientMessage to send.
     * @returns Whether the message (might have been) sent.
     */
    sendMessage(message) {
      const messageForLog = {
        type: message.type,
        ...message.type === "Authenticate" && message.tokenType === "User" ? {
          value: `...${message.value.slice(-7)}`
        } : {}
      };
      if (this.socket.state === "ready" && this.socket.paused === "no") {
        const encodedMessage = encodeClientMessage(message);
        const request = JSON.stringify(encodedMessage);
        let sent = false;
        try {
          this.socket.ws.send(request);
          sent = true;
        } catch (error) {
          this.logger.log(
            `Failed to send message on WebSocket, reconnecting: ${error}`
          );
          this.closeAndReconnect("FailedToSendMessage");
        }
        this._logVerbose(
          `${sent ? "sent" : "failed to send"} message with type ${message.type}: ${JSON.stringify(
            messageForLog
          )}`
        );
        return true;
      }
      this._logVerbose(
        `message not sent (socket state: ${this.socket.state}, paused: ${"paused" in this.socket ? this.socket.paused : void 0}): ${JSON.stringify(
          messageForLog
        )}`
      );
      return false;
    }
    resetServerInactivityTimeout() {
      if (this.socket.state === "terminated") {
        return;
      }
      if (this.reconnectDueToServerInactivityTimeout !== null) {
        clearTimeout(this.reconnectDueToServerInactivityTimeout);
        this.reconnectDueToServerInactivityTimeout = null;
      }
      this.reconnectDueToServerInactivityTimeout = setTimeout(() => {
        this.closeAndReconnect("InactiveServer");
      }, this.serverInactivityThreshold);
    }
    scheduleReconnect(reason) {
      this.socket = { state: "disconnected" };
      const backoff = this.nextBackoff(reason);
      this.markConnectionStateDirty();
      this.logger.log(`Attempting reconnect in ${Math.round(backoff)}ms`);
      setTimeout(() => this.connect(), backoff);
    }
    /**
     * Close the WebSocket and schedule a reconnect.
     *
     * This should be used when we hit an error and would like to restart the session.
     */
    closeAndReconnect(closeReason) {
      this._logVerbose(`begin closeAndReconnect with reason ${closeReason}`);
      switch (this.socket.state) {
        case "disconnected":
        case "terminated":
        case "stopped":
          return;
        case "connecting":
        case "ready": {
          this.lastCloseReason = closeReason;
          void this.close();
          this.scheduleReconnect("client");
          return;
        }
        default: {
          this.socket;
        }
      }
    }
    /**
     * Close the WebSocket, being careful to clear the onclose handler to avoid re-entrant
     * calls. Use this instead of directly calling `ws.close()`
     *
     * It is the callers responsibility to update the state after this method is called so that the
     * closed socket is not accessible or used again after this method is called
     */
    close() {
      this.transitionChunkBuffer = null;
      switch (this.socket.state) {
        case "disconnected":
        case "terminated":
        case "stopped":
          return Promise.resolve();
        case "connecting": {
          const ws = this.socket.ws;
          ws.onmessage = (_message) => {
            this._logVerbose("Ignoring message received after close");
          };
          return new Promise((r) => {
            ws.onclose = () => {
              this._logVerbose("Closed after connecting");
              r();
            };
            ws.onopen = () => {
              this._logVerbose("Opened after connecting");
              ws.close();
            };
          });
        }
        case "ready": {
          this._logVerbose("ws.close called");
          const ws = this.socket.ws;
          ws.onmessage = (_message) => {
            this._logVerbose("Ignoring message received after close");
          };
          const result = new Promise((r) => {
            ws.onclose = () => {
              r();
            };
          });
          ws.close();
          return result;
        }
        default: {
          this.socket;
          return Promise.resolve();
        }
      }
    }
    /**
     * Close the WebSocket and do not reconnect.
     * @returns A Promise that resolves when the WebSocket `onClose` callback is called.
     */
    terminate() {
      if (this.reconnectDueToServerInactivityTimeout) {
        clearTimeout(this.reconnectDueToServerInactivityTimeout);
      }
      switch (this.socket.state) {
        case "terminated":
        case "stopped":
        case "disconnected":
        case "connecting":
        case "ready": {
          const result = this.close();
          this.setSocketState({ state: "terminated" });
          return result;
        }
        default: {
          this.socket;
          throw new Error(
            `Invalid websocket state: ${this.socket.state}`
          );
        }
      }
    }
    stop() {
      switch (this.socket.state) {
        case "terminated":
          return Promise.resolve();
        case "connecting":
        case "stopped":
        case "disconnected":
        case "ready": {
          const result = this.close();
          this.socket = { state: "stopped" };
          return result;
        }
        default: {
          this.socket;
          return Promise.resolve();
        }
      }
    }
    /**
     * Create a new WebSocket after a previous `stop()`, unless `terminate()` was
     * called before.
     */
    tryRestart() {
      switch (this.socket.state) {
        case "stopped":
          break;
        case "terminated":
        case "connecting":
        case "ready":
        case "disconnected":
          this.logger.logVerbose("Restart called without stopping first");
          return;
        default: {
          this.socket;
        }
      }
      this.connect();
    }
    pause() {
      switch (this.socket.state) {
        case "disconnected":
        case "stopped":
        case "terminated":
          return;
        case "connecting":
        case "ready": {
          this.socket = { ...this.socket, paused: "yes" };
          return;
        }
        default: {
          this.socket;
          return;
        }
      }
    }
    /**
     * Resume the state machine if previously paused.
     */
    resume() {
      switch (this.socket.state) {
        case "connecting":
          this.socket = { ...this.socket, paused: "no" };
          return;
        case "ready":
          if (this.socket.paused === "uninitialized") {
            this.socket = { ...this.socket, paused: "no" };
            this.onOpen({
              connectionCount: this.connectionCount,
              lastCloseReason: this.lastCloseReason,
              clientTs: monotonicMillis()
            });
          } else if (this.socket.paused === "yes") {
            this.socket = { ...this.socket, paused: "no" };
            this.onResume();
          }
          return;
        case "terminated":
        case "stopped":
        case "disconnected":
          return;
        default: {
          this.socket;
        }
      }
      this.connect();
    }
    connectionState() {
      return {
        isConnected: this.socket.state === "ready",
        hasEverConnected: this._hasEverConnected,
        connectionCount: this.connectionCount,
        connectionRetries: this.retries
      };
    }
    _logVerbose(message) {
      this.logger.logVerbose(message);
    }
    nextBackoff(reason) {
      const initialBackoff = reason === "client" ? 100 : reason === "Unknown" ? this.defaultInitialBackoff : serverDisconnectErrors[reason].timeout;
      const baseBackoff = initialBackoff * Math.pow(2, this.retries);
      this.retries += 1;
      const actualBackoff = Math.min(baseBackoff, this.maxBackoff);
      const jitter = actualBackoff * (Math.random() - 0.5);
      return actualBackoff + jitter;
    }
    reportLargeTransition({
      transition,
      messageLength
    }) {
      if (transition.clientClockSkew === void 0 || transition.serverTs === void 0) {
        return;
      }
      const transitionTransitTime = monotonicMillis() - // client time now
      // clientClockSkew = (server time + upstream latency) - client time
      // clientClockSkew is "how many milliseconds behind (slow) is the client clock"
      // but the latency of the Connect message inflates this, making it appear further behind
      transition.clientClockSkew - transition.serverTs / 1e6;
      const prettyTransitionTime = `${Math.round(transitionTransitTime)}ms`;
      const prettyMessageMB = `${Math.round(messageLength / 1e4) / 100}MB`;
      const bytesPerSecond = messageLength / (transitionTransitTime / 1e3);
      const prettyBytesPerSecond = `${Math.round(bytesPerSecond / 1e4) / 100}MB per second`;
      this._logVerbose(
        `received ${prettyMessageMB} transition in ${prettyTransitionTime} at ${prettyBytesPerSecond}`
      );
      if (messageLength > 2e7) {
        this.logger.log(
          `received query results totaling more that 20MB (${prettyMessageMB}) which will take a long time to download on slower connections`
        );
      } else if (transitionTransitTime > 2e4) {
        this.logger.log(
          `received query results totaling ${prettyMessageMB} which took more than 20s to arrive (${prettyTransitionTime})`
        );
      }
      if (this.debug) {
        this.sendMessage({
          type: "Event",
          eventType: "ClientReceivedTransition",
          event: { transitionTransitTime, messageLength }
        });
      }
    }
  };

  // src/browser/sync/session.ts
  function newSessionId() {
    return uuidv4();
  }
  function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0, v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }

  // src/vendor/jwt-decode/index.ts
  var InvalidTokenError = class extends Error {
  };
  InvalidTokenError.prototype.name = "InvalidTokenError";
  function b64DecodeUnicode(str) {
    return decodeURIComponent(
      atob(str).replace(/(.)/g, (_m, p) => {
        let code2 = p.charCodeAt(0).toString(16).toUpperCase();
        if (code2.length < 2) {
          code2 = "0" + code2;
        }
        return "%" + code2;
      })
    );
  }
  function base64UrlDecode(str) {
    let output = str.replace(/-/g, "+").replace(/_/g, "/");
    switch (output.length % 4) {
      case 0:
        break;
      case 2:
        output += "==";
        break;
      case 3:
        output += "=";
        break;
      default:
        throw new Error("base64 string is not of the correct length");
    }
    try {
      return b64DecodeUnicode(output);
    } catch {
      return atob(output);
    }
  }
  function jwtDecode(token, options) {
    if (typeof token !== "string") {
      throw new InvalidTokenError("Invalid token specified: must be a string");
    }
    options ||= {};
    const pos = options.header === true ? 0 : 1;
    const part = token.split(".")[pos];
    if (typeof part !== "string") {
      throw new InvalidTokenError(
        `Invalid token specified: missing part #${pos + 1}`
      );
    }
    let decoded;
    try {
      decoded = base64UrlDecode(part);
    } catch (e) {
      throw new InvalidTokenError(
        `Invalid token specified: invalid base64 for part #${pos + 1} (${e.message})`
      );
    }
    try {
      return JSON.parse(decoded);
    } catch (e) {
      throw new InvalidTokenError(
        `Invalid token specified: invalid json for part #${pos + 1} (${e.message})`
      );
    }
  }

  // src/browser/sync/authentication_manager.ts
  var MAXIMUM_REFRESH_DELAY = 20 * 24 * 60 * 60 * 1e3;
  var MAX_TOKEN_CONFIRMATION_ATTEMPTS = 2;
  var AuthenticationManager = class {
    authState = { state: "noAuth" };
    // Used to detect races involving `setConfig` calls
    // while a token is being fetched.
    configVersion = 0;
    // Shared by the BaseClient so that the auth manager can easily inspect it
    syncState;
    // Passed down by BaseClient, sends a message to the server
    authenticate;
    stopSocket;
    tryRestartSocket;
    pauseSocket;
    resumeSocket;
    // Passed down by BaseClient, sends a message to the server
    clearAuth;
    logger;
    refreshTokenLeewaySeconds;
    // Number of times we have attempted to confirm the latest token. We retry up
    // to `MAX_TOKEN_CONFIRMATION_ATTEMPTS` times.
    tokenConfirmationAttempts = 0;
    constructor(syncState, callbacks, config) {
      this.syncState = syncState;
      this.authenticate = callbacks.authenticate;
      this.stopSocket = callbacks.stopSocket;
      this.tryRestartSocket = callbacks.tryRestartSocket;
      this.pauseSocket = callbacks.pauseSocket;
      this.resumeSocket = callbacks.resumeSocket;
      this.clearAuth = callbacks.clearAuth;
      this.logger = config.logger;
      this.refreshTokenLeewaySeconds = config.refreshTokenLeewaySeconds;
    }
    async setConfig(fetchToken, onChange) {
      this.resetAuthState();
      this._logVerbose("pausing WS for auth token fetch");
      this.pauseSocket();
      const token = await this.fetchTokenAndGuardAgainstRace(fetchToken, {
        forceRefreshToken: false
      });
      if (token.isFromOutdatedConfig) {
        return;
      }
      if (token.value) {
        this.setAuthState({
          state: "waitingForServerConfirmationOfCachedToken",
          config: { fetchToken, onAuthChange: onChange },
          hasRetried: false
        });
        this.authenticate(token.value);
      } else {
        this.setAuthState({
          state: "initialRefetch",
          config: { fetchToken, onAuthChange: onChange }
        });
        await this.refetchToken();
      }
      this._logVerbose("resuming WS after auth token fetch");
      this.resumeSocket();
    }
    onTransition(serverMessage) {
      if (!this.syncState.isCurrentOrNewerAuthVersion(
        serverMessage.endVersion.identity
      )) {
        return;
      }
      if (serverMessage.endVersion.identity <= serverMessage.startVersion.identity) {
        return;
      }
      if (this.authState.state === "waitingForServerConfirmationOfCachedToken") {
        this._logVerbose("server confirmed auth token is valid");
        void this.refetchToken();
        this.authState.config.onAuthChange(true);
        return;
      }
      if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
        this._logVerbose("server confirmed new auth token is valid");
        this.scheduleTokenRefetch(this.authState.token);
        this.tokenConfirmationAttempts = 0;
        if (!this.authState.hadAuth) {
          this.authState.config.onAuthChange(true);
        }
      }
    }
    onAuthError(serverMessage) {
      if (serverMessage.authUpdateAttempted === false && (this.authState.state === "waitingForServerConfirmationOfFreshToken" || this.authState.state === "waitingForServerConfirmationOfCachedToken")) {
        this._logVerbose("ignoring non-auth token expired error");
        return;
      }
      const { baseVersion } = serverMessage;
      if (!this.syncState.isCurrentOrNewerAuthVersion(baseVersion + 1)) {
        this._logVerbose("ignoring auth error for previous auth attempt");
        return;
      }
      void this.tryToReauthenticate(serverMessage);
      return;
    }
    // This is similar to `refetchToken` defined below, in fact we
    // don't represent them as different states, but it is different
    // in that we pause the WebSocket so that mutations
    // don't retry with bad auth.
    async tryToReauthenticate(serverMessage) {
      this._logVerbose(`attempting to reauthenticate: ${serverMessage.error}`);
      if (
        // No way to fetch another token, kaboom
        this.authState.state === "noAuth" || // We failed on a fresh token. After a small number of retries, we give up
        // and clear the auth state to avoid infinite retries.
        this.authState.state === "waitingForServerConfirmationOfFreshToken" && this.tokenConfirmationAttempts >= MAX_TOKEN_CONFIRMATION_ATTEMPTS
      ) {
        this.logger.error(
          `Failed to authenticate: "${serverMessage.error}", check your server auth config`
        );
        if (this.syncState.hasAuth()) {
          this.syncState.clearAuth();
        }
        if (this.authState.state !== "noAuth") {
          this.setAndReportAuthFailed(this.authState.config.onAuthChange);
        }
        return;
      }
      if (this.authState.state === "waitingForServerConfirmationOfFreshToken") {
        this.tokenConfirmationAttempts++;
        this._logVerbose(
          `retrying reauthentication, ${MAX_TOKEN_CONFIRMATION_ATTEMPTS - this.tokenConfirmationAttempts} attempts remaining`
        );
      }
      await this.stopSocket();
      const token = await this.fetchTokenAndGuardAgainstRace(
        this.authState.config.fetchToken,
        {
          forceRefreshToken: true
        }
      );
      if (token.isFromOutdatedConfig) {
        return;
      }
      if (token.value && this.syncState.isNewAuth(token.value)) {
        this.authenticate(token.value);
        this.setAuthState({
          state: "waitingForServerConfirmationOfFreshToken",
          config: this.authState.config,
          token: token.value,
          hadAuth: this.authState.state === "notRefetching" || this.authState.state === "waitingForScheduledRefetch"
        });
      } else {
        this._logVerbose("reauthentication failed, could not fetch a new token");
        if (this.syncState.hasAuth()) {
          this.syncState.clearAuth();
        }
        this.setAndReportAuthFailed(this.authState.config.onAuthChange);
      }
      this.tryRestartSocket();
    }
    // Force refetch the token and schedule another refetch
    // before the token expires - an active client should never
    // need to reauthenticate.
    async refetchToken() {
      if (this.authState.state === "noAuth") {
        return;
      }
      this._logVerbose("refetching auth token");
      const token = await this.fetchTokenAndGuardAgainstRace(
        this.authState.config.fetchToken,
        {
          forceRefreshToken: true
        }
      );
      if (token.isFromOutdatedConfig) {
        return;
      }
      if (token.value) {
        if (this.syncState.isNewAuth(token.value)) {
          this.setAuthState({
            state: "waitingForServerConfirmationOfFreshToken",
            hadAuth: this.syncState.hasAuth(),
            token: token.value,
            config: this.authState.config
          });
          this.authenticate(token.value);
        } else {
          this.setAuthState({
            state: "notRefetching",
            config: this.authState.config
          });
        }
      } else {
        this._logVerbose("refetching token failed");
        if (this.syncState.hasAuth()) {
          this.clearAuth();
        }
        this.setAndReportAuthFailed(this.authState.config.onAuthChange);
      }
      this._logVerbose(
        "restarting WS after auth token fetch (if currently stopped)"
      );
      this.tryRestartSocket();
    }
    scheduleTokenRefetch(token) {
      if (this.authState.state === "noAuth") {
        return;
      }
      const decodedToken = this.decodeToken(token);
      if (!decodedToken) {
        this.logger.error(
          "Auth token is not a valid JWT, cannot refetch the token"
        );
        return;
      }
      const { iat, exp } = decodedToken;
      if (!iat || !exp) {
        this.logger.error(
          "Auth token does not have required fields, cannot refetch the token"
        );
        return;
      }
      const tokenValiditySeconds = exp - iat;
      if (tokenValiditySeconds <= 2) {
        this.logger.error(
          "Auth token does not live long enough, cannot refetch the token"
        );
        return;
      }
      let delay = Math.min(
        MAXIMUM_REFRESH_DELAY,
        (tokenValiditySeconds - this.refreshTokenLeewaySeconds) * 1e3
      );
      if (delay <= 0) {
        this.logger.warn(
          `Refetching auth token immediately, configured leeway ${this.refreshTokenLeewaySeconds}s is larger than the token's lifetime ${tokenValiditySeconds}s`
        );
        delay = 0;
      }
      const refetchTokenTimeoutId = setTimeout(() => {
        this._logVerbose("running scheduled token refetch");
        void this.refetchToken();
      }, delay);
      this.setAuthState({
        state: "waitingForScheduledRefetch",
        refetchTokenTimeoutId,
        config: this.authState.config
      });
      this._logVerbose(
        `scheduled preemptive auth token refetching in ${delay}ms`
      );
    }
    // Protects against simultaneous calls to `setConfig`
    // while we're fetching a token
    async fetchTokenAndGuardAgainstRace(fetchToken, fetchArgs) {
      const originalConfigVersion = ++this.configVersion;
      this._logVerbose(
        `fetching token with config version ${originalConfigVersion}`
      );
      const token = await fetchToken(fetchArgs);
      if (this.configVersion !== originalConfigVersion) {
        this._logVerbose(
          `stale config version, expected ${originalConfigVersion}, got ${this.configVersion}`
        );
        return { isFromOutdatedConfig: true };
      }
      return { isFromOutdatedConfig: false, value: token };
    }
    stop() {
      this.resetAuthState();
      this.configVersion++;
      this._logVerbose(`config version bumped to ${this.configVersion}`);
    }
    setAndReportAuthFailed(onAuthChange) {
      onAuthChange(false);
      this.resetAuthState();
    }
    resetAuthState() {
      this.setAuthState({ state: "noAuth" });
    }
    setAuthState(newAuth) {
      const authStateForLog = newAuth.state === "waitingForServerConfirmationOfFreshToken" ? {
        hadAuth: newAuth.hadAuth,
        state: newAuth.state,
        token: `...${newAuth.token.slice(-7)}`
      } : { state: newAuth.state };
      this._logVerbose(
        `setting auth state to ${JSON.stringify(authStateForLog)}`
      );
      switch (newAuth.state) {
        case "waitingForScheduledRefetch":
        case "notRefetching":
        case "noAuth":
          this.tokenConfirmationAttempts = 0;
          break;
        case "waitingForServerConfirmationOfFreshToken":
        case "waitingForServerConfirmationOfCachedToken":
        case "initialRefetch":
          break;
        default: {
          newAuth;
        }
      }
      if (this.authState.state === "waitingForScheduledRefetch") {
        clearTimeout(this.authState.refetchTokenTimeoutId);
        this.syncState.markAuthCompletion();
      }
      this.authState = newAuth;
    }
    decodeToken(token) {
      try {
        return jwtDecode(token);
      } catch (e) {
        this._logVerbose(
          `Error decoding token: ${e instanceof Error ? e.message : "Unknown error"}`
        );
        return null;
      }
    }
    _logVerbose(message) {
      this.logger.logVerbose(`${message} [v${this.configVersion}]`);
    }
  };

  // src/browser/sync/metrics.ts
  var markNames = [
    "convexClientConstructed",
    "convexWebSocketOpen",
    "convexFirstMessageReceived"
  ];
  function mark(name, sessionId) {
    const detail = { sessionId };
    if (typeof performance === "undefined" || !performance.mark) return;
    performance.mark(name, { detail });
  }
  function performanceMarkToJson(mark2) {
    let name = mark2.name.slice("convex".length);
    name = name.charAt(0).toLowerCase() + name.slice(1);
    return {
      name,
      startTime: mark2.startTime
    };
  }
  function getMarksReport(sessionId) {
    if (typeof performance === "undefined" || !performance.getEntriesByName) {
      return [];
    }
    const allMarks = [];
    for (const name of markNames) {
      const marks = performance.getEntriesByName(name).filter((entry) => entry.entryType === "mark").filter((mark2) => mark2.detail.sessionId === sessionId);
      allMarks.push(...marks);
    }
    return allMarks.map(performanceMarkToJson);
  }

  // src/browser/sync/client.ts
  var BaseConvexClient = class {
    address;
    state;
    requestManager;
    webSocketManager;
    authenticationManager;
    remoteQuerySet;
    optimisticQueryResults;
    _transitionHandlerCounter = 0;
    _nextRequestId;
    _onTransitionFns = /* @__PURE__ */ new Map();
    _sessionId;
    firstMessageReceived = false;
    debug;
    logger;
    maxObservedTimestamp;
    connectionStateSubscribers = /* @__PURE__ */ new Map();
    nextConnectionStateSubscriberId = 0;
    _lastPublishedConnectionState;
    /**
     * @param address - The url of your Convex deployment, often provided
     * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
     * @param onTransition - A callback receiving an array of query tokens
     * corresponding to query results that have changed -- additional handlers
     * can be added via `addOnTransitionHandler`.
     * @param options - See {@link BaseConvexClientOptions} for a full description.
     */
    constructor(address, onTransition, options) {
      if (typeof address === "object") {
        throw new Error(
          "Passing a ClientConfig object is no longer supported. Pass the URL of the Convex deployment as a string directly."
        );
      }
      if (options?.skipConvexDeploymentUrlCheck !== true) {
        validateDeploymentUrl(address);
      }
      options = { ...options };
      const authRefreshTokenLeewaySeconds = options.authRefreshTokenLeewaySeconds ?? 2;
      let webSocketConstructor = options.webSocketConstructor;
      if (!webSocketConstructor && typeof WebSocket === "undefined") {
        throw new Error(
          "No WebSocket global variable defined! To use Convex in an environment without WebSocket try the HTTP client: https://docs.convex.dev/api/classes/browser.ConvexHttpClient"
        );
      }
      webSocketConstructor = webSocketConstructor || WebSocket;
      this.debug = options.reportDebugInfoToConvex ?? false;
      this.address = address;
      this.logger = options.logger === false ? instantiateNoopLogger({ verbose: options.verbose ?? false }) : options.logger !== true && options.logger ? options.logger : instantiateDefaultLogger({ verbose: options.verbose ?? false });
      const i = address.search("://");
      if (i === -1) {
        throw new Error("Provided address was not an absolute URL.");
      }
      const origin = address.substring(i + 3);
      const protocol = address.substring(0, i);
      let wsProtocol;
      if (protocol === "http") {
        wsProtocol = "ws";
      } else if (protocol === "https") {
        wsProtocol = "wss";
      } else {
        throw new Error(`Unknown parent protocol ${protocol}`);
      }
      const wsUri = `${wsProtocol}://${origin}/api/${version}/sync`;
      this.state = new LocalSyncState();
      this.remoteQuerySet = new RemoteQuerySet(
        (queryId) => this.state.queryPath(queryId),
        this.logger
      );
      this.requestManager = new RequestManager(
        this.logger,
        this.markConnectionStateDirty
      );
      const pauseSocket = () => {
        this.webSocketManager.pause();
        this.state.pause();
      };
      this.authenticationManager = new AuthenticationManager(
        this.state,
        {
          authenticate: (token) => {
            const message = this.state.setAuth(token);
            this.webSocketManager.sendMessage(message);
            return message.baseVersion;
          },
          stopSocket: () => this.webSocketManager.stop(),
          tryRestartSocket: () => this.webSocketManager.tryRestart(),
          pauseSocket,
          resumeSocket: () => this.webSocketManager.resume(),
          clearAuth: () => {
            this.clearAuth();
          }
        },
        {
          logger: this.logger,
          refreshTokenLeewaySeconds: authRefreshTokenLeewaySeconds
        }
      );
      this.optimisticQueryResults = new OptimisticQueryResults();
      this.addOnTransitionHandler((transition) => {
        onTransition(transition.queries.map((q) => q.token));
      });
      this._nextRequestId = 0;
      this._sessionId = newSessionId();
      const { unsavedChangesWarning } = options;
      if (typeof window === "undefined" || typeof window.addEventListener === "undefined") {
        if (unsavedChangesWarning === true) {
          throw new Error(
            "unsavedChangesWarning requested, but window.addEventListener not found! Remove {unsavedChangesWarning: true} from Convex client options."
          );
        }
      } else if (unsavedChangesWarning !== false) {
        window.addEventListener("beforeunload", (e) => {
          if (this.requestManager.hasIncompleteRequests()) {
            e.preventDefault();
            const confirmationMessage = "Are you sure you want to leave? Your changes may not be saved.";
            (e || window.event).returnValue = confirmationMessage;
            return confirmationMessage;
          }
        });
      }
      this.webSocketManager = new WebSocketManager(
        wsUri,
        {
          onOpen: (reconnectMetadata) => {
            this.mark("convexWebSocketOpen");
            this.webSocketManager.sendMessage({
              ...reconnectMetadata,
              type: "Connect",
              sessionId: this._sessionId,
              maxObservedTimestamp: this.maxObservedTimestamp
            });
            const oldRemoteQueryResults = new Set(
              this.remoteQuerySet.remoteQueryResults().keys()
            );
            this.remoteQuerySet = new RemoteQuerySet(
              (queryId) => this.state.queryPath(queryId),
              this.logger
            );
            const [querySetModification, authModification] = this.state.restart(
              oldRemoteQueryResults
            );
            if (authModification) {
              this.webSocketManager.sendMessage(authModification);
            }
            this.webSocketManager.sendMessage(querySetModification);
            for (const message of this.requestManager.restart()) {
              this.webSocketManager.sendMessage(message);
            }
          },
          onResume: () => {
            const [querySetModification, authModification] = this.state.resume();
            if (authModification) {
              this.webSocketManager.sendMessage(authModification);
            }
            if (querySetModification) {
              this.webSocketManager.sendMessage(querySetModification);
            }
            for (const message of this.requestManager.resume()) {
              this.webSocketManager.sendMessage(message);
            }
          },
          onMessage: (serverMessage) => {
            if (!this.firstMessageReceived) {
              this.firstMessageReceived = true;
              this.mark("convexFirstMessageReceived");
              this.reportMarks();
            }
            switch (serverMessage.type) {
              case "Transition": {
                this.observedTimestamp(serverMessage.endVersion.ts);
                this.authenticationManager.onTransition(serverMessage);
                this.remoteQuerySet.transition(serverMessage);
                this.state.transition(serverMessage);
                const completedRequests = this.requestManager.removeCompleted(
                  this.remoteQuerySet.timestamp()
                );
                this.notifyOnQueryResultChanges(completedRequests);
                break;
              }
              case "MutationResponse": {
                if (serverMessage.success) {
                  this.observedTimestamp(serverMessage.ts);
                }
                const completedMutationInfo = this.requestManager.onResponse(serverMessage);
                if (completedMutationInfo !== null) {
                  this.notifyOnQueryResultChanges(
                    /* @__PURE__ */ new Map([
                      [
                        completedMutationInfo.requestId,
                        completedMutationInfo.result
                      ]
                    ])
                  );
                }
                break;
              }
              case "ActionResponse": {
                this.requestManager.onResponse(serverMessage);
                break;
              }
              case "AuthError": {
                this.authenticationManager.onAuthError(serverMessage);
                break;
              }
              case "FatalError": {
                const error = logFatalError(this.logger, serverMessage.error);
                void this.webSocketManager.terminate();
                throw error;
              }
              default: {
                serverMessage;
              }
            }
            return {
              hasSyncedPastLastReconnect: this.hasSyncedPastLastReconnect()
            };
          },
          onServerDisconnectError: options.onServerDisconnectError
        },
        webSocketConstructor,
        this.logger,
        this.markConnectionStateDirty,
        this.debug
      );
      this.mark("convexClientConstructed");
      if (options.expectAuth) {
        pauseSocket();
      }
    }
    /**
     * Return true if there is outstanding work from prior to the time of the most recent restart.
     * This indicates that the client has not proven itself to have gotten past the issue that
     * potentially led to the restart. Use this to influence when to reset backoff after a failure.
     */
    hasSyncedPastLastReconnect() {
      const hasSyncedPastLastReconnect = this.requestManager.hasSyncedPastLastReconnect() || this.state.hasSyncedPastLastReconnect();
      return hasSyncedPastLastReconnect;
    }
    observedTimestamp(observedTs) {
      if (this.maxObservedTimestamp === void 0 || this.maxObservedTimestamp.lessThanOrEqual(observedTs)) {
        this.maxObservedTimestamp = observedTs;
      }
    }
    getMaxObservedTimestamp() {
      return this.maxObservedTimestamp;
    }
    /**
     * Compute the current query results based on the remoteQuerySet and the
     * current optimistic updates and call `onTransition` for all the changed
     * queries.
     *
     * @param completedMutations - A set of mutation IDs whose optimistic updates
     * are no longer needed.
     */
    notifyOnQueryResultChanges(completedRequests) {
      const remoteQueryResults = this.remoteQuerySet.remoteQueryResults();
      const queryTokenToValue = /* @__PURE__ */ new Map();
      for (const [queryId, result] of remoteQueryResults) {
        const queryToken = this.state.queryToken(queryId);
        if (queryToken !== null) {
          const query = {
            result,
            udfPath: this.state.queryPath(queryId),
            args: this.state.queryArgs(queryId)
          };
          queryTokenToValue.set(queryToken, query);
        }
      }
      const changedQueryTokens = this.optimisticQueryResults.ingestQueryResultsFromServer(
        queryTokenToValue,
        new Set(completedRequests.keys())
      );
      this.handleTransition({
        queries: changedQueryTokens.map((token) => {
          const optimisticResult = this.optimisticQueryResults.rawQueryResult(token);
          return {
            token,
            modification: {
              kind: "Updated",
              result: optimisticResult.result
            }
          };
        }),
        reflectedMutations: Array.from(completedRequests).map(
          ([requestId, result]) => ({
            requestId,
            result
          })
        ),
        timestamp: this.remoteQuerySet.timestamp()
      });
    }
    handleTransition(transition) {
      for (const fn of this._onTransitionFns.values()) {
        fn(transition);
      }
    }
    /**
     * Add a handler that will be called on a transition.
     *
     * Any external side effects (e.g. setting React state) should be handled here.
     *
     * @param fn
     *
     * @returns
     */
    addOnTransitionHandler(fn) {
      const id = this._transitionHandlerCounter++;
      this._onTransitionFns.set(id, fn);
      return () => this._onTransitionFns.delete(id);
    }
    /**
     * Get the current JWT auth token and decoded claims.
     */
    getCurrentAuthClaims() {
      const authToken = this.state.getAuth();
      let decoded = {};
      if (authToken && authToken.tokenType === "User") {
        try {
          decoded = authToken ? jwtDecode(authToken.value) : {};
        } catch {
          decoded = {};
        }
      } else {
        return void 0;
      }
      return { token: authToken.value, decoded };
    }
    /**
     * Set the authentication token to be used for subsequent queries and mutations.
     * `fetchToken` will be called automatically again if a token expires.
     * `fetchToken` should return `null` if the token cannot be retrieved, for example
     * when the user's rights were permanently revoked.
     * @param fetchToken - an async function returning the JWT-encoded OpenID Connect Identity Token
     * @param onChange - a callback that will be called when the authentication status changes
     */
    setAuth(fetchToken, onChange) {
      void this.authenticationManager.setConfig(fetchToken, onChange);
    }
    hasAuth() {
      return this.state.hasAuth();
    }
    /** @internal */
    setAdminAuth(value, fakeUserIdentity) {
      const message = this.state.setAdminAuth(value, fakeUserIdentity);
      this.webSocketManager.sendMessage(message);
    }
    clearAuth() {
      const message = this.state.clearAuth();
      this.webSocketManager.sendMessage(message);
    }
    /**
       * Subscribe to a query function.
       *
       * Whenever this query's result changes, the `onTransition` callback
       * passed into the constructor will be called.
       *
       * @param name - The name of the query.
       * @param args - An arguments object for the query. If this is omitted, the
       * arguments will be `{}`.
       * @param options - A {@link SubscribeOptions} options object for this query.
    
       * @returns An object containing a {@link QueryToken} corresponding to this
       * query and an `unsubscribe` callback.
       */
    subscribe(name, args, options) {
      const argsObject = parseArgs(args);
      const { modification, queryToken, unsubscribe } = this.state.subscribe(
        name,
        argsObject,
        options?.journal,
        options?.componentPath
      );
      if (modification !== null) {
        this.webSocketManager.sendMessage(modification);
      }
      return {
        queryToken,
        unsubscribe: () => {
          const modification2 = unsubscribe();
          if (modification2) {
            this.webSocketManager.sendMessage(modification2);
          }
        }
      };
    }
    /**
     * A query result based only on the current, local state.
     *
     * The only way this will return a value is if we're already subscribed to the
     * query or its value has been set optimistically.
     */
    localQueryResult(udfPath, args) {
      const argsObject = parseArgs(args);
      const queryToken = serializePathAndArgs(udfPath, argsObject);
      return this.optimisticQueryResults.queryResult(queryToken);
    }
    /**
     * Get query result by query token based on current, local state
     *
     * The only way this will return a value is if we're already subscribed to the
     * query or its value has been set optimistically.
     *
     * @internal
     */
    localQueryResultByToken(queryToken) {
      return this.optimisticQueryResults.queryResult(queryToken);
    }
    /**
     * Whether local query result is available for a toke.
     *
     * This method does not throw if the result is an error.
     *
     * @internal
     */
    hasLocalQueryResultByToken(queryToken) {
      return this.optimisticQueryResults.hasQueryResult(queryToken);
    }
    /**
     * @internal
     */
    localQueryLogs(udfPath, args) {
      const argsObject = parseArgs(args);
      const queryToken = serializePathAndArgs(udfPath, argsObject);
      return this.optimisticQueryResults.queryLogs(queryToken);
    }
    /**
     * Retrieve the current {@link QueryJournal} for this query function.
     *
     * If we have not yet received a result for this query, this will be `undefined`.
     *
     * @param name - The name of the query.
     * @param args - The arguments object for this query.
     * @returns The query's {@link QueryJournal} or `undefined`.
     */
    queryJournal(name, args) {
      const argsObject = parseArgs(args);
      const queryToken = serializePathAndArgs(name, argsObject);
      return this.state.queryJournal(queryToken);
    }
    /**
     * Get the current {@link ConnectionState} between the client and the Convex
     * backend.
     *
     * @returns The {@link ConnectionState} with the Convex backend.
     */
    connectionState() {
      const wsConnectionState = this.webSocketManager.connectionState();
      return {
        hasInflightRequests: this.requestManager.hasInflightRequests(),
        isWebSocketConnected: wsConnectionState.isConnected,
        hasEverConnected: wsConnectionState.hasEverConnected,
        connectionCount: wsConnectionState.connectionCount,
        connectionRetries: wsConnectionState.connectionRetries,
        timeOfOldestInflightRequest: this.requestManager.timeOfOldestInflightRequest(),
        inflightMutations: this.requestManager.inflightMutations(),
        inflightActions: this.requestManager.inflightActions()
      };
    }
    /**
     * Call this whenever the connection state may have changed in a way that could
     * require publishing it. Schedules a possibly update.
     */
    markConnectionStateDirty = () => {
      void Promise.resolve().then(() => {
        const curConnectionState = this.connectionState();
        if (JSON.stringify(curConnectionState) !== JSON.stringify(this._lastPublishedConnectionState)) {
          this._lastPublishedConnectionState = curConnectionState;
          for (const cb of this.connectionStateSubscribers.values()) {
            cb(curConnectionState);
          }
        }
      });
    };
    /**
     * Subscribe to the {@link ConnectionState} between the client and the Convex
     * backend, calling a callback each time it changes.
     *
     * Subscribed callbacks will be called when any part of ConnectionState changes.
     * ConnectionState may grow in future versions (e.g. to provide a array of
     * inflight requests) in which case callbacks would be called more frequently.
     *
     * @returns An unsubscribe function to stop listening.
     */
    subscribeToConnectionState(cb) {
      const id = this.nextConnectionStateSubscriberId++;
      this.connectionStateSubscribers.set(id, cb);
      return () => {
        this.connectionStateSubscribers.delete(id);
      };
    }
    /**
       * Execute a mutation function.
       *
       * @param name - The name of the mutation.
       * @param args - An arguments object for the mutation. If this is omitted,
       * the arguments will be `{}`.
       * @param options - A {@link MutationOptions} options object for this mutation.
    
       * @returns - A promise of the mutation's result.
       */
    async mutation(name, args, options) {
      const result = await this.mutationInternal(name, args, options);
      if (!result.success) {
        if (result.errorData !== void 0) {
          throw forwardData(
            result,
            new ConvexError(
              createHybridErrorStacktrace("mutation", name, result)
            )
          );
        }
        throw new Error(createHybridErrorStacktrace("mutation", name, result));
      }
      return result.value;
    }
    /**
     * @internal
     */
    async mutationInternal(udfPath, args, options, componentPath) {
      const { mutationPromise } = this.enqueueMutation(
        udfPath,
        args,
        options,
        componentPath
      );
      return mutationPromise;
    }
    /**
     * @internal
     */
    enqueueMutation(udfPath, args, options, componentPath) {
      const mutationArgs = parseArgs(args);
      this.tryReportLongDisconnect();
      const requestId = this.nextRequestId;
      this._nextRequestId++;
      if (options !== void 0) {
        const optimisticUpdate = options.optimisticUpdate;
        if (optimisticUpdate !== void 0) {
          const wrappedUpdate = (localQueryStore) => {
            const result = optimisticUpdate(
              localQueryStore,
              mutationArgs
            );
            if (result instanceof Promise) {
              this.logger.warn(
                "Optimistic update handler returned a Promise. Optimistic updates should be synchronous."
              );
            }
          };
          const changedQueryTokens = this.optimisticQueryResults.applyOptimisticUpdate(
            wrappedUpdate,
            requestId
          );
          const changedQueries = changedQueryTokens.map((token) => {
            const localResult = this.localQueryResultByToken(token);
            return {
              token,
              modification: {
                kind: "Updated",
                result: localResult === void 0 ? void 0 : {
                  success: true,
                  value: localResult,
                  logLines: []
                }
              }
            };
          });
          this.handleTransition({
            queries: changedQueries,
            reflectedMutations: [],
            timestamp: this.remoteQuerySet.timestamp()
          });
        }
      }
      const message = {
        type: "Mutation",
        requestId,
        udfPath,
        componentPath,
        args: [convexToJson(mutationArgs)]
      };
      const mightBeSent = this.webSocketManager.sendMessage(message);
      const mutationPromise = this.requestManager.request(message, mightBeSent);
      return {
        requestId,
        mutationPromise
      };
    }
    /**
     * Execute an action function.
     *
     * @param name - The name of the action.
     * @param args - An arguments object for the action. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the action's result.
     */
    async action(name, args) {
      const result = await this.actionInternal(name, args);
      if (!result.success) {
        if (result.errorData !== void 0) {
          throw forwardData(
            result,
            new ConvexError(createHybridErrorStacktrace("action", name, result))
          );
        }
        throw new Error(createHybridErrorStacktrace("action", name, result));
      }
      return result.value;
    }
    /**
     * @internal
     */
    async actionInternal(udfPath, args, componentPath) {
      const actionArgs = parseArgs(args);
      const requestId = this.nextRequestId;
      this._nextRequestId++;
      this.tryReportLongDisconnect();
      const message = {
        type: "Action",
        requestId,
        udfPath,
        componentPath,
        args: [convexToJson(actionArgs)]
      };
      const mightBeSent = this.webSocketManager.sendMessage(message);
      return this.requestManager.request(message, mightBeSent);
    }
    /**
     * Close any network handles associated with this client and stop all subscriptions.
     *
     * Call this method when you're done with an {@link BaseConvexClient} to
     * dispose of its sockets and resources.
     *
     * @returns A `Promise` fulfilled when the connection has been completely closed.
     */
    async close() {
      this.authenticationManager.stop();
      return this.webSocketManager.terminate();
    }
    /**
     * Return the address for this client, useful for creating a new client.
     *
     * Not guaranteed to match the address with which this client was constructed:
     * it may be canonicalized.
     */
    get url() {
      return this.address;
    }
    /**
     * @internal
     */
    get nextRequestId() {
      return this._nextRequestId;
    }
    /**
     * @internal
     */
    get sessionId() {
      return this._sessionId;
    }
    // Instance property so that `mark()` doesn't need to be called as a method.
    mark = (name) => {
      if (this.debug) {
        mark(name, this.sessionId);
      }
    };
    /**
     * Reports performance marks to the server. This should only be called when
     * we have a functional websocket.
     */
    reportMarks() {
      if (this.debug) {
        const report = getMarksReport(this.sessionId);
        this.webSocketManager.sendMessage({
          type: "Event",
          eventType: "ClientConnect",
          event: report
        });
      }
    }
    tryReportLongDisconnect() {
      if (!this.debug) {
        return;
      }
      const timeOfOldestRequest = this.connectionState().timeOfOldestInflightRequest;
      if (timeOfOldestRequest === null || Date.now() - timeOfOldestRequest.getTime() <= 60 * 1e3) {
        return;
      }
      const endpoint = `${this.address}/api/debug_event`;
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Convex-Client": `npm-${version}`
        },
        body: JSON.stringify({ event: "LongWebsocketDisconnect" })
      }).then((response) => {
        if (!response.ok) {
          this.logger.warn(
            "Analytics request failed with response:",
            response.body
          );
        }
      }).catch((error) => {
        this.logger.warn("Analytics response failed with error:", error);
      });
    }
  };

  // src/browser/simple_client.ts
  var defaultWebSocketConstructor;
  var ConvexClient = class {
    listeners;
    _client;
    // A synthetic server event to run callbacks the first time
    callNewListenersWithCurrentValuesTimer;
    _closed;
    _disabled;
    /**
     * Once closed no registered callbacks will fire again.
     */
    get closed() {
      return this._closed;
    }
    get client() {
      if (this._client) return this._client;
      throw new Error("ConvexClient is disabled");
    }
    get disabled() {
      return this._disabled;
    }
    /**
     * Construct a client and immediately initiate a WebSocket connection to the passed address.
     *
     * @public
     */
    constructor(address, options = {}) {
      if (options.skipConvexDeploymentUrlCheck !== true) {
        validateDeploymentUrl(address);
      }
      const { disabled, ...baseOptions } = options;
      this._closed = false;
      this._disabled = !!disabled;
      if (defaultWebSocketConstructor && !("webSocketConstructor" in baseOptions) && typeof WebSocket === "undefined") {
        baseOptions.webSocketConstructor = defaultWebSocketConstructor;
      }
      if (typeof window === "undefined" && !("unsavedChangesWarning" in baseOptions)) {
        baseOptions.unsavedChangesWarning = false;
      }
      if (!this.disabled) {
        this._client = new BaseConvexClient(
          address,
          (updatedQueries) => this._transition(updatedQueries),
          baseOptions
        );
      }
      this.listeners = /* @__PURE__ */ new Set();
    }
    /**
     * Call a callback whenever a new result for a query is received. The callback
     * will run soon after being registered if a result for the query is already
     * in memory.
     *
     * The return value is an {@link Unsubscribe} object which is both a function
     * an an object with properties. Both of the patterns below work with this object:
     *
     *```ts
     * // call the return value as a function
     * const unsubscribe = client.onUpdate(api.messages.list, {}, (messages) => {
     *   console.log(messages);
     * });
     * unsubscribe();
     *
     * // unpack the return value into its properties
     * const {
     *   getCurrentValue,
     *   unsubscribe,
     * } = client.onUpdate(api.messages.list, {}, (messages) => {
     *   console.log(messages);
     * });
     *```
     *
     * @param query - A {@link server.FunctionReference} for the public query to run.
     * @param args - The arguments to run the query with.
     * @param callback - Function to call when the query result updates.
     * @param onError - Function to call when the query result updates with an error.
     * If not provided, errors will be thrown instead of calling the callback.
     *
     * @return an {@link Unsubscribe} function to stop calling the onUpdate function.
     */
    onUpdate(query, args, callback, onError) {
      if (this.disabled) {
        const disabledUnsubscribe = () => {
        };
        const unsubscribeProps2 = {
          unsubscribe: disabledUnsubscribe,
          getCurrentValue: () => void 0,
          getQueryLogs: () => void 0
        };
        Object.assign(disabledUnsubscribe, unsubscribeProps2);
        return disabledUnsubscribe;
      }
      const { queryToken, unsubscribe } = this.client.subscribe(
        getFunctionName(query),
        args
      );
      const queryInfo = {
        queryToken,
        callback,
        onError,
        unsubscribe,
        hasEverRun: false,
        query,
        args
      };
      this.listeners.add(queryInfo);
      if (this.queryResultReady(queryToken) && this.callNewListenersWithCurrentValuesTimer === void 0) {
        this.callNewListenersWithCurrentValuesTimer = setTimeout(
          () => this.callNewListenersWithCurrentValues(),
          0
        );
      }
      const unsubscribeProps = {
        unsubscribe: () => {
          if (this.closed) {
            return;
          }
          this.listeners.delete(queryInfo);
          unsubscribe();
        },
        getCurrentValue: () => this.client.localQueryResultByToken(queryToken),
        getQueryLogs: () => this.client.localQueryLogs(queryToken)
      };
      const ret = unsubscribeProps.unsubscribe;
      Object.assign(ret, unsubscribeProps);
      return ret;
    }
    // Run all callbacks that have never been run before if they have a query
    // result available now.
    callNewListenersWithCurrentValues() {
      this.callNewListenersWithCurrentValuesTimer = void 0;
      this._transition([], true);
    }
    queryResultReady(queryToken) {
      return this.client.hasLocalQueryResultByToken(queryToken);
    }
    async close() {
      if (this.disabled) return;
      this.listeners.clear();
      this._closed = true;
      return this.client.close();
    }
    /**
     * Get the current JWT auth token and decoded claims.
     */
    getAuth() {
      if (this.disabled) return;
      return this.client.getCurrentAuthClaims();
    }
    /**
     * Set the authentication token to be used for subsequent queries and mutations.
     * `fetchToken` will be called automatically again if a token expires.
     * `fetchToken` should return `null` if the token cannot be retrieved, for example
     * when the user's rights were permanently revoked.
     * @param fetchToken - an async function returning the JWT (typically an OpenID Connect Identity Token)
     * @param onChange - a callback that will be called when the authentication status changes
     */
    setAuth(fetchToken, onChange) {
      if (this.disabled) return;
      this.client.setAuth(
        fetchToken,
        onChange ?? (() => {
        })
      );
    }
    /**
     * @internal
     */
    setAdminAuth(token, identity) {
      if (this.closed) {
        throw new Error("ConvexClient has already been closed.");
      }
      if (this.disabled) return;
      this.client.setAdminAuth(token, identity);
    }
    /**
     * @internal
     */
    _transition(updatedQueries, callNewListeners = false) {
      for (const queryInfo of this.listeners) {
        const { callback, queryToken, onError, hasEverRun } = queryInfo;
        if (updatedQueries.includes(queryToken) || callNewListeners && !hasEverRun && this.client.hasLocalQueryResultByToken(queryToken)) {
          queryInfo.hasEverRun = true;
          let newValue;
          try {
            newValue = this.client.localQueryResultByToken(queryToken);
          } catch (error) {
            if (!(error instanceof Error)) throw error;
            if (onError) {
              onError(
                error,
                "Second argument to onUpdate onError is reserved for later use"
              );
            } else {
              void Promise.reject(error);
            }
            continue;
          }
          callback(
            newValue,
            "Second argument to onUpdate callback is reserved for later use"
          );
        }
      }
    }
    /**
     * Execute a mutation function.
     *
     * @param mutation - A {@link server.FunctionReference} for the public mutation
     * to run.
     * @param args - An arguments object for the mutation.
     * @param options - A {@link MutationOptions} options object for the mutation.
     * @returns A promise of the mutation's result.
     */
    async mutation(mutation, args, options) {
      if (this.disabled) throw new Error("ConvexClient is disabled");
      return await this.client.mutation(getFunctionName(mutation), args, options);
    }
    /**
     * Execute an action function.
     *
     * @param action - A {@link server.FunctionReference} for the public action
     * to run.
     * @param args - An arguments object for the action.
     * @returns A promise of the action's result.
     */
    async action(action, args) {
      if (this.disabled) throw new Error("ConvexClient is disabled");
      return await this.client.action(getFunctionName(action), args);
    }
    /**
     * Fetch a query result once.
     *
     * @param query - A {@link server.FunctionReference} for the public query
     * to run.
     * @param args - An arguments object for the query.
     * @returns A promise of the query's result.
     */
    async query(query, args) {
      if (this.disabled) throw new Error("ConvexClient is disabled");
      const value = this.client.localQueryResult(getFunctionName(query), args);
      if (value !== void 0) return Promise.resolve(value);
      return new Promise((resolve, reject) => {
        const { unsubscribe } = this.onUpdate(
          query,
          args,
          (value2) => {
            unsubscribe();
            resolve(value2);
          },
          (e) => {
            unsubscribe();
            reject(e);
          }
        );
      });
    }
    /**
     * Get the current {@link ConnectionState} between the client and the Convex
     * backend.
     *
     * @returns The {@link ConnectionState} with the Convex backend.
     */
    connectionState() {
      if (this.disabled) throw new Error("ConvexClient is disabled");
      return this.client.connectionState();
    }
    /**
     * Subscribe to the {@link ConnectionState} between the client and the Convex
     * backend, calling a callback each time it changes.
     *
     * Subscribed callbacks will be called when any part of ConnectionState changes.
     * ConnectionState may grow in future versions (e.g. to provide a array of
     * inflight requests) in which case callbacks would be called more frequently.
     *
     * @returns An unsubscribe function to stop listening.
     */
    subscribeToConnectionState(cb) {
      if (this.disabled) return () => {
      };
      return this.client.subscribeToConnectionState(cb);
    }
  };

  // src/browser/http_client.ts
  var STATUS_CODE_UDF_FAILED = 560;
  var specifiedFetch = void 0;
  var ConvexHttpClient = class {
    address;
    auth;
    adminAuth;
    encodedTsPromise;
    debug;
    fetchOptions;
    logger;
    mutationQueue = [];
    isProcessingQueue = false;
    /**
     * Create a new {@link ConvexHttpClient}.
     *
     * @param address - The url of your Convex deployment, often provided
     * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
     * @param options - An object of options.
     * - `skipConvexDeploymentUrlCheck` - Skip validating that the Convex deployment URL looks like
     * `https://happy-animal-123.convex.cloud` or localhost. This can be useful if running a self-hosted
     * Convex backend that uses a different URL.
     * - `logger` - A logger or a boolean. If not provided, logs to the console.
     * You can construct your own logger to customize logging to log elsewhere
     * or not log at all, or use `false` as a shorthand for a no-op logger.
     * A logger is an object with 4 methods: log(), warn(), error(), and logVerbose().
     * These methods can receive multiple arguments of any types, like console.log().
     * - `auth` - A JWT containing identity claims accessible in Convex functions.
     * This identity may expire so it may be necessary to call `setAuth()` later,
     * but for short-lived clients it's convenient to specify this value here.
     */
    constructor(address, options) {
      if (typeof options === "boolean") {
        throw new Error(
          "skipConvexDeploymentUrlCheck as the second argument is no longer supported. Please pass an options object, `{ skipConvexDeploymentUrlCheck: true }`."
        );
      }
      const opts = options ?? {};
      if (opts.skipConvexDeploymentUrlCheck !== true) {
        validateDeploymentUrl(address);
      }
      this.logger = options?.logger === false ? instantiateNoopLogger({ verbose: false }) : options?.logger !== true && options?.logger ? options.logger : instantiateDefaultLogger({ verbose: false });
      this.address = address;
      this.debug = true;
      this.auth = void 0;
      this.adminAuth = void 0;
      if (options?.auth) {
        this.setAuth(options.auth);
      }
    }
    /**
     * Obtain the {@link ConvexHttpClient}'s URL to its backend.
     * @deprecated Use url, which returns the url without /api at the end.
     *
     * @returns The URL to the Convex backend, including the client's API version.
     */
    backendUrl() {
      return `${this.address}/api`;
    }
    /**
     * Return the address for this client, useful for creating a new client.
     *
     * Not guaranteed to match the address with which this client was constructed:
     * it may be canonicalized.
     */
    get url() {
      return this.address;
    }
    /**
     * Set the authentication token to be used for subsequent queries and mutations.
     *
     * Should be called whenever the token changes (i.e. due to expiration and refresh).
     *
     * @param value - JWT-encoded OpenID Connect identity token.
     */
    setAuth(value) {
      this.clearAuth();
      this.auth = value;
    }
    /**
     * Set admin auth token to allow calling internal queries, mutations, and actions
     * and acting as an identity.
     *
     * @internal
     */
    setAdminAuth(token, actingAsIdentity) {
      this.clearAuth();
      if (actingAsIdentity !== void 0) {
        const bytes = new TextEncoder().encode(JSON.stringify(actingAsIdentity));
        const actingAsIdentityEncoded = btoa(String.fromCodePoint(...bytes));
        this.adminAuth = `${token}:${actingAsIdentityEncoded}`;
      } else {
        this.adminAuth = token;
      }
    }
    /**
     * Clear the current authentication token if set.
     */
    clearAuth() {
      this.auth = void 0;
      this.adminAuth = void 0;
    }
    /**
     * Sets whether the result log lines should be printed on the console or not.
     *
     * @internal
     */
    setDebug(debug) {
      this.debug = debug;
    }
    /**
     * Used to customize the fetch behavior in some runtimes.
     *
     * @internal
     */
    setFetchOptions(fetchOptions) {
      this.fetchOptions = fetchOptions;
    }
    /**
     * This API is experimental: it may change or disappear.
     *
     * Execute a Convex query function at the same timestamp as every other
     * consistent query execution run by this HTTP client.
     *
     * This doesn't make sense for long-lived ConvexHttpClients as Convex
     * backends can read a limited amount into the past: beyond 30 seconds
     * in the past may not be available.
     *
     * Create a new client to use a consistent time.
     *
     * @param name - The name of the query.
     * @param args - The arguments object for the query. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the query's result.
     *
     * @deprecated This API is experimental: it may change or disappear.
     */
    async consistentQuery(query, ...args) {
      const queryArgs = parseArgs(args[0]);
      const timestampPromise = this.getTimestamp();
      return await this.queryInner(query, queryArgs, { timestampPromise });
    }
    async getTimestamp() {
      if (this.encodedTsPromise) {
        return this.encodedTsPromise;
      }
      return this.encodedTsPromise = this.getTimestampInner();
    }
    async getTimestampInner() {
      const localFetch = specifiedFetch || fetch;
      const headers = {
        "Content-Type": "application/json",
        "Convex-Client": `npm-${version}`
      };
      const response = await localFetch(`${this.address}/api/query_ts`, {
        ...this.fetchOptions,
        method: "POST",
        headers
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const { ts } = await response.json();
      return ts;
    }
    /**
     * Execute a Convex query function.
     *
     * @param name - The name of the query.
     * @param args - The arguments object for the query. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the query's result.
     */
    async query(query, ...args) {
      const queryArgs = parseArgs(args[0]);
      return await this.queryInner(query, queryArgs, {});
    }
    async queryInner(query, queryArgs, options) {
      const name = getFunctionName(query);
      const args = [convexToJson(queryArgs)];
      const headers = {
        "Content-Type": "application/json",
        "Convex-Client": `npm-${version}`
      };
      if (this.adminAuth) {
        headers["Authorization"] = `Convex ${this.adminAuth}`;
      } else if (this.auth) {
        headers["Authorization"] = `Bearer ${this.auth}`;
      }
      const localFetch = specifiedFetch || fetch;
      const timestamp = options.timestampPromise ? await options.timestampPromise : void 0;
      const body = JSON.stringify({
        path: name,
        format: "convex_encoded_json",
        args,
        ...timestamp ? { ts: timestamp } : {}
      });
      const endpoint = timestamp ? `${this.address}/api/query_at_ts` : `${this.address}/api/query`;
      const response = await localFetch(endpoint, {
        ...this.fetchOptions,
        body,
        method: "POST",
        headers
      });
      if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
        throw new Error(await response.text());
      }
      const respJSON = await response.json();
      if (this.debug) {
        for (const line of respJSON.logLines ?? []) {
          logForFunction(this.logger, "info", "query", name, line);
        }
      }
      switch (respJSON.status) {
        case "success":
          return jsonToConvex(respJSON.value);
        case "error":
          if (respJSON.errorData !== void 0) {
            throw forwardErrorData(
              respJSON.errorData,
              new ConvexError(respJSON.errorMessage)
            );
          }
          throw new Error(respJSON.errorMessage);
        default:
          throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
      }
    }
    async mutationInner(mutation, mutationArgs) {
      const name = getFunctionName(mutation);
      const body = JSON.stringify({
        path: name,
        format: "convex_encoded_json",
        args: [convexToJson(mutationArgs)]
      });
      const headers = {
        "Content-Type": "application/json",
        "Convex-Client": `npm-${version}`
      };
      if (this.adminAuth) {
        headers["Authorization"] = `Convex ${this.adminAuth}`;
      } else if (this.auth) {
        headers["Authorization"] = `Bearer ${this.auth}`;
      }
      const localFetch = specifiedFetch || fetch;
      const response = await localFetch(`${this.address}/api/mutation`, {
        ...this.fetchOptions,
        body,
        method: "POST",
        headers
      });
      if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
        throw new Error(await response.text());
      }
      const respJSON = await response.json();
      if (this.debug) {
        for (const line of respJSON.logLines ?? []) {
          logForFunction(this.logger, "info", "mutation", name, line);
        }
      }
      switch (respJSON.status) {
        case "success":
          return jsonToConvex(respJSON.value);
        case "error":
          if (respJSON.errorData !== void 0) {
            throw forwardErrorData(
              respJSON.errorData,
              new ConvexError(respJSON.errorMessage)
            );
          }
          throw new Error(respJSON.errorMessage);
        default:
          throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
      }
    }
    async processMutationQueue() {
      if (this.isProcessingQueue) {
        return;
      }
      this.isProcessingQueue = true;
      while (this.mutationQueue.length > 0) {
        const { mutation, args, resolve, reject } = this.mutationQueue.shift();
        try {
          const result = await this.mutationInner(mutation, args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }
      this.isProcessingQueue = false;
    }
    enqueueMutation(mutation, args) {
      return new Promise((resolve, reject) => {
        this.mutationQueue.push({ mutation, args, resolve, reject });
        void this.processMutationQueue();
      });
    }
    /**
     * Execute a Convex mutation function. Mutations are queued by default.
     *
     * @param name - The name of the mutation.
     * @param args - The arguments object for the mutation. If this is omitted,
     * the arguments will be `{}`.
     * @param options - An optional object containing
     * @returns A promise of the mutation's result.
     */
    async mutation(mutation, ...args) {
      const [fnArgs, options] = args;
      const mutationArgs = parseArgs(fnArgs);
      const queued = !options?.skipQueue;
      if (queued) {
        return await this.enqueueMutation(mutation, mutationArgs);
      } else {
        return await this.mutationInner(mutation, mutationArgs);
      }
    }
    /**
     * Execute a Convex action function. Actions are not queued.
     *
     * @param name - The name of the action.
     * @param args - The arguments object for the action. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the action's result.
     */
    async action(action, ...args) {
      const actionArgs = parseArgs(args[0]);
      const name = getFunctionName(action);
      const body = JSON.stringify({
        path: name,
        format: "convex_encoded_json",
        args: [convexToJson(actionArgs)]
      });
      const headers = {
        "Content-Type": "application/json",
        "Convex-Client": `npm-${version}`
      };
      if (this.adminAuth) {
        headers["Authorization"] = `Convex ${this.adminAuth}`;
      } else if (this.auth) {
        headers["Authorization"] = `Bearer ${this.auth}`;
      }
      const localFetch = specifiedFetch || fetch;
      const response = await localFetch(`${this.address}/api/action`, {
        ...this.fetchOptions,
        body,
        method: "POST",
        headers
      });
      if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
        throw new Error(await response.text());
      }
      const respJSON = await response.json();
      if (this.debug) {
        for (const line of respJSON.logLines ?? []) {
          logForFunction(this.logger, "info", "action", name, line);
        }
      }
      switch (respJSON.status) {
        case "success":
          return jsonToConvex(respJSON.value);
        case "error":
          if (respJSON.errorData !== void 0) {
            throw forwardErrorData(
              respJSON.errorData,
              new ConvexError(respJSON.errorMessage)
            );
          }
          throw new Error(respJSON.errorMessage);
        default:
          throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
      }
    }
    /**
     * Execute a Convex function of an unknown type. These function calls are not queued.
     *
     * @param name - The name of the function.
     * @param args - The arguments object for the function. If this is omitted,
     * the arguments will be `{}`.
     * @returns A promise of the function's result.
     *
     * @internal
     */
    async function(anyFunction, componentPath, ...args) {
      const functionArgs = parseArgs(args[0]);
      const name = typeof anyFunction === "string" ? anyFunction : getFunctionName(anyFunction);
      const body = JSON.stringify({
        componentPath,
        path: name,
        format: "convex_encoded_json",
        args: convexToJson(functionArgs)
      });
      const headers = {
        "Content-Type": "application/json",
        "Convex-Client": `npm-${version}`
      };
      if (this.adminAuth) {
        headers["Authorization"] = `Convex ${this.adminAuth}`;
      } else if (this.auth) {
        headers["Authorization"] = `Bearer ${this.auth}`;
      }
      const localFetch = specifiedFetch || fetch;
      const response = await localFetch(`${this.address}/api/function`, {
        ...this.fetchOptions,
        body,
        method: "POST",
        headers
      });
      if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
        throw new Error(await response.text());
      }
      const respJSON = await response.json();
      if (this.debug) {
        for (const line of respJSON.logLines ?? []) {
          logForFunction(this.logger, "info", "any", name, line);
        }
      }
      switch (respJSON.status) {
        case "success":
          return jsonToConvex(respJSON.value);
        case "error":
          if (respJSON.errorData !== void 0) {
            throw forwardErrorData(
              respJSON.errorData,
              new ConvexError(respJSON.errorMessage)
            );
          }
          throw new Error(respJSON.errorMessage);
        default:
          throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
      }
    }
  };
  function forwardErrorData(errorData, error) {
    error.data = jsonToConvex(errorData);
    return error;
  }
  return __toCommonJS(browser_bundle_exports);
})();
//# sourceMappingURL=browser.bundle.js.map
