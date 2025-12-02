"use client";

// src/primitives/messagePart/useMessagePartImage.tsx
import { useMessagePart } from "../../context/react/MessagePartContext.js";
var useMessagePartImage = () => {
  const image = useMessagePart((c) => {
    if (c.type !== "image")
      throw new Error(
        "MessagePartImage can only be used inside image message parts."
      );
    return c;
  });
  return image;
};
export {
  useMessagePartImage
};
//# sourceMappingURL=useMessagePartImage.js.map