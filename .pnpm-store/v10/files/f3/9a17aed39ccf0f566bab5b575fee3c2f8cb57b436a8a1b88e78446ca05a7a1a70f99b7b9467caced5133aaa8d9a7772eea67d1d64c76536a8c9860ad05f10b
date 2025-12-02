// src/workers/kv/sites.worker.ts
import { base64Decode, base64Encode, SharedBindings } from "miniflare:shared";

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
};
var SiteBindings = {
  KV_NAMESPACE_SITE: "__STATIC_CONTENT",
  JSON_SITE_MANIFEST: "__STATIC_CONTENT_MANIFEST",
  JSON_SITE_FILTER: "MINIFLARE_SITE_FILTER"
}, SITES_NO_CACHE_PREFIX = "$__MINIFLARE_SITES__$/";
function encodeSitesKey(key) {
  return SITES_NO_CACHE_PREFIX + encodeURIComponent(key);
}
function decodeSitesKey(key) {
  return key.startsWith(SITES_NO_CACHE_PREFIX) ? decodeURIComponent(key.substring(SITES_NO_CACHE_PREFIX.length)) : key;
}
function deserialiseRegExps(matcher) {
  return {
    include: matcher.include.map((regExp) => new RegExp(regExp)),
    exclude: matcher.exclude.map((regExp) => new RegExp(regExp))
  };
}
function deserialiseSiteRegExps(siteRegExps) {
  return {
    include: siteRegExps.include && deserialiseRegExps(siteRegExps.include),
    exclude: siteRegExps.exclude && deserialiseRegExps(siteRegExps.exclude)
  };
}
function testSiteRegExps(regExps, key) {
  return regExps.include !== void 0 ? testRegExps(regExps.include, key) : regExps.exclude !== void 0 ? !testRegExps(regExps.exclude, key) : !0;
}

// src/workers/kv/validator.worker.ts
import { Buffer } from "node:buffer";
import { HttpError } from "miniflare:shared";
function validateKeyLength(key) {
  let keyLength = Buffer.byteLength(key);
  if (keyLength > KVLimits.MAX_KEY_SIZE)
    throw new HttpError(
      414,
      `UTF-8 encoded length of ${keyLength} exceeds key length limit of ${KVLimits.MAX_KEY_SIZE}.`
    );
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

// src/workers/kv/sites.worker.ts
var siteRegExpsCache = /* @__PURE__ */ new WeakMap();
function getSiteRegExps(env) {
  let regExps = siteRegExpsCache.get(env);
  return regExps !== void 0 || (regExps = deserialiseSiteRegExps(env[SiteBindings.JSON_SITE_FILTER]), siteRegExpsCache.set(env, regExps)), regExps;
}
async function* walkDirectory(blobsService, path = "") {
  let res = await blobsService.fetch(`http://placeholder/${path}`);
  if (!(res.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) {
    await res.body?.pipeTo(new WritableStream()), yield path;
    return;
  }
  let entries = await res.json();
  for (let { name, type } of entries) {
    let entryPath = `${path}${path === "" ? "" : "/"}${name}`;
    type === "directory" ? yield* walkDirectory(blobsService, entryPath) : yield entryPath;
  }
}
var encoder = new TextEncoder();
function arrayCompare(a, b) {
  let minLength = Math.min(a.length, b.length);
  for (let i = 0; i < minLength; i++) {
    let aElement = a[i], bElement = b[i];
    if (aElement < bElement) return -1;
    if (aElement > bElement) return 1;
  }
  return a.length - b.length;
}
async function handleListRequest(url, blobsService, siteRegExps) {
  let options = decodeListOptions(url);
  validateListOptions(options);
  let { limit = KVLimits.MAX_LIST_KEYS, prefix, cursor } = options, keys = [];
  for await (let name of walkDirectory(blobsService))
    testSiteRegExps(siteRegExps, name) && (name = encodeSitesKey(name), !(prefix !== void 0 && !name.startsWith(prefix)) && keys.push({ name, encodedName: encoder.encode(name) }));
  keys.sort((a, b) => arrayCompare(a.encodedName, b.encodedName));
  for (let key of keys) delete key.encodedName;
  let startAfter = cursor === void 0 ? "" : base64Decode(cursor), startIndex = 0;
  startAfter !== "" && (startIndex = keys.findIndex(({ name }) => name === startAfter), startIndex === -1 && (startIndex = keys.length), startIndex++);
  let endIndex = startIndex + limit, nextCursor = endIndex < keys.length ? base64Encode(keys[endIndex - 1].name) : void 0;
  return keys = keys.slice(startIndex, endIndex), nextCursor === void 0 ? Response.json({ keys, list_complete: !0 }) : Response.json({ keys, list_complete: !1, cursor: nextCursor });
}
var sites_worker_default = {
  async fetch(request, env) {
    if (request.method !== "GET") {
      let message = `Cannot ${request.method.toLowerCase()}() with Workers Sites namespace`;
      return new Response(message, { status: 405, statusText: message });
    }
    let url = new URL(request.url), key = url.pathname.substring(1);
    url.searchParams.get(KVParams.URL_ENCODED)?.toLowerCase() === "true" && (key = decodeURIComponent(key)), key = decodeSitesKey(key);
    let siteRegExps = getSiteRegExps(env);
    if (key !== "" && !testSiteRegExps(siteRegExps, key))
      return new Response("Not Found", {
        status: 404,
        statusText: "Not Found"
      });
    let blobsService = env[SharedBindings.MAYBE_SERVICE_BLOBS];
    return key === "" ? handleListRequest(url, blobsService, siteRegExps) : blobsService.fetch(new URL(key, "http://placeholder"));
  }
};
export {
  sites_worker_default as default
};
//# sourceMappingURL=sites.worker.js.map
