import { overlaySurfaceStyle, raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { TransitionEvent } from 'react';

import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { cardHeightClass, cardMaxHeightClass, cardRadiusClass, cardTransitionClass } from '../layout';
import type { WorkspacePanelSize } from '../layout';
import { WorkspaceFilesContent } from './WorkspaceFilesContent';

/** Unfolds from the dock's capsule and folds back into it; stays mounted while folded, so the tree keeps its open folders. */
export function WorkspacePanelDockCard() {
  const { open, canDock, moving, onDockSettled } = useWorkspacePanel();
  const [size, setSize] = useState<WorkspacePanelSize>('compact');
  const [settledSize, setSettledSize] = useState(size);
  const docked = open && canDock;

  const settle = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    onDockSettled();
    setSettledSize(size);
  };

  return (
    <div
      data-motion={moving ? 'place' : settledSize !== size ? 'height' : undefined}
      onTransitionEnd={settle}
      onTransitionCancel={settle}
      className={cn(
        'pointer-events-auto absolute flex flex-col overflow-hidden',
        '[interpolate-size:allow-keywords] transition-[border-radius,box-shadow]',
        // Without keyword interpolation the height would jump while the width glides.
        'motion-safe:supports-[interpolate-size:allow-keywords]:transition-[height,width,top,right,border-radius,box-shadow]',
        cardTransitionClass,
        docked
          ? cn(
              overlaySurfaceStyle,
              cardRadiusClass,
              cardHeightClass[size],
              cardMaxHeightClass,
              '-top-(--dock-overhang) -right-(--dock-overhang) w-(--workspace-files-card)',
              'starting:top-0 starting:right-0 starting:size-full starting:rounded-(--capsule-radius)',
            )
          : cn(raisedSurfaceStyle, 'top-0 right-0 size-full rounded-(--capsule-radius)'),
      )}
    >
      <div
        inert={!docked}
        data-testid="workspace-files-card"
        className={cn(
          'flex min-h-0 w-(--workspace-files-card) min-w-full grow origin-top-right flex-col self-end',
          'transition-[opacity,filter,scale] ease-(--resize-ease) motion-reduce:transition-none',
          docked
            ? cn(
                'opacity-100 delay-75 duration-(--duration-slow)',
                moving && 'starting:opacity-0 motion-safe:starting:scale-[0.96] motion-safe:starting:blur-xs',
              )
            : 'opacity-0 duration-(--duration-fast) motion-safe:scale-[0.96] motion-safe:blur-xs',
        )}
      >
        <WorkspaceFilesContent onSizeChange={setSize} />
      </div>
    </div>
  );
}
