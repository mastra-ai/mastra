"use client";

// src/primitives/messagePart/MessagePartInProgress.tsx
import { useMessagePart } from "../../context/index.js";
var MessagePartPrimitiveInProgress = ({ children }) => {
  const isInProgress = useMessagePart((c) => c.status.type === "running");
  return isInProgress ? children : null;
};
MessagePartPrimitiveInProgress.displayName = "MessagePartPrimitive.InProgress";
export {
  MessagePartPrimitiveInProgress
};
//# sourceMappingURL=MessagePartInProgress.js.map