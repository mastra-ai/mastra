// src/runtimes/external-store/ExternalStoreThreadRuntimeCore.tsx
import {
  getExternalStoreMessage,
  symbolInnerMessage
} from "./getExternalStoreMessage.js";
import { ThreadMessageConverter } from "./ThreadMessageConverter.js";
import { getAutoStatus, isAutoStatus } from "./auto-status.js";
import { fromThreadMessageLike } from "./ThreadMessageLike.js";
import { getThreadMessageText } from "../../utils/getThreadMessageText.js";
import { BaseThreadRuntimeCore } from "../core/BaseThreadRuntimeCore.js";
import {
  ExportedMessageRepository,
  MessageRepository
} from "../utils/MessageRepository.js";
var EMPTY_ARRAY = Object.freeze([]);
var hasUpcomingMessage = (isRunning, messages) => {
  return isRunning && messages[messages.length - 1]?.role !== "assistant";
};
var ExternalStoreThreadRuntimeCore = class extends BaseThreadRuntimeCore {
  _assistantOptimisticId = null;
  _capabilities = {
    switchToBranch: false,
    edit: false,
    reload: false,
    cancel: false,
    unstable_copy: false,
    speech: false,
    attachments: false,
    feedback: false
  };
  get capabilities() {
    return this._capabilities;
  }
  _messages;
  isDisabled;
  get isLoading() {
    return this._store.isLoading ?? false;
  }
  get messages() {
    return this._messages;
  }
  get adapters() {
    return this._store.adapters;
  }
  suggestions = [];
  extras = void 0;
  _converter = new ThreadMessageConverter();
  _store;
  beginEdit(messageId) {
    if (!this._store.onEdit)
      throw new Error("Runtime does not support editing.");
    super.beginEdit(messageId);
  }
  constructor(contextProvider, store) {
    super(contextProvider);
    this.__internal_setAdapter(store);
  }
  __internal_setAdapter(store) {
    if (this._store === store) return;
    const isRunning = store.isRunning ?? false;
    this.isDisabled = store.isDisabled ?? false;
    const oldStore = this._store;
    this._store = store;
    this.extras = store.extras;
    this.suggestions = store.suggestions ?? EMPTY_ARRAY;
    this._capabilities = {
      switchToBranch: this._store.setMessages !== void 0,
      edit: this._store.onEdit !== void 0,
      reload: this._store.onReload !== void 0,
      cancel: this._store.onCancel !== void 0,
      speech: this._store.adapters?.speech !== void 0,
      unstable_copy: this._store.unstable_capabilities?.copy !== false,
      // default true
      attachments: !!this._store.adapters?.attachments,
      feedback: !!this._store.adapters?.feedback
    };
    let messages;
    if (store.messageRepository) {
      if (oldStore && oldStore.isRunning === store.isRunning && oldStore.messageRepository === store.messageRepository) {
        this._notifySubscribers();
        return;
      }
      this.repository.clear();
      this._assistantOptimisticId = null;
      this.repository.import(store.messageRepository);
      messages = this.repository.getMessages();
    } else if (store.messages) {
      if (oldStore) {
        if (oldStore.convertMessage !== store.convertMessage) {
          this._converter = new ThreadMessageConverter();
        } else if (oldStore.isRunning === store.isRunning && oldStore.messages === store.messages) {
          this._notifySubscribers();
          return;
        }
      }
      messages = !store.convertMessage ? store.messages : this._converter.convertMessages(store.messages, (cache, m, idx) => {
        if (!store.convertMessage) return m;
        const isLast = idx === store.messages.length - 1;
        const autoStatus = getAutoStatus(isLast, isRunning, false);
        if (cache && (cache.role !== "assistant" || !isAutoStatus(cache.status) || cache.status === autoStatus))
          return cache;
        const messageLike = store.convertMessage(m, idx);
        const newMessage = fromThreadMessageLike(
          messageLike,
          idx.toString(),
          autoStatus
        );
        newMessage[symbolInnerMessage] = m;
        return newMessage;
      });
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const parent = messages[i - 1];
        this.repository.addOrUpdateMessage(parent?.id ?? null, message);
      }
    } else {
      throw new Error(
        "ExternalStoreAdapter must provide either 'messages' or 'messageRepository'"
      );
    }
    if (messages.length > 0) this.ensureInitialized();
    if ((oldStore?.isRunning ?? false) !== (store.isRunning ?? false)) {
      if (store.isRunning) {
        this._notifyEventSubscribers("run-start");
      } else {
        this._notifyEventSubscribers("run-end");
      }
    }
    if (this._assistantOptimisticId) {
      this.repository.deleteMessage(this._assistantOptimisticId);
      this._assistantOptimisticId = null;
    }
    if (hasUpcomingMessage(isRunning, messages)) {
      this._assistantOptimisticId = this.repository.appendOptimisticMessage(
        messages.at(-1)?.id ?? null,
        {
          role: "assistant",
          content: []
        }
      );
    }
    this.repository.resetHead(
      this._assistantOptimisticId ?? messages.at(-1)?.id ?? null
    );
    this._messages = this.repository.getMessages();
    this._notifySubscribers();
  }
  switchToBranch(branchId) {
    if (!this._store.setMessages)
      throw new Error("Runtime does not support switching branches.");
    this.repository.switchToBranch(branchId);
    this.updateMessages(this.repository.getMessages());
  }
  async append(message) {
    if (message.parentId !== (this.messages.at(-1)?.id ?? null)) {
      if (!this._store.onEdit)
        throw new Error("Runtime does not support editing messages.");
      await this._store.onEdit(message);
    } else {
      await this._store.onNew(message);
    }
  }
  async startRun(config) {
    if (!this._store.onReload)
      throw new Error("Runtime does not support reloading messages.");
    await this._store.onReload(config.parentId, config);
  }
  async resumeRun() {
    throw new Error("Runtime does not support resuming runs.");
  }
  cancelRun() {
    if (!this._store.onCancel)
      throw new Error("Runtime does not support cancelling runs.");
    this._store.onCancel();
    if (this._assistantOptimisticId) {
      this.repository.deleteMessage(this._assistantOptimisticId);
      this._assistantOptimisticId = null;
    }
    let messages = this.repository.getMessages();
    const previousMessage = messages[messages.length - 1];
    if (previousMessage?.role === "user" && previousMessage.id === messages.at(-1)?.id) {
      this.repository.deleteMessage(previousMessage.id);
      if (!this.composer.text.trim()) {
        this.composer.setText(getThreadMessageText(previousMessage));
      }
      messages = this.repository.getMessages();
    } else {
      this._notifySubscribers();
    }
    setTimeout(() => {
      this.updateMessages(messages);
    }, 0);
  }
  addToolResult(options) {
    if (!this._store.onAddToolResult && !this._store.onAddToolResult)
      throw new Error("Runtime does not support tool results.");
    this._store.onAddToolResult?.(options);
  }
  reset(initialMessages) {
    const repo = new MessageRepository();
    repo.import(ExportedMessageRepository.fromArray(initialMessages ?? []));
    this.updateMessages(repo.getMessages());
  }
  import(data) {
    this._assistantOptimisticId = null;
    super.import(data);
  }
  updateMessages = (messages) => {
    const hasConverter = this._store.convertMessage !== void 0;
    if (hasConverter) {
      this._store.setMessages?.(
        messages.flatMap(getExternalStoreMessage).filter((m) => m != null)
      );
    } else {
      this._store.setMessages?.(messages);
    }
  };
};
export {
  ExternalStoreThreadRuntimeCore,
  hasUpcomingMessage
};
//# sourceMappingURL=ExternalStoreThreadRuntimeCore.js.map