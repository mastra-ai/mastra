// src/workers/hello-world/object.worker.ts
import { DurableObject } from "cloudflare:workers";
var HelloWorldObject = class extends DurableObject {
  async get() {
    return await this.ctx.storage.get("value");
  }
  async set(value) {
    await this.ctx.storage.put("value", value);
  }
};
export {
  HelloWorldObject
};
//# sourceMappingURL=object.worker.js.map
