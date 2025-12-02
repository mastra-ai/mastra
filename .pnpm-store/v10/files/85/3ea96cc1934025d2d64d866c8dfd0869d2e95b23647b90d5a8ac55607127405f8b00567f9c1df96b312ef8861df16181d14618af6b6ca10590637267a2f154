// src/workers/assets/assets-kv.worker.ts
import { SharedBindings } from "miniflare:shared";
var assets_kv_worker_default = {
  async fetch(request, env) {
    if (request.method !== "GET") {
      let message = `Cannot ${request.method.toLowerCase()}() with Workers Assets namespace`;
      return new Response(message, { status: 405, statusText: message });
    }
    let pathHash = new URL(request.url).pathname.substring(1), entry = env.ASSETS_REVERSE_MAP[pathHash];
    if (entry === void 0)
      return new Response("Not Found", { status: 404 });
    let { filePath, contentType } = entry, response = await env[SharedBindings.MAYBE_SERVICE_BLOBS].fetch(
      new URL(
        // somewhere in blobservice I think this is being decoded again
        filePath.split("/").map((x) => encodeURIComponent(x)).join("/"),
        "http://placeholder"
      )
    ), newResponse = new Response(response.body, response);
    return contentType !== null && newResponse.headers.append(
      "cf-kv-metadata",
      `{"contentType": "${contentType}"}`
    ), newResponse;
  }
};
export {
  assets_kv_worker_default as default
};
//# sourceMappingURL=assets-kv.worker.js.map
