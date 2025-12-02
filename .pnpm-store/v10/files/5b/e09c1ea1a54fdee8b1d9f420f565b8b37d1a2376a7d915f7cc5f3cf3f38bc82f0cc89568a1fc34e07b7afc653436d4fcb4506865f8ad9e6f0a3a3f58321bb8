"use client";

// src/primitives/threadListItem/ThreadListItemUnarchive.ts
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useThreadListItemRuntime } from "../../context/react/ThreadListItemContext.js";
var useThreadListItemUnarchive = () => {
  const runtime = useThreadListItemRuntime();
  return () => {
    runtime.unarchive();
  };
};
var ThreadListItemPrimitiveUnarchive = createActionButton(
  "ThreadListItemPrimitive.Unarchive",
  useThreadListItemUnarchive
);
export {
  ThreadListItemPrimitiveUnarchive
};
//# sourceMappingURL=ThreadListItemUnarchive.js.map