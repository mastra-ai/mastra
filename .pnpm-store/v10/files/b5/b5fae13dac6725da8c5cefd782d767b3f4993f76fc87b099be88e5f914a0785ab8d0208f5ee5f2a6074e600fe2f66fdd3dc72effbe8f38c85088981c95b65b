// src/model-context/frame/AssistantFrameProvider.ts
import { z } from "zod";
import {
  FRAME_MESSAGE_CHANNEL
} from "./AssistantFrameTypes.js";
var serializeTool = (tool) => ({
  ...tool.description && { description: tool.description },
  parameters: tool.parameters instanceof z.ZodType ? z.toJSONSchema?.(tool.parameters) ?? tool.parameters : tool.parameters,
  ...tool.disabled !== void 0 && { disabled: tool.disabled },
  ...tool.type && { type: tool.type }
});
var serializeModelContext = (context) => ({
  ...context.system !== void 0 && { system: context.system },
  ...context.tools && {
    tools: Object.fromEntries(
      Object.entries(context.tools).map(([name, tool]) => [
        name,
        serializeTool(tool)
      ])
    )
  }
});
var AssistantFrameProvider = class _AssistantFrameProvider {
  static _instance = null;
  _providers = /* @__PURE__ */ new Set();
  _providerUnsubscribes = /* @__PURE__ */ new Map();
  _targetOrigin;
  constructor(targetOrigin = "*") {
    this._targetOrigin = targetOrigin;
    this.handleMessage = this.handleMessage.bind(this);
    window.addEventListener("message", this.handleMessage);
    setTimeout(() => this.broadcastUpdate(), 0);
  }
  static getInstance(targetOrigin) {
    if (!_AssistantFrameProvider._instance) {
      _AssistantFrameProvider._instance = new _AssistantFrameProvider(
        targetOrigin
      );
    }
    return _AssistantFrameProvider._instance;
  }
  handleMessage(event) {
    if (this._targetOrigin !== "*" && event.origin !== this._targetOrigin)
      return;
    if (event.data?.channel !== FRAME_MESSAGE_CHANNEL) return;
    const message = event.data.message;
    switch (message.type) {
      case "model-context-request":
        this.sendMessage(event, {
          type: "model-context-update",
          context: serializeModelContext(this.getModelContext())
        });
        break;
      case "tool-call":
        this.handleToolCall(message, event);
        break;
    }
  }
  async handleToolCall(message, event) {
    const tool = this.getModelContext().tools?.[message.toolName];
    let result;
    let error;
    if (!tool) {
      error = `Tool "${message.toolName}" not found`;
    } else {
      try {
        result = tool.execute ? await tool.execute(message.args, {
          toolCallId: message.id,
          abortSignal: new AbortController().signal
        }) : void 0;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }
    this.sendMessage(event, {
      type: "tool-result",
      id: message.id,
      ...error ? { error } : { result }
    });
  }
  sendMessage(event, message) {
    event.source?.postMessage(
      { channel: FRAME_MESSAGE_CHANNEL, message },
      { targetOrigin: event.origin }
    );
  }
  getModelContext() {
    const contexts = Array.from(this._providers).map(
      (p) => p.getModelContext()
    );
    return contexts.reduce(
      (merged, context) => ({
        system: context.system ? merged.system ? `${merged.system}

${context.system}` : context.system : merged.system,
        tools: { ...merged.tools || {}, ...context.tools || {} }
      }),
      {}
    );
  }
  broadcastUpdate() {
    if (window.parent && window.parent !== window) {
      const updateMessage = {
        type: "model-context-update",
        context: serializeModelContext(this.getModelContext())
      };
      window.parent.postMessage(
        { channel: FRAME_MESSAGE_CHANNEL, message: updateMessage },
        this._targetOrigin
      );
    }
  }
  static addModelContextProvider(provider, targetOrigin) {
    const instance = _AssistantFrameProvider.getInstance(targetOrigin);
    instance._providers.add(provider);
    const unsubscribe = provider.subscribe?.(() => instance.broadcastUpdate());
    if (unsubscribe) {
      instance._providerUnsubscribes.set(provider, unsubscribe);
    }
    instance.broadcastUpdate();
    return () => {
      instance._providers.delete(provider);
      instance._providerUnsubscribes.get(provider)?.();
      instance._providerUnsubscribes.delete(provider);
      instance.broadcastUpdate();
    };
  }
  static dispose() {
    if (_AssistantFrameProvider._instance) {
      const instance = _AssistantFrameProvider._instance;
      window.removeEventListener("message", instance.handleMessage);
      instance._providerUnsubscribes.forEach((unsubscribe) => unsubscribe?.());
      instance._providerUnsubscribes.clear();
      instance._providers.clear();
      _AssistantFrameProvider._instance = null;
    }
  }
};
export {
  AssistantFrameProvider
};
//# sourceMappingURL=AssistantFrameProvider.js.map