"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useCallback } from "react";
import { useComposer, useComposerRuntime } from "../../context";

const useComposerAddAttachment = ({
  multiple = true,
}: {
  /** allow selecting multiple files */
  multiple?: boolean | undefined;
} = {}) => {
  const disabled = useComposer((c) => !c.isEditing);

  const composerRuntime = useComposerRuntime();
  const callback = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.hidden = true;

    const attachmentAccept = composerRuntime.getAttachmentAccept();
    if (attachmentAccept !== "*") {
      input.accept = attachmentAccept;
    }

    document.body.appendChild(input);

    input.onchange = (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList) return;
      for (const file of fileList) {
        composerRuntime.addAttachment(file);
      }

      document.body.removeChild(input);
    };

    input.oncancel = () => {
      if (!input.files || input.files.length === 0) {
        document.body.removeChild(input);
      }
    };

    input.click();
  }, [composerRuntime, multiple]);

  if (disabled) return null;
  return callback;
};

export namespace ComposerPrimitiveAddAttachment {
  export type Element = ActionButtonElement;
  export type Props = ActionButtonProps<typeof useComposerAddAttachment>;
}

export const ComposerPrimitiveAddAttachment = createActionButton(
  "ComposerPrimitive.AddAttachment",
  useComposerAddAttachment,
  ["multiple"],
);
