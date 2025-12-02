"use client";

import { ComponentPropsWithoutRef, forwardRef, type FC } from "react";
import { ArchiveIcon } from "lucide-react";

import { withDefaults } from "./utils/withDefaults";
import { TooltipIconButton } from "./base/tooltip-icon-button";
import { ThreadListItemPrimitive } from "@assistant-ui/react";
import { useThreadConfig } from "./thread-config";
import classNames from "classnames";

const ThreadListItem: FC = () => {
  return (
    <ThreadListItemRoot>
      <ThreadListItemTrigger>
        <ThreadListItemTitle />
      </ThreadListItemTrigger>
      <ThreadListItemArchive />
    </ThreadListItemRoot>
  );
};

const ThreadListItemRoot = withDefaults(ThreadListItemPrimitive.Root, {
  className: "aui-thread-list-item",
});

ThreadListItemRoot.displayName = "ThreadListItemRoot";

const ThreadListItemTrigger = withDefaults(ThreadListItemPrimitive.Trigger, {
  className: "aui-thread-list-item-trigger",
});

namespace ThreadListItemPrimitiveTitle {
  export type Element = HTMLParagraphElement;
  export type Props = ComponentPropsWithoutRef<"p">;
}

const ThreadListItemTitle = forwardRef<
  ThreadListItemPrimitiveTitle.Element,
  ThreadListItemPrimitiveTitle.Props
>(({ className, ...props }, ref) => {
  const config = useThreadConfig();
  const fallback =
    config.strings?.threadList?.item?.title?.fallback ?? "New Chat";

  return (
    <p
      ref={ref}
      className={classNames("aui-thread-list-item-title", className)}
      {...props}
    >
      <ThreadListItemPrimitive.Title fallback={fallback} />
    </p>
  );
});

ThreadListItemTitle.displayName = "ThreadListItemTitle";

const ThreadListItemArchive = forwardRef<
  HTMLButtonElement,
  Partial<TooltipIconButton.Props>
>(({ className, ...props }, ref) => {
  const config = useThreadConfig();
  const tooltip =
    config.strings?.threadList?.item?.archive?.tooltip ?? "Archive thread";

  return (
    <ThreadListItemPrimitive.Archive asChild>
      <TooltipIconButton
        ref={ref}
        className={classNames("aui-thread-list-item-archive", className)}
        variant="ghost"
        tooltip={tooltip}
        {...props}
      >
        <ArchiveIcon />
      </TooltipIconButton>
    </ThreadListItemPrimitive.Archive>
  );
});

ThreadListItemArchive.displayName = "ThreadListItemArchive";

const exports = {
  Root: ThreadListItemRoot,
  Title: ThreadListItemTitle,
  Archive: ThreadListItemArchive,
};

export default Object.assign(ThreadListItem, exports) as typeof ThreadListItem &
  typeof exports;
