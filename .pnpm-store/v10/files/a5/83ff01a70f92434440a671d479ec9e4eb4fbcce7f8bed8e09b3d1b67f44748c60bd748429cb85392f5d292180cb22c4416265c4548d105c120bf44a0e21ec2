import { forwardRef, useCallback, useState } from "react";

import { Slot } from "@radix-ui/react-slot";
import React from "react";
import { useComposerRuntime } from "../../context";

export namespace ComposerAttachmentDropzonePrimitive {
  export type Element = HTMLDivElement;
  export type Props = React.HTMLAttributes<HTMLDivElement> & {
    asChild?: boolean | undefined;
    disabled?: boolean | undefined;
  };
}

export const ComposerAttachmentDropzone = forwardRef<
  HTMLDivElement,
  ComposerAttachmentDropzonePrimitive.Props
>(({ disabled, asChild = false, children, ...rest }, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const composerRuntime = useComposerRuntime();

  const handleDrag = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(e.type === "dragenter" || e.type === "dragover");
    },
    [disabled],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      for (const file of e.dataTransfer.files) {
        try {
          await composerRuntime.addAttachment(file);
        } catch (error) {
          console.error("Failed to add attachment:", error);
        }
      }
    },
    [disabled, composerRuntime],
  );

  const dragProps = {
    onDragEnter: handleDrag,
    onDragOver: handleDrag,
    onDragLeave: handleDrag,
    onDrop: handleDrop,
  };

  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      {...(isDragging ? { "data-dragging": "true" } : null)}
      ref={ref}
      {...dragProps}
      {...rest}
    >
      {children}
    </Comp>
  );
});

ComposerAttachmentDropzone.displayName = "ComposerPrimitive.AttachmentDropzone";
