import type { ReactNode } from 'react';
import { Panel } from 'react-resizable-panels';
import { useWorkspaceContext } from './use-workspace-context';
import { WorkspaceActiveFileContent as ActiveFileBody } from './workspace-active-file';
import { WorkspaceProvider } from './workspace-context';
import { WorkspaceSearchResults } from './workspace-search';
import { WorkspaceTree as TreeBody } from './workspace-tree';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';
import { PanelGroup } from '@/lib/resize/panel-group';
import { PanelSeparator } from '@/lib/resize/separator';

export interface WorkspaceRootProps {
  workspaceId: string;
  initialFile?: string;
  children: ReactNode;
}

export function WorkspaceRoot({ workspaceId, initialFile, children }: WorkspaceRootProps) {
  return (
    <WorkspaceProvider workspaceId={workspaceId} initialFile={initialFile}>
      <PanelGroup className="size-full min-h-0 min-w-0" orientation="horizontal">
        {children}
      </PanelGroup>
    </WorkspaceProvider>
  );
}

export function WorkspaceAside({ children }: { children: ReactNode }) {
  return (
    <>
      <CollapsiblePanel
        direction="left"
        id="workspace-aside"
        minSize={200}
        maxSize="50%"
        defaultSize="25%"
        collapsedSize={60}
        collapsible
        className="flex min-w-0 flex-col"
      >
        {children}
      </CollapsiblePanel>
      <PanelSeparator />
    </>
  );
}

export function WorkspaceAsideHeader({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 border-b border-border p-2">{children}</div>;
}

/** Shows the file tree, or search results while a query is active. */
export function WorkspaceTree() {
  const { query } = useWorkspaceContext();
  return (
    <ScrollArea className="min-h-0 flex-1 px-1">{query.trim() ? <WorkspaceSearchResults /> : <TreeBody />}</ScrollArea>
  );
}

export function WorkspaceActiveFile({ children }: { children: ReactNode }) {
  return (
    <Panel id="workspace-active-file" className="flex min-w-0 flex-col" minSize={30}>
      {children}
    </Panel>
  );
}

export function WorkspaceActiveFileHeader({ children }: { children: ReactNode }) {
  return <div className="flex min-h-11 items-center gap-2 border-b border-border px-4">{children}</div>;
}

export function WorkspaceActiveFileContent() {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ActiveFileBody />
    </ScrollArea>
  );
}
