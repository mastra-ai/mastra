import { ThreadAssistantMessagePart, ThreadUserMessagePart, MessagePartStatus, ToolCallMessagePartStatus } from "../types/AssistantTypes";
import { ThreadRuntimeCoreBinding } from "./ThreadRuntime";
import type { MessageStateBinding } from "./RuntimeBindings";
import { SubscribableWithState } from "./subscribable/Subscribable";
import { Unsubscribe } from "../types";
import { MessagePartRuntimePath } from "./RuntimePathTypes";
import { ToolResponse } from "assistant-stream";
export type MessagePartState = (ThreadUserMessagePart | ThreadAssistantMessagePart) & {
    readonly status: MessagePartStatus | ToolCallMessagePartStatus;
};
type MessagePartSnapshotBinding = SubscribableWithState<MessagePartState, MessagePartRuntimePath>;
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
export declare class MessagePartRuntimeImpl implements MessagePartRuntime {
    private contentBinding;
    private messageApi?;
    private threadApi?;
    get path(): MessagePartRuntimePath;
    constructor(contentBinding: MessagePartSnapshotBinding, messageApi?: MessageStateBinding | undefined, threadApi?: ThreadRuntimeCoreBinding | undefined);
    protected __internal_bindMethods(): void;
    getState(): MessagePartState;
    addToolResult(result: any | ToolResponse<any>): void;
    subscribe(callback: () => void): Unsubscribe;
}
export {};
//# sourceMappingURL=MessagePartRuntime.d.ts.map