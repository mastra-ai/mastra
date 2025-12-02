import { Tool } from "./tool-types";
import { ToolExecutionStream } from "./ToolExecutionStream";
import { AssistantMessage } from "../utils/types";
export declare function unstable_runPendingTools(message: AssistantMessage, tools: Record<string, Tool> | undefined, abortSignal: AbortSignal, human: (toolCallId: string, payload: unknown) => Promise<unknown>): Promise<AssistantMessage>;
export declare function toolResultStream(tools: Record<string, Tool> | (() => Record<string, Tool> | undefined) | undefined, abortSignal: AbortSignal | (() => AbortSignal), human: (toolCallId: string, payload: unknown) => Promise<unknown>): ToolExecutionStream;
//# sourceMappingURL=toolResultStream.d.ts.map