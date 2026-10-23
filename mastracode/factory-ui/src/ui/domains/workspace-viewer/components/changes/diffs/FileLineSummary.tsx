import { Txt } from '@mastra/playground-ui/components/Txt';

import type { WorkspaceChange } from '../../../../../../api/types';
import { ChangeCounts } from '../ChangeCounts';
import { hasTextChanges } from './has-text-changes';

export function FileLineSummary({ change, patch }: { change: WorkspaceChange; patch?: string }) {
  if (patch === undefined) {
    return (
      <Txt as="span" variant="meta" tone="muted">
        Diff too large to show
      </Txt>
    );
  }
  if (!change.binary && !hasTextChanges(change)) return null;
  return <ChangeCounts {...change} />;
}
