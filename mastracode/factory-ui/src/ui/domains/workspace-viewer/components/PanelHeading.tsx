import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

export function PanelHeading({ detail, children }: { detail?: ReactNode; children: ReactNode }) {
  return (
    <Txt as="h3" variant="meta" tone="muted" className="flex min-w-0 items-center gap-1.5 px-2 py-1">
      {children}
      {detail === undefined ? null : (
        <>
          {/* The space keeps the count its own word for screen readers: "Links 2". */}{' '}
          <Txt as="span" variant="meta" tone="faint" className="min-w-0 truncate">
            {detail}
          </Txt>
        </>
      )}
    </Txt>
  );
}
