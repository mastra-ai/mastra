import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ComponentProps } from 'react';

import { SettingsActionRow } from './SettingsActionRow';
import { IconPlusLarge } from '@mastra/playground-ui/icons/central/IconPlusLarge';

export function SettingsAddRow({ children, ...props }: ComponentProps<'button'>) {
  return (
    <SettingsActionRow {...props}>
      <IconPlusLarge className="size-4 shrink-0" aria-hidden />
      <Txt as="span" variant="caption">
        {children}
      </Txt>
    </SettingsActionRow>
  );
}
