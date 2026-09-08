import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { Label } from '@/ds/components/Label/label';
import { cn } from '@/lib/utils';

const settingsRowVariants = cva('flex min-w-0 flex-col', {
  variants: {
    variant: {
      default: 'gap-3 sm:flex-row sm:items-center sm:justify-between',
      factory: 'gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4',
    },
  },
  defaultVariants: { variant: 'default' },
});

const settingsRowLabelBlockVariants = cva('flex min-w-0 flex-col', {
  variants: {
    variant: { default: '', factory: 'gap-0.5' },
  },
  defaultVariants: { variant: 'default' },
});

const settingsRowLabelVariants = cva('', {
  variants: {
    variant: { default: 'text-sm font-medium', factory: 'text-ui-md leading-ui-md text-neutral5' },
  },
  defaultVariants: { variant: 'default' },
});

const settingsRowDescriptionVariants = cva('flex flex-col gap-0.5', {
  variants: {
    variant: { default: 'text-sm text-neutral3', factory: 'text-ui-sm text-neutral3' },
  },
  defaultVariants: { variant: 'default' },
});

export type SettingsRowProps = {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  className?: string;
  children?: ReactNode;
} & VariantProps<typeof settingsRowVariants>;

export function SettingsRow({ label, description, htmlFor, variant, className, children }: SettingsRowProps) {
  return (
    <div className={cn(settingsRowVariants({ variant }), className)} data-slot="settings-row">
      <div className={settingsRowLabelBlockVariants({ variant })}>
        {htmlFor ? (
          <Label htmlFor={htmlFor} className={settingsRowLabelVariants({ variant })}>
            {label}
          </Label>
        ) : (
          <span className={settingsRowLabelVariants({ variant })}>{label}</span>
        )}
        {description && <div className={settingsRowDescriptionVariants({ variant })}>{description}</div>}
      </div>
      {children}
    </div>
  );
}
