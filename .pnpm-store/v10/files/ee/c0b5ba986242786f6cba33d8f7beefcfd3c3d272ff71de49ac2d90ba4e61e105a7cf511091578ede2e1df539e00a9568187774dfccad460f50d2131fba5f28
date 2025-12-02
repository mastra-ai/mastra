"use client";

// src/model-context/useAssistantToolUI.tsx
import { useEffect } from "react";
import { useToolUIsStore } from "../context/react/AssistantContext.js";
var useAssistantToolUI = (tool) => {
  const toolUIsStore = useToolUIsStore();
  useEffect(() => {
    if (!tool?.toolName || !tool?.render) return;
    return toolUIsStore.getState().setToolUI(tool.toolName, tool.render);
  }, [toolUIsStore, tool?.toolName, tool?.render]);
};
export {
  useAssistantToolUI
};
//# sourceMappingURL=useAssistantToolUI.js.map