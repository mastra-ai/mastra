import type { ReactNode } from 'react';
import { Label } from '@/ds/components/Label/label';
import { cn } from '@/lib/utils';

type SettingsRowVariant = 'default' | 'factory';

const VARIANTS: Record<SettingsRowVariant, { row: string; labelBlock: string; label: string; description: string }> = {
  default: {
    row: 'gap-3 sm:flex-row sm:items-center sm:justify-between',
    labelBlock: '',
    label: 'text-sm font-medium',
    description: 'text-neutral3 text-sm',
  },
  factory: {
    row: 'gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4',
    labelBlock: 'gap-0.5',
    label: 'text-ui-md leading-ui-md text-neutral5',
    description: 'text-ui-sm text-neutral3',
  },
};

export type SettingsRowProps = {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  variant?: SettingsRowVariant;
  className?: string;
  children?: ReactNode;
};

export function SettingsRow({
  label,
  description,
  htmlFor,
  variant = 'default',
  className,
  children,
}: SettingsRowProps) {
  const styles = VARIANTS[variant];

  return (
    <div className={cn('flex min-w-0 flex-col', styles.row, className)} data-slot="settings-row">
      <div className={cn('flex min-w-0 flex-col', styles.labelBlock)}>
        {htmlFor ? (
          <Label htmlFor={htmlFor} className={styles.label}>
            {label}
          </Label>
        ) : (
          <span className={styles.label}>{label}</span>
        )}
        {description && <div className={cn('flex flex-col gap-0.5', styles.description)}>{description}</div>}
      </div>
      {children}
    </div>
  );
}
