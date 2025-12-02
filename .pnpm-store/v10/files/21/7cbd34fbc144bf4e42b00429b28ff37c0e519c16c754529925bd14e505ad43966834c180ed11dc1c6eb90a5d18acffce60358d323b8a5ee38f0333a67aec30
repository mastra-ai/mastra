// src/model-context/registry/ModelContextRegistry.ts
import {
  mergeModelContexts
} from "../../model-context/ModelContextTypes.js";
var ModelContextRegistry = class {
  _tools = /* @__PURE__ */ new Map();
  _instructions = /* @__PURE__ */ new Map();
  _providers = /* @__PURE__ */ new Map();
  _subscribers = /* @__PURE__ */ new Set();
  _providerUnsubscribes = /* @__PURE__ */ new Map();
  getModelContext() {
    const instructions = Array.from(this._instructions.values()).filter(
      Boolean
    );
    const system = instructions.length > 0 ? instructions.join("\n\n") : void 0;
    const tools = {};
    for (const toolProps of this._tools.values()) {
      const { toolName, render, ...tool } = toolProps;
      tools[toolName] = tool;
    }
    const providerContexts = mergeModelContexts(
      new Set(this._providers.values())
    );
    const context = {
      system,
      tools: Object.keys(tools).length > 0 ? tools : void 0
    };
    if (providerContexts.system) {
      context.system = context.system ? `${context.system}

${providerContexts.system}` : providerContexts.system;
    }
    if (providerContexts.tools) {
      context.tools = { ...context.tools || {}, ...providerContexts.tools };
    }
    if (providerContexts.callSettings) {
      context.callSettings = providerContexts.callSettings;
    }
    if (providerContexts.config) {
      context.config = providerContexts.config;
    }
    return context;
  }
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }
  notifySubscribers() {
    for (const callback of this._subscribers) {
      callback();
    }
  }
  addTool(tool) {
    const id = Symbol();
    this._tools.set(id, tool);
    this.notifySubscribers();
    return {
      update: (newTool) => {
        if (this._tools.has(id)) {
          this._tools.set(id, newTool);
          this.notifySubscribers();
        }
      },
      remove: () => {
        this._tools.delete(id);
        this.notifySubscribers();
      }
    };
  }
  addInstruction(config) {
    const id = Symbol();
    const instruction = typeof config === "string" ? config : config.instruction;
    const disabled = typeof config === "object" ? config.disabled : false;
    if (!disabled) {
      this._instructions.set(id, instruction);
      this.notifySubscribers();
    }
    return {
      update: (newConfig) => {
        const newInstruction = typeof newConfig === "string" ? newConfig : newConfig.instruction;
        const newDisabled = typeof newConfig === "object" ? newConfig.disabled : false;
        if (newDisabled) {
          this._instructions.delete(id);
        } else {
          this._instructions.set(id, newInstruction);
        }
        this.notifySubscribers();
      },
      remove: () => {
        this._instructions.delete(id);
        this.notifySubscribers();
      }
    };
  }
  addProvider(provider) {
    const id = Symbol();
    this._providers.set(id, provider);
    const unsubscribe = provider.subscribe?.(() => {
      this.notifySubscribers();
    });
    this._providerUnsubscribes.set(id, unsubscribe);
    this.notifySubscribers();
    return {
      remove: () => {
        this._providers.delete(id);
        const unsubscribe2 = this._providerUnsubscribes.get(id);
        unsubscribe2?.();
        this._providerUnsubscribes.delete(id);
        this.notifySubscribers();
      }
    };
  }
};
export {
  ModelContextRegistry
};
//# sourceMappingURL=ModelContextRegistry.js.map