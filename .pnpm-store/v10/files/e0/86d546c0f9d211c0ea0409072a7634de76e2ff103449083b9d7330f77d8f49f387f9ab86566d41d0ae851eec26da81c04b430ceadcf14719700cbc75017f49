"use client";

import { MessagePartState } from "../../api/MessagePartRuntime";
import { useMessagePart } from "../../context/react/MessagePartContext";
import { ReasoningMessagePart } from "../../types";

export const useMessagePartReasoning = () => {
  const text = useMessagePart((c) => {
    if (c.type !== "reasoning")
      throw new Error(
        "MessagePartReasoning can only be used inside reasoning message parts.",
      );

    return c as MessagePartState & ReasoningMessagePart;
  });

  return text;
};
