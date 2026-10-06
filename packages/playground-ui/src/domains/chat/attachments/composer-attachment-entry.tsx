import { useContext } from 'react';
import type { ReactNode } from 'react';
import { ComposerAttachmentContext } from './composer-attachment-context';
import { Txt } from '@/ds/components/Txt';

/** Preview content shares the composer's filename without duplicating it in each adapter. */
export function ComposerAttachmentEntry({ children, name }: { children: ReactNode; name?: string }) {
  const composerName = useContext(ComposerAttachmentContext);
  const filename = composerName ?? name;

  if (!filename) return children;

  return (
    <span className="flex h-full min-w-0 items-center gap-2 px-3">
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md [&_img]:size-full [&_img]:object-cover">
        {children}
      </span>
      <Txt as="span" variant="label" className="truncate">
        {filename}
      </Txt>
    </span>
  );
}
