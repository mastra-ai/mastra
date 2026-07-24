import type { ReactNode } from 'react';
import { Label } from '@/ds/components/Label/label';
import { cn } from '@/lib/utils';

export type SettingsRowProps = {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
};

export function SettingsRow({ label, description, htmlFor, className, children }: SettingsRowProps) {
  return (
    <div
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}
      data-slot="settings-row"
    >
      <div>
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-sm font-medium">
            {label}
          </Label>
        ) : (
          <p className="text-sm font-medium">{label}</p>
        )}
        {description && <p className="text-sm text-neutral3">{description}</p>}
      </div>
      {children}
    </div>
  );
}
