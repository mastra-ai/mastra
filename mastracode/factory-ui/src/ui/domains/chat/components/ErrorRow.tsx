import { Txt } from '@mastra/playground-ui/components/Txt';
import { OctagonAlert } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * A run that died, in the row rhythm the rest of the transcript uses. It carries
 * the weight of a line, not of a panel: the failure is one moment of the
 * conversation, and everything around it stays readable.
 */
export function ErrorRow({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-notice-destructive-fg flex w-full min-w-0 items-start gap-2 px-1.5 py-1">
      <span aria-hidden className="flex h-[1lh] shrink-0 items-center">
        <OctagonAlert size={13} />
      </span>
      {/* wrap-anywhere — provider errors carry URLs and tokens with no break opportunity */}
      <Txt as="span" variant="ui-sm" className="min-w-0 wrap-anywhere">
        {children}
      </Txt>
    </p>
  );
}
