// src/workers/assets/rpc-proxy.worker.ts
import { WorkerEntrypoint } from "cloudflare:workers";
var RPCProxyWorker = class extends WorkerEntrypoint {
  async fetch(request) {
    return this.env.ROUTER_WORKER.fetch(request);
  }
  tail(events) {
    return this.env.USER_WORKER.tail(
      JSON.parse(JSON.stringify(events, tailEventsReplacer), tailEventsReviver)
    );
  }
  constructor(ctx, env) {
    return super(ctx, env), new Proxy(this, {
      get(target, prop) {
        return Reflect.has(target, prop) ? Reflect.get(target, prop) : Reflect.get(target.env.USER_WORKER, prop);
      }
    });
  }
}, serializedDate = "___serialized_date___";
function tailEventsReplacer(_, value) {
  return value instanceof Date ? { [serializedDate]: value.toISOString() } : value;
}
function tailEventsReviver(_, value) {
  return value && typeof value == "object" && serializedDate in value ? new Date(value[serializedDate]) : value;
}
export {
  RPCProxyWorker as default
};
//# sourceMappingURL=rpc-proxy.worker.js.map
