import { Badge } from '@mastra/playground-ui/components/Badge';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { SectionCard } from '@mastra/playground-ui/components/SectionCard';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useInfrastructureStatus } from '@/domains/agent-builder/hooks/use-infrastructure-status';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

const InfrastructureStatus = ({ ok, label }: { ok: boolean; label: string }) => (
  <Badge
    variant={ok ? 'green' : 'neutral'}
    size="sm"
    indicator="dot"
    data-slot="infrastructure-status-badge"
    data-ok={ok ? 'true' : 'false'}
  >
    {label}
  </Badge>
);

const EmptyRow = ({ message }: { message: string }) => (
  <Txt variant="caption" tone="muted">
    {message}
  </Txt>
);

const titleCase = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return value;
  return String(value)
    .split(/([\s-]+)/)
    .map(part => (/^[\s-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
};

const Detail = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="flex flex-col gap-0.5">
    <Txt variant="meta" tone="muted">
      {label}
    </Txt>
    <Txt variant="caption" tone="ink">
      {value ?? 'Not set'}
    </Txt>
  </div>
);

const ConfigDetails = ({ entries }: { entries: Array<{ key: string; value: string }> }) => {
  if (entries.length === 0) return null;

  return (
    <div className="border-border grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
      {entries.map(entry => (
        <Detail key={entry.key} label={`Config: ${entry.key}`} value={titleCase(entry.value)} />
      ))}
    </div>
  );
};

export const AgentBuilderInfrastructure = () => {
  const { hasPermission } = usePermissions();
  const canViewInfrastructure = hasPermission('infrastructure:read');
  const { data, isLoading, error } = useInfrastructureStatus({ enabled: canViewInfrastructure });

  return (
    <PageLayout width="narrow">
      <PageLayout.TopArea>
        <PageHeader>
          <PageHeader.Title>Infrastructure</PageHeader.Title>
        </PageHeader>
      </PageLayout.TopArea>

      <PageLayout.MainArea className="mt-6 flex flex-col gap-5">
        <SectionCard
          title="Agent Builder Infrastructure"
          description="Deployment-level defaults Agent Builder applies when users create or run builder agents."
        >
          {!canViewInfrastructure ? (
            <Txt variant="caption" tone="muted">
              You do not have permission to view Agent Builder infrastructure.
            </Txt>
          ) : isLoading ? (
            <Txt variant="caption" tone="muted">
              Loading infrastructure configuration…
            </Txt>
          ) : error || !data ? (
            <Txt variant="caption" tone="muted">
              Infrastructure configuration unavailable.
            </Txt>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Txt variant="subheading">Channels</Txt>
                  <Txt variant="meta" tone="muted">
                    Configured channel providers available to Agent Builder publish/share flows. Unconfigured providers
                    are omitted until their required environment/config is present.
                  </Txt>
                </div>
                {data.channels.providers.length === 0 ? (
                  <EmptyRow message="No configured channel providers for Agent Builder." />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.channels.providers.map(provider => (
                      <li key={provider.id} className="border-border rounded-md border px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <Txt variant="column">{titleCase(provider.name)}</Txt>
                            <Txt variant="meta" tone="muted">
                              Provider ID: {provider.id}
                            </Txt>
                          </div>
                          <InfrastructureStatus
                            ok={provider.isConfigured}
                            label={provider.isConfigured ? 'Configured' : 'Not configured'}
                          />
                        </div>
                        <div className="border-border mt-3 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
                          <Detail label="Registered by" value={`${titleCase(provider.name)} provider`} />
                          <Detail label="Provider routes" value={provider.routeCount} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Txt variant="subheading">Browser</Txt>
                  <Txt variant="meta" tone="muted">
                    Browser automation provider configured for builder agents. The card shows the selected provider and
                    only non-default options explicitly passed in configuration.
                  </Txt>
                </div>
                {!data.browser.provider ? (
                  <EmptyRow message="No browser configured." />
                ) : (
                  <div className="border-border rounded-md border px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <Txt variant="column">{titleCase(data.browser.provider)}</Txt>
                      </div>
                      <InfrastructureStatus
                        ok={data.browser.registered}
                        label={data.browser.registered ? 'Provider available' : 'Provider missing'}
                      />
                    </div>
                    {data.browser.env ? (
                      <div className="border-border mt-3 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
                        <Detail label="Environment" value={titleCase(data.browser.env)} />
                      </div>
                    ) : null}
                    <ConfigDetails entries={data.browser.config} />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Txt variant="subheading">Registries</Txt>
                  <Txt variant="meta" tone="muted">
                    External skill registries available to import skills into the workspace.
                  </Txt>
                </div>
                <div className="border-border rounded-md border px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <Txt variant="column">skills.sh</Txt>
                      <Txt variant="meta" tone="muted">
                        GitHub-backed public skills registry.
                      </Txt>
                    </div>
                    <InfrastructureStatus
                      ok={data.registries?.skillsSh?.enabled ?? false}
                      label={data.registries?.skillsSh?.enabled ? 'Enabled' : 'Disabled'}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Txt variant="subheading">Workspace</Txt>
                  <Txt variant="meta" tone="muted">
                    Workspace config used for generated files and sandbox execution. This reports the builder workspace
                    only, not agent-specific runtime workspaces.
                  </Txt>
                </div>
                {!data.workspace.type ? (
                  <EmptyRow message="No workspace configured." />
                ) : (
                  <div className="border-border rounded-md border px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <Txt variant="column">
                        {data.workspace.workspaceId ?? data.workspace.name ?? 'Inline workspace'}
                      </Txt>
                      <div className="flex gap-2">
                        <InfrastructureStatus ok={data.workspace.hasFilesystem} label="Filesystem" />
                        <InfrastructureStatus ok={data.workspace.hasSandbox} label="Sandbox" />
                      </div>
                    </div>
                    <div className="border-border mt-3 grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2">
                      <Detail
                        label="Config type"
                        value={data.workspace.type === 'id' ? 'Registered workspace' : 'Inline config'}
                      />
                      {data.workspace.workspaceId ? (
                        <Detail label="Workspace ID" value={data.workspace.workspaceId} />
                      ) : null}
                      <Detail label="Name" value={data.workspace.name} />
                      <Detail label="Filesystem provider" value={titleCase(data.workspace.filesystemProvider)} />
                      <Detail label="Sandbox provider" value={titleCase(data.workspace.sandboxProvider)} />
                    </div>
                    <ConfigDetails entries={data.workspace.config} />
                  </div>
                )}
              </div>
            </div>
          )}
        </SectionCard>
      </PageLayout.MainArea>
    </PageLayout>
  );
};

export default AgentBuilderInfrastructure;
