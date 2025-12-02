"use client";

// src/primitives/messagePart/useMessagePartReasoning.tsx
import { useMessagePart } from "../../context/react/MessagePartContext.js";
var useMessagePartReasoning = () => {
  const text = useMessagePart((c) => {
    if (c.type !== "reasoning")
      throw new Error(
        "MessagePartReasoning can only be used inside reasoning message parts."
      );
    return c;
  });
  return text;
};
export {
  useMessagePartReasoning
};
//# sourceMappingURL=useMessagePartReasoning.js.map