"use client";

import { FC, PropsWithChildren } from "react";
import { useMessage } from "../../context/react/MessageContext";

export const MessagePrimitiveError: FC<PropsWithChildren> = ({ children }) => {
  const hasError = useMessage(
    (m) => m.status?.type === "incomplete" && m.status.reason === "error",
  );
  return hasError ? <>{children}</> : null;
};

MessagePrimitiveError.displayName = "MessagePrimitive.Error";
