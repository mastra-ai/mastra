import { Workspace } from './workspace';

export interface WorkspaceTreeViewProps {
  workspaceId: string;
  initialFile?: string;
}

export function WorkspaceTreeView({ workspaceId, initialFile }: WorkspaceTreeViewProps) {
  return (
    <Workspace.Root workspaceId={workspaceId} initialFile={initialFile}>
      <Workspace.Aside>
        <Workspace.AsideHeader>
          <Workspace.Search />
        </Workspace.AsideHeader>
        <Workspace.Tree />
      </Workspace.Aside>
      <Workspace.ActiveFile>
        <Workspace.ActiveFileHeader>
          <Workspace.FilePath />
        </Workspace.ActiveFileHeader>
        <Workspace.ActiveFileContent />
      </Workspace.ActiveFile>
    </Workspace.Root>
  );
}
