import { LockKeyholeIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Label } from '@/ds/components/Label/label';
import { cn } from '@/lib/utils';

export type SettingsRowProps = Omit<ComponentProps<'div'>, 'children'> & {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
  tone?: 'default' | 'destructive';
  viewOnly?: boolean;
};

type SettingsRowLayoutProps = SettingsRowProps & {
  layout: 'factory' | 'standalone' | 'section';
};

export function SettingsRowLayout({
  label,
  description,
  htmlFor,
  children,
  className,
  layout,
  tone = 'default',
  viewOnly = false,
  ...props
}: SettingsRowLayoutProps) {
  const isSectionLayout = layout === 'section';
  const TextElement = isSectionLayout ? 'p' : 'span';
  const LabelElement = htmlFor ? Label : TextElement;
  const DescriptionElement = isSectionLayout ? 'p' : 'div';
  const control = viewOnly ? (
    <>
      <LockKeyholeIcon className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">View only: </span>
      {children}
    </>
  ) : (
    children
  );

  return (
    <div
      data-slot={isSectionLayout ? 'section-row' : 'settings-row'}
      className={cn(
        isSectionLayout
          ? 'grid min-w-0 gap-3 group-data-[variant=factory]/section:px-3 group-data-[variant=factory]/section:py-2 group-data-[variant=flat]/section:p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:group-data-[variant=default]/section:gap-4 sm:group-data-[variant=factory]/section:gap-4 sm:group-data-[variant=flat]/section:gap-6'
          : 'flex min-w-0 flex-col',
        layout === 'standalone' && 'gap-3 sm:flex-row sm:items-center sm:justify-between',
        layout === 'factory' && 'gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        className,
      )}
      {...props}
    >
      <div className={cn('min-w-0', !isSectionLayout && 'flex flex-col', layout === 'factory' && 'gap-0.5')}>
        <LabelElement
          htmlFor={htmlFor}
          className={cn(
            'text-label text-foreground',
            viewOnly && 'text-muted-foreground',
            tone === 'destructive' && 'text-destructive',
          )}
        >
          {label}
        </LabelElement>
        {description != null && (
          <DescriptionElement
            className={cn(
              'text-caption text-muted-foreground',
              isSectionLayout ? 'mt-1 max-w-[62ch] text-pretty' : 'flex flex-col gap-0.5',
            )}
          >
            {description}
          </DescriptionElement>
        )}
      </div>
      {children != null &&
        (isSectionLayout || viewOnly ? (
          <div
            data-slot={isSectionLayout ? 'section-control' : undefined}
            className={cn(
              'min-w-0',
              isSectionLayout && 'sm:justify-self-end',
              viewOnly && 'flex items-center gap-2 text-body text-muted-foreground',
            )}
          >
            {control}
          </div>
        ) : (
          control
        ))}
    </div>
  );
}

export function SettingsRow(props: SettingsRowProps) {
  return <SettingsRowLayout {...props} layout="factory" />;
}
