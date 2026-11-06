import { Button } from '@mastra/playground-ui/components/Button';
import { FileDiff, NotepadText } from 'lucide-react';

import { SkeletonRows } from '../../../ui/SkeletonRows';

/** Mirrors the compact overview while the session's authorized details resolve. */
export function WorkspaceOverviewSkeleton() {
  return (
    <aside aria-label="Workspace" aria-busy="true" className="flex min-w-0 flex-col gap-0.5 p-1.5">
      <Button disabled className="w-full justify-start" size="sm" variant="ghost">
        <FileDiff />
        <span>Changes</span>
        <SkeletonRows label="Loading workspace details" rows={1} rowClassName="h-3 w-16" className="ml-auto" />
      </Button>
      <Button disabled className="w-full justify-start" size="sm" variant="ghost">
        <NotepadText />
        <span>Files</span>
      </Button>
    </aside>
  );
}
