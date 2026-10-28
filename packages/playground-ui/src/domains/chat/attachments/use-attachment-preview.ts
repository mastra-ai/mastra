import { useRef, useState } from 'react';

export interface AttachmentPreviewProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Previews can share composer state or manage their own state when used alone. */
export function useAttachmentPreview({ open, onOpenChange }: AttachmentPreviewProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function setOpen(nextOpen: boolean) {
    if (open === undefined) setLocalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  }

  return { open: open ?? localOpen, setOpen, triggerRef };
}
