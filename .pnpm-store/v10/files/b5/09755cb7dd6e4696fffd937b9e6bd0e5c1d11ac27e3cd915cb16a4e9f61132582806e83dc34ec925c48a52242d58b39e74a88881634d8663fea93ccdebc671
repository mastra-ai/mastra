var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/helpers.ts
var helpers_exports = {};
__export(helpers_exports, {
  htmlEscape: () => htmlEscape,
  tokenizeArray: () => tokenizeArray,
  tokenizeObject: () => tokenizeObject,
  tokenizePrototype: () => tokenizePrototype,
  wordWrap: () => wordWrap
});
import is from "@sindresorhus/is";
var ObjectPrototype = Object.prototype;
var ArrayPrototype = Array.prototype;
var ObjectPrototypeKeys = Reflect.ownKeys(ObjectPrototype);
var ArrayPrototypeKeys = Reflect.ownKeys(ArrayPrototype);
function tokenizeObject(value, parser, config) {
  parser.context.objectsSeen = parser.context.objectsSeen ?? /* @__PURE__ */ new Set();
  parser.context.depth = parser.context.depth ?? 0;
  if (parser.context.objectsSeen.has(value)) {
    parser.collect({ type: "object-circular-ref" });
    return;
  }
  if (parser.context.depth >= parser.config.depth) {
    parser.collect({ type: "object-max-depth-ref" });
    return;
  }
  const showHidden = config.showHidden;
  const name = config.constructorName ?? Object.getPrototypeOf(value)?.constructor.name ?? null;
  if (config.collapse.includes(name)) {
    parser.collect({
      type: "collapse",
      name,
      token: {
        type: "object-start",
        constructorName: name
      }
    });
    return;
  }
  const ownKeys = Reflect.ownKeys(value);
  const eagerGetters = config.eagerGetters ?? [];
  parser.context.depth++;
  parser.context.objectsSeen.add(value);
  let keys = [];
  if (config.membersToIgnore) {
    const keysSet = /* @__PURE__ */ new Set([...ownKeys]);
    config.membersToIgnore.forEach((m) => keysSet.delete(m));
    keys = Array.from(keysSet);
  } else {
    keys = ownKeys;
  }
  parser.collect({ type: "object-start", constructorName: name });
  for (let key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) {
      continue;
    }
    if (!descriptor.enumerable && !showHidden) {
      continue;
    }
    const isSymbol = typeof key === "symbol";
    const isWritable = !!descriptor.set || !!descriptor.writable;
    parser.collect({
      type: "object-key",
      isSymbol,
      isWritable,
      value: String(key)
    });
    if ("get" in descriptor && !eagerGetters.includes(key)) {
      parser.collect({ type: "object-value-getter" });
      continue;
    }
    parser.collect({ type: "object-value-start" });
    parser.parse(value[key]);
    parser.collect({ type: "object-value-end" });
  }
  if (config.inspectObjectPrototype === true) {
    tokenizePrototype(value, parser, {
      membersToIgnore: ObjectPrototypeKeys
    });
  } else if (config.inspectObjectPrototype === "unless-plain-object" && !is.plainObject(value)) {
    tokenizePrototype(value, parser, {
      membersToIgnore: ObjectPrototypeKeys,
      prototypeToIgnore: ObjectPrototype
    });
  }
  parser.collect({ type: "object-end" });
  parser.context.depth--;
  parser.context.objectsSeen.delete(value);
}
function tokenizePrototype(value, parser, config) {
  const prototypeChain = [];
  for (let proto = Object.getPrototypeOf(value); proto && (!config.prototypeToIgnore || proto !== config.prototypeToIgnore); proto = Object.getPrototypeOf(proto)) {
    let keys = Reflect.ownKeys(proto);
    if (config.membersToIgnore) {
      const keysSet = /* @__PURE__ */ new Set([...keys]);
      config.membersToIgnore.forEach((m) => keysSet.delete(m));
      keys = Array.from(keysSet);
    }
    prototypeChain.push({ proto, keys });
  }
  if (!prototypeChain.length) {
    return;
  }
  const eagerGetters = config.eagerGetters ?? [];
  parser.collect({ type: "prototype-start" });
  for (let proto of prototypeChain) {
    for (let key of proto.keys) {
      if (key === "constructor") {
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(proto.proto, key);
      if (!descriptor) {
        continue;
      }
      const isSymbol = typeof key === "symbol";
      const isWritable = !!descriptor.set || !!descriptor.writable;
      parser.collect({
        type: "object-key",
        isSymbol,
        isWritable,
        value: String(key)
      });
      if ("get" in descriptor && !eagerGetters.includes(key)) {
        parser.collect({ type: "object-value-getter" });
        continue;
      }
      parser.collect({ type: "object-value-start" });
      parser.parse(value[key]);
      parser.collect({ type: "object-value-end" });
    }
  }
  parser.collect({ type: "prototype-end" });
}
function tokenizeArray(values, parser, config) {
  parser.context.arraysSeen = parser.context.arraysSeen ?? /* @__PURE__ */ new Set();
  parser.context.depth = parser.context.depth ?? 0;
  if (parser.context.arraysSeen.has(values)) {
    parser.collect({ type: "array-circular-ref" });
    return;
  }
  if (parser.context.depth >= config.depth) {
    parser.collect({ type: "array-max-depth-ref" });
    return;
  }
  const limit = config.maxArrayLength;
  const size = values.length;
  const name = config.name || values.constructor.name;
  if (config.collapse.includes(name)) {
    parser.collect({
      type: "collapse",
      name,
      token: {
        type: "array-start",
        name,
        size
      }
    });
    return;
  }
  parser.context.depth++;
  parser.context.arraysSeen.add(values);
  parser.collect({ type: "array-start", name, size });
  for (let index = 0; index < size; index++) {
    if (index >= limit) {
      parser.collect({ type: "array-max-length-ref", limit, size });
      break;
    }
    const value = values[index];
    if (Object.hasOwn(values, index)) {
      parser.collect({ type: "array-value-start", index });
      parser.parse(value);
      parser.collect({ type: "array-value-end", index });
    } else {
      parser.collect({ type: "array-value-hole", index });
    }
  }
  if (config.inspectArrayPrototype) {
    tokenizePrototype(values, parser, {
      membersToIgnore: ArrayPrototypeKeys,
      prototypeToIgnore: ArrayPrototype
    });
  }
  parser.collect({ type: "array-end", size });
  parser.context.depth--;
  parser.context.arraysSeen.delete(values);
}
function htmlEscape(value) {
  return value.replace(/&/g, "&amp;").replace(/\\"/g, "&bsol;&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function wordWrap(value, options) {
  const width = options.width;
  const indent = options.indent;
  const newLine = `${options.newLine}${indent}`;
  let regexString = ".{1," + width + "}";
  regexString += "([\\s\u200B]+|$)|[^\\s\u200B]+?([\\s\u200B]+|$)";
  const re = new RegExp(regexString, "g");
  const lines = value.match(re) || [];
  const result = lines.map(function(line) {
    if (line.slice(-1) === "\n") {
      line = line.slice(0, line.length - 1);
    }
    return options.escape ? options.escape(line) : htmlEscape(line);
  }).join(newLine);
  return result;
}

// src/tokenizers/main.ts
import { inspect } from "util";
import is2 from "@sindresorhus/is";
var tokenizers = {
  /**
   * Tokenizes an object and its properties.
   *  - Enable "showHidden" option to parse non-enumerable
   *  - Enable "inspectObjectPrototype" to parse prototype members
   */
  Object: (value, parser) => {
    tokenizeObject(value, parser, parser.config);
  },
  /**
   * Tokenizes an array of values
   */
  Array: (values, parser) => {
    tokenizeArray(values, parser, parser.config);
  },
  /**
   * Tokenizes keys and values inside a map
   */
  Map: (values, parser) => {
    parser.context.mapsSeen = parser.context.mapsSeen ?? /* @__PURE__ */ new Set();
    parser.context.depth = parser.context.depth ?? 0;
    if (parser.context.mapsSeen.has(values)) {
      parser.collect({ type: "map-circular-ref" });
      return;
    }
    if (parser.context.depth >= parser.config.depth) {
      parser.collect({ type: "map-max-depth-ref" });
      return;
    }
    parser.context.depth++;
    parser.context.mapsSeen.add(values);
    let index = 0;
    const size = values.size;
    const limit = parser.config.maxArrayLength;
    parser.collect({ type: "map-start", size });
    for (let [key, value] of values) {
      if (index >= limit) {
        parser.collect({ type: "map-max-length-ref", limit, size });
        break;
      }
      parser.collect({ type: "map-row-start", index });
      parser.collect({ type: "map-key-start", index });
      parser.parse(key);
      parser.collect({ type: "map-key-end", index });
      parser.collect({ type: "map-value-start", index });
      parser.parse(value);
      parser.collect({ type: "map-value-end", index });
      parser.collect({ type: "map-row-end", index });
      index++;
    }
    parser.collect({ type: "map-end", size });
    parser.context.depth--;
    parser.context.mapsSeen.delete(values);
  },
  /**
   * Tokenizes values inside a set
   */
  Set: (values, parser) => {
    parser.context.setsSeen = parser.context.setsSeen ?? /* @__PURE__ */ new Set();
    parser.context.depth = parser.context.depth ?? 0;
    if (parser.context.setsSeen.has(values)) {
      parser.collect({ type: "set-circular-ref" });
      return;
    }
    if (parser.context.depth >= parser.config.depth) {
      parser.collect({ type: "set-max-depth-ref" });
      return;
    }
    parser.context.depth++;
    parser.context.setsSeen.add(values);
    let index = 0;
    const size = values.size;
    const limit = parser.config.maxArrayLength;
    parser.collect({ type: "set-start", size });
    for (let value of values) {
      if (index >= limit) {
        parser.collect({ type: "set-max-length-ref", limit, size });
        break;
      }
      parser.collect({ type: "set-value-start", index });
      parser.parse(value);
      parser.collect({ type: "set-value-end", index });
      index++;
    }
    parser.collect({ type: "set-end", size });
    parser.context.depth--;
    parser.context.setsSeen.delete(values);
  },
  /**
   * Tokenizes a function. If the function is a class created
   * using the [class] keyword, we will process its static
   * members when "config.inspectClassConstructor"
   * is enabled
   */
  Function: (value, parser) => {
    const ConstructorName = value.constructor.name;
    if (ConstructorName === "GeneratorFunction") {
      return tokenizers.GeneratorFunction(value, parser);
    }
    if (ConstructorName === "AsyncGeneratorFunction") {
      return tokenizers.AsyncGeneratorFunction(value, parser);
    }
    if (ConstructorName === "AsyncFunction") {
      return tokenizers.AsyncFunction(value, parser);
    }
    const isClass = is2.class(value);
    parser.collect({
      type: "function",
      isClass,
      isAsync: false,
      isGenerator: false,
      name: value.name || "anonymous"
    });
    if (parser.config.inspectStaticMembers && isClass) {
      parser.collect({ type: "static-members-start" });
      tokenizeObject(value, parser, {
        showHidden: true,
        depth: parser.config.depth,
        inspectObjectPrototype: false,
        collapse: parser.config.collapse,
        membersToIgnore: ["prototype", "name", "length"]
      });
      parser.collect({ type: "static-members-end" });
    }
  },
  /**
   * Tokenizes a string value and handles max length and
   * correct quotes via the "util.inspect" method.
   */
  string: (value, parser) => {
    const formatted = inspect(value, {
      maxStringLength: parser.config.maxStringLength,
      customInspect: false
    });
    parser.collect({ type: "string", value: formatted });
  },
  /**
   * Tokenizes the URL instance as an object
   */
  URL: (value, parser) => {
    tokenizeObject(
      {
        hash: value.hash,
        host: value.host,
        hostname: value.hostname,
        href: value.href,
        origin: value.origin,
        password: value.password,
        pathname: value.pathname,
        port: value.port,
        protocol: value.protocol,
        search: value.search,
        searchParams: value.searchParams,
        username: value.username
      },
      parser,
      { constructorName: "URL", ...parser.config }
    );
  },
  /**
   * Tokenizes the URLSearchParams instance as an object
   */
  URLSearchParams: (value, parser) => {
    tokenizeObject(Object.fromEntries(value), parser, {
      constructorName: "URLSearchParams",
      ...parser.config
    });
  },
  Error: function(value, parser) {
    tokenizeObject(value, parser, {
      eagerGetters: ["message", "stack"],
      ...parser.config,
      inspectObjectPrototype: parser.config.inspectObjectPrototype === true ? true : false,
      showHidden: true
    });
  },
  FormData: function(value, parser) {
    tokenizeObject(Object.fromEntries(value.entries()), parser, {
      constructorName: "FormData",
      ...parser.config
    });
  },
  /**
   * Straight forward one's
   */
  undefined: (_, parser) => {
    parser.collect({ type: "undefined" });
  },
  null: (_, parser) => {
    parser.collect({ type: "null" });
  },
  symbol: (value, parser) => {
    parser.collect({ type: "symbol", value: String(value) });
  },
  number: (value, parser) => {
    parser.collect({ type: "number", value });
  },
  boolean: (value, parser) => {
    parser.collect({ type: "boolean", value });
  },
  bigint: (value, parser) => {
    parser.collect({ type: "bigInt", value: `${value.toString()}n` });
  },
  Date: (value, parser) => {
    parser.collect({ type: "date", value: value.toISOString() });
  },
  RegExp: (value, parser) => {
    parser.collect({ type: "regexp", value: String(value) });
  },
  Buffer: (value, parser) => {
    parser.collect({
      type: "buffer",
      value: inspect(value)
    });
  },
  WeakSet: (_, parser) => {
    parser.collect({ type: "weak-set" });
  },
  WeakMap: (_, parser) => {
    parser.collect({ type: "weak-map" });
  },
  WeakRef: function(_, parser) {
    parser.collect({ type: "weak-ref" });
  },
  Generator: function(_, parser) {
    parser.collect({ type: "generator", isAsync: false });
  },
  AsyncGenerator: function(_, parser) {
    parser.collect({ type: "generator", isAsync: true });
  },
  GeneratorFunction: function(value, parser) {
    parser.collect({
      type: "function",
      isGenerator: true,
      isClass: false,
      isAsync: false,
      name: value.name || "anonymous"
    });
  },
  AsyncGeneratorFunction: function(value, parser) {
    parser.collect({
      type: "function",
      isGenerator: true,
      isClass: false,
      isAsync: true,
      name: value.name || "anonymous"
    });
  },
  AsyncFunction: function(value, parser) {
    parser.collect({
      type: "function",
      isGenerator: false,
      isClass: false,
      isAsync: true,
      name: value.name || "anonymous"
    });
  },
  Observable: function(_, parser) {
    parser.collect({ type: "observable" });
  },
  Blob: function(value, parser) {
    parser.collect({ type: "blob", size: value.size, contentType: value.type });
  },
  Promise: function(value, parser) {
    parser.collect({
      type: "promise",
      isFulfilled: !inspect(value).includes("pending")
    });
  },
  NaN: function(_, parser) {
    parser.collect({ type: "number", value: Number.NaN });
  },
  Int8Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  },
  Uint8Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  },
  Int16Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  },
  Uint16Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  },
  Int32Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  },
  Uint32Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  },
  Float32Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  },
  Float64Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  },
  BigInt64Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  },
  BigUint64Array: function(value, parser) {
    tokenizeArray(value, parser, parser.config);
  }
};

// src/parser.ts
import is3 from "@sindresorhus/is";
var Parser = class {
  #tokens = [];
  /**
   * Config shared with tokenizers
   */
  config;
  /**
   * Context maintained through out the parsing phase.
   * Each instance of Parser has its own context
   * that gets mutated internally.
   */
  context;
  constructor(config, context) {
    this.context = context || {};
    this.config = Object.freeze({
      showHidden: false,
      depth: 5,
      inspectObjectPrototype: "unless-plain-object",
      inspectArrayPrototype: false,
      inspectStaticMembers: false,
      maxArrayLength: 100,
      maxStringLength: 1e3,
      collapse: [],
      ...config
    });
  }
  /**
   * Normalizes the type name of a property using additional
   * bit of checks. For example, the "is" module does not
   * use instanceOf checks and hence misses out on many
   * potentional improvements.
   */
  #normalizeTypeName(name, value) {
    if (name === "Object" && value instanceof Error) {
      return "Error";
    }
    return name;
  }
  /**
   * Collect a token inside the list of tokens. The order
   * of tokens matter during printing therefore you must
   * collect tokens in the right order.
   */
  collect(token) {
    this.#tokens.push(token);
  }
  /**
   * Parses a value using the tokenizers. Under the hood the
   * tokenizers will call "parser.collect" to collect
   * tokens inside an array.
   *
   * You can use "parser.flush" method to get the list of
   * tokens.
   */
  parse(value) {
    const typeName = this.#normalizeTypeName(is3.detect(value), value);
    const tokenizer = tokenizers[typeName];
    if (tokenizer) {
      tokenizer(value, this);
    } else {
      this.collect({ type: "unknown", jsType: typeName, value });
    }
  }
  /**
   * Returns collected tokens and resets the internal state.
   */
  flush() {
    const tokens = this.#tokens;
    this.#tokens = [];
    this.context = {};
    return tokens;
  }
};

export {
  htmlEscape,
  wordWrap,
  helpers_exports,
  tokenizers,
  Parser
};
