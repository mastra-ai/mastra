import type { ToolCallMessagePartComponent } from "../types/MessagePartComponentTypes";
import type { Tool } from "assistant-stream";
export type AssistantToolProps<TArgs extends Record<string, unknown>, TResult> = Tool<TArgs, TResult> & {
    toolName: string;
    render?: ToolCallMessagePartComponent<TArgs, TResult> | undefined;
};
export declare const useAssistantTool: <TArgs extends Record<string, unknown>, TResult>(tool: AssistantToolProps<TArgs, TResult>) => void;
//# sourceMappingURL=useAssistantTool.d.ts.map