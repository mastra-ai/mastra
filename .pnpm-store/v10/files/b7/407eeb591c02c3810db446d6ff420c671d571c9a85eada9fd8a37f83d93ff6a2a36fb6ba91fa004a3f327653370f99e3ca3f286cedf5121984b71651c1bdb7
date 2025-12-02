"use client";

// src/primitives/threadList/ThreadListItems.tsx
import { memo, useMemo } from "react";
import { ThreadListItemRuntimeProvider } from "../../context/providers/ThreadListItemRuntimeProvider.js";
import { useAssistantRuntime, useThreadList } from "../../context/index.js";
import { jsx } from "react/jsx-runtime";
var ThreadListPrimitiveItemByIndex = memo(
  ({ index, archived = false, components }) => {
    const assistantRuntime = useAssistantRuntime();
    const runtime = useMemo(
      () => archived ? assistantRuntime.threads.getArchivedItemByIndex(index) : assistantRuntime.threads.getItemByIndex(index),
      [assistantRuntime, index, archived]
    );
    const ThreadListItemComponent = components.ThreadListItem;
    return /* @__PURE__ */ jsx(ThreadListItemRuntimeProvider, { runtime, children: /* @__PURE__ */ jsx(ThreadListItemComponent, {}) });
  },
  (prev, next) => prev.index === next.index && prev.archived === next.archived && prev.components.ThreadListItem === next.components.ThreadListItem
);
ThreadListPrimitiveItemByIndex.displayName = "ThreadListPrimitive.ItemByIndex";
var ThreadListPrimitiveItems = ({
  archived = false,
  components
}) => {
  const contentLength = useThreadList(
    (s) => archived ? s.archivedThreads.length : s.threads.length
  );
  const listElements = useMemo(() => {
    return Array.from({ length: contentLength }, (_, index) => /* @__PURE__ */ jsx(
      ThreadListPrimitiveItemByIndex,
      {
        index,
        archived,
        components
      },
      index
    ));
  }, [contentLength, archived, components]);
  return listElements;
};
ThreadListPrimitiveItems.displayName = "ThreadListPrimitive.Items";
export {
  ThreadListPrimitiveItemByIndex,
  ThreadListPrimitiveItems
};
//# sourceMappingURL=ThreadListItems.js.map