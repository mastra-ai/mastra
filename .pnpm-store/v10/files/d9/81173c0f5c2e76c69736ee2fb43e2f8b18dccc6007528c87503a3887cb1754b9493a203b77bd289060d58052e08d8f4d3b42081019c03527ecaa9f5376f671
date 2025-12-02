// src/workers/hello-world/binding.worker.ts
import { WorkerEntrypoint } from "cloudflare:workers";
var HelloWorldBinding = class extends WorkerEntrypoint {
  async get() {
    let objectNamespace = this.env.store, namespaceId = JSON.stringify(this.env.config), id = objectNamespace.idFromName(namespaceId);
    return {
      value: await objectNamespace.get(id).get() ?? "",
      ms: this.env.config.enable_timer ? 100 : void 0
    };
  }
  async set(value) {
    let objectNamespace = this.env.store, namespaceId = JSON.stringify(this.env.config), id = objectNamespace.idFromName(namespaceId);
    await objectNamespace.get(id).set(value);
  }
};
export {
  HelloWorldBinding
};
//# sourceMappingURL=binding.worker.js.map
