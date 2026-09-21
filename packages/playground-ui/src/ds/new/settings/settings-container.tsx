import '../../../../new-theme.css';

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
          ? 'new-theme divide-y divide-border rounded-xl border border-border bg-card'
          : 'new-theme group-data-[variant=factory]/section:overflow-hidden group-data-[variant=factory]/section:rounded-xl group-data-[variant=factory]/section:border group-data-[variant=factory]/section:border-border group-data-[variant=factory]/section:bg-card',
        className,
      )}
      {...props}
    />
  );
}

export function SettingsContainer(props: ComponentProps<'div'>) {
  return <SettingsContainerLayout {...props} layout="factory" />;
}
