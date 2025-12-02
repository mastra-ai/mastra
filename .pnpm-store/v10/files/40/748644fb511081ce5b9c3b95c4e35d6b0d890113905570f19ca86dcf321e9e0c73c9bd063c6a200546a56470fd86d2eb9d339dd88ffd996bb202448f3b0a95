"use client";

import { ComponentType, FC, memo, useMemo } from "react";
import { ThreadListItemRuntimeProvider } from "../../context/providers/ThreadListItemRuntimeProvider";
import { useAssistantRuntime, useThreadList } from "../../context";

export namespace ThreadListPrimitiveItems {
  export type Props = {
    archived?: boolean | undefined;
    components: {
      ThreadListItem: ComponentType;
    };
  };
}

export namespace ThreadListPrimitiveItemByIndex {
  export type Props = {
    index: number;
    archived?: boolean | undefined;
    components: ThreadListPrimitiveItems.Props["components"];
  };
}

/**
 * Renders a single thread list item at the specified index.
 *
 * This component provides direct access to render a specific thread
 * from the thread list using the provided component configuration.
 *
 * @example
 * ```tsx
 * <ThreadListPrimitive.ItemByIndex
 *   index={0}
 *   components={{
 *     ThreadListItem: MyThreadListItem
 *   }}
 * />
 * ```
 */
export const ThreadListPrimitiveItemByIndex: FC<ThreadListPrimitiveItemByIndex.Props> =
  memo(
    ({ index, archived = false, components }) => {
      const assistantRuntime = useAssistantRuntime();
      const runtime = useMemo(
        () =>
          archived
            ? assistantRuntime.threads.getArchivedItemByIndex(index)
            : assistantRuntime.threads.getItemByIndex(index),
        [assistantRuntime, index, archived],
      );

      const ThreadListItemComponent = components.ThreadListItem;

      return (
        <ThreadListItemRuntimeProvider runtime={runtime}>
          <ThreadListItemComponent />
        </ThreadListItemRuntimeProvider>
      );
    },
    (prev, next) =>
      prev.index === next.index &&
      prev.archived === next.archived &&
      prev.components.ThreadListItem === next.components.ThreadListItem,
  );

ThreadListPrimitiveItemByIndex.displayName = "ThreadListPrimitive.ItemByIndex";

export const ThreadListPrimitiveItems: FC<ThreadListPrimitiveItems.Props> = ({
  archived = false,
  components,
}) => {
  const contentLength = useThreadList((s) =>
    archived ? s.archivedThreads.length : s.threads.length,
  );

  const listElements = useMemo(() => {
    return Array.from({ length: contentLength }, (_, index) => (
      <ThreadListPrimitiveItemByIndex
        key={index}
        index={index}
        archived={archived}
        components={components}
      />
    ));
  }, [contentLength, archived, components]);

  return listElements;
};

ThreadListPrimitiveItems.displayName = "ThreadListPrimitive.Items";
