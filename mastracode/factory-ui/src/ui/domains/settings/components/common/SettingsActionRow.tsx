import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { cn } from '@mastra/playground-ui/utils/cn';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';

import { settingsRowLayout } from './settings-row-layout';

export const SettingsActionRow = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  function SettingsActionRow({ className, ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        className={cn(buttonVariants({ variant: 'ghost', size: null }), settingsRowLayout, 'justify-start', className)}
      />
    );
  },
);
