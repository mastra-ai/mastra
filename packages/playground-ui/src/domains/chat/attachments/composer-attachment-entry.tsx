import { useContext } from 'react';
import type { ReactNode } from 'react';
import { ComposerAttachmentContext } from './composer-attachment-context';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

/** Preview content shares the composer's filename without duplicating it in each adapter. */
export function ComposerAttachmentEntry({
  children,
  name,
  variant = 'icon',
}: {
  children: ReactNode;
  name?: string;
  variant?: 'image' | 'icon';
}) {
  const composerName = useContext(ComposerAttachmentContext);
  const filename = composerName ?? name;

  if (!filename) return children;

  return (
    <span className={cn('flex h-full min-w-0 items-center gap-2', variant === 'image' ? 'px-1' : 'px-3')}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden [&_img]:size-full [&_img]:object-cover',
          variant === 'image'
            ? 'size-12 rounded-[max(0px,calc(var(--attachment-radius,var(--radius-lg))-var(--spacing)))]'
            : 'size-8 rounded-md',
        )}
      >
        {children}
      </span>
      <Txt as="span" variant="label" className="truncate">
        {filename}
      </Txt>
    </span>
  );
}
