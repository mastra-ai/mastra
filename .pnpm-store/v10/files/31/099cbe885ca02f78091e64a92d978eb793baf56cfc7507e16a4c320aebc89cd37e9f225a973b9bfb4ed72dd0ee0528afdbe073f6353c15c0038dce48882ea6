"use client";

// src/model-context/useAssistantTool.tsx
import { useEffect } from "react";
import {
  useAssistantRuntime,
  useToolUIsStore
} from "../context/react/AssistantContext.js";
var useAssistantTool = (tool) => {
  const assistantRuntime = useAssistantRuntime();
  const toolUIsStore = useToolUIsStore();
  useEffect(() => {
    return tool.render ? toolUIsStore.getState().setToolUI(tool.toolName, tool.render) : void 0;
  }, [toolUIsStore, tool.toolName, tool.render]);
  useEffect(() => {
    const { toolName, render, ...rest } = tool;
    const context = {
      tools: {
        [toolName]: rest
      }
    };
    return assistantRuntime.registerModelContextProvider({
      getModelContext: () => context
    });
  }, [assistantRuntime, tool]);
};
export {
  useAssistantTool
};
//# sourceMappingURL=useAssistantTool.js.map