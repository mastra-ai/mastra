import type { ComponentProps } from 'react';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export type SettingsContainerVariant = 'default' | 'inset';

const insetRowsClassName =
  'flex flex-col gap-px rounded-xl p-1 [&>*]:min-h-14 [&>*]:bg-background [&>*]:px-3.5 [&>*]:py-2.5 [&>:first-child]:rounded-t-lg [&>:last-child]:rounded-b-lg';

export function SettingsContainerLayout({
  layout,
  variant = 'default',
  className,
  ...props
}: ComponentProps<'div'> & { layout: 'factory' | 'section'; variant?: SettingsContainerVariant }) {
  return (
    <div
      data-slot={layout === 'section' ? 'section-content' : 'settings-container'}
      data-variant={layout === 'factory' ? variant : undefined}
      className={cn(
        layout === 'factory'
          ? cn(raisedSurfaceStyle, variant === 'inset' ? insetRowsClassName : 'divide-y divide-border rounded-xl')
          : cn(
              'group-data-[variant=factory]/section:overflow-hidden group-data-[variant=factory]/section:rounded-xl',
              'group-data-[variant=factory]/section:bg-card group-data-[variant=factory]/section:shadow-raised',
            ),
        className,
      )}
      {...props}
    />
  );
}

export function SettingsContainer(props: ComponentProps<'div'> & { variant?: SettingsContainerVariant }) {
  return <SettingsContainerLayout {...props} layout="factory" />;
}
