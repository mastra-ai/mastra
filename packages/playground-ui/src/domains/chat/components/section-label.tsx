import type { ReactNode } from 'react';

import { Txt } from '../../../ds/components/Txt';

/** Names a section of an expanded call body at the body's own quiet scale. */
export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <Txt as="p" variant="ui-xs" className="text-icon3 pb-1 select-none">
    {children}
  </Txt>
);
