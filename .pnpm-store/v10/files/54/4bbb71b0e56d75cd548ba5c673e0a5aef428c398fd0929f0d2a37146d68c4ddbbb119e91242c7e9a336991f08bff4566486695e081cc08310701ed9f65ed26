"use client";

import { MessagePartState } from "../../api/MessagePartRuntime";
import { useMessagePart } from "../../context/react/MessagePartContext";
import { SourceMessagePart } from "../../types";

export const useMessagePartSource = () => {
  const source = useMessagePart((c) => {
    if (c.type !== "source")
      throw new Error(
        "MessagePartSource can only be used inside source message parts.",
      );

    return c as MessagePartState & SourceMessagePart;
  });

  return source;
};
