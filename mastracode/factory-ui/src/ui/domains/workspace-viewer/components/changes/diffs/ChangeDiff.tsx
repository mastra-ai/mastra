import { CodeDiff } from '@mastra/playground-ui/components/CodeDiff';
import type { Ref } from 'react';

import type { WorkspaceChange, WorkspacePatchOmission } from '../../../../../../api/types';
import type { DiffLayout } from '../../../hooks/useDiffLayout';
import { ChangeStatusIcon } from '../ChangeStatusIcon';
import { FileLineSummary } from './FileLineSummary';
import { hasTextChanges } from './has-text-changes';

interface ChangeDiffProps {
  change: WorkspaceChange;
  patch?: string;
  omission?: WorkspacePatchOmission;
  layout: DiffLayout;
  ref: Ref<HTMLDivElement>;
}

export function ChangeDiff({ change, patch, omission, layout, ref }: ChangeDiffProps) {
  const header = {
    path: change.path,
    previousPath: change.previousPath,
    icon: <ChangeStatusIcon status={change.status} />,
    meta: <FileLineSummary change={change} patch={patch} omission={omission} />,
  };

  if (patch === undefined || !hasTextChanges(change)) return <CodeDiff ref={ref} header={header} />;
  return <CodeDiff ref={ref} header={header} patch={patch} layout={layout} />;
}
