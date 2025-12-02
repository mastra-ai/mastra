"use client";

// src/primitives/threadListItem/ThreadListItemDelete.ts
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useThreadListItemRuntime } from "../../context/react/ThreadListItemContext.js";
var useThreadListItemDelete = () => {
  const runtime = useThreadListItemRuntime();
  return () => {
    runtime.delete();
  };
};
var ThreadListItemPrimitiveDelete = createActionButton(
  "ThreadListItemPrimitive.Delete",
  useThreadListItemDelete
);
export {
  ThreadListItemPrimitiveDelete
};
//# sourceMappingURL=ThreadListItemDelete.js.map