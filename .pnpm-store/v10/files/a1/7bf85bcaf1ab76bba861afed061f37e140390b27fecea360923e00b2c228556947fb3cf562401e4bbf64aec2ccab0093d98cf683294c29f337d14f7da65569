"use client";

// src/primitives/messagePart/useMessagePartText.tsx
import { useMessagePart } from "../../context/react/MessagePartContext.js";
var useMessagePartText = () => {
  const text = useMessagePart((c) => {
    if (c.type !== "text" && c.type !== "reasoning")
      throw new Error(
        "MessagePartText can only be used inside text or reasoning message parts."
      );
    return c;
  });
  return text;
};
export {
  useMessagePartText
};
//# sourceMappingURL=useMessagePartText.js.map