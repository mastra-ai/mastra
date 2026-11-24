import { is404NotFoundError } from '@mastra/react/hooks/query';
import { useWorkspaceDirectory } from '@mastra/react/hooks/workspace';
import type { ReactNode } from 'react';
import { Panel } from 'react-resizable-panels';
import { ROOT_PATH } from '../path';
import { useWorkspaceContext } from './use-workspace-context';
import { WorkspaceActiveFileContent as ActiveFileBody } from './workspace-active-file';
import type { WorkspacePreviewFactory } from './workspace-active-file';
import { WorkspaceAddSkill } from './workspace-add-skill';
import { WorkspaceProvider } from './workspace-context';
import type { WorkspaceProviderProps } from './workspace-context';
import { WorkspaceCreateDirectory } from './workspace-create-directory';
import { WorkspaceSearchResults } from './workspace-search';
import { WorkspaceTree as TreeBody } from './workspace-tree';
import { EmptyState } from '@/ds/components/EmptyState';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';
import { PanelGroup } from '@/lib/resize/panel-group';
import { PanelSeparator } from '@/lib/resize/separator';

export type WorkspaceRootProps = WorkspaceProviderProps;

export function WorkspaceRoot({ children, ...props }: WorkspaceRootProps) {
  return (
    <WorkspaceProvider {...props}>
      <WorkspaceRootBody>{children}</WorkspaceRootBody>
    </WorkspaceProvider>
  );
}

/** An empty workspace (or one whose root folder doesn't exist yet) gets a single empty state instead of two panes. */
function WorkspaceRootBody({ children }: { children: ReactNode }) {
  const { workspaceId } = useWorkspaceContext();
  const { data, error } = useWorkspaceDirectory({ workspaceId: workspaceId, path: ROOT_PATH });
  const isEmpty = data ? data.length === 0 : is404NotFoundError(error);

  if (isEmpty) {
    return (
      <EmptyState
        variant="fill"
        titleSlot="This workspace is empty"
        descriptionSlot="Files written by your agents will show up here."
        actionSlot={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <WorkspaceCreateDirectory labeled />
            <WorkspaceAddSkill labeled />
          </div>
        }
      />
    );
  }

  return (
    <div className="size-full overflow-hidden">
      <PanelGroup className="size-full min-h-0 min-w-0" orientation="horizontal">
        {children}
      </PanelGroup>
    </div>
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
        collapsible={false}
        className="min-w-0"
      >
        <div className="flex h-full min-h-0 flex-col">{children}</div>
      </CollapsiblePanel>
      <PanelSeparator className="w-px bg-border" />
    </>
  );
}

export interface WorkspaceAsideHeaderProps {
  children: ReactNode;
  /** Slot for icon buttons (e.g. create directory), rendered after the children. */
  actions?: ReactNode;
}

export function WorkspaceAsideHeader({ children, actions }: WorkspaceAsideHeaderProps) {
  const { isSearching } = useWorkspaceContext();
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
      <div className="min-w-0 flex-1">{children}</div>
      {actions && !isSearching ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

/** Shows the file tree, or search results while the search is open. */
export function WorkspaceTree() {
  const { isSearching } = useWorkspaceContext();
  return (
    <ScrollArea className="min-h-0 flex-1 px-2 py-1">
      {isSearching ? <WorkspaceSearchResults /> : <TreeBody />}
    </ScrollArea>
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
  return <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">{children}</div>;
}

export function WorkspaceActiveFileContent({ renderPreview }: { renderPreview?: WorkspacePreviewFactory }) {
  const { activeFilePath } = useWorkspaceContext();
  if (!activeFilePath) return <EmptyState variant="fill" titleSlot="Select a file" />;
  return (
    <ScrollArea className="min-h-0 flex-1">
      <ActiveFileBody renderPreview={renderPreview} />
    </ScrollArea>
  );
}
