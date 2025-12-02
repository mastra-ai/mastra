// src/workers/cache/cache-entry.worker.ts
import { SharedBindings } from "miniflare:shared";

// src/workers/cache/constants.ts
var CacheHeaders = {
  NAMESPACE: "cf-cache-namespace",
  STATUS: "cf-cache-status"
}, CacheBindings = {
  MAYBE_JSON_CACHE_WARN_USAGE: "MINIFLARE_CACHE_WARN_USAGE"
};

// src/workers/cache/cache-entry.worker.ts
var cache_entry_worker_default = {
  async fetch(request, env) {
    let namespace = request.headers.get(CacheHeaders.NAMESPACE), name = namespace === null ? "default" : `named:${namespace}`, objectNamespace = env[SharedBindings.DURABLE_OBJECT_NAMESPACE_OBJECT], id = objectNamespace.idFromName(name), stub = objectNamespace.get(id), cf = {
      ...request.cf,
      miniflare: {
        name,
        cacheWarnUsage: env[CacheBindings.MAYBE_JSON_CACHE_WARN_USAGE]
      }
    };
    return await stub.fetch(request, { cf });
  }
};
export {
  cache_entry_worker_default as default
};
//# sourceMappingURL=cache-entry.worker.js.map
