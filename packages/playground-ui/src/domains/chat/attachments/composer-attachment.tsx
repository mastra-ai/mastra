import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { ComposerAttachmentContext } from './composer-attachment-context';
import { Icon } from '@/ds/icons/Icon';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@/ds/primitives/raised-surface';
import { focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

export interface ComposerAttachmentProps {
  name: string;
  children: ReactNode;
  onRemove: () => void;
  /** Inline entries allow a little more width for long filenames. */
  variant?: 'thumbnail' | 'inline';
}

export function ComposerAttachment({ name, children, onRemove, variant = 'thumbnail' }: ComposerAttachmentProps) {
  return (
    <div
      className={cn(
        raisedSurfaceStyle,
        surfaceStateLayerStyle,
        'group/attachment relative flex h-14 min-w-24 shrink-0 items-center overflow-hidden rounded-(--attachment-radius) [--attachment-radius:var(--radius-xl)]',
        variant === 'inline' ? 'max-w-56' : 'max-w-48',
      )}
      title={name}
    >
      <div className="flex h-full min-w-0 flex-1 items-center justify-center rounded-[inherit] pr-9 pointer-coarse:pr-12">
        <ComposerAttachmentContext.Provider value={name}>{children}</ComposerAttachmentContext.Provider>
      </div>
      <button
        type="button"
        aria-label={`Remove ${name}`}
        title={`Remove ${name}`}
        onClick={onRemove}
        className={cn(
          'absolute top-0 right-0 z-10 flex size-7 cursor-pointer items-center justify-center rounded-tr-[inherit] rounded-bl-lg bg-fill-subtle text-muted-foreground hover:bg-fill hover:text-foreground',
          // Follow actual hover state so a secondary mouse can reveal the tab too.
          'opacity-0 group-focus-within/attachment:opacity-100 group-[:hover]/attachment:opacity-100 focus-visible:opacity-100 pointer-coarse:size-11 pointer-coarse:opacity-100',
          'motion-safe:transition-opacity motion-safe:duration-fast',
          focusRingInset,
        )}
      >
        <Icon size="sm" aria-hidden="true">
          <X />
        </Icon>
      </button>
    </div>
  );
}
