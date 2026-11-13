import { Txt } from '@mastra/playground-ui/components/Txt';

import type { WorkspaceChange, WorkspacePatchOmission } from '../../../../../../api/types';
import { ChangeCounts } from '../ChangeCounts';
import { hasTextChanges } from './has-text-changes';

const OMISSION_LABELS: Record<WorkspacePatchOmission, string> = {
  'file-too-large': 'Diff too large to show',
  'total-too-large': 'Too many changes to show',
};

interface FileLineSummaryProps {
  change: WorkspaceChange;
  patch?: string;
  omission?: WorkspacePatchOmission;
}

export function FileLineSummary({ change, patch, omission }: FileLineSummaryProps) {
  if (patch === undefined) {
    return (
      <Txt as="span" variant="meta" tone="muted">
        {omission ? OMISSION_LABELS[omission] : 'Diff unavailable'}
      </Txt>
    );
  }
  if (!change.binary && !hasTextChanges(change)) return null;
  return <ChangeCounts {...change} />;
}
