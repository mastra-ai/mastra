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
  if (patches.isFetching) return <Spinner size="sm" />;
  if (patches.error || !patches.data?.changes.length) return null;
  return <ChangeCounts additions={patches.data.additions} deletions={patches.data.deletions} />;
}
