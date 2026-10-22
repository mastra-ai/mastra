import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';
import { raisedSurfaceStyle } from '../../primitives/raised-surface';

export function SettingsContainerLayout({
  layout,
  className,
  ...props
}: ComponentProps<'div'> & { layout: 'factory' | 'section' }) {
  return (
    <div
      data-slot={layout === 'section' ? 'section-content' : 'settings-container'}
      className={cn(
        layout === 'factory'
          ? cn(raisedSurfaceStyle, 'rounded-xl')
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

export type SettingsContainerVariant = 'default' | 'inset';

export type SettingsContainerProps = ComponentProps<'div'> & { variant?: SettingsContainerVariant };

const rowsClassNames = {
  default: 'divide-y divide-border',
  inset:
    'flex flex-col gap-px p-1 [&>*]:min-h-14 [&>*]:bg-background [&>*]:px-3.5 [&>*]:py-2.5 [&>:first-child]:rounded-t-lg [&>:last-child]:rounded-b-lg',
} satisfies Record<SettingsContainerVariant, string>;

export function SettingsContainer({ variant = 'default', className, ...props }: SettingsContainerProps) {
  return (
    <SettingsContainerLayout
      {...props}
      layout="factory"
      data-variant={variant}
      className={cn(rowsClassNames[variant], className)}
    />
  );
}
