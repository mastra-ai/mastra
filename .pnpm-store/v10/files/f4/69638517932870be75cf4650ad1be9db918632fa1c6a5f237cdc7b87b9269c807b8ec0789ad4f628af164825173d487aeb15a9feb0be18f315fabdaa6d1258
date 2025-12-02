// src/runtimes/core/BaseThreadRuntimeCore.tsx
import {
  ExportedMessageRepository,
  MessageRepository
} from "../utils/MessageRepository.js";
import { DefaultThreadComposerRuntimeCore } from "../composer/DefaultThreadComposerRuntimeCore.js";
import { DefaultEditComposerRuntimeCore } from "../composer/DefaultEditComposerRuntimeCore.js";
import { getThreadMessageText } from "../../utils/getThreadMessageText.js";
var BaseThreadRuntimeCore = class {
  constructor(_contextProvider) {
    this._contextProvider = _contextProvider;
  }
  _subscriptions = /* @__PURE__ */ new Set();
  _isInitialized = false;
  repository = new MessageRepository();
  get messages() {
    return this.repository.getMessages();
  }
  get state() {
    let mostRecentAssistantMessage;
    for (const message of this.messages) {
      if (message.role === "assistant") {
        mostRecentAssistantMessage = message;
        break;
      }
    }
    return mostRecentAssistantMessage?.metadata.unstable_state ?? null;
  }
  composer = new DefaultThreadComposerRuntimeCore(this);
  getModelContext() {
    return this._contextProvider.getModelContext();
  }
  _editComposers = /* @__PURE__ */ new Map();
  getEditComposer(messageId) {
    return this._editComposers.get(messageId);
  }
  beginEdit(messageId) {
    if (this._editComposers.has(messageId))
      throw new Error("Edit already in progress");
    this._editComposers.set(
      messageId,
      new DefaultEditComposerRuntimeCore(
        this,
        () => this._editComposers.delete(messageId),
        this.repository.getMessage(messageId)
      )
    );
    this._notifySubscribers();
  }
  getMessageById(messageId) {
    return this.repository.getMessage(messageId);
  }
  getBranches(messageId) {
    return this.repository.getBranches(messageId);
  }
  switchToBranch(branchId) {
    this.repository.switchToBranch(branchId);
    this._notifySubscribers();
  }
  _notifySubscribers() {
    for (const callback of this._subscriptions) callback();
  }
  _notifyEventSubscribers(event) {
    const subscribers = this._eventSubscribers.get(event);
    if (!subscribers) return;
    for (const callback of subscribers) callback();
  }
  subscribe(callback) {
    this._subscriptions.add(callback);
    return () => this._subscriptions.delete(callback);
  }
  _submittedFeedback = {};
  getSubmittedFeedback(messageId) {
    return this._submittedFeedback[messageId];
  }
  submitFeedback({ messageId, type }) {
    const adapter = this.adapters?.feedback;
    if (!adapter) throw new Error("Feedback adapter not configured");
    const { message } = this.repository.getMessage(messageId);
    adapter.submit({ message, type });
    this._submittedFeedback[messageId] = { type };
    this._notifySubscribers();
  }
  _stopSpeaking;
  speech;
  speak(messageId) {
    const adapter = this.adapters?.speech;
    if (!adapter) throw new Error("Speech adapter not configured");
    const { message } = this.repository.getMessage(messageId);
    this._stopSpeaking?.();
    const utterance = adapter.speak(getThreadMessageText(message));
    const unsub = utterance.subscribe(() => {
      if (utterance.status.type === "ended") {
        this._stopSpeaking = void 0;
        this.speech = void 0;
      } else {
        this.speech = { messageId, status: utterance.status };
      }
      this._notifySubscribers();
    });
    this.speech = { messageId, status: utterance.status };
    this._notifySubscribers();
    this._stopSpeaking = () => {
      utterance.cancel();
      unsub();
      this.speech = void 0;
      this._stopSpeaking = void 0;
    };
  }
  stopSpeaking() {
    if (!this._stopSpeaking) throw new Error("No message is being spoken");
    this._stopSpeaking();
    this._notifySubscribers();
  }
  ensureInitialized() {
    if (!this._isInitialized) {
      this._isInitialized = true;
      this._notifyEventSubscribers("initialize");
    }
  }
  // TODO import()/export() on external store doesn't make much sense
  export() {
    return this.repository.export();
  }
  import(data) {
    this.ensureInitialized();
    this.repository.clear();
    this.repository.import(data);
    this._notifySubscribers();
  }
  reset(initialMessages) {
    this.import(ExportedMessageRepository.fromArray(initialMessages ?? []));
  }
  _eventSubscribers = /* @__PURE__ */ new Map();
  unstable_on(event, callback) {
    if (event === "model-context-update") {
      return this._contextProvider.subscribe?.(callback) ?? (() => {
      });
    }
    const subscribers = this._eventSubscribers.get(event);
    if (!subscribers) {
      this._eventSubscribers.set(event, /* @__PURE__ */ new Set([callback]));
    } else {
      subscribers.add(callback);
    }
    return () => {
      const subscribers2 = this._eventSubscribers.get(event);
      subscribers2.delete(callback);
    };
  }
};
export {
  BaseThreadRuntimeCore
};
//# sourceMappingURL=BaseThreadRuntimeCore.js.map