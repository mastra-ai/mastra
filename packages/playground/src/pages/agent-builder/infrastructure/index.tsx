import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import {
  SettingsContainer,
  SettingsEmptyRow,
  SettingsGroup,
  SettingsItem,
  SettingsLayout,
  SettingsRow,
  SettingsSkeleton,
  SettingsTitle,
} from '@mastra/playground-ui/new/settings';

import { useInfrastructureStatus } from '@/domains/agent-builder/hooks/use-infrastructure-status';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

const InfrastructureStatus = ({ ok, label }: { ok: boolean; label: string }) => (
  <Badge
    variant={ok ? 'success' : 'neutral'}
    size="sm"
    indicator="dot"
    data-slot="infrastructure-status-badge"
    data-ok={ok ? 'true' : 'false'}
  >
    {label}
  </Badge>
);

const titleCase = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return value;
  return String(value)
    .split(/([\s-]+)/)
    .map(part => (/^[\s-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
};

const DetailRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <SettingsRow label={label}>
    <span className="truncate text-body-sm text-muted-foreground">{value ?? 'Not set'}</span>
  </SettingsRow>
);

const ConfigRows = ({ entries }: { entries: Array<{ key: string; value: string }> }) =>
  entries.map(entry => <DetailRow key={entry.key} label={`Config: ${entry.key}`} value={titleCase(entry.value)} />);

const StatusMessage = ({ title, message }: { title: string; message: string }) => (
  <SettingsGroup>
    <SettingsTitle>{title}</SettingsTitle>
    <SettingsContainer>
      <SettingsEmptyRow>{message}</SettingsEmptyRow>
    </SettingsContainer>
  </SettingsGroup>
);

export const AgentBuilderInfrastructure = () => {
  const { hasPermission } = usePermissions();
  const canViewInfrastructure = hasPermission('infrastructure:read');
  const { data, isLoading, error } = useInfrastructureStatus({ enabled: canViewInfrastructure });

  return (
    <PageLayout
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <PageHeader>
              <PageHeader.Title>Infrastructure</PageHeader.Title>
              <PageHeader.Description>
                Deployment-level defaults Agent Builder applies when users create or run builder agents.
              </PageHeader.Description>
            </PageHeader>
          </ActionRow.Start>
        </ActionRow>
      }
    >
      <SettingsLayout>
        {!canViewInfrastructure ? (
          <StatusMessage
            title="Agent Builder"
            message="You do not have permission to view Agent Builder infrastructure."
          />
        ) : isLoading ? (
          <SettingsGroup>
            <SettingsTitle>Agent Builder</SettingsTitle>
            <SettingsContainer>
              <SettingsSkeleton label="Loading infrastructure configuration" variant="item" rows={3} />
            </SettingsContainer>
          </SettingsGroup>
        ) : error || !data ? (
          <StatusMessage title="Agent Builder" message="Infrastructure configuration unavailable." />
        ) : (
          <>
            <SettingsGroup>
              <SettingsTitle info="Configured channel providers available to Agent Builder publish/share flows. Unconfigured providers are omitted until their required environment/config is present.">
                Channels
              </SettingsTitle>
              <SettingsContainer>
                {data.channels.providers.length === 0 ? (
                  <SettingsEmptyRow>No configured channel providers for Agent Builder.</SettingsEmptyRow>
                ) : (
                  data.channels.providers.map(provider => (
                    <SettingsItem
                      key={provider.id}
                      title={titleCase(provider.name)}
                      description={`Provider ID: ${provider.id}, ${provider.routeCount} provider routes`}
                    >
                      <InfrastructureStatus
                        ok={provider.isConfigured}
                        label={provider.isConfigured ? 'Configured' : 'Not configured'}
                      />
                    </SettingsItem>
                  ))
                )}
              </SettingsContainer>
            </SettingsGroup>

            <SettingsGroup>
              <SettingsTitle info="Browser automation provider configured for builder agents, with only the non-default options passed in configuration.">
                Browser
              </SettingsTitle>
              <SettingsContainer>
                {!data.browser.provider ? (
                  <SettingsEmptyRow>No browser configured.</SettingsEmptyRow>
                ) : (
                  <>
                    <SettingsItem title={titleCase(data.browser.provider)}>
                      <InfrastructureStatus
                        ok={data.browser.registered}
                        label={data.browser.registered ? 'Provider available' : 'Provider missing'}
                      />
                    </SettingsItem>
                    {data.browser.env ? <DetailRow label="Environment" value={titleCase(data.browser.env)} /> : null}
                    <ConfigRows entries={data.browser.config} />
                  </>
                )}
              </SettingsContainer>
            </SettingsGroup>

            <SettingsGroup>
              <SettingsTitle info="External skill registries available to import skills into the workspace.">
                Registries
              </SettingsTitle>
              <SettingsContainer>
                <SettingsItem title="skills.sh" description="GitHub-backed public skills registry.">
                  <InfrastructureStatus
                    ok={data.registries?.skillsSh?.enabled ?? false}
                    label={data.registries?.skillsSh?.enabled ? 'Enabled' : 'Disabled'}
                  />
                </SettingsItem>
              </SettingsContainer>
            </SettingsGroup>

            <SettingsGroup>
              <SettingsTitle info="Workspace config used for generated files and sandbox execution. This reports the builder workspace only, not agent-specific runtime workspaces.">
                Workspace
              </SettingsTitle>
              <SettingsContainer>
                {!data.workspace.type ? (
                  <SettingsEmptyRow>No workspace configured.</SettingsEmptyRow>
                ) : (
                  <>
                    <SettingsItem title={data.workspace.workspaceId ?? data.workspace.name ?? 'Inline workspace'}>
                      <InfrastructureStatus ok={data.workspace.hasFilesystem} label="Filesystem" />
                      <InfrastructureStatus ok={data.workspace.hasSandbox} label="Sandbox" />
                    </SettingsItem>
                    <DetailRow
                      label="Config type"
                      value={data.workspace.type === 'id' ? 'Registered workspace' : 'Inline config'}
                    />
                    {data.workspace.workspaceId ? (
                      <DetailRow label="Workspace ID" value={data.workspace.workspaceId} />
                    ) : null}
                    <DetailRow label="Name" value={data.workspace.name} />
                    <DetailRow label="Filesystem provider" value={titleCase(data.workspace.filesystemProvider)} />
                    <DetailRow label="Sandbox provider" value={titleCase(data.workspace.sandboxProvider)} />
                    <ConfigRows entries={data.workspace.config} />
                  </>
                )}
              </SettingsContainer>
            </SettingsGroup>
          </>
        )}
      </SettingsLayout>
    </PageLayout>
  );
};

export default AgentBuilderInfrastructure;
