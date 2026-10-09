import type { ReactNode, Ref } from 'react';
import { Txt } from '../Txt';
import { AttachmentPreview } from './attachment-preview';
import { messageSurfaceStyle } from '@/ds/primitives/message-surface';
import { cn } from '@/lib/utils';

export interface AttachmentCardProps {
  name: string;
  buttonRef?: Ref<HTMLButtonElement>;
  typeLabel: string;
  icon: ReactNode;
  preview?: ReactNode;
  onClick?: () => void;
  href?: string;
}

/** Sent-file presentation. Upload state and removal controls belong to the composer. */
export function AttachmentCard({ name, typeLabel, icon, preview, onClick, href, buttonRef }: AttachmentCardProps) {
  const className = cn(
    messageSurfaceStyle,
    'relative isolate block w-64 max-w-full min-w-0 overflow-hidden text-left',
    preview &&
      'after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:inset-ring-1 after:inset-ring-white/15',
    (onClick || href) &&
      'cursor-pointer hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus motion-safe:transition-colors',
  );
  const content = (
    <>
      {preview && <AttachmentPreview>{preview}</AttachmentPreview>}
      <span className={cn('flex min-w-0 items-center gap-2.5 px-3 py-2.5', preview && 'absolute inset-x-0 bottom-0')}>
        {!preview && (
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <Txt as="span" variant="body-sm" className="block truncate" title={name}>
            {name}
          </Txt>
          <Txt as="span" variant="meta" tone="muted" className="block truncate">
            {typeLabel}
          </Txt>
        </span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        ref={buttonRef}
        type="button"
        className={className}
        onClick={onClick}
        aria-label={`Preview ${name}`}
        title={name}
      >
        {content}
      </button>
    );
  }
  if (href) {
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`Open ${name}`}
        title={name}
      >
        {content}
      </a>
    );
  }
  return (
    <div className={className} title={name}>
      {content}
    </div>
  );
}
