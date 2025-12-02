import type {
  FileMessagePart,
  MessageStatus,
  ReasoningMessagePart,
  RunConfig,
  SourceMessagePart,
  TextMessagePart,
  ThreadAssistantMessagePart,
  ThreadMessage,
  ThreadStep,
  ToolCallMessagePart,
} from "../../types/AssistantTypes";
import type { ModelContext } from "../../model-context/ModelContextTypes";
import { ReadonlyJSONValue } from "assistant-stream/utils";

export type ChatModelRunUpdate = {
  readonly content: readonly ThreadAssistantMessagePart[];
  readonly metadata?: Record<string, unknown>;
};

export type ChatModelRunResult = {
  readonly content?: readonly ThreadAssistantMessagePart[] | undefined;
  readonly status?: MessageStatus | undefined;
  readonly metadata?: {
    readonly unstable_state?: ReadonlyJSONValue;
    readonly unstable_annotations?: readonly ReadonlyJSONValue[] | undefined;
    readonly unstable_data?: readonly ReadonlyJSONValue[] | undefined;
    readonly steps?: readonly ThreadStep[] | undefined;
    readonly custom?: Record<string, unknown> | undefined;
  };
};

export type CoreChatModelRunResult = Omit<ChatModelRunResult, "content"> & {
  readonly content: readonly (
    | TextMessagePart
    | ReasoningMessagePart
    | ToolCallMessagePart
    | SourceMessagePart
    | FileMessagePart
  )[];
};

export type ChatModelRunOptions = {
  readonly messages: readonly ThreadMessage[];
  readonly runConfig: RunConfig;
  readonly abortSignal: AbortSignal;
  readonly context: ModelContext;

  /**
   * @deprecated This field was renamed to `context`.
   */
  readonly config: ModelContext;

  readonly unstable_assistantMessageId?: string;
  unstable_getMessage(): ThreadMessage;
};

export type ChatModelAdapter = {
  run(
    options: ChatModelRunOptions,
  ): Promise<ChatModelRunResult> | AsyncGenerator<ChatModelRunResult, void>;
};
