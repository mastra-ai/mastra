import type { ComponentProps } from 'react';
import { ComposerAttachments } from '@/ds/components/Composer';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { cn } from '@/utils/cn';

export function ComposerAttachmentList({ className, ...props }: ComponentProps<typeof ComposerAttachments>) {
  return (
    <ScrollArea orientation="horizontal" mask={false} data-slot="composer-attachment-scroll-area">
      <ComposerAttachments
        aria-label="Draft attachments"
        className={cn('flex max-w-none items-center gap-3 p-2', className)}
        {...props}
      />
    </ScrollArea>
  );
}
