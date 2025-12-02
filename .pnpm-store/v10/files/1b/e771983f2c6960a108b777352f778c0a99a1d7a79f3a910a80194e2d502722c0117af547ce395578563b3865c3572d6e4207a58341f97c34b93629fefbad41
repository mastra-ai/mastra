// src/cloud/AssistantCloudThreadHistoryAdapter.tsx
import { useState } from "react";
import { useThreadListItemRuntime } from "../context/index.js";
import { auiV0Decode, auiV0Encode } from "./auiV0.js";
var globalMessageIdMapping = /* @__PURE__ */ new WeakMap();
var FormattedThreadHistoryAdapter = class {
  constructor(parent, formatAdapter) {
    this.parent = parent;
    this.formatAdapter = formatAdapter;
  }
  async append(item) {
    const encoded = this.formatAdapter.encode(item);
    const messageId = this.formatAdapter.getId(item.message);
    return this.parent._appendWithFormat(
      item.parentId,
      messageId,
      this.formatAdapter.format,
      encoded
    );
  }
  async load() {
    return this.parent._loadWithFormat(
      this.formatAdapter.format,
      (message) => this.formatAdapter.decode(message)
    );
  }
};
var AssistantCloudThreadHistoryAdapter = class {
  constructor(cloudRef, threadListItemRuntime) {
    this.cloudRef = cloudRef;
    this.threadListItemRuntime = threadListItemRuntime;
  }
  get _getIdForLocalId() {
    if (!globalMessageIdMapping.has(this.threadListItemRuntime)) {
      globalMessageIdMapping.set(this.threadListItemRuntime, {});
    }
    return globalMessageIdMapping.get(this.threadListItemRuntime);
  }
  withFormat(formatAdapter) {
    return new FormattedThreadHistoryAdapter(this, formatAdapter);
  }
  async append({ parentId, message }) {
    const { remoteId } = await this.threadListItemRuntime.initialize();
    const task = this.cloudRef.current.threads.messages.create(remoteId, {
      parent_id: parentId ? await this._getIdForLocalId[parentId] ?? parentId : null,
      format: "aui/v0",
      content: auiV0Encode(message)
    }).then(({ message_id }) => {
      this._getIdForLocalId[message.id] = message_id;
      return message_id;
    });
    this._getIdForLocalId[message.id] = task;
    return task.then(() => {
    });
  }
  async load() {
    const remoteId = this.threadListItemRuntime.getState().remoteId;
    if (!remoteId) return { messages: [] };
    const { messages } = await this.cloudRef.current.threads.messages.list(
      remoteId,
      {
        format: "aui/v0"
      }
    );
    const payload = {
      messages: messages.filter(
        (m) => m.format === "aui/v0"
      ).map(auiV0Decode).reverse()
    };
    return payload;
  }
  // Internal methods for FormattedThreadHistoryAdapter
  async _appendWithFormat(parentId, messageId, format, content) {
    const { remoteId } = await this.threadListItemRuntime.initialize();
    const task = this.cloudRef.current.threads.messages.create(remoteId, {
      parent_id: parentId ? await this._getIdForLocalId[parentId] ?? parentId : null,
      format,
      content
    }).then(({ message_id }) => {
      this._getIdForLocalId[messageId] = message_id;
      return message_id;
    });
    this._getIdForLocalId[messageId] = task;
    return task.then(() => {
    });
  }
  async _loadWithFormat(format, decoder) {
    const remoteId = this.threadListItemRuntime.getState().remoteId;
    if (!remoteId) return { messages: [] };
    const { messages } = await this.cloudRef.current.threads.messages.list(
      remoteId,
      {
        format
      }
    );
    return {
      messages: messages.filter((m) => m.format === format).map(
        (m) => decoder({
          id: m.id,
          parent_id: m.parent_id,
          format: m.format,
          content: m.content
        })
      ).reverse()
    };
  }
};
var useAssistantCloudThreadHistoryAdapter = (cloudRef) => {
  const threadListItemRuntime = useThreadListItemRuntime();
  const [adapter] = useState(
    () => new AssistantCloudThreadHistoryAdapter(cloudRef, threadListItemRuntime)
  );
  return adapter;
};
export {
  useAssistantCloudThreadHistoryAdapter
};
//# sourceMappingURL=AssistantCloudThreadHistoryAdapter.js.map