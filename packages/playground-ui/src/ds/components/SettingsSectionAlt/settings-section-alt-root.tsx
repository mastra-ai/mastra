import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SettingsSectionAltRootProps = Omit<ComponentPropsWithoutRef<'section'>, 'title'> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  contentClassName?: string;
};

export function SettingsSectionAltRoot({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  ...props
}: SettingsSectionAltRootProps) {
  const hasHeader = title != null || description != null || action != null;

  return (
    <section data-slot="settings-section-alt" className={cn('min-w-0', className)} {...props}>
      {hasHeader ? (
        <div className="flex min-w-0 flex-col gap-4 px-1 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            {title != null ? (
              <h3 className="text-ui-lg leading-ui-lg text-neutral5 font-medium text-balance">{title}</h3>
            ) : null}
            {description != null ? (
              <p
                className={cn(
                  'max-w-[62ch] text-ui-md leading-ui-md text-pretty text-neutral3',
                  title != null && 'mt-1.5',
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          {action != null ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
