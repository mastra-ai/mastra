"use client";

import { MessagePartState } from "../../api/MessagePartRuntime";
import { useMessagePart } from "../../context/react/MessagePartContext";
import { TextMessagePart, ReasoningMessagePart } from "../../types";

export const useMessagePartText = () => {
  const text = useMessagePart((c) => {
    if (c.type !== "text" && c.type !== "reasoning")
      throw new Error(
        "MessagePartText can only be used inside text or reasoning message parts.",
      );

    return c as MessagePartState & (TextMessagePart | ReasoningMessagePart);
  });

  return text;
};
