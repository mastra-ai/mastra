"use client";

import type { FC, PropsWithChildren } from "react";
import {
  useMessageRuntime,
  useMessageUtilsStore,
} from "../../context/react/MessageContext";
import type { RequireAtLeastOne } from "../../utils/RequireAtLeastOne";
import { useCombinedStore } from "../../utils/combined/useCombinedStore";

type MessageIfFilters = {
  user: boolean | undefined;
  assistant: boolean | undefined;
  system: boolean | undefined;
  hasBranches: boolean | undefined;
  copied: boolean | undefined;
  lastOrHover: boolean | undefined;
  last: boolean | undefined;
  speaking: boolean | undefined;
  hasAttachments: boolean | undefined;
  hasContent: boolean | undefined;
  submittedFeedback: "positive" | "negative" | null | undefined;
};
type UseMessageIfProps = RequireAtLeastOne<MessageIfFilters>;

const useMessageIf = (props: UseMessageIfProps) => {
  const messageRuntime = useMessageRuntime();
  const messageUtilsStore = useMessageUtilsStore();

  return useCombinedStore(
    [messageRuntime, messageUtilsStore],
    (
      {
        role,
        attachments,
        content,
        branchCount,
        isLast,
        speech,
        submittedFeedback,
      },
      { isCopied, isHovering },
    ) => {
      if (props.hasBranches === true && branchCount < 2) return false;

      if (props.user && role !== "user") return false;
      if (props.assistant && role !== "assistant") return false;
      if (props.system && role !== "system") return false;

      if (props.lastOrHover === true && !isHovering && !isLast) return false;
      if (props.last !== undefined && props.last !== isLast) return false;

      if (props.copied === true && !isCopied) return false;
      if (props.copied === false && isCopied) return false;

      if (props.speaking === true && speech == null) return false;
      if (props.speaking === false && speech != null) return false;

      if (
        props.hasAttachments === true &&
        (role !== "user" || !attachments.length)
      )
        return false;
      if (
        props.hasAttachments === false &&
        role === "user" &&
        !!attachments.length
      )
        return false;

      if (props.hasContent === true && content.length === 0) return false;
      if (props.hasContent === false && content.length > 0) return false;

      if (
        props.submittedFeedback !== undefined &&
        (submittedFeedback?.type ?? null) !== props.submittedFeedback
      )
        return false;

      return true;
    },
  );
};

export namespace MessagePrimitiveIf {
  export type Props = PropsWithChildren<UseMessageIfProps>;
}

export const MessagePrimitiveIf: FC<MessagePrimitiveIf.Props> = ({
  children,
  ...query
}) => {
  const result = useMessageIf(query);
  return result ? children : null;
};

MessagePrimitiveIf.displayName = "MessagePrimitive.If";
