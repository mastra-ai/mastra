import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentProps } from 'react';

import { settingsRowLayout } from './settings-row-layout';

export function SettingsActionRow({ className, ...props }: ComponentProps<'button'>) {
  return (
    <button
      {...props}
      type="button"
      className={cn(buttonVariants({ variant: 'ghost', size: null }), settingsRowLayout, 'justify-start', className)}
    />
  );
}
