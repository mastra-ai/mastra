"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  EndpointCache: () => EndpointCache
});
module.exports = __toCommonJS(index_exports);

// src/EndpointCache.ts
var import_lru_cache = __toESM(require("mnemonist/lru-cache"));
var EndpointCache = class {
  static {
    __name(this, "EndpointCache");
  }
  cache;
  constructor(capacity) {
    this.cache = new import_lru_cache.default(capacity);
  }
  /**
   * Returns an un-expired endpoint for the given key.
   *
   * @param endpointsWithExpiry
   * @returns
   */
  getEndpoint(key) {
    const endpointsWithExpiry = this.get(key);
    if (!endpointsWithExpiry || endpointsWithExpiry.length === 0) {
      return void 0;
    }
    const endpoints = endpointsWithExpiry.map((endpoint) => endpoint.Address);
    return endpoints[Math.floor(Math.random() * endpoints.length)];
  }
  /**
   * Returns un-expired endpoints for the given key.
   *
   * @param key
   * @returns
   */
  get(key) {
    if (!this.has(key)) {
      return;
    }
    const value = this.cache.get(key);
    if (!value) {
      return;
    }
    const now = Date.now();
    const endpointsWithExpiry = value.filter((endpoint) => now < endpoint.Expires);
    if (endpointsWithExpiry.length === 0) {
      this.delete(key);
      return void 0;
    }
    return endpointsWithExpiry;
  }
  /**
   * Stores the endpoints passed for the key in cache.
   * If not defined, uses empty string for the Address in endpoint.
   * If not defined, uses one minute for CachePeriodInMinutes in endpoint.
   * Stores milliseconds elapsed since the UNIX epoch in Expires param based
   * on value provided in CachePeriodInMinutes.
   *
   * @param key
   * @param endpoints
   */
  set(key, endpoints) {
    const now = Date.now();
    this.cache.set(
      key,
      endpoints.map(({ Address, CachePeriodInMinutes }) => ({
        Address,
        Expires: now + CachePeriodInMinutes * 60 * 1e3
      }))
    );
  }
  /**
   * Deletes the value for the given key in the cache.
   *
   * @param {string} key
   */
  delete(key) {
    this.cache.set(key, []);
  }
  /**
   * Checks whether the key exists in cache.
   *
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    if (!this.cache.has(key)) {
      return false;
    }
    const endpoints = this.cache.peek(key);
    if (!endpoints) {
      return false;
    }
    return endpoints.length > 0;
  }
  /**
   * Clears the cache.
   */
  clear() {
    this.cache.clear();
  }
};
// Annotate the CommonJS export names for ESM import in node:

0 && (module.exports = {
  EndpointCache
});

