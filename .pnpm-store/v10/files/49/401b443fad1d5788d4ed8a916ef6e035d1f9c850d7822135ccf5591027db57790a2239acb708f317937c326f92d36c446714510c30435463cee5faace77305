"use client";

// src/primitives/messagePart/useMessagePartFile.tsx
import { useMessagePart } from "../../context/react/MessagePartContext.js";
var useMessagePartFile = () => {
  const file = useMessagePart((c) => {
    if (c.type !== "file")
      throw new Error(
        "MessagePartFile can only be used inside file message parts."
      );
    return c;
  });
  return file;
};
export {
  useMessagePartFile
};
//# sourceMappingURL=useMessagePartFile.js.map