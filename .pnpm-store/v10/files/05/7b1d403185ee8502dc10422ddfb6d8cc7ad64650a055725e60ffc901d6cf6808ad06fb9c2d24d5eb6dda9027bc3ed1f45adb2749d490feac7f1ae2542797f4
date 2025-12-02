// src/workers/secrets-store/secret.worker.ts
import { WorkerEntrypoint } from "cloudflare:workers";

// src/workers/secrets-store/constants.ts
var ADMIN_API = "SecretsStoreSecret::admin_api";

// src/workers/secrets-store/secret.worker.ts
var SecretsStoreSecret = class extends WorkerEntrypoint {
  async get() {
    let value = await this.env.store.get(this.env.secret_name, "text");
    if (value === null)
      throw new Error(`Secret "${this.env.secret_name}" not found`);
    return value;
  }
  [ADMIN_API]() {
    return {
      create: async (value) => {
        let id = crypto.randomUUID().replaceAll("-", "");
        return await this.env.store.put(this.env.secret_name, value, {
          metadata: { uuid: id }
        }), id;
      },
      update: async (value, id) => {
        let { keys } = await this.env.store.list(), secret = keys.find((k) => k.metadata?.uuid === id);
        if (!secret)
          throw new Error("Secret not found");
        return await this.env.store.put(secret?.name, value, {
          metadata: { uuid: id }
        }), id;
      },
      duplicate: async (id, newName) => {
        let { keys } = await this.env.store.list(), secret = keys.find((k) => k.metadata?.uuid === id);
        if (!secret)
          throw new Error("Secret not found");
        let existingValue = await this.env.store.get(secret.name);
        if (!existingValue)
          throw new Error("Secret not found");
        let newId = crypto.randomUUID();
        return await this.env.store.put(newName, existingValue, {
          metadata: { uuid: newId }
        }), newId;
      },
      delete: async (id) => {
        let { keys } = await this.env.store.list(), secret = keys.find((k) => k.metadata?.uuid === id);
        if (!secret)
          throw new Error("Secret not found");
        await this.env.store.delete(secret?.name);
      },
      list: async () => {
        let { keys } = await this.env.store.list();
        return keys;
      },
      get: async (id) => {
        let { keys } = await this.env.store.list(), secret = keys.find((k) => k.metadata?.uuid === id);
        if (!secret)
          throw new Error("Secret not found");
        return secret.name;
      }
    };
  }
};
export {
  SecretsStoreSecret
};
//# sourceMappingURL=secret.worker.js.map
