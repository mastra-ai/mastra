import { RefObject, useState } from "react";
import { useThreadListItemRuntime } from "../context";
import { ThreadHistoryAdapter } from "../runtimes/adapters/thread-history/ThreadHistoryAdapter";
import { ExportedMessageRepositoryItem } from "../runtimes/utils/MessageRepository";
import { AssistantCloud } from "assistant-cloud";
import { auiV0Decode, auiV0Encode } from "./auiV0";
import { ThreadListItemRuntime } from "../api";
import {
  MessageFormatAdapter,
  MessageFormatItem,
  MessageFormatRepository,
  MessageStorageEntry,
} from "../runtimes/adapters/thread-history/MessageFormatAdapter";
import { GenericThreadHistoryAdapter } from "../runtimes/adapters/thread-history/ThreadHistoryAdapter";
import { ReadonlyJSONObject } from "assistant-stream/utils";

// Global WeakMap to store message ID mappings across adapter instances
const globalMessageIdMapping = new WeakMap<
  ThreadListItemRuntime,
  Record<string, string | Promise<string>>
>();

class FormattedThreadHistoryAdapter<TMessage, TStorageFormat>
  implements GenericThreadHistoryAdapter<TMessage>
{
  constructor(
    private parent: AssistantCloudThreadHistoryAdapter,
    private formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
  ) {}

  async append(item: MessageFormatItem<TMessage>) {
    // Encode the message using the format adapter
    const encoded = this.formatAdapter.encode(item);
    const messageId = this.formatAdapter.getId(item.message);

    // Delegate to parent's internal append method with the encoded format
    return this.parent._appendWithFormat(
      item.parentId,
      messageId,
      this.formatAdapter.format,
      encoded,
    );
  }

  async load(): Promise<MessageFormatRepository<TMessage>> {
    // Delegate to parent's internal load method with format filter
    return this.parent._loadWithFormat(
      this.formatAdapter.format,
      (message: MessageStorageEntry<TStorageFormat>) =>
        this.formatAdapter.decode(message),
    );
  }
}

class AssistantCloudThreadHistoryAdapter implements ThreadHistoryAdapter {
  constructor(
    private cloudRef: RefObject<AssistantCloud>,
    private threadListItemRuntime: ThreadListItemRuntime,
  ) {}

  private get _getIdForLocalId(): Record<string, string | Promise<string>> {
    if (!globalMessageIdMapping.has(this.threadListItemRuntime)) {
      globalMessageIdMapping.set(this.threadListItemRuntime, {});
    }
    return globalMessageIdMapping.get(this.threadListItemRuntime)!;
  }

  withFormat<TMessage, TStorageFormat>(
    formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
  ): GenericThreadHistoryAdapter<TMessage> {
    return new FormattedThreadHistoryAdapter(this, formatAdapter);
  }

  async append({ parentId, message }: ExportedMessageRepositoryItem) {
    const { remoteId } = await this.threadListItemRuntime.initialize();
    const task = this.cloudRef.current.threads.messages
      .create(remoteId, {
        parent_id: parentId
          ? ((await this._getIdForLocalId[parentId]) ?? parentId)
          : null,
        format: "aui/v0",
        content: auiV0Encode(message),
      })
      .then(({ message_id }) => {
        this._getIdForLocalId[message.id] = message_id;
        return message_id;
      });

    this._getIdForLocalId[message.id] = task;

    return task.then(() => {});
  }

  async load() {
    const remoteId = this.threadListItemRuntime.getState().remoteId;
    if (!remoteId) return { messages: [] };
    const { messages } = await this.cloudRef.current.threads.messages.list(
      remoteId,
      {
        format: "aui/v0",
      },
    );
    const payload = {
      messages: messages
        .filter(
          (m): m is typeof m & { format: "aui/v0" } => m.format === "aui/v0",
        )
        .map(auiV0Decode)
        .reverse(),
    };
    return payload;
  }

  // Internal methods for FormattedThreadHistoryAdapter
  async _appendWithFormat<T>(
    parentId: string | null,
    messageId: string,
    format: string,
    content: T,
  ) {
    const { remoteId } = await this.threadListItemRuntime.initialize();

    const task = this.cloudRef.current.threads.messages
      .create(remoteId, {
        parent_id: parentId
          ? ((await this._getIdForLocalId[parentId]) ?? parentId)
          : null,
        format,
        content: content as ReadonlyJSONObject,
      })
      .then(({ message_id }) => {
        this._getIdForLocalId[messageId] = message_id;
        return message_id;
      });

    this._getIdForLocalId[messageId] = task;

    return task.then(() => {});
  }

  async _loadWithFormat<TMessage, TStorageFormat>(
    format: string,
    decoder: (
      message: MessageStorageEntry<TStorageFormat>,
    ) => MessageFormatItem<TMessage>,
  ): Promise<MessageFormatRepository<TMessage>> {
    const remoteId = this.threadListItemRuntime.getState().remoteId;
    if (!remoteId) return { messages: [] };

    const { messages } = await this.cloudRef.current.threads.messages.list(
      remoteId,
      {
        format,
      },
    );

    return {
      messages: messages
        .filter((m) => m.format === format)
        .map((m) =>
          decoder({
            id: m.id,
            parent_id: m.parent_id,
            format: m.format,
            content: m.content as TStorageFormat,
          }),
        )
        .reverse(),
    };
  }
}

export const useAssistantCloudThreadHistoryAdapter = (
  cloudRef: RefObject<AssistantCloud>,
): ThreadHistoryAdapter => {
  const threadListItemRuntime = useThreadListItemRuntime();
  const [adapter] = useState(
    () =>
      new AssistantCloudThreadHistoryAdapter(cloudRef, threadListItemRuntime),
  );

  return adapter;
};
