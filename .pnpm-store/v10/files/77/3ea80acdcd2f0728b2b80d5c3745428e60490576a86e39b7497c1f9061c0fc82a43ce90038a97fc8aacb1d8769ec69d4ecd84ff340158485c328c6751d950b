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
var __decorateClass = (decorators, target, key, kind) => {
  for (var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target, i = decorators.length - 1, decorator; i >= 0; i--)
    (decorator = decorators[i]) && (result = (kind ? decorator(target, key, result) : decorator(result)) || result);
  return kind && result && __defProp(target, key, result), result;
};

// ../../node_modules/.pnpm/http-cache-semantics@4.1.1/node_modules/http-cache-semantics/index.js
var require_http_cache_semantics = __commonJS({
  "../../node_modules/.pnpm/http-cache-semantics@4.1.1/node_modules/http-cache-semantics/index.js"(exports, module) {
    "use strict";
    var statusCodeCacheableByDefault = /* @__PURE__ */ new Set([
      200,
      203,
      204,
      206,
      300,
      301,
      308,
      404,
      405,
      410,
      414,
      501
    ]), understoodStatuses = /* @__PURE__ */ new Set([
      200,
      203,
      204,
      300,
      301,
      302,
      303,
      307,
      308,
      404,
      405,
      410,
      414,
      501
    ]), errorStatusCodes = /* @__PURE__ */ new Set([
      500,
      502,
      503,
      504
    ]), hopByHopHeaders = {
      date: !0,
      // included, because we add Age update Date
      connection: !0,
      "keep-alive": !0,
      "proxy-authenticate": !0,
      "proxy-authorization": !0,
      te: !0,
      trailer: !0,
      "transfer-encoding": !0,
      upgrade: !0
    }, excludedFromRevalidationUpdate = {
      // Since the old body is reused, it doesn't make sense to change properties of the body
      "content-length": !0,
      "content-encoding": !0,
      "transfer-encoding": !0,
      "content-range": !0
    };
    function toNumberOrZero(s) {
      let n = parseInt(s, 10);
      return isFinite(n) ? n : 0;
    }
    function isErrorResponse(response) {
      return response ? errorStatusCodes.has(response.status) : !0;
    }
    function parseCacheControl(header) {
      let cc = {};
      if (!header) return cc;
      let parts = header.trim().split(/,/);
      for (let part of parts) {
        let [k, v] = part.split(/=/, 2);
        cc[k.trim()] = v === void 0 ? !0 : v.trim().replace(/^"|"$/g, "");
      }
      return cc;
    }
    function formatCacheControl(cc) {
      let parts = [];
      for (let k in cc) {
        let v = cc[k];
        parts.push(v === !0 ? k : k + "=" + v);
      }
      if (parts.length)
        return parts.join(", ");
    }
    module.exports = class {
      constructor(req, res, {
        shared,
        cacheHeuristic,
        immutableMinTimeToLive,
        ignoreCargoCult,
        _fromObject
      } = {}) {
        if (_fromObject) {
          this._fromObject(_fromObject);
          return;
        }
        if (!res || !res.headers)
          throw Error("Response headers missing");
        this._assertRequestHasHeaders(req), this._responseTime = this.now(), this._isShared = shared !== !1, this._cacheHeuristic = cacheHeuristic !== void 0 ? cacheHeuristic : 0.1, this._immutableMinTtl = immutableMinTimeToLive !== void 0 ? immutableMinTimeToLive : 24 * 3600 * 1e3, this._status = "status" in res ? res.status : 200, this._resHeaders = res.headers, this._rescc = parseCacheControl(res.headers["cache-control"]), this._method = "method" in req ? req.method : "GET", this._url = req.url, this._host = req.headers.host, this._noAuthorization = !req.headers.authorization, this._reqHeaders = res.headers.vary ? req.headers : null, this._reqcc = parseCacheControl(req.headers["cache-control"]), ignoreCargoCult && "pre-check" in this._rescc && "post-check" in this._rescc && (delete this._rescc["pre-check"], delete this._rescc["post-check"], delete this._rescc["no-cache"], delete this._rescc["no-store"], delete this._rescc["must-revalidate"], this._resHeaders = Object.assign({}, this._resHeaders, {
          "cache-control": formatCacheControl(this._rescc)
        }), delete this._resHeaders.expires, delete this._resHeaders.pragma), res.headers["cache-control"] == null && /no-cache/.test(res.headers.pragma) && (this._rescc["no-cache"] = !0);
      }
      now() {
        return Date.now();
      }
      storable() {
        return !!(!this._reqcc["no-store"] && // A cache MUST NOT store a response to any request, unless:
        // The request method is understood by the cache and defined as being cacheable, and
        (this._method === "GET" || this._method === "HEAD" || this._method === "POST" && this._hasExplicitExpiration()) && // the response status code is understood by the cache, and
        understoodStatuses.has(this._status) && // the "no-store" cache directive does not appear in request or response header fields, and
        !this._rescc["no-store"] && // the "private" response directive does not appear in the response, if the cache is shared, and
        (!this._isShared || !this._rescc.private) && // the Authorization header field does not appear in the request, if the cache is shared,
        (!this._isShared || this._noAuthorization || this._allowsStoringAuthenticated()) && // the response either:
        // contains an Expires header field, or
        (this._resHeaders.expires || // contains a max-age response directive, or
        // contains a s-maxage response directive and the cache is shared, or
        // contains a public response directive.
        this._rescc["max-age"] || this._isShared && this._rescc["s-maxage"] || this._rescc.public || // has a status code that is defined as cacheable by default
        statusCodeCacheableByDefault.has(this._status)));
      }
      _hasExplicitExpiration() {
        return this._isShared && this._rescc["s-maxage"] || this._rescc["max-age"] || this._resHeaders.expires;
      }
      _assertRequestHasHeaders(req) {
        if (!req || !req.headers)
          throw Error("Request headers missing");
      }
      satisfiesWithoutRevalidation(req) {
        this._assertRequestHasHeaders(req);
        let requestCC = parseCacheControl(req.headers["cache-control"]);
        return requestCC["no-cache"] || /no-cache/.test(req.headers.pragma) || requestCC["max-age"] && this.age() > requestCC["max-age"] || requestCC["min-fresh"] && this.timeToLive() < 1e3 * requestCC["min-fresh"] || this.stale() && !(requestCC["max-stale"] && !this._rescc["must-revalidate"] && (requestCC["max-stale"] === !0 || requestCC["max-stale"] > this.age() - this.maxAge())) ? !1 : this._requestMatches(req, !1);
      }
      _requestMatches(req, allowHeadMethod) {
        return (!this._url || this._url === req.url) && this._host === req.headers.host && // the request method associated with the stored response allows it to be used for the presented request, and
        (!req.method || this._method === req.method || allowHeadMethod && req.method === "HEAD") && // selecting header fields nominated by the stored response (if any) match those presented, and
        this._varyMatches(req);
      }
      _allowsStoringAuthenticated() {
        return this._rescc["must-revalidate"] || this._rescc.public || this._rescc["s-maxage"];
      }
      _varyMatches(req) {
        if (!this._resHeaders.vary)
          return !0;
        if (this._resHeaders.vary === "*")
          return !1;
        let fields = this._resHeaders.vary.trim().toLowerCase().split(/\s*,\s*/);
        for (let name of fields)
          if (req.headers[name] !== this._reqHeaders[name]) return !1;
        return !0;
      }
      _copyWithoutHopByHopHeaders(inHeaders) {
        let headers = {};
        for (let name in inHeaders)
          hopByHopHeaders[name] || (headers[name] = inHeaders[name]);
        if (inHeaders.connection) {
          let tokens = inHeaders.connection.trim().split(/\s*,\s*/);
          for (let name of tokens)
            delete headers[name];
        }
        if (headers.warning) {
          let warnings = headers.warning.split(/,/).filter((warning) => !/^\s*1[0-9][0-9]/.test(warning));
          warnings.length ? headers.warning = warnings.join(",").trim() : delete headers.warning;
        }
        return headers;
      }
      responseHeaders() {
        let headers = this._copyWithoutHopByHopHeaders(this._resHeaders), age = this.age();
        return age > 3600 * 24 && !this._hasExplicitExpiration() && this.maxAge() > 3600 * 24 && (headers.warning = (headers.warning ? `${headers.warning}, ` : "") + '113 - "rfc7234 5.5.4"'), headers.age = `${Math.round(age)}`, headers.date = new Date(this.now()).toUTCString(), headers;
      }
      /**
       * Value of the Date response header or current time if Date was invalid
       * @return timestamp
       */
      date() {
        let serverDate = Date.parse(this._resHeaders.date);
        return isFinite(serverDate) ? serverDate : this._responseTime;
      }
      /**
       * Value of the Age header, in seconds, updated for the current time.
       * May be fractional.
       *
       * @return Number
       */
      age() {
        let age = this._ageValue(), residentTime = (this.now() - this._responseTime) / 1e3;
        return age + residentTime;
      }
      _ageValue() {
        return toNumberOrZero(this._resHeaders.age);
      }
      /**
       * Value of applicable max-age (or heuristic equivalent) in seconds. This counts since response's `Date`.
       *
       * For an up-to-date value, see `timeToLive()`.
       *
       * @return Number
       */
      maxAge() {
        if (!this.storable() || this._rescc["no-cache"] || this._isShared && this._resHeaders["set-cookie"] && !this._rescc.public && !this._rescc.immutable || this._resHeaders.vary === "*")
          return 0;
        if (this._isShared) {
          if (this._rescc["proxy-revalidate"])
            return 0;
          if (this._rescc["s-maxage"])
            return toNumberOrZero(this._rescc["s-maxage"]);
        }
        if (this._rescc["max-age"])
          return toNumberOrZero(this._rescc["max-age"]);
        let defaultMinTtl = this._rescc.immutable ? this._immutableMinTtl : 0, serverDate = this.date();
        if (this._resHeaders.expires) {
          let expires = Date.parse(this._resHeaders.expires);
          return Number.isNaN(expires) || expires < serverDate ? 0 : Math.max(defaultMinTtl, (expires - serverDate) / 1e3);
        }
        if (this._resHeaders["last-modified"]) {
          let lastModified = Date.parse(this._resHeaders["last-modified"]);
          if (isFinite(lastModified) && serverDate > lastModified)
            return Math.max(
              defaultMinTtl,
              (serverDate - lastModified) / 1e3 * this._cacheHeuristic
            );
        }
        return defaultMinTtl;
      }
      timeToLive() {
        let age = this.maxAge() - this.age(), staleIfErrorAge = age + toNumberOrZero(this._rescc["stale-if-error"]), staleWhileRevalidateAge = age + toNumberOrZero(this._rescc["stale-while-revalidate"]);
        return Math.max(0, age, staleIfErrorAge, staleWhileRevalidateAge) * 1e3;
      }
      stale() {
        return this.maxAge() <= this.age();
      }
      _useStaleIfError() {
        return this.maxAge() + toNumberOrZero(this._rescc["stale-if-error"]) > this.age();
      }
      useStaleWhileRevalidate() {
        return this.maxAge() + toNumberOrZero(this._rescc["stale-while-revalidate"]) > this.age();
      }
      static fromObject(obj) {
        return new this(void 0, void 0, { _fromObject: obj });
      }
      _fromObject(obj) {
        if (this._responseTime) throw Error("Reinitialized");
        if (!obj || obj.v !== 1) throw Error("Invalid serialization");
        this._responseTime = obj.t, this._isShared = obj.sh, this._cacheHeuristic = obj.ch, this._immutableMinTtl = obj.imm !== void 0 ? obj.imm : 24 * 3600 * 1e3, this._status = obj.st, this._resHeaders = obj.resh, this._rescc = obj.rescc, this._method = obj.m, this._url = obj.u, this._host = obj.h, this._noAuthorization = obj.a, this._reqHeaders = obj.reqh, this._reqcc = obj.reqcc;
      }
      toObject() {
        return {
          v: 1,
          t: this._responseTime,
          sh: this._isShared,
          ch: this._cacheHeuristic,
          imm: this._immutableMinTtl,
          st: this._status,
          resh: this._resHeaders,
          rescc: this._rescc,
          m: this._method,
          u: this._url,
          h: this._host,
          a: this._noAuthorization,
          reqh: this._reqHeaders,
          reqcc: this._reqcc
        };
      }
      /**
       * Headers for sending to the origin server to revalidate stale response.
       * Allows server to return 304 to allow reuse of the previous response.
       *
       * Hop by hop headers are always stripped.
       * Revalidation headers may be added or removed, depending on request.
       */
      revalidationHeaders(incomingReq) {
        this._assertRequestHasHeaders(incomingReq);
        let headers = this._copyWithoutHopByHopHeaders(incomingReq.headers);
        if (delete headers["if-range"], !this._requestMatches(incomingReq, !0) || !this.storable())
          return delete headers["if-none-match"], delete headers["if-modified-since"], headers;
        if (this._resHeaders.etag && (headers["if-none-match"] = headers["if-none-match"] ? `${headers["if-none-match"]}, ${this._resHeaders.etag}` : this._resHeaders.etag), headers["accept-ranges"] || headers["if-match"] || headers["if-unmodified-since"] || this._method && this._method != "GET") {
          if (delete headers["if-modified-since"], headers["if-none-match"]) {
            let etags = headers["if-none-match"].split(/,/).filter((etag) => !/^\s*W\//.test(etag));
            etags.length ? headers["if-none-match"] = etags.join(",").trim() : delete headers["if-none-match"];
          }
        } else this._resHeaders["last-modified"] && !headers["if-modified-since"] && (headers["if-modified-since"] = this._resHeaders["last-modified"]);
        return headers;
      }
      /**
       * Creates new CachePolicy with information combined from the previews response,
       * and the new revalidation response.
       *
       * Returns {policy, modified} where modified is a boolean indicating
       * whether the response body has been modified, and old cached body can't be used.
       *
       * @return {Object} {policy: CachePolicy, modified: Boolean}
       */
      revalidatedPolicy(request, response) {
        if (this._assertRequestHasHeaders(request), this._useStaleIfError() && isErrorResponse(response))
          return {
            modified: !1,
            matches: !1,
            policy: this
          };
        if (!response || !response.headers)
          throw Error("Response headers missing");
        let matches = !1;
        if (response.status !== void 0 && response.status != 304 ? matches = !1 : response.headers.etag && !/^\s*W\//.test(response.headers.etag) ? matches = this._resHeaders.etag && this._resHeaders.etag.replace(/^\s*W\//, "") === response.headers.etag : this._resHeaders.etag && response.headers.etag ? matches = this._resHeaders.etag.replace(/^\s*W\//, "") === response.headers.etag.replace(/^\s*W\//, "") : this._resHeaders["last-modified"] ? matches = this._resHeaders["last-modified"] === response.headers["last-modified"] : !this._resHeaders.etag && !this._resHeaders["last-modified"] && !response.headers.etag && !response.headers["last-modified"] && (matches = !0), !matches)
          return {
            policy: new this.constructor(request, response),
            // Client receiving 304 without body, even if it's invalid/mismatched has no option
            // but to reuse a cached body. We don't have a good way to tell clients to do
            // error recovery in such case.
            modified: response.status != 304,
            matches: !1
          };
        let headers = {};
        for (let k in this._resHeaders)
          headers[k] = k in response.headers && !excludedFromRevalidationUpdate[k] ? response.headers[k] : this._resHeaders[k];
        let newResponse = Object.assign({}, response, {
          status: this._status,
          method: this._method,
          headers
        });
        return {
          policy: new this.constructor(request, newResponse, {
            shared: this._isShared,
            cacheHeuristic: this._cacheHeuristic,
            immutableMinTimeToLive: this._immutableMinTtl
          }),
          modified: !1,
          matches: !0
        };
      }
    };
  }
});

// src/workers/cache/cache.worker.ts
var import_http_cache_semantics = __toESM(require_http_cache_semantics());
import assert from "node:assert";
import { Buffer as Buffer2 } from "node:buffer";
import {
  DeferredPromise,
  GET,
  KeyValueStorage,
  LogLevel,
  MiniflareDurableObject,
  parseRanges,
  PURGE,
  PUT
} from "miniflare:shared";

// src/workers/kv/constants.ts
import { testRegExps } from "miniflare:shared";
var KVLimits = {
  MIN_CACHE_TTL: 60,
  MAX_LIST_KEYS: 1e3,
  MAX_KEY_SIZE: 512,
  MAX_VALUE_SIZE: 25 * 1024 * 1024,
  MAX_VALUE_SIZE_TEST: 1024,
  MAX_METADATA_SIZE: 1024,
  MAX_BULK_SIZE: 25 * 1024 * 1024
};
var SITES_NO_CACHE_PREFIX = "$__MINIFLARE_SITES__$/";
function isSitesRequest(request) {
  return new URL(request.url).pathname.startsWith(`/${SITES_NO_CACHE_PREFIX}`);
}

// src/workers/cache/errors.worker.ts
import { HttpError } from "miniflare:shared";

// src/workers/cache/constants.ts
var CacheHeaders = {
  NAMESPACE: "cf-cache-namespace",
  STATUS: "cf-cache-status"
};

// src/workers/cache/errors.worker.ts
var CacheError = class extends HttpError {
  constructor(code, message, headers = []) {
    super(code, message);
    this.headers = headers;
  }
  toResponse() {
    return new Response(null, {
      status: this.code,
      headers: this.headers
    });
  }
  context(info) {
    return this.message += ` (${info})`, this;
  }
}, StorageFailure = class extends CacheError {
  constructor() {
    super(413, "Cache storage failed");
  }
}, PurgeFailure = class extends CacheError {
  constructor() {
    super(404, "Couldn't find asset to purge");
  }
}, CacheMiss = class extends CacheError {
  constructor() {
    super(
      // workerd ignores this, but it's the correct status code
      504,
      "Asset not found in cache",
      [[CacheHeaders.STATUS, "MISS"]]
    );
  }
}, RangeNotSatisfiable = class extends CacheError {
  constructor(size) {
    super(416, "Range not satisfiable", [
      ["Content-Range", `bytes */${size}`],
      [CacheHeaders.STATUS, "HIT"]
    ]);
  }
};

// src/workers/cache/cache.worker.ts
function getCacheKey(req) {
  return req.cf?.cacheKey ? String(req.cf?.cacheKey) : req.url;
}
function getExpiration(timers, req, res) {
  let reqHeaders = normaliseHeaders(req.headers);
  delete reqHeaders["cache-control"];
  let resHeaders = normaliseHeaders(res.headers);
  resHeaders["cache-control"]?.toLowerCase().includes("private=set-cookie") && (resHeaders["cache-control"] = resHeaders["cache-control"]?.toLowerCase().replace(/private=set-cookie;?/i, ""), delete resHeaders["set-cookie"]);
  let cacheReq = {
    url: req.url,
    // If a request gets to the Cache service, it's method will be GET. See README.md for details
    method: "GET",
    headers: reqHeaders
  }, cacheRes = {
    status: res.status,
    headers: resHeaders
  }, originalNow = import_http_cache_semantics.default.prototype.now;
  import_http_cache_semantics.default.prototype.now = timers.now;
  try {
    let policy = new import_http_cache_semantics.default(cacheReq, cacheRes, { shared: !0 });
    return {
      // Check if the request & response is cacheable
      storable: policy.storable() && !("set-cookie" in resHeaders),
      expiration: policy.timeToLive(),
      // Cache Policy Headers is typed as [header: string]: string | string[] | undefined
      // It's safe to ignore the undefined here, which is what casting to HeadersInit does
      headers: policy.responseHeaders()
    };
  } finally {
    import_http_cache_semantics.default.prototype.now = originalNow;
  }
}
function normaliseHeaders(headers) {
  let result = {};
  for (let [key, value] of headers) result[key.toLowerCase()] = value;
  return result;
}
var etagRegexp = /^(W\/)?"(.+)"$/;
function parseETag(value) {
  return etagRegexp.exec(value.trim())?.[2] ?? void 0;
}
var utcDateRegexp = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d\d (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d\d\d\d \d\d:\d\d:\d\d GMT$/;
function parseUTCDate(value) {
  return utcDateRegexp.test(value) ? Date.parse(value) : NaN;
}
function getMatchResponse(reqHeaders, res) {
  let reqIfNoneMatchHeader = reqHeaders.get("If-None-Match"), resETagHeader = res.headers.get("ETag");
  if (reqIfNoneMatchHeader !== null && resETagHeader !== null) {
    let resETag = parseETag(resETagHeader);
    if (resETag !== void 0) {
      if (reqIfNoneMatchHeader.trim() === "*")
        return new Response(null, { status: 304, headers: res.headers });
      for (let reqIfNoneMatch of reqIfNoneMatchHeader.split(","))
        if (resETag === parseETag(reqIfNoneMatch))
          return new Response(null, { status: 304, headers: res.headers });
    }
  }
  let reqIfModifiedSinceHeader = reqHeaders.get("If-Modified-Since"), resLastModifiedHeader = res.headers.get("Last-Modified");
  if (reqIfModifiedSinceHeader !== null && resLastModifiedHeader !== null) {
    let reqIfModifiedSince = parseUTCDate(reqIfModifiedSinceHeader);
    if (parseUTCDate(resLastModifiedHeader) <= reqIfModifiedSince)
      return new Response(null, { status: 304, headers: res.headers });
  }
  if (res.ranges.length > 0)
    if (res.status = 206, res.ranges.length > 1)
      assert(!(res.body instanceof ReadableStream)), res.headers.set("Content-Type", res.body.multipartContentType);
    else {
      let { start, end } = res.ranges[0];
      res.headers.set(
        "Content-Range",
        `bytes ${start}-${end}/${res.totalSize}`
      ), res.headers.set("Content-Length", `${end - start + 1}`);
    }
  return res.body instanceof ReadableStream || (res.body = res.body.body), new Response(res.body, { status: res.status, headers: res.headers });
}
var CR = 13, LF = 10, STATUS_REGEXP = /^HTTP\/\d(?:\.\d)? (?<rawStatusCode>\d+) (?<statusText>.*)$/;
async function parseHttpResponse(stream) {
  let buffer = Buffer2.alloc(0), blankLineIndex = -1;
  for await (let chunk of stream.values({ preventCancel: !0 }))
    if (buffer = Buffer2.concat([buffer, chunk]), blankLineIndex = buffer.findIndex(
      (_value, index) => buffer[index] === CR && buffer[index + 1] === LF && buffer[index + 2] === CR && buffer[index + 3] === LF
    ), blankLineIndex !== -1) break;
  assert(blankLineIndex !== -1, "Expected to find blank line in HTTP message");
  let rawStatusHeaders = buffer.subarray(0, blankLineIndex).toString(), [rawStatus, ...rawHeaders] = rawStatusHeaders.split(`\r
`), statusMatch = rawStatus.match(STATUS_REGEXP);
  assert(
    statusMatch?.groups != null,
    `Expected first line ${JSON.stringify(rawStatus)} to be HTTP status line`
  );
  let { rawStatusCode, statusText } = statusMatch.groups, statusCode = parseInt(rawStatusCode), headers = rawHeaders.map((rawHeader) => {
    let index = rawHeader.indexOf(":");
    return [
      rawHeader.substring(0, index),
      rawHeader.substring(index + 1).trim()
    ];
  }), prefix = buffer.subarray(
    blankLineIndex + 4
    /* "\r\n\r\n" */
  ), { readable, writable } = new IdentityTransformStream(), writer = writable.getWriter();
  return writer.write(prefix).then(() => (writer.releaseLock(), stream.pipeTo(writable))).catch((e) => console.error("Error writing HTTP body:", e)), new Response(readable, { status: statusCode, statusText, headers });
}
var SizingStream = class extends TransformStream {
  size;
  constructor() {
    let sizePromise = new DeferredPromise(), size = 0;
    super({
      transform(chunk, controller) {
        size += chunk.byteLength, controller.enqueue(chunk);
      },
      flush() {
        sizePromise.resolve(size);
      }
    }), this.size = sizePromise;
  }
}, CacheObject = class extends MiniflareDurableObject {
  #warnedUsage = !1;
  async #maybeWarnUsage(request) {
    !this.#warnedUsage && request.cf?.miniflare?.cacheWarnUsage === !0 && (this.#warnedUsage = !0, await this.logWithLevel(
      LogLevel.WARN,
      "Cache operations will have no impact if you deploy to a workers.dev subdomain!"
    ));
  }
  #storage;
  get storage() {
    return this.#storage ??= new KeyValueStorage(this);
  }
  match = async (req) => {
    await this.#maybeWarnUsage(req);
    let cacheKey = getCacheKey(req);
    if (isSitesRequest(req)) throw new CacheMiss();
    let resHeaders, resRanges, cached = await this.storage.get(cacheKey, ({ size, headers }) => {
      resHeaders = new Headers(headers);
      let contentType = resHeaders.get("Content-Type"), rangeHeader = req.headers.get("Range");
      if (rangeHeader !== null && (resRanges = parseRanges(rangeHeader, size), resRanges === void 0))
        throw new RangeNotSatisfiable(size);
      return {
        ranges: resRanges,
        contentLength: size,
        contentType: contentType ?? void 0
      };
    });
    if (cached?.metadata === void 0) throw new CacheMiss();
    return assert(resHeaders !== void 0), resHeaders.set("CF-Cache-Status", "HIT"), resRanges ??= [], getMatchResponse(req.headers, {
      status: cached.metadata.status,
      headers: resHeaders,
      ranges: resRanges,
      body: cached.value,
      totalSize: cached.metadata.size
    });
  };
  put = async (req) => {
    await this.#maybeWarnUsage(req);
    let cacheKey = getCacheKey(req);
    if (isSitesRequest(req)) throw new CacheMiss();
    assert(req.body !== null);
    let res = await parseHttpResponse(req.body), body = res.body;
    assert(body !== null);
    let { storable, expiration, headers } = getExpiration(
      this.timers,
      req,
      res
    );
    if (!storable) {
      try {
        await body.pipeTo(new WritableStream());
      } catch {
      }
      throw new StorageFailure();
    }
    let contentLength = parseInt(res.headers.get("Content-Length")), sizePromise;
    if (Number.isNaN(contentLength)) {
      let stream = new SizingStream();
      body = body.pipeThrough(stream), sizePromise = stream.size;
    } else
      sizePromise = Promise.resolve(contentLength);
    let metadata = sizePromise.then((size) => ({
      headers: Object.entries(headers),
      status: res.status,
      size
    }));
    return await this.storage.put({
      key: cacheKey,
      value: body,
      expiration: this.timers.now() + expiration,
      metadata
    }), new Response(null, { status: 204 });
  };
  delete = async (req) => {
    await this.#maybeWarnUsage(req);
    let cacheKey = getCacheKey(req);
    if (!await this.storage.delete(cacheKey)) throw new PurgeFailure();
    return new Response(null);
  };
};
__decorateClass([
  GET()
], CacheObject.prototype, "match", 2), __decorateClass([
  PUT()
], CacheObject.prototype, "put", 2), __decorateClass([
  PURGE()
], CacheObject.prototype, "delete", 2);
export {
  CacheObject,
  parseHttpResponse
};
//# sourceMappingURL=cache.worker.js.map
