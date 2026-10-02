import type { ComponentProps } from 'react';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

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
          ? cn(raisedSurfaceStyle, 'divide-y divide-border rounded-xl')
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

export function SettingsContainer(props: ComponentProps<'div'>) {
  return <SettingsContainerLayout {...props} layout="factory" />;
}
