// src/primitives/composer/ComposerAttachmentDropzone.tsx
import { forwardRef, useCallback, useState } from "react";
import { Slot } from "@radix-ui/react-slot";
import { useComposerRuntime } from "../../context/index.js";
import { jsx } from "react/jsx-runtime";
var ComposerAttachmentDropzone = forwardRef(({ disabled, asChild = false, children, ...rest }, ref) => {
  const [isDragging, setIsDragging] = useState(false);
  const composerRuntime = useComposerRuntime();
  const handleDrag = useCallback(
    (e) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(e.type === "dragenter" || e.type === "dragover");
    },
    [disabled]
  );
  const handleDrop = useCallback(
    async (e) => {
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
    [disabled, composerRuntime]
  );
  const dragProps = {
    onDragEnter: handleDrag,
    onDragOver: handleDrag,
    onDragLeave: handleDrag,
    onDrop: handleDrop
  };
  const Comp = asChild ? Slot : "div";
  return /* @__PURE__ */ jsx(
    Comp,
    {
      ...isDragging ? { "data-dragging": "true" } : null,
      ref,
      ...dragProps,
      ...rest,
      children
    }
  );
});
ComposerAttachmentDropzone.displayName = "ComposerPrimitive.AttachmentDropzone";
export {
  ComposerAttachmentDropzone
};
//# sourceMappingURL=ComposerAttachmentDropzone.js.map