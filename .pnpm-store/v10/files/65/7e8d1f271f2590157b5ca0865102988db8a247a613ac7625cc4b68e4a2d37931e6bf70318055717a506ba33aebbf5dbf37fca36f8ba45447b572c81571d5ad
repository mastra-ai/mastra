"use client";

import { MessagePartState } from "../../api/MessagePartRuntime";
import { useMessagePart } from "../../context/react/MessagePartContext";
import { FileMessagePart } from "../../types";

export const useMessagePartFile = () => {
  const file = useMessagePart((c) => {
    if (c.type !== "file")
      throw new Error(
        "MessagePartFile can only be used inside file message parts.",
      );

    return c as MessagePartState & FileMessagePart;
  });

  return file;
};
