import { overlaySurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';

import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { cardHeightClass, cardRadiusClass } from '../layout';
import { WorkspaceFilesContent } from './WorkspaceFilesContent';

/** The docked card. Stays mounted but dormant while hidden so the tree keeps its expanded folders. */
export function WorkspaceFilesSurface() {
  const { open, workspacePath, size, canDock } = useWorkspacePanel();

  if (!workspacePath || !canDock) return null;

  return (
    <div
      inert={!open}
      data-testid="workspace-files-card"
      className={cn(
        'absolute top-3 right-3 z-20 flex flex-col overflow-hidden',
        cardRadiusClass,
        overlaySurfaceStyle,
        '[interpolate-size:allow-keywords] origin-top-right duration-360 ease-out-custom transition-[scale,opacity,width,height,min-height]',
        'will-change-[scale,opacity] motion-reduce:transition-none',
        'w-(--workspace-files-card) max-h-[calc(100%-1.5rem)]',
        cardHeightClass[size],
        open ? 'scale-100 opacity-100' : 'pointer-events-none scale-98 opacity-0',
      )}
    >
      <WorkspaceFilesContent />
    </div>
  );
}
