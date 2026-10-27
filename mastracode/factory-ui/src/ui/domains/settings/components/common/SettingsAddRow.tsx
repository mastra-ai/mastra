import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus } from 'lucide-react';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';

import { SettingsActionRow } from './SettingsActionRow';

export const SettingsAddRow = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(function SettingsAddRow(
  { children, ...props },
  ref,
) {
  return (
    <SettingsActionRow {...props} ref={ref}>
      <Plus className="size-4 shrink-0" aria-hidden />
      <Txt as="span" variant="caption">
        {children}
      </Txt>
    </SettingsActionRow>
  );
});
