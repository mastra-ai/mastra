import { LockKeyholeIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useSectionVariant } from './section-context';
import { Label } from '@/ds/components/Label/label';
import { cn } from '@/lib/utils';

export type SectionRowProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
};

export type SectionViewOnlyRowProps = Omit<SectionRowProps, 'children'> & {
  children: ReactNode;
};

export type SectionDestructiveRowProps = Omit<SectionRowProps, 'children'> & {
  children: ReactNode;
};

type SectionRowLayoutProps = SectionRowProps & {
  tone?: 'default' | 'destructive';
  viewOnly?: boolean;
};

function SectionRowLayout({
  label,
  description,
  htmlFor,
  children,
  className,
  tone = 'default',
  viewOnly = false,
  ...props
}: SectionRowLayoutProps) {
  const variant = useSectionVariant();
  const factory = variant === 'factory';
  const flat = variant === 'flat';
  const destructive = tone === 'destructive';
  const labelClassName = cn(
    'text-ui-md leading-ui-md',
    destructive ? 'text-accent2' : viewOnly ? 'text-neutral3' : 'text-neutral5',
    variant !== 'default' && 'font-medium',
  );

  return (
    <div
      data-slot="section-row"
      data-tone={tone}
      data-view-only={viewOnly || undefined}
      className={cn(
        'grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
        variant === 'default' && 'sm:gap-4',
        flat && 'px-1 py-4 sm:gap-8',
        factory && 'px-4 py-3 sm:gap-4',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className={labelClassName}>
            {label}
          </Label>
        ) : (
          <p className={labelClassName}>{label}</p>
        )}
        {description != null ? (
          <p className="text-ui-md leading-ui-md text-neutral3 mt-1 max-w-[62ch] text-pretty">{description}</p>
        ) : null}
      </div>
      {children != null ? (
        <div
          data-slot="section-control"
          className={cn('min-w-0 sm:justify-self-end', viewOnly && 'flex items-center gap-2 text-ui-md text-neutral3')}
        >
          {viewOnly ? (
            <>
              <LockKeyholeIcon className="size-4 shrink-0" aria-hidden />
              <span className="sr-only">View only: </span>
            </>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function SectionRow(props: SectionRowProps) {
  return <SectionRowLayout {...props} />;
}

export function SectionViewOnlyRow(props: SectionViewOnlyRowProps) {
  return <SectionRowLayout viewOnly {...props} />;
}

export function SectionDestructiveRow(props: SectionDestructiveRowProps) {
  return <SectionRowLayout tone="destructive" {...props} />;
}
