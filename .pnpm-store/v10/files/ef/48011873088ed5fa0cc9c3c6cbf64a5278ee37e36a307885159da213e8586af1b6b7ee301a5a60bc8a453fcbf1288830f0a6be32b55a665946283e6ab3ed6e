"use client";

// src/primitives/threadListItem/ThreadListItemTrigger.ts
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useThreadListItemRuntime } from "../../context/react/ThreadListItemContext.js";
var useThreadListItemTrigger = () => {
  const runtime = useThreadListItemRuntime();
  return () => {
    runtime.switchTo();
  };
};
var ThreadListItemPrimitiveTrigger = createActionButton(
  "ThreadListItemPrimitive.Trigger",
  useThreadListItemTrigger
);
export {
  ThreadListItemPrimitiveTrigger
};
//# sourceMappingURL=ThreadListItemTrigger.js.map