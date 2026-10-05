import type { ReactNode, Ref } from 'react';
import { Txt } from '../Txt';
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
    'block w-64 max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-fill-subtle text-left text-foreground',
    (onClick || href) &&
      'cursor-pointer hover:bg-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus motion-safe:transition-colors',
  );
  const content = (
    <>
      {preview && <span className="flex h-36 items-center justify-center overflow-hidden bg-fill">{preview}</span>}
      <span className="flex min-w-0 items-center gap-3 p-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill text-muted-foreground"
          aria-hidden="true"
        >
          {icon}
        </span>
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
