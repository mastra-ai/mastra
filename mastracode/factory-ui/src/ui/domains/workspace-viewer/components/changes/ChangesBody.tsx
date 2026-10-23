import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { lazy, Suspense } from 'react';
import type { Ref } from 'react';

import type { WorkspaceChangesScope } from '../../../../../api/types';
import { useWorkspacePatches } from '../../../../../hooks/use-fs';
import type { DiffLayout } from '../../hooks/useDiffLayout';
import { ChangesEmptyState } from './ChangesEmptyState';
import type { StackedDiffsHandle } from './diffs/StackedDiffs';

const StackedDiffs = lazy(() => import('./diffs/StackedDiffs').then(({ StackedDiffs }) => ({ default: StackedDiffs })));

const centeredSpinner = (
  <div className="flex min-h-0 flex-1 items-center justify-center">
    <Spinner size="sm" />
  </div>
);

interface ChangesBodyProps {
  workspacePath: string;
  scope: WorkspaceChangesScope;
  visible: boolean;
  layout: DiffLayout;
  diffsRef: Ref<StackedDiffsHandle>;
}

export function ChangesBody({ workspacePath, scope, visible, layout, diffsRef }: ChangesBodyProps) {
  const patches = useWorkspacePatches(workspacePath, scope, { enabled: visible });

  if (patches.error) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 text-center">
        <Txt variant="caption" className="text-destructive-foreground">
          {patches.error.message}
        </Txt>
      </div>
    );
  }
  if (!patches.data) return centeredSpinner;
  if (patches.data.changes.length === 0) {
    return <ChangesEmptyState workspacePath={workspacePath} sandboxRunning={patches.data.available} />;
  }
  return (
    <Suspense fallback={centeredSpinner}>
      <StackedDiffs key={scope} ref={diffsRef} changes={patches.data} layout={layout} className="flex-1" />
    </Suspense>
  );
}
