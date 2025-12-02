"use client";

// src/primitives/messagePart/useMessagePartSource.tsx
import { useMessagePart } from "../../context/react/MessagePartContext.js";
var useMessagePartSource = () => {
  const source = useMessagePart((c) => {
    if (c.type !== "source")
      throw new Error(
        "MessagePartSource can only be used inside source message parts."
      );
    return c;
  });
  return source;
};
export {
  useMessagePartSource
};
//# sourceMappingURL=useMessagePartSource.js.map