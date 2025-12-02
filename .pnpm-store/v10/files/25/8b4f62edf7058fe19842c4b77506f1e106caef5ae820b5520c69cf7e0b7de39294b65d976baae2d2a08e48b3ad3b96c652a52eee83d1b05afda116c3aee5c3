"use client";

import { useEffect } from "react";
import { useToolUIsStore } from "../context/react/AssistantContext";
import type { ToolCallMessagePartComponent } from "../types/MessagePartComponentTypes";

export type AssistantToolUIProps<TArgs, TResult> = {
  toolName: string;
  render: ToolCallMessagePartComponent<TArgs, TResult>;
};

export const useAssistantToolUI = (
  tool: AssistantToolUIProps<any, any> | null,
) => {
  const toolUIsStore = useToolUIsStore();
  useEffect(() => {
    if (!tool?.toolName || !tool?.render) return;
    return toolUIsStore.getState().setToolUI(tool.toolName, tool.render);
  }, [toolUIsStore, tool?.toolName, tool?.render]);
};
