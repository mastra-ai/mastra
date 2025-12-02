var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  for (var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target, i = decorators.length - 1, decorator; i >= 0; i--)
    (decorator = decorators[i]) && (result = (kind ? decorator(target, key, result) : decorator(result)) || result);
  return kind && result && __defProp(target, key, result), result;
};

// src/workers/kv/namespace.worker.ts
import assert from "node:assert";
import {
  DeferredPromise,
  DELETE,
  GET,
  HttpError as HttpError2,
  KeyValueStorage,
  maybeApply,
  MiniflareDurableObject,
  POST,
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
}, KVParams = {
  URL_ENCODED: "urlencoded",
  CACHE_TTL: "cache_ttl",
  EXPIRATION: "expiration",
  EXPIRATION_TTL: "expiration_ttl",
  LIST_LIMIT: "key_count_limit",
  LIST_PREFIX: "prefix",
  LIST_CURSOR: "cursor"
}, KVHeaders = {
  EXPIRATION: "CF-Expiration",
  METADATA: "CF-KV-Metadata"
};
var MAX_BULK_GET_KEYS = 100;

// src/workers/kv/validator.worker.ts
import { Buffer as Buffer2 } from "node:buffer";
import { HttpError } from "miniflare:shared";
function decodeKey({ key }, query) {
  if (query.get(KVParams.URL_ENCODED)?.toLowerCase() !== "true") return key;
  try {
    return decodeURIComponent(key);
  } catch (e) {
    throw e instanceof URIError ? new HttpError(400, "Could not URL-decode key name") : e;
  }
}
function validateKey(key) {
  if (key === "")
    throw new HttpError(400, "Key names must not be empty");
  if (key === "." || key === "..")
    throw new HttpError(
      400,
      `Illegal key name "${key}". Please use a different name.`
    );
  validateKeyLength(key);
}
function validateKeyLength(key) {
  let keyLength = Buffer2.byteLength(key);
  if (keyLength > KVLimits.MAX_KEY_SIZE)
    throw new HttpError(
      414,
      `UTF-8 encoded length of ${keyLength} exceeds key length limit of ${KVLimits.MAX_KEY_SIZE}.`
    );
}
function validateGetOptions(key, options) {
  validateKey(key);
  let cacheTtl = options?.cacheTtl;
  if (cacheTtl !== void 0 && (isNaN(cacheTtl) || cacheTtl < KVLimits.MIN_CACHE_TTL))
    throw new HttpError(
      400,
      `Invalid ${KVParams.CACHE_TTL} of ${cacheTtl}. Cache TTL must be at least ${KVLimits.MIN_CACHE_TTL}.`
    );
}
function validatePutOptions(key, options) {
  let { now, rawExpiration, rawExpirationTtl, rawMetadata } = options;
  validateKey(key);
  let expiration;
  if (rawExpirationTtl !== null) {
    let expirationTtl = parseInt(rawExpirationTtl);
    if (Number.isNaN(expirationTtl) || expirationTtl <= 0)
      throw new HttpError(
        400,
        `Invalid ${KVParams.EXPIRATION_TTL} of ${rawExpirationTtl}. Please specify integer greater than 0.`
      );
    if (expirationTtl < KVLimits.MIN_CACHE_TTL)
      throw new HttpError(
        400,
        `Invalid ${KVParams.EXPIRATION_TTL} of ${rawExpirationTtl}. Expiration TTL must be at least ${KVLimits.MIN_CACHE_TTL}.`
      );
    expiration = now + expirationTtl;
  } else if (rawExpiration !== null) {
    if (expiration = parseInt(rawExpiration), Number.isNaN(expiration) || expiration <= now)
      throw new HttpError(
        400,
        `Invalid ${KVParams.EXPIRATION} of ${rawExpiration}. Please specify integer greater than the current number of seconds since the UNIX epoch.`
      );
    if (expiration < now + KVLimits.MIN_CACHE_TTL)
      throw new HttpError(
        400,
        `Invalid ${KVParams.EXPIRATION} of ${rawExpiration}. Expiration times must be at least ${KVLimits.MIN_CACHE_TTL} seconds in the future.`
      );
  }
  let metadata;
  if (rawMetadata !== null) {
    let metadataLength = Buffer2.byteLength(rawMetadata);
    if (metadataLength > KVLimits.MAX_METADATA_SIZE)
      throw new HttpError(
        413,
        `Metadata length of ${metadataLength} exceeds limit of ${KVLimits.MAX_METADATA_SIZE}.`
      );
    metadata = JSON.parse(rawMetadata);
  }
  return { expiration, metadata };
}
function decodeListOptions(url) {
  let limitParam = url.searchParams.get(KVParams.LIST_LIMIT), limit = limitParam === null ? KVLimits.MAX_LIST_KEYS : parseInt(limitParam), prefix = url.searchParams.get(KVParams.LIST_PREFIX) ?? void 0, cursor = url.searchParams.get(KVParams.LIST_CURSOR) ?? void 0;
  return { limit, prefix, cursor };
}
function validateListOptions(options) {
  let limit = options.limit;
  if (limit !== void 0) {
    if (isNaN(limit) || limit < 1)
      throw new HttpError(
        400,
        `Invalid ${KVParams.LIST_LIMIT} of ${limit}. Please specify an integer greater than 0.`
      );
    if (limit > KVLimits.MAX_LIST_KEYS)
      throw new HttpError(
        400,
        `Invalid ${KVParams.LIST_LIMIT} of ${limit}. Please specify an integer less than ${KVLimits.MAX_LIST_KEYS}.`
      );
  }
  let prefix = options.prefix;
  prefix != null && validateKeyLength(prefix);
}

// src/workers/kv/namespace.worker.ts
function createMaxValueSizeError(length, maxValueSize) {
  return new HttpError2(
    413,
    `Value length of ${length} exceeds limit of ${maxValueSize}.`
  );
}
var MaxLengthStream = class extends TransformStream {
  signal;
  length;
  constructor(maxLength) {
    let abortController = new AbortController(), lengthPromise = new DeferredPromise(), length = 0;
    super({
      transform(chunk, controller) {
        length += chunk.byteLength, length <= maxLength ? controller.enqueue(chunk) : abortController.signal.aborted || abortController.abort();
      },
      flush() {
        lengthPromise.resolve(length);
      }
    }), this.signal = abortController.signal, this.length = lengthPromise;
  }
};
function millisToSeconds(millis) {
  return Math.floor(millis / 1e3);
}
function secondsToMillis(seconds) {
  return seconds * 1e3;
}
async function processKeyValue(obj, type = "text", withMetadata = !1) {
  let decoder = new TextDecoder(), decodedValue = "";
  if (obj?.value) {
    for await (let chunk of obj?.value)
      decodedValue += decoder.decode(chunk, { stream: !0 });
    decodedValue += decoder.decode();
  }
  let val = null, size = decodedValue.length;
  try {
    val = obj?.value ? type === "json" ? JSON.parse(decodedValue) : decodedValue : null;
  } catch {
    throw new HttpError2(
      400,
      `At least one of the requested keys corresponds to a non-${type} value`
    );
  }
  return val && withMetadata ? [
    {
      value: val,
      metadata: obj?.metadata ?? null
    },
    size
  ] : [val, size];
}
var KVNamespaceObject = class extends MiniflareDurableObject {
  #storage;
  get storage() {
    return this.#storage ??= new KeyValueStorage(this);
  }
  get = async (req, params, url) => {
    if (req.method === "POST" && req.body != null) {
      let decodedBody = "", decoder = new TextDecoder();
      for await (let chunk of req.body)
        decodedBody += decoder.decode(chunk, { stream: !0 });
      decodedBody += decoder.decode();
      let parsedBody = JSON.parse(decodedBody), keys = parsedBody.keys, type = parsedBody?.type;
      if (type && type !== "text" && type !== "json") {
        let errorStr = `"${type}" is not a valid type. Use "json" or "text"`;
        return new Response(errorStr, { status: 400, statusText: errorStr });
      }
      let obj = {};
      if (keys.length > MAX_BULK_GET_KEYS) {
        let errorStr = `You can request a maximum of ${MAX_BULK_GET_KEYS} keys`;
        return new Response(errorStr, { status: 400, statusText: errorStr });
      }
      if (keys.length < 1) {
        let errorStr = "You must request a minimum of 1 key";
        return new Response(errorStr, { status: 400, statusText: errorStr });
      }
      let totalBytes = 0;
      for (let key2 of keys) {
        validateGetOptions(key2, { cacheTtl: parsedBody?.cacheTtl });
        let entry2 = await this.storage.get(key2), [value, size] = await processKeyValue(
          entry2,
          parsedBody?.type,
          parsedBody?.withMetadata
        );
        totalBytes += size, obj[key2] = value;
      }
      let maxValueSize = this.beingTested ? KVLimits.MAX_VALUE_SIZE_TEST : KVLimits.MAX_BULK_SIZE;
      if (totalBytes > maxValueSize)
        throw new HttpError2(
          413,
          `Total size of request exceeds the limit of ${maxValueSize / 1024 / 1024}MB`
        );
      return new Response(JSON.stringify(obj));
    }
    let key = decodeKey(params, url.searchParams), cacheTtlParam = url.searchParams.get(KVParams.CACHE_TTL), cacheTtl = cacheTtlParam === null ? void 0 : parseInt(cacheTtlParam);
    validateGetOptions(key, { cacheTtl });
    let entry = await this.storage.get(key);
    if (entry === null) throw new HttpError2(404, "Not Found");
    let headers = new Headers();
    return entry.expiration !== void 0 && headers.set(
      KVHeaders.EXPIRATION,
      millisToSeconds(entry.expiration).toString()
    ), entry.metadata !== void 0 && headers.set(KVHeaders.METADATA, JSON.stringify(entry.metadata)), new Response(entry.value, { headers });
  };
  put = async (req, params, url) => {
    let key = decodeKey(params, url.searchParams), rawExpiration = url.searchParams.get(KVParams.EXPIRATION), rawExpirationTtl = url.searchParams.get(KVParams.EXPIRATION_TTL), rawMetadata = req.headers.get(KVHeaders.METADATA), now = millisToSeconds(this.timers.now()), { expiration, metadata } = validatePutOptions(key, {
      now,
      rawExpiration,
      rawExpirationTtl,
      rawMetadata
    }), value = req.body, contentLength = parseInt(req.headers.get("Content-Length")), valueLengthHint;
    Number.isNaN(contentLength) ? value === null && (valueLengthHint = 0) : valueLengthHint = contentLength, value ??= new ReadableStream({
      start(controller) {
        controller.close();
      }
    });
    let maxValueSize = this.beingTested ? KVLimits.MAX_VALUE_SIZE_TEST : KVLimits.MAX_VALUE_SIZE, maxLengthStream;
    if (valueLengthHint !== void 0 && valueLengthHint > maxValueSize)
      throw createMaxValueSizeError(valueLengthHint, maxValueSize);
    maxLengthStream = new MaxLengthStream(maxValueSize), value = value.pipeThrough(maxLengthStream);
    try {
      await this.storage.put({
        key,
        value,
        expiration: maybeApply(secondsToMillis, expiration),
        metadata,
        signal: maxLengthStream?.signal
      });
    } catch (e) {
      if (typeof e == "object" && e !== null && "name" in e && e.name === "AbortError") {
        assert(maxLengthStream !== void 0);
        let length = await maxLengthStream.length;
        throw createMaxValueSizeError(length, maxValueSize);
      } else
        throw e;
    }
    return new Response();
  };
  delete = async (req, params, url) => {
    let key = decodeKey(params, url.searchParams);
    return validateKey(key), await this.storage.delete(key), new Response();
  };
  list = async (req, params, url) => {
    let options = decodeListOptions(url);
    validateListOptions(options);
    let res = await this.storage.list(options), keys = res.keys.map((key) => ({
      name: key.key,
      expiration: maybeApply(millisToSeconds, key.expiration),
      // workerd expects metadata to be a JSON-serialised string
      metadata: maybeApply(JSON.stringify, key.metadata)
    })), result;
    return res.cursor === void 0 ? result = { keys, list_complete: !0, cacheStatus: null } : result = {
      keys,
      list_complete: !1,
      cursor: res.cursor,
      cacheStatus: null
    }, Response.json(result);
  };
};
__decorateClass([
  GET("/:key"),
  POST("/bulk/get")
], KVNamespaceObject.prototype, "get", 2), __decorateClass([
  PUT("/:key")
], KVNamespaceObject.prototype, "put", 2), __decorateClass([
  DELETE("/:key")
], KVNamespaceObject.prototype, "delete", 2), __decorateClass([
  GET("/")
], KVNamespaceObject.prototype, "list", 2);
export {
  KVNamespaceObject
};
//# sourceMappingURL=namespace.worker.js.map
