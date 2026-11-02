import { Spinner } from '@mastra/playground-ui/components/Spinner';

import type { WorkspaceChangesScope } from '../../../../../../api/types';
import { useWorkspacePatches } from '../../../../../../hooks/use-fs';
import { ChangeCounts } from '../ChangeCounts';

interface ChangesTotalsProps {
  workspacePath: string;
  scope: WorkspaceChangesScope;
  visible: boolean;
}

export function ChangesTotals({ workspacePath, scope, visible }: ChangesTotalsProps) {
  const patches = useWorkspacePatches(workspacePath, scope, { enabled: visible });

  if (patches.isLoading) return null;
  const totals = patches.error ? undefined : patches.data;
  return (
    <>
      {totals?.changes.length ? <ChangeCounts additions={totals.additions} deletions={totals.deletions} /> : null}
      {patches.isFetching ? <Spinner size="sm" /> : null}
    </>
  );
}
