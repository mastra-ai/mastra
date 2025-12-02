import {
  ThreadAssistantMessagePart,
  ThreadUserMessagePart,
  MessagePartStatus,
  ToolCallMessagePartStatus,
} from "../types/AssistantTypes";
import { ThreadRuntimeCoreBinding } from "./ThreadRuntime";
import type { MessageStateBinding } from "./RuntimeBindings";
import { SubscribableWithState } from "./subscribable/Subscribable";
import { Unsubscribe } from "../types";
import { MessagePartRuntimePath } from "./RuntimePathTypes";
import { ToolResponse } from "assistant-stream";

export type MessagePartState = (
  | ThreadUserMessagePart
  | ThreadAssistantMessagePart
) & {
  readonly status: MessagePartStatus | ToolCallMessagePartStatus;
};

type MessagePartSnapshotBinding = SubscribableWithState<
  MessagePartState,
  MessagePartRuntimePath
>;

export type MessagePartRuntime = {
  /**
   * Add tool result to a tool call message part that has no tool result yet.
   * This is useful when you are collecting a tool result via user input ("human tool calls").
   */
  addToolResult(result: any | ToolResponse<any>): void;

  readonly path: MessagePartRuntimePath;
  getState(): MessagePartState;
  subscribe(callback: () => void): Unsubscribe;
};

export class MessagePartRuntimeImpl implements MessagePartRuntime {
  public get path() {
    return this.contentBinding.path;
  }

  constructor(
    private contentBinding: MessagePartSnapshotBinding,
    private messageApi?: MessageStateBinding,
    private threadApi?: ThreadRuntimeCoreBinding,
  ) {}

  protected __internal_bindMethods() {
    this.addToolResult = this.addToolResult.bind(this);
    this.getState = this.getState.bind(this);
    this.subscribe = this.subscribe.bind(this);
  }

  public getState() {
    return this.contentBinding.getState();
  }

  public addToolResult(result: any | ToolResponse<any>) {
    const state = this.contentBinding.getState();
    if (!state) throw new Error("Message part is not available");

    if (state.type !== "tool-call")
      throw new Error("Tried to add tool result to non-tool message part");

    if (!this.messageApi)
      throw new Error(
        "Message API is not available. This is likely a bug in assistant-ui.",
      );
    if (!this.threadApi) throw new Error("Thread API is not available");

    const message = this.messageApi.getState();
    if (!message) throw new Error("Message is not available");

    const toolName = state.toolName;
    const toolCallId = state.toolCallId;

    const response = ToolResponse.toResponse(result);
    this.threadApi.getState().addToolResult({
      messageId: message.id,
      toolName,
      toolCallId,
      result: response.result,
      artifact: response.artifact,
      isError: response.isError,
    });
  }

  public subscribe(callback: () => void) {
    return this.contentBinding.subscribe(callback);
  }
}
