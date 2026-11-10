import { DiffStat } from '@mastra/playground-ui/components/DiffStat';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { WorkspaceChange } from '../../../../../api/types';

export function ChangeCounts({
  additions,
  deletions,
  binary,
}: Pick<WorkspaceChange, 'additions' | 'deletions' | 'binary'>) {
  if (binary) {
    return (
      <Txt as="span" variant="meta" tone="muted" className="shrink-0">
        Binary
      </Txt>
    );
  }
  if (additions === undefined || deletions === undefined) return null;

  return (
    <Txt as="span" variant="meta" font="mono" className="shrink-0">
      <DiffStat additions={additions} deletions={deletions} />
    </Txt>
  );
}
