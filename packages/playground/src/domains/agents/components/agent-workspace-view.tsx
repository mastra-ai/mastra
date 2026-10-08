import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAgentWorkspace } from '../context/agent-workspace-context';
import { useMemoryTimeline } from '../context/memory-timeline-context';

/** Supplies view content without mounting another sidebar, header or resizable layout. */
export function AgentWorkspaceView({ navigation, children }: { navigation?: ReactNode; children: ReactNode }) {
  const workspace = useAgentWorkspace();
  const panelRef = workspace?.navigationPanel;
  const { isPanelOpen } = useMemoryTimeline();

  useEffect(() => {
    const panel = panelRef?.current;
    if (!isPanelOpen || !panel) return;
    const width = panel.getSize().inPixels;
    panel.resize('50%');
    // Also restore the working width when leaving Chat with memory detail open.
    return () => panel.resize(width);
  }, [isPanelOpen, panelRef]);

  return (
    <>
      {workspace?.navigationTarget && navigation ? createPortal(navigation, workspace.navigationTarget) : null}
      {children}
    </>
  );
}
