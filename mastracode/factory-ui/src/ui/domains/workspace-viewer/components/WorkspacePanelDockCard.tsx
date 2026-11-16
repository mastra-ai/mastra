import { overlaySurfaceStyle, raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';

import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { cardHeightClass, cardMotionClass, cardRadiusClass, cardTrackClass, panelRevealClass } from '../layout';
import type { WorkspacePanelSize } from '../layout';
import { WorkspaceFilesContent } from './WorkspaceFilesContent';

export function WorkspacePanelDockCard() {
  const { docked, hasDocked } = useWorkspacePanel();
  const [size, setSize] = useState<WorkspacePanelSize>();

  return (
    <div
      className={cn(
        'absolute',
        '-top-[calc(var(--panel-reveal)*var(--dock-overhang))] -right-[calc(var(--panel-reveal)*var(--dock-overhang))]',
        'w-[calc(100%+var(--panel-reveal)*(var(--workspace-files-card)-100%))]',
        cardTrackClass,
        panelRevealClass,
      )}
    >
      <div
        data-resized={size !== undefined || undefined}
        className={cn(
          'pointer-events-auto flex max-h-full flex-col overflow-hidden',
          '[interpolate-size:allow-keywords] [transition-property:border-radius,box-shadow]',
          // Without keyword interpolation the height would jump while the width glides.
          'motion-safe:supports-[interpolate-size:allow-keywords]:[transition-property:height,border-radius,box-shadow]',
          cardMotionClass,
          docked
            ? cn(overlaySurfaceStyle, cardRadiusClass, cardHeightClass[size ?? 'compact'])
            : cn(raisedSurfaceStyle, 'h-(--capsule-height) rounded-[calc(var(--capsule-height)/2)]'),
        )}
      >
        <div
          inert={!docked}
          data-testid="workspace-files-card"
          className={cn(
            // Floored at the dock threshold's width: folded, the content keeps one layout however the chat resizes.
            'flex min-h-0 w-[max(var(--workspace-files-card),var(--workspace-card-min))] grow origin-top-right flex-col self-end',
            'transition-[opacity,filter,scale] ease-(--resize-ease) motion-reduce:transition-none',
            docked
              ? 'opacity-100 duration-0 [[data-panel-moved]_&]:delay-75 [[data-panel-moved]_&]:duration-(--duration-slow)'
              : 'opacity-0 duration-(--duration-fast) motion-safe:scale-[0.96] motion-safe:blur-xs',
          )}
        >
          {hasDocked && <WorkspaceFilesContent visible={docked} onSizeChange={setSize} />}
        </div>
      </div>
    </div>
  );
}
