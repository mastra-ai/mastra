import { create } from "zustand";
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
  setToolUI: (
    toolName: string,
    render: ToolCallMessagePartComponent,
  ) => Unsubscribe;
};

export const makeAssistantToolUIsStore = () =>
  create<AssistantToolUIsState>((set) => {
    const renderers = new Map<string, ToolCallMessagePartComponent[]>();

    return Object.freeze({
      getToolUI: (name) => {
        const arr = renderers.get(name);
        const last = arr?.at(-1);
        if (last) return last;
        return null;
      },
      setToolUI: (name, render) => {
        let arr = renderers.get(name);
        if (!arr) {
          arr = [];
          renderers.set(name, arr);
        }
        arr.push(render);
        set({}); // notify the store listeners

        return () => {
          const index = arr.indexOf(render);
          if (index !== -1) {
            arr.splice(index, 1);
          }
          if (index === arr.length) {
            set({}); // notify the store listeners
          }
        };
      },
    }) satisfies AssistantToolUIsState;
  });
