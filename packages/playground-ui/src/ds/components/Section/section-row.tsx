import { LockKeyholeIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Label } from '@/ds/components/Label/label';
import { cn } from '@/lib/utils';

export type SectionRowProps = Omit<ComponentProps<'div'>, 'children'> & {
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
  const destructive = tone === 'destructive';
  const labelClassName = cn(
    'text-ui-md leading-ui-md',
    destructive ? 'text-accent2' : viewOnly ? 'text-neutral3' : 'text-neutral5',
    'group-data-[variant=factory]/section:font-medium group-data-[variant=flat]/section:font-medium',
  );

  return (
    <div
      data-slot="section-row"
      className={cn(
        'grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
        'sm:group-data-[variant=default]/section:gap-4',
        'group-data-[variant=flat]/section:p-4 sm:group-data-[variant=flat]/section:gap-8',
        'group-data-[variant=factory]/section:px-4 group-data-[variant=factory]/section:py-3 sm:group-data-[variant=factory]/section:gap-4',
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
