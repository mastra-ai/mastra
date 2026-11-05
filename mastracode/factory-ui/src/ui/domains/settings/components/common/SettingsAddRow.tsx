import { Txt } from '@mastra/playground-ui/components/Txt';
import { Plus } from 'lucide-react';
import type { ComponentProps } from 'react';

import { SettingsActionRow } from './SettingsActionRow';

export function SettingsAddRow({ children, ...props }: ComponentProps<'button'>) {
  return (
    <SettingsActionRow {...props}>
      <Plus className="size-4 shrink-0" aria-hidden />
      <Txt as="span" variant="caption">
        {children}
      </Txt>
    </SettingsActionRow>
  );
}
