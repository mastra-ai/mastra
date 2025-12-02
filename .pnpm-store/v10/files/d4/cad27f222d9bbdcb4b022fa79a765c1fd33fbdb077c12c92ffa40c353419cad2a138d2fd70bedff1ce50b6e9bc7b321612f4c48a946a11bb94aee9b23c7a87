"use client";

import { useEffect } from "react";
import { useAssistantRuntime } from "../context";

export type AssistantInstructionsConfig = {
  disabled?: boolean | undefined;
  instruction: string;
};

const getInstructions = (
  instruction: string | AssistantInstructionsConfig,
): AssistantInstructionsConfig => {
  if (typeof instruction === "string") return { instruction };
  return instruction;
};

export const useAssistantInstructions = (
  config: string | AssistantInstructionsConfig,
) => {
  const { instruction, disabled = false } = getInstructions(config);
  const assistantRuntime = useAssistantRuntime();

  useEffect(() => {
    if (disabled) return;

    const config = {
      system: instruction,
    };
    return assistantRuntime.registerModelContextProvider({
      getModelContext: () => config,
    });
  }, [assistantRuntime, instruction, disabled]);
};
