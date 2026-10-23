import { Txt } from '@mastra/playground-ui/components/Txt';

import type { WorkspaceChange } from '../../../../../api/types';
import { pluralize } from './pluralize';

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
    <Txt
      as="span"
      variant="meta"
      font="mono"
      className="flex shrink-0 items-center gap-1 tabular-nums"
      aria-label={`${pluralize(additions, 'addition')} and ${pluralize(deletions, 'deletion')}`}
    >
      <span className="text-success-indicator">+{additions}</span>
      <span className="text-destructive-foreground">−{deletions}</span>
    </Txt>
  );
}
