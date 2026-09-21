import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/utils/cn';

export interface ComposerAttachmentProps {
  name: string;
  children: ReactNode;
  onRemove: () => void;
  variant?: 'thumbnail' | 'inline';
}

export function ComposerAttachment({ name, children, onRemove, variant = 'thumbnail' }: ComposerAttachmentProps) {
  const isThumbnail = variant === 'thumbnail';

  return (
    <div
      className={cn(
        'relative shrink-0 pointer-coarse:flex pointer-coarse:items-center pointer-coarse:gap-1',
        !isThumbnail && 'flex items-center gap-1',
      )}
      title={name}
    >
      <div
        className={cn(
          isThumbnail &&
            `${raisedSurfaceStyle} size-14 shrink-0 overflow-hidden rounded-md [&_img]:size-full [&_img]:object-cover`,
        )}
      >
        {children}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Remove ${name}`}
        tooltip={`Remove ${name}`}
        onClick={onRemove}
        className={cn(
          'bg-card pointer-coarse:min-h-11 pointer-coarse:min-w-11',
          isThumbnail && 'absolute -top-2 -right-2 rounded-full pointer-coarse:static',
        )}
      >
        <X />
      </Button>
    </div>
  );
}
