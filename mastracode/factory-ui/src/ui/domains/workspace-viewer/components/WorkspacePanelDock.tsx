import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { workspacePanelKey } from '../context/WorkspacePanelContext';
import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { reservedSpaceClass } from '../layout';
import { WorkspacePanelDockCard } from './WorkspacePanelDockCard';

function measureCapsule(capsule: HTMLDivElement) {
  const dock = capsule.parentElement;
  if (!dock) return;
  const observer = new ResizeObserver(() =>
    dock.style.setProperty('--dock-actions-reserve', `calc(${capsule.offsetWidth}px + var(--dock-overhang))`),
  );
  observer.observe(capsule);
  return () => observer.disconnect();
}

export function WorkspacePanelDock({ children }: { children: ReactNode }) {
  const panel = useWorkspacePanel();
  const Dock = panel.workspacePath ? 'aside' : 'div';

  return (
    <Dock
      aria-label={panel.workspacePath ? 'Session panel' : undefined}
      className={cn(
        'relative flex justify-self-end',
        '[--dock-overhang:--spacing(1)] [--capsule-height:calc(var(--spacing-control-sm)+--spacing(1))]',
        reservedSpaceClass.dock,
      )}
    >
      <div
        ref={measureCapsule}
        className="pointer-events-auto relative z-1 flex items-center gap-0.5 p-0.5 empty:hidden"
      >
        {children}
      </div>
      {panel.workspacePath && <WorkspacePanelDockCard key={workspacePanelKey(panel)} />}
    </Dock>
  );
}
