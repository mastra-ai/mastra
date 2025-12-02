"use client";

// src/primitives/thread/ThreadIf.tsx
import { useThread } from "../../context/index.js";
var useThreadIf = (props) => {
  return useThread((thread) => {
    if (props.empty === true && thread.messages.length !== 0) return false;
    if (props.empty === false && thread.messages.length === 0) return false;
    if (props.running === true && !thread.isRunning) return false;
    if (props.running === false && thread.isRunning) return false;
    if (props.disabled === true && !thread.isDisabled) return false;
    if (props.disabled === false && thread.isDisabled) return false;
    return true;
  });
};
var ThreadPrimitiveIf = ({
  children,
  ...query
}) => {
  const result = useThreadIf(query);
  return result ? children : null;
};
ThreadPrimitiveIf.displayName = "ThreadPrimitive.If";
export {
  ThreadPrimitiveIf
};
//# sourceMappingURL=ThreadIf.js.map