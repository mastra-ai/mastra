import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  AgentIcon,
  WorkspacesIcon,
  truncateString,
} from '@mastra/playground-ui';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { useMemo } from 'react';
import type { WorkspaceItem } from '../types';
import { useLinkComponent } from '@/lib/framework';

export interface WorkspacesListProps {
  workspaces: WorkspaceItem[];
  isLoading: boolean;
  search?: string;
}

const COLUMNS = 'auto 1fr auto auto';

export function WorkspacesList({ workspaces, isLoading, search = '' }: WorkspacesListProps) {
  const { paths, Link } = useLinkComponent();

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return workspaces.filter(workspace => {
      const name = workspace.name?.toLowerCase() ?? '';
      const agentName = workspace.agentName?.toLowerCase() ?? '';
      return name.includes(term) || agentName.includes(term);
    });
  }, [workspaces, search]);

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <EntityList columns={COLUMNS} variant="striped">
      <EntityList.Top>
        <EntityList.TopCell className="">Name</EntityList.TopCell>
        <EntityList.TopCell className="">Source</EntityList.TopCell>
        <EntityList.TopCell className="">Capabilities</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Access</EntityList.TopCell>
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Workspaces match your search" /> : null}

      {filteredData.map(workspace => {
        const name = truncateString(workspace.name, 50);
        const isAgentWorkspace = workspace.source === 'agent';
        const capabilities = [
          workspace.capabilities.hasFilesystem ? 'Filesystem' : null,
          workspace.capabilities.hasSkills ? 'Skills' : null,
        ].filter(Boolean);

        return (
          <EntityList.RowLink key={workspace.id} to={paths.workspaceLink(workspace.id)} LinkComponent={Link}>
            <EntityList.NameCell>{name || ''}</EntityList.NameCell>
            <EntityList.Cell>
              {isAgentWorkspace && workspace.agentName ? (
                <Badge icon={<AgentIcon />}>{truncateString(workspace.agentName, 40)}</Badge>
              ) : (
                <Badge icon={<WorkspacesIcon />}>Global</Badge>
              )}
            </EntityList.Cell>
            <EntityList.TextCell>{capabilities.length ? capabilities.join(', ') : '—'}</EntityList.TextCell>
            <EntityList.TextCell className="text-center">
              {workspace.safety.readOnly ? <Badge variant="warning">Read-only</Badge> : 'Writable'}
            </EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
