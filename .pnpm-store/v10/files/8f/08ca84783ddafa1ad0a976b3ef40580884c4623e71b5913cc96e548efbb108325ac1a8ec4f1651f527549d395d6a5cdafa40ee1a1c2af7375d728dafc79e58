"use client";

// src/model-context/useAssistantInstructions.tsx
import { useEffect } from "react";
import { useAssistantRuntime } from "../context/index.js";
var getInstructions = (instruction) => {
  if (typeof instruction === "string") return { instruction };
  return instruction;
};
var useAssistantInstructions = (config) => {
  const { instruction, disabled = false } = getInstructions(config);
  const assistantRuntime = useAssistantRuntime();
  useEffect(() => {
    if (disabled) return;
    const config2 = {
      system: instruction
    };
    return assistantRuntime.registerModelContextProvider({
      getModelContext: () => config2
    });
  }, [assistantRuntime, instruction, disabled]);
};
export {
  useAssistantInstructions
};
//# sourceMappingURL=useAssistantInstructions.js.map