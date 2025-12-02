"use client";

import { FC } from "react";
import { type AssistantToolProps, useAssistantTool } from "./useAssistantTool";

export type AssistantTool = FC & {
  unstable_tool: AssistantToolProps<any, any>;
};

export const makeAssistantTool = <
  TArgs extends Record<string, unknown>,
  TResult,
>(
  tool: AssistantToolProps<TArgs, TResult>,
) => {
  const Tool: AssistantTool = () => {
    useAssistantTool(tool);
    return null;
  };
  Tool.unstable_tool = tool;
  return Tool;
};
