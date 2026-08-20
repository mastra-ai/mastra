import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Label } from '@/ds/components/Label/label';
import { cn } from '@/lib/utils';

export type SettingsSectionAltRowProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
};

export function SettingsSectionAltRow({
  label,
  description,
  htmlFor,
  children,
  className,
  ...props
}: SettingsSectionAltRowProps) {
  const labelClassName = 'text-ui-md leading-ui-md font-medium text-neutral5';

  return (
    <div
      data-slot="settings-section-alt-row"
      className={cn(
        'grid min-w-0 gap-3 px-1 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8',
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
        {description ? (
          <p className="text-ui-md leading-ui-md text-neutral3 mt-1 max-w-[62ch] text-pretty">{description}</p>
        ) : null}
      </div>
      <div data-slot="settings-section-alt-control" className="min-w-0 sm:justify-self-end">
        {children}
      </div>
    </div>
  );
}
