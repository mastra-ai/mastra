import { cn } from '@mastra/playground-ui/utils/cn';

import { useWorkspaceFiles } from '../context/useWorkspaceFiles';
import { WorkspaceFilesContent } from './WorkspaceFilesContent';

/** The docked card. Stays mounted but dormant while hidden so the tree keeps its expanded folders. */
export function WorkspaceFilesSurface() {
  const { open, workspacePath, viewingFile, canDock } = useWorkspaceFiles();

  if (!workspacePath || !canDock) return null;

  return (
    <div
      inert={!open}
      data-testid="workspace-files-card"
      className={cn(
        'border-border1 bg-surface3 absolute top-3 right-3 z-20 flex flex-col overflow-hidden rounded-2xl border',
        'shadow-[0_1px_2px_-1px_oklch(0%_0_0deg/12%),0_16px_40px_-20px_oklch(0%_0_0deg/22%)]',
        'duration-360 ease-out-custom transition-[translate,scale,opacity]',
        'will-change-[translate,opacity] motion-reduce:transition-none',
        'w-[var(--workspace-files-card)]',
        viewingFile ? 'h-[min(34rem,calc(100%-1.5rem))]' : 'max-h-[calc(100%-1.5rem)]',
        open
          ? 'translate-x-0 scale-100 opacity-100'
          : 'pointer-events-none translate-x-[calc(100%+0.75rem)] scale-[0.98] opacity-0',
      )}
    >
      <WorkspaceFilesContent />
    </div>
  );
}
