import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { workspacePanelKey } from '../context/WorkspacePanelContext';
import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { reservedSpaceClass, reservedSpaceTransitionClass } from '../layout';
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

  return (
    <div
      className={cn(
        'relative flex justify-self-end transition-[left] starting:left-0',
        '[--dock-overhang:--spacing(1)] [--capsule-radius:calc(var(--spacing-control-sm)/2+--spacing(0.5))]',
        reservedSpaceClass.dock,
        reservedSpaceTransitionClass,
      )}
    >
      <div ref={measureCapsule} className="pointer-events-auto relative z-1 flex items-center gap-0.5 p-0.5">
        {children}
      </div>
      <WorkspacePanelDockCard key={workspacePanelKey(panel)} />
    </div>
  );
}
