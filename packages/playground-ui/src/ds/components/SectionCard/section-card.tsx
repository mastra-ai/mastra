import type { ReactNode } from 'react';
import { CardHeading } from './card-heading';
import { cn } from '@/lib/utils';

export type SectionCardVariant = 'default' | 'danger';

export interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: SectionCardVariant;
  fillHeight?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  description,
  action,
  variant = 'default',
  fillHeight = false,
  className,
  contentClassName,
  children,
}: SectionCardProps) {
  const danger = variant === 'danger';

  return (
    <section
      data-variant={variant}
      className={cn(
        'overflow-hidden rounded-2xl border',
        fillHeight && 'flex h-full flex-col',
        danger ? 'border-accent2/25' : 'border-border2/40',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-3 px-7 pt-7 pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
          danger ? 'bg-accent2/[0.08]' : 'bg-surface2',
        )}
      >
        <div className="min-w-0">
          <CardHeading title={title} description={description} tone={danger ? 'danger' : 'default'} />
        </div>
        {action != null ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div
        className={cn(
          'min-w-0 px-7 pt-6 pb-7',
          fillHeight && 'flex-1',
          danger ? 'bg-accent2/[0.04]' : null,
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
