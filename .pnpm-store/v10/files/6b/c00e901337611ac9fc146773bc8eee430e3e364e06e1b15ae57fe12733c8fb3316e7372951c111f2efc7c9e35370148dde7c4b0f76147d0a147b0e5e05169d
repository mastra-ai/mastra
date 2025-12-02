"use client";

// src/primitives/threadListItem/ThreadListItemArchive.ts
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useThreadListItemRuntime } from "../../context/react/ThreadListItemContext.js";
import { useCallback } from "react";
var useThreadListItemArchive = () => {
  const runtime = useThreadListItemRuntime();
  return useCallback(() => {
    runtime.archive();
  }, [runtime]);
};
var ThreadListItemPrimitiveArchive = createActionButton(
  "ThreadListItemPrimitive.Archive",
  useThreadListItemArchive
);
export {
  ThreadListItemPrimitiveArchive
};
//# sourceMappingURL=ThreadListItemArchive.js.map