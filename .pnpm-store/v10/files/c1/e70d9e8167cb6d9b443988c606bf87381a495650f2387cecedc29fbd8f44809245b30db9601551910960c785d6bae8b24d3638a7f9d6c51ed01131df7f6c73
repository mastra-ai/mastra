// src/runtimes/local/LocalThreadRuntimeCore.tsx
import { fromThreadMessageLike, generateId } from "../../internal.js";
import { shouldContinue } from "./shouldContinue.js";
import { BaseThreadRuntimeCore } from "../core/BaseThreadRuntimeCore.js";
var AbortError = class extends Error {
  name = "AbortError";
  detach;
  constructor(detach, message) {
    super(message);
    this.detach = detach;
  }
};
var LocalThreadRuntimeCore = class extends BaseThreadRuntimeCore {
  capabilities = {
    switchToBranch: true,
    edit: true,
    reload: true,
    cancel: true,
    unstable_copy: true,
    speech: false,
    attachments: false,
    feedback: false
  };
  abortController = null;
  isDisabled = false;
  _isLoading = false;
  get isLoading() {
    return this._isLoading;
  }
  _suggestions = [];
  _suggestionsController = null;
  get suggestions() {
    return this._suggestions;
  }
  get adapters() {
    return this._options.adapters;
  }
  constructor(contextProvider, options) {
    super(contextProvider);
    this.__internal_setOptions(options);
  }
  _options;
  _lastRunConfig = {};
  get extras() {
    return void 0;
  }
  __internal_setOptions(options) {
    if (this._options === options) return;
    this._options = options;
    let hasUpdates = false;
    const canSpeak = options.adapters?.speech !== void 0;
    if (this.capabilities.speech !== canSpeak) {
      this.capabilities.speech = canSpeak;
      hasUpdates = true;
    }
    const canAttach = options.adapters?.attachments !== void 0;
    if (this.capabilities.attachments !== canAttach) {
      this.capabilities.attachments = canAttach;
      hasUpdates = true;
    }
    const canFeedback = options.adapters?.feedback !== void 0;
    if (this.capabilities.feedback !== canFeedback) {
      this.capabilities.feedback = canFeedback;
      hasUpdates = true;
    }
    if (hasUpdates) this._notifySubscribers();
  }
  _loadPromise;
  __internal_load() {
    if (this._loadPromise) return this._loadPromise;
    const promise = this.adapters.history?.load() ?? Promise.resolve(null);
    this._isLoading = true;
    this._notifySubscribers();
    this._loadPromise = promise.then((repo) => {
      if (!repo) return;
      this.repository.import(repo);
      this._notifySubscribers();
      const resume = this.adapters.history?.resume?.bind(
        this.adapters.history
      );
      if (repo.unstable_resume && resume) {
        this.startRun(
          {
            parentId: this.repository.headId,
            sourceId: this.repository.headId,
            runConfig: this._lastRunConfig
          },
          resume
        );
      }
    }).finally(() => {
      this._isLoading = false;
      this._notifySubscribers();
    });
    return this._loadPromise;
  }
  async append(message) {
    this.ensureInitialized();
    const newMessage = fromThreadMessageLike(message, generateId(), {
      type: "complete",
      reason: "unknown"
    });
    this.repository.addOrUpdateMessage(message.parentId, newMessage);
    this._options.adapters.history?.append({
      parentId: message.parentId,
      message: newMessage
    });
    const startRun = message.startRun ?? message.role === "user";
    if (startRun) {
      await this.startRun({
        parentId: newMessage.id,
        sourceId: message.sourceId,
        runConfig: message.runConfig ?? {}
      });
    } else {
      this.repository.resetHead(newMessage.id);
      this._notifySubscribers();
    }
  }
  resumeRun({ stream, ...startConfig }) {
    return this.startRun(startConfig, stream);
  }
  async startRun({ parentId, runConfig }, runCallback) {
    this.ensureInitialized();
    this.repository.resetHead(parentId);
    const id = generateId();
    let message = {
      id,
      role: "assistant",
      status: { type: "running" },
      content: [],
      metadata: {
        unstable_state: this.state,
        unstable_annotations: [],
        unstable_data: [],
        steps: [],
        custom: {}
      },
      createdAt: /* @__PURE__ */ new Date()
    };
    this._notifyEventSubscribers("run-start");
    try {
      this._suggestions = [];
      this._suggestionsController?.abort();
      this._suggestionsController = null;
      do {
        message = await this.performRoundtrip(
          parentId,
          message,
          runConfig,
          runCallback
        );
        runCallback = void 0;
      } while (shouldContinue(message, this._options.unstable_humanToolNames));
    } finally {
      this._notifyEventSubscribers("run-end");
    }
    this._suggestionsController = new AbortController();
    const signal = this._suggestionsController.signal;
    if (this.adapters.suggestion && message.status?.type !== "requires-action") {
      const promiseOrGenerator = this.adapters.suggestion?.generate({
        messages: this.messages
      });
      if (Symbol.asyncIterator in promiseOrGenerator) {
        for await (const r of promiseOrGenerator) {
          if (signal.aborted) break;
          this._suggestions = r;
        }
      } else {
        const result = await promiseOrGenerator;
        if (signal.aborted) return;
        this._suggestions = result;
      }
    }
  }
  async performRoundtrip(parentId, message, runConfig, runCallback) {
    const messages = this.repository.getMessages();
    this.abortController?.abort();
    this.abortController = new AbortController();
    const initialContent = message.content;
    const initialAnnotations = message.metadata?.unstable_annotations;
    const initialData = message.metadata?.unstable_data;
    const initialSteps = message.metadata?.steps;
    const initalCustom = message.metadata?.custom;
    const updateMessage = (m) => {
      const newSteps = m.metadata?.steps;
      const steps2 = newSteps ? [...initialSteps ?? [], ...newSteps] : void 0;
      const newAnnotations = m.metadata?.unstable_annotations;
      const newData = m.metadata?.unstable_data;
      const annotations = newAnnotations ? [...initialAnnotations ?? [], ...newAnnotations] : void 0;
      const data = newData ? [...initialData ?? [], ...newData] : void 0;
      message = {
        ...message,
        ...m.content ? { content: [...initialContent, ...m.content ?? []] } : void 0,
        status: m.status ?? message.status,
        ...m.metadata ? {
          metadata: {
            ...message.metadata,
            ...m.metadata.unstable_state ? { unstable_state: m.metadata.unstable_state } : void 0,
            ...annotations ? { unstable_annotations: annotations } : void 0,
            ...data ? { unstable_data: data } : void 0,
            ...steps2 ? { steps: steps2 } : void 0,
            ...m.metadata?.custom ? {
              custom: { ...initalCustom ?? {}, ...m.metadata.custom }
            } : void 0
          }
        } : void 0
      };
      this.repository.addOrUpdateMessage(parentId, message);
      this._notifySubscribers();
    };
    const maxSteps = this._options.maxSteps ?? 2;
    const steps = message.metadata?.steps?.length ?? 0;
    if (steps >= maxSteps) {
      updateMessage({
        status: {
          type: "incomplete",
          reason: "tool-calls"
        }
      });
      return message;
    } else {
      updateMessage({
        status: {
          type: "running"
        }
      });
    }
    try {
      this._lastRunConfig = runConfig ?? {};
      const context = this.getModelContext();
      runCallback = runCallback ?? this.adapters.chatModel.run.bind(this.adapters.chatModel);
      const abortSignal = this.abortController.signal;
      const promiseOrGenerator = runCallback({
        messages,
        runConfig: this._lastRunConfig,
        abortSignal,
        context,
        config: context,
        unstable_assistantMessageId: message.id,
        unstable_getMessage() {
          return message;
        }
      });
      if (Symbol.asyncIterator in promiseOrGenerator) {
        for await (const r of promiseOrGenerator) {
          if (abortSignal.aborted) {
            updateMessage({
              status: { type: "incomplete", reason: "cancelled" }
            });
            break;
          }
          updateMessage(r);
        }
      } else {
        updateMessage(await promiseOrGenerator);
      }
      if (message.status.type === "running") {
        updateMessage({
          status: { type: "complete", reason: "unknown" }
        });
      }
    } catch (e) {
      if (e instanceof AbortError) {
        updateMessage({
          status: { type: "incomplete", reason: "cancelled" }
        });
      } else {
        updateMessage({
          status: {
            type: "incomplete",
            reason: "error",
            error: e instanceof Error ? e.message : `[${typeof e}] ${new String(e).toString()}`
          }
        });
        throw e;
      }
    } finally {
      this.abortController = null;
      if (message.status.type === "complete" || message.status.type === "incomplete") {
        await this._options.adapters.history?.append({
          parentId,
          message
        });
      }
    }
    return message;
  }
  detach() {
    const error = new AbortError(true);
    this.abortController?.abort(error);
    this.abortController = null;
  }
  cancelRun() {
    const error = new AbortError(false);
    this.abortController?.abort(error);
    this.abortController = null;
  }
  addToolResult({
    messageId,
    toolCallId,
    result,
    isError,
    artifact
  }) {
    const messageData = this.repository.getMessage(messageId);
    const { parentId } = messageData;
    let { message } = messageData;
    if (message.role !== "assistant")
      throw new Error("Tried to add tool result to non-assistant message");
    let added = false;
    let found = false;
    const newContent = message.content.map((c) => {
      if (c.type !== "tool-call") return c;
      if (c.toolCallId !== toolCallId) return c;
      found = true;
      if (!c.result) added = true;
      return {
        ...c,
        result,
        artifact,
        isError
      };
    });
    if (!found)
      throw new Error("Tried to add tool result to non-existing tool call");
    message = {
      ...message,
      content: newContent
    };
    this.repository.addOrUpdateMessage(parentId, message);
    if (added && shouldContinue(message, this._options.unstable_humanToolNames)) {
      this.performRoundtrip(parentId, message, this._lastRunConfig);
    }
  }
};
export {
  LocalThreadRuntimeCore
};
//# sourceMappingURL=LocalThreadRuntimeCore.js.map