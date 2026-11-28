import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconPencil } from '@/ds/icons/central/IconPencil';

export interface DetailsCardSectionProps {
  label: string;
  action?: ReactNode;
  /** Shows a pencil on hover and keyboard focus (always on touch screens) that opens this section's editor. */
  onEdit?: () => void;
  children: ReactNode;
}

export function DetailsCardSection({ label, action, onEdit, children }: DetailsCardSectionProps) {
  return (
    <section className="group/section flex flex-col gap-2 border-b border-surface-rim px-4 py-3 last:border-b-0">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Txt as="h3" variant="caption" tone="muted">
          {label}
        </Txt>
        <span className="flex items-center gap-1">
          {action}
          {onEdit ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${label.toLowerCase()}`}
              tooltip={`Edit ${label.toLowerCase()}`}
              className="-my-1 -mr-2 opacity-0 group-focus-within/section:opacity-100 group-hover/section:opacity-100 pointer-coarse:opacity-100"
              onClick={onEdit}
            >
              <IconPencil />
            </Button>
          ) : null}
        </span>
      </div>
      {children}
    </section>
  );
}
