// src/workers/cache/constants.ts
var CacheHeaders = {
  NAMESPACE: "cf-cache-namespace",
  STATUS: "cf-cache-status"
};

// src/workers/cache/cache-entry-noop.worker.ts
var cache_entry_noop_worker_default = {
  async fetch(request) {
    return request.method === "GET" ? new Response(null, {
      status: 504,
      headers: { [CacheHeaders.STATUS]: "MISS" }
    }) : request.method === "PUT" ? (await request.body?.pipeTo(new WritableStream()), new Response(null, { status: 204 })) : request.method === "PURGE" ? new Response(null, { status: 404 }) : new Response(null, { status: 405 });
  }
};
export {
  cache_entry_noop_worker_default as default
};
//# sourceMappingURL=cache-entry-noop.worker.js.map
