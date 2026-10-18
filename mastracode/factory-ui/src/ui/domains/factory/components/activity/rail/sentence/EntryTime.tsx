import { Txt } from '@mastra/playground-ui/components/Txt';

import { clockTime } from '../../../../activity';

export function EntryTime({ at, className }: { at: number; className?: string }) {
  return (
    <Txt
      as="time"
      variant="meta"
      tone="muted"
      font="mono"
      dateTime={new Date(at).toISOString()}
      className={`shrink-0 ${className ?? ''}`}
    >
      {clockTime(at)}
    </Txt>
  );
}
