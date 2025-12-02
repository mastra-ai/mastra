"use client";

import { forwardRef, type FC } from "react";
import { PlusIcon } from "lucide-react";

import { withDefaults } from "./utils/withDefaults";
import { ThreadListPrimitive } from "@assistant-ui/react";
import ThreadListItem from "./thread-list-item";
import { useThreadConfig } from "./thread-config";
import { Button, ButtonProps } from "./base";

const ThreadList: FC = () => {
  return (
    <ThreadListRoot>
      <ThreadListNew />
      <ThreadListItems />
    </ThreadListRoot>
  );
};

const ThreadListRoot = withDefaults(ThreadListPrimitive.Root, {
  className: "aui-root aui-thread-list-root",
});
ThreadListRoot.displayName = "ThreadListRoot";

const ThreadListNew = forwardRef<
  HTMLButtonElement,
  ThreadListPrimitive.New.Props & ButtonProps
>((props, ref) => {
  const config = useThreadConfig();
  const label = config.strings?.threadList?.new?.label ?? "New Thread";

  return (
    <ThreadListPrimitive.New asChild>
      <Button
        ref={ref}
        className="aui-thread-list-new"
        variant="ghost"
        {...props}
      >
        <PlusIcon />
        {label}
      </Button>
    </ThreadListPrimitive.New>
  );
});
ThreadListNew.displayName = "ThreadListNew";

namespace ThreadListItems {
  export type Props = {
    /**
     * Optional custom components to override default thread list items
     */
    components?: Partial<ThreadListPrimitive.Items.Props["components"]>;
  };
}

const ThreadListItems: FC<ThreadListItems.Props> = ({ components }) => {
  return (
    <ThreadListPrimitive.Items
      components={{
        ...components,
        ThreadListItem: components?.ThreadListItem ?? ThreadListItem,
      }}
    />
  );
};

ThreadListItems.displayName = "ThreadListItems";

const exports = {
  Root: ThreadListRoot,
  New: ThreadListNew,
  Items: ThreadListItems,
};

export default Object.assign(ThreadList, exports) as typeof ThreadList &
  typeof exports;
