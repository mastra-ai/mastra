// src/workers/browser-rendering/binding.worker.ts
import assert from "node:assert";
import { DurableObject } from "cloudflare:workers";

// src/workers/core/constants.ts
var CoreBindings = {
  SERVICE_LOOPBACK: "MINIFLARE_LOOPBACK",
  SERVICE_USER_ROUTE_PREFIX: "MINIFLARE_USER_ROUTE_",
  SERVICE_USER_FALLBACK: "MINIFLARE_USER_FALLBACK",
  TEXT_CUSTOM_SERVICE: "MINIFLARE_CUSTOM_SERVICE",
  IMAGES_SERVICE: "MINIFLARE_IMAGES_SERVICE",
  TEXT_UPSTREAM_URL: "MINIFLARE_UPSTREAM_URL",
  JSON_CF_BLOB: "CF_BLOB",
  JSON_ROUTES: "MINIFLARE_ROUTES",
  JSON_LOG_LEVEL: "MINIFLARE_LOG_LEVEL",
  DATA_LIVE_RELOAD_SCRIPT: "MINIFLARE_LIVE_RELOAD_SCRIPT",
  DURABLE_OBJECT_NAMESPACE_PROXY: "MINIFLARE_PROXY",
  DATA_PROXY_SECRET: "MINIFLARE_PROXY_SECRET",
  DATA_PROXY_SHARED_SECRET: "MINIFLARE_PROXY_SHARED_SECRET",
  TRIGGER_HANDLERS: "TRIGGER_HANDLERS",
  LOG_REQUESTS: "LOG_REQUESTS",
  STRIP_DISABLE_PRETTY_ERROR: "STRIP_DISABLE_PRETTY_ERROR"
};

// src/workers/browser-rendering/binding.worker.ts
function isClosed(ws) {
  return !ws || ws.readyState === WebSocket.CLOSED;
}
var BrowserSession = class extends DurableObject {
  sessionInfo;
  ws;
  server;
  async fetch(_request) {
    assert(
      this.sessionInfo !== void 0,
      "sessionInfo must be set before connecting"
    ), isClosed(this.ws) || isClosed(this.server) ? this.closeWebSockets() : assert.fail("WebSocket already initialized");
    let webSocketPair = new WebSocketPair(), [client, server] = Object.values(webSocketPair);
    server.accept();
    let wsEndpoint = this.sessionInfo.wsEndpoint.replace("ws://", "http://"), response = await fetch(wsEndpoint, {
      headers: {
        Upgrade: "websocket"
      }
    });
    assert(response.webSocket !== null, "Expected a WebSocket response");
    let ws = response.webSocket;
    return ws.accept(), ws.addEventListener("message", (m) => {
      let string = new TextEncoder().encode(m.data), data = new Uint8Array(string.length + 4);
      new DataView(data.buffer).setUint32(0, string.length, !0), data.set(string, 4), server.send(data);
    }), server.addEventListener("message", (m) => {
      if (m.data === "ping") {
        this.#checkStatus().catch((err) => {
          console.error("Error checking browser status:", err);
        });
        return;
      }
      ws.send(new TextDecoder().decode(m.data.slice(4)));
    }), server.addEventListener("close", ({ code, reason }) => {
      ws.close(code, reason), this.ws = void 0;
    }), ws.addEventListener("close", ({ code, reason }) => {
      server.close(code, reason), this.server = void 0;
    }), this.ws = ws, this.server = server, this.sessionInfo.connectionId = crypto.randomUUID(), this.sessionInfo.connectionStartTime = Date.now(), new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  async setSessionInfo(sessionInfo) {
    this.sessionInfo = sessionInfo;
  }
  async getSessionInfo() {
    return (isClosed(this.ws) || isClosed(this.server)) && this.closeWebSockets(), this.sessionInfo;
  }
  async #checkStatus() {
    if (this.sessionInfo) {
      let url = new URL("http://example.com/browser/status");
      if (url.searchParams.set("sessionId", this.sessionInfo.sessionId), !(await this.env[CoreBindings.SERVICE_LOOPBACK].fetch(url)).ok) {
        this.closeWebSockets();
        return;
      }
    }
  }
  closeWebSockets() {
    this.ws?.close(), this.server?.close(), this.ws = void 0, this.server = void 0, this.sessionInfo && (this.sessionInfo.connectionId = void 0, this.sessionInfo.connectionStartTime = void 0);
  }
}, binding_worker_default = {
  async fetch(request, env) {
    let url = new URL(request.url);
    switch (url.pathname) {
      case "/v1/acquire": {
        let sessionInfo = await (await env[CoreBindings.SERVICE_LOOPBACK].fetch(
          "http://example.com/browser/launch"
        )).json(), id = env.BrowserSession.idFromName(sessionInfo.sessionId);
        return await env.BrowserSession.get(id).setSessionInfo(sessionInfo), Response.json({ sessionId: sessionInfo.sessionId });
      }
      case "/v1/connectDevtools": {
        let sessionId = url.searchParams.get("browser_session");
        assert(sessionId !== null, "browser_session must be set");
        let id = env.BrowserSession.idFromName(sessionId);
        return env.BrowserSession.get(id).fetch(request);
      }
      case "/v1/sessions": {
        let sessionIds = await env[CoreBindings.SERVICE_LOOPBACK].fetch("http://example.com/browser/sessionIds").then((resp) => resp.json()), sessions = await Promise.all(
          sessionIds.map(async (sessionId) => {
            let id = env.BrowserSession.idFromName(sessionId);
            return env.BrowserSession.get(id).getSessionInfo().then((sessionInfo) => sessionInfo ? {
              sessionId: sessionInfo.sessionId,
              startTime: sessionInfo.startTime,
              connectionId: sessionInfo.connectionId,
              connectionStartTime: sessionInfo.connectionStartTime
            } : null);
          })
        ).then((results) => results.filter(Boolean));
        return Response.json({ sessions });
      }
      default:
        return new Response("Not implemented", { status: 405 });
    }
  }
};
export {
  BrowserSession,
  binding_worker_default as default
};
//# sourceMappingURL=binding.worker.js.map
