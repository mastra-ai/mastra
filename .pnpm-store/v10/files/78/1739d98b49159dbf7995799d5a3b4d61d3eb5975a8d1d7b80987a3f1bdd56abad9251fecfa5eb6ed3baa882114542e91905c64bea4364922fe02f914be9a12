"use client";

import { MessagePartState } from "../../api/MessagePartRuntime";
import { useMessagePart } from "../../context/react/MessagePartContext";
import { ImageMessagePart } from "../../types";

export const useMessagePartImage = () => {
  const image = useMessagePart((c) => {
    if (c.type !== "image")
      throw new Error(
        "MessagePartImage can only be used inside image message parts.",
      );

    return c as MessagePartState & ImageMessagePart;
  });

  return image;
};
