import type { ToolCallMessagePartComponent } from "../../types/MessagePartComponentTypes";
import { Unsubscribe } from "../../types";
export type AssistantToolUIsState = {
    /**
     * Get the tool UI configured for a given tool name.
     */
    getToolUI: (toolName: string) => ToolCallMessagePartComponent | null;
    /**
     * Registers a tool UI for a given tool name. Returns an unsubscribe function to remove the tool UI.
     */
    setToolUI: (toolName: string, render: ToolCallMessagePartComponent) => Unsubscribe;
};
export declare const makeAssistantToolUIsStore: () => import("zustand").UseBoundStore<import("zustand").StoreApi<AssistantToolUIsState>>;
//# sourceMappingURL=AssistantToolUIs.d.ts.map