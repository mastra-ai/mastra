import { useRef, useState } from 'react';
import { ImagePreviewDialog } from './attachment-preview-dialog';
import { AttachmentCard } from '@/ds/components/AttachmentCard';
import { IconImages1 } from '@/ds/icons/central/IconImages1';

export function MessageImageAttachment({ src, name, typeLabel }: { src: string; name: string; typeLabel: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <AttachmentCard
        buttonRef={triggerRef}
        name={name}
        typeLabel={failed ? `${typeLabel} (preview unavailable)` : typeLabel}
        icon={<IconImages1 className="size-5" />}
        onClick={failed || !src ? undefined : () => setOpen(true)}
        href={failed && /^https?:\/\//.test(src) ? src : undefined}
        preview={
          !failed && src ? (
            <img
              src={src}
              alt={name}
              loading="lazy"
              className="size-full object-cover"
              onError={() => setFailed(true)}
            />
          ) : undefined
        }
      />
      <ImagePreviewDialog src={src} open={open} onOpenChange={setOpen} returnFocusRef={triggerRef} />
    </>
  );
}
