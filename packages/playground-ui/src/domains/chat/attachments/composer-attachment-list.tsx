import type { ComponentProps } from 'react';
import { ComposerAttachments } from '@/ds/components/Composer';
import { cn } from '@/utils/cn';

export function ComposerAttachmentList({ className, ...props }: ComponentProps<typeof ComposerAttachments>) {
  return (
    <ComposerAttachments
      aria-label="Draft attachments"
      className={cn('flex max-w-none items-center gap-3 overflow-x-auto px-3 pt-3 pb-2', className)}
      {...props}
    />
  );
}
