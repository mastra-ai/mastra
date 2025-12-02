import { ChatModelRunOptions, ChatModelRunResult } from "../../local";
import {
  ExportedMessageRepository,
  ExportedMessageRepositoryItem,
} from "../../utils/MessageRepository";
import {
  MessageFormatAdapter,
  MessageFormatItem,
  MessageFormatRepository,
} from "./MessageFormatAdapter";

export type GenericThreadHistoryAdapter<TMessage> = {
  load(): Promise<MessageFormatRepository<TMessage>>;
  append(item: MessageFormatItem<TMessage>): Promise<void>;
};

export type ThreadHistoryAdapter = {
  load(): Promise<ExportedMessageRepository & { unstable_resume?: boolean }>;
  resume?(
    options: ChatModelRunOptions,
  ): AsyncGenerator<ChatModelRunResult, void, unknown>;
  append(item: ExportedMessageRepositoryItem): Promise<void>;
  withFormat?<TMessage, TStorageFormat>(
    formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
  ): GenericThreadHistoryAdapter<TMessage>;
};
