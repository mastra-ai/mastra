"use client";

import type { FC, PropsWithChildren } from "react";
import { useThread } from "../../context";

export namespace ThreadPrimitiveEmpty {
  export type Props = PropsWithChildren;
}

export const ThreadPrimitiveEmpty: FC<ThreadPrimitiveEmpty.Props> = ({
  children,
}) => {
  const empty = useThread((u) => u.messages.length === 0);
  return empty ? children : null;
};

ThreadPrimitiveEmpty.displayName = "ThreadPrimitive.Empty";
