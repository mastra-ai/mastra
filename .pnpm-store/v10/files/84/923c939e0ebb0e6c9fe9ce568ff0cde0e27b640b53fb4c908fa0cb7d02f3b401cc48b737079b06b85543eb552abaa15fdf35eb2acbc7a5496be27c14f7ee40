import { AppendMessage, ThreadMessage } from "../../types";
import { AttachmentAdapter } from "../adapters/attachment";
import {
  AddToolResultOptions,
  StartRunConfig,
  ThreadSuggestion,
} from "../core/ThreadRuntimeCore";
import { FeedbackAdapter } from "../adapters/feedback/FeedbackAdapter";
import { SpeechSynthesisAdapter } from "../adapters/speech/SpeechAdapterTypes";
import { ThreadMessageLike } from "./ThreadMessageLike";
import { ExportedMessageRepository } from "../utils/MessageRepository";

export type ExternalStoreThreadData<TState extends "regular" | "archived"> = {
  status: TState;
  threadId: string;
  title?: string | undefined;
};

export type ExternalStoreThreadListAdapter = {
  /**
   * @deprecated This API is still under active development and might change without notice.
   */
  threadId?: string | undefined;
  isLoading?: boolean | undefined;
  threads?: readonly ExternalStoreThreadData<"regular">[] | undefined;
  archivedThreads?: readonly ExternalStoreThreadData<"archived">[] | undefined;
  /**
   * @deprecated This API is still under active development and might change without notice.
   */
  onSwitchToNewThread?: (() => Promise<void> | void) | undefined;
  /**
   * @deprecated This API is still under active development and might change without notice.
   */
  onSwitchToThread?: ((threadId: string) => Promise<void> | void) | undefined;
  onRename?: (
    threadId: string,
    newTitle: string,
  ) => (Promise<void> | void) | undefined;
  onArchive?: ((threadId: string) => Promise<void> | void) | undefined;
  onUnarchive?: ((threadId: string) => Promise<void> | void) | undefined;
  onDelete?: ((threadId: string) => Promise<void> | void) | undefined;
};

export type ExternalStoreMessageConverter<T> = (
  message: T,
  idx: number,
) => ThreadMessageLike;

type ExternalStoreMessageConverterAdapter<T> = {
  convertMessage: ExternalStoreMessageConverter<T>;
};

type ExternalStoreAdapterBase<T> = {
  isDisabled?: boolean | undefined;
  isRunning?: boolean | undefined;
  isLoading?: boolean | undefined;
  messages?: readonly T[];
  messageRepository?: ExportedMessageRepository;
  suggestions?: readonly ThreadSuggestion[] | undefined;
  extras?: unknown;

  setMessages?: ((messages: T[]) => void) | undefined;
  onNew: (message: AppendMessage) => Promise<void>;
  onEdit?: ((message: AppendMessage) => Promise<void>) | undefined;
  onReload?: // TODO: remove parentId in 0.8.0
  | ((parentId: string | null, config: StartRunConfig) => Promise<void>)
    | undefined;
  onCancel?: (() => Promise<void>) | undefined;
  onAddToolResult?:
    | ((options: AddToolResultOptions) => Promise<void> | void)
    | undefined;
  convertMessage?: ExternalStoreMessageConverter<T> | undefined;
  adapters?:
    | {
        attachments?: AttachmentAdapter | undefined;
        speech?: SpeechSynthesisAdapter | undefined;
        feedback?: FeedbackAdapter | undefined;
        /**
         * @deprecated This API is still under active development and might change without notice.
         */
        threadList?: ExternalStoreThreadListAdapter | undefined;
      }
    | undefined;
  unstable_capabilities?:
    | {
        copy?: boolean | undefined;
      }
    | undefined;
};

export type ExternalStoreAdapter<T = ThreadMessage> =
  ExternalStoreAdapterBase<T> &
    (T extends ThreadMessage
      ? object
      : ExternalStoreMessageConverterAdapter<T>);
