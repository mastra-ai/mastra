import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { queryKeys } from '../../../../api/keys';
import type { WorkspaceChangesScope } from '../../../../api/types';
import { setDiffLayout, useDiffLayout } from '../hooks/useDiffLayout';
import { ChangesBody } from './changes/ChangesBody';
import type { StackedDiffsHandle } from './changes/diffs/StackedDiffs';
import { ChangesOptionsMenu } from './changes/header/ChangesOptionsMenu';
import { ChangesScopeMenu } from './changes/header/ChangesScopeMenu';
import { ChangesTotals } from './changes/header/ChangesTotals';
import { JumpToFile } from './changes/header/JumpToFile';
import type { RepositoryProviders } from './changes/tree/change-tree';

interface WorkspaceChangesPanelProps {
  workspacePath: string;
  visible: boolean;
  scope: WorkspaceChangesScope;
  onScopeChange: (scope: WorkspaceChangesScope) => void;
  repositoryProviders?: RepositoryProviders;
}

export function WorkspaceChangesPanel({
  workspacePath,
  visible,
  scope,
  onScopeChange,
  repositoryProviders,
}: WorkspaceChangesPanelProps) {
  const queryClient = useQueryClient();
  const diffLayout = useDiffLayout();
  const diffsRef = useRef<StackedDiffsHandle>(null);

  return (
    <section
      className="flex min-h-0 min-w-0 grow flex-col"
      aria-label="Workspace changes"
      data-testid="workspace-changes-panel"
    >
      <div className="border-border flex min-h-10 items-center gap-1 border-b px-1.5 py-1">
        <ChangesScopeMenu scope={scope} onScopeChange={onScopeChange} />
        <ChangesTotals workspacePath={workspacePath} scope={scope} visible={visible} />
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          <JumpToFile
            workspacePath={workspacePath}
            scope={scope}
            visible={visible}
            repositoryProviders={repositoryProviders}
            onJump={path => diffsRef.current?.scrollToFile(path)}
          />
          <ChangesOptionsMenu
            layout={diffLayout}
            onLayoutChange={setDiffLayout}
            onRefresh={() =>
              void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceChanges(workspacePath) })
            }
          />
        </span>
      </div>
      <ChangesBody
        workspacePath={workspacePath}
        scope={scope}
        visible={visible}
        layout={diffLayout}
        diffsRef={diffsRef}
      />
    </section>
  );
}
