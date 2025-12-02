// src/workers/core/strip-cf-connecting-ip.worker.ts
var strip_cf_connecting_ip_worker_default = {
  fetch(request) {
    let headers = new Headers(request.headers);
    return headers.delete("CF-Connecting-IP"), fetch(request, { headers });
  }
};
export {
  strip_cf_connecting_ip_worker_default as default
};
//# sourceMappingURL=strip-cf-connecting-ip.worker.js.map
