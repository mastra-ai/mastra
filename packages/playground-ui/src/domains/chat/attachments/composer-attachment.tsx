import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { ComposerAttachmentContext } from './composer-attachment-context';
import { Button } from '@/ds/components/Button';
import { raisedSurfaceStyle, surfaceStateLayerStyle } from '@/ds/primitives/raised-surface';
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
        'flex h-14 min-w-24 shrink-0 items-center overflow-hidden rounded-lg',
        variant === 'inline' ? 'max-w-56' : 'max-w-48',
      )}
      title={name}
    >
      <div className="flex h-full min-w-0 flex-1 items-center justify-center rounded-[inherit]">
        <ComposerAttachmentContext.Provider value={name}>{children}</ComposerAttachmentContext.Provider>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${name}`}
        tooltip={`Remove ${name}`}
        onClick={onRemove}
        className="mr-2 shrink-0 pointer-coarse:mr-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <X />
      </Button>
    </div>
  );
}
