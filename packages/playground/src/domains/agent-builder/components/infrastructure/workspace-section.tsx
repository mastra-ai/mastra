import type { InfrastructureStatusResponse } from '@mastra/client-js';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsGroup,
  SettingsItem,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';
import { titleCaseOrNotSet } from './format-infrastructure-value';
import { InfrastructureConfigRows } from './infrastructure-config-rows';
import { InfrastructureDetailRow } from './infrastructure-detail-row';
import { InfrastructureStatusBadge } from './infrastructure-status-badge';

type Workspace = InfrastructureStatusResponse['workspace'];

const workspaceTitle = (workspace: Workspace) => {
  if (workspace.workspaceId) return workspace.workspaceId;
  if (workspace.name) return workspace.name;
  return 'Inline workspace';
};

const WorkspaceRows = ({ workspace }: { workspace: Workspace }) => (
  <>
    <SettingsItem title={workspaceTitle(workspace)}>
      <InfrastructureStatusBadge ok={workspace.hasFilesystem} label="Filesystem" />
      <InfrastructureStatusBadge ok={workspace.hasSandbox} label="Sandbox" />
    </SettingsItem>
    <InfrastructureDetailRow
      label="Config type"
      value={workspace.type === 'id' ? 'Registered workspace' : 'Inline config'}
    />
    {workspace.workspaceId ? <InfrastructureDetailRow label="Workspace ID" value={workspace.workspaceId} /> : null}
    <InfrastructureDetailRow label="Name" value={workspace.name ?? 'Not set'} />
    <InfrastructureDetailRow label="Filesystem provider" value={titleCaseOrNotSet(workspace.filesystemProvider)} />
    <InfrastructureDetailRow label="Sandbox provider" value={titleCaseOrNotSet(workspace.sandboxProvider)} />
    <InfrastructureConfigRows entries={workspace.config} />
  </>
);

export const WorkspaceSection = ({ workspace }: { workspace: Workspace }) => (
  <SettingsGroup>
    <SettingsTitle info="Workspace config used for generated files and sandbox execution. This reports the builder workspace only, not agent-specific runtime workspaces.">
      Workspace
    </SettingsTitle>
    <SettingsContainer>
      {workspace.type ? (
        <WorkspaceRows workspace={workspace} />
      ) : (
        <SettingsEmptyRow>No workspace configured.</SettingsEmptyRow>
      )}
    </SettingsContainer>
  </SettingsGroup>
);
