"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useCallback } from "react";
import { useAttachmentRuntime } from "../../context/react/AttachmentContext";

const useAttachmentRemove = () => {
  const attachmentRuntime = useAttachmentRuntime();

  const handleRemoveAttachment = useCallback(() => {
    attachmentRuntime.remove();
  }, [attachmentRuntime]);

  return handleRemoveAttachment;
};

export namespace AttachmentPrimitiveRemove {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useAttachmentRemove>;
}

export const AttachmentPrimitiveRemove = createActionButton(
  "AttachmentPrimitive.Remove",
  useAttachmentRemove,
);
