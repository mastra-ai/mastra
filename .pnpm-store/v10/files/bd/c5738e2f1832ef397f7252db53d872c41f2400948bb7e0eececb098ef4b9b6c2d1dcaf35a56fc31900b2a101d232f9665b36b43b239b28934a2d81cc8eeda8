"use client";

// src/primitives/message/MessageError.tsx
import { useMessage } from "../../context/react/MessageContext.js";
import { Fragment, jsx } from "react/jsx-runtime";
var MessagePrimitiveError = ({ children }) => {
  const hasError = useMessage(
    (m) => m.status?.type === "incomplete" && m.status.reason === "error"
  );
  return hasError ? /* @__PURE__ */ jsx(Fragment, { children }) : null;
};
MessagePrimitiveError.displayName = "MessagePrimitive.Error";
export {
  MessagePrimitiveError
};
//# sourceMappingURL=MessageError.js.map