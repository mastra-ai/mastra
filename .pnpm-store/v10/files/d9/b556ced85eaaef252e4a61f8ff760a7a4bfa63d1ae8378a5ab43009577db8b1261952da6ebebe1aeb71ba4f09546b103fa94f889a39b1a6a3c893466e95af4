"use client";

import { FC, PropsWithChildren } from "react";
import { useMessagePart } from "../../context";

export namespace MessagePartPrimitiveInProgress {
  export type Props = PropsWithChildren;
}

// TODO should this be renamed to IsRunning?
export const MessagePartPrimitiveInProgress: FC<
  MessagePartPrimitiveInProgress.Props
> = ({ children }) => {
  const isInProgress = useMessagePart((c) => c.status.type === "running");

  return isInProgress ? children : null;
};

MessagePartPrimitiveInProgress.displayName = "MessagePartPrimitive.InProgress";
