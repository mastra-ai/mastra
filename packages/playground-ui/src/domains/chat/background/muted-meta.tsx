import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';

/** The quiet trailing text of a background row: elapsed time, exit code, how it ended. */
export function MutedMeta({ children }: { children: ReactNode }) {
  return (
    <Txt as="span" variant="meta" tone="muted" className="px-1 tabular-nums">
      {children}
    </Txt>
  );
}
