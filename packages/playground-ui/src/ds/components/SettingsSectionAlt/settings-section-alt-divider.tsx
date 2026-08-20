import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SettingsSectionAltDividerProps = ComponentPropsWithoutRef<'div'>;

export function SettingsSectionAltDivider({ className, ...props }: SettingsSectionAltDividerProps) {
  return <div role="separator" aria-orientation="horizontal" className={cn('h-px bg-border1', className)} {...props} />;
}
