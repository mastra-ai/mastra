import type { ComponentProps } from 'react';
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
          ? 'divide-y divide-border1 rounded-xl border border-border1 bg-surface3'
          : 'group-data-[variant=factory]/section:overflow-hidden group-data-[variant=factory]/section:rounded-xl group-data-[variant=factory]/section:border group-data-[variant=factory]/section:border-border1 group-data-[variant=factory]/section:bg-surface3',
        className,
      )}
      {...props}
    />
  );
}

export function SettingsContainer(props: ComponentProps<'div'>) {
  return <SettingsContainerLayout {...props} layout="factory" />;
}
