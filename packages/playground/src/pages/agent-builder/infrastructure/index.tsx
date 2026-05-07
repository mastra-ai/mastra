import type { InfrastructureStatusResponse } from '@mastra/client-js';
import { PageHeader, PageLayout, SectionCard, Txt } from '@mastra/playground-ui';

import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useInfrastructureStatus } from '@/domains/builder/hooks/use-infrastructure-status';

const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
      ok ? 'bg-accent3/10 text-accent3' : 'bg-surface2 text-neutral3'
    }`}
    data-slot="infrastructure-status-badge"
    data-ok={ok ? 'true' : 'false'}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-accent3' : 'bg-neutral3'}`} aria-hidden="true" />
    {label}
  </span>
);

const EmptyRow = ({ message }: { message: string }) => (
  <Txt variant="ui-sm" className="text-neutral3">
    {message}
  </Txt>
);

const Detail = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div className="flex flex-col gap-0.5">
    <Txt variant="ui-xs" className="text-neutral4">
      {label}
    </Txt>
    <Txt variant="ui-sm" className="text-icon6">
      {value ?? 'Not set'}
    </Txt>
  </div>
);

const ConfigDetails = ({ entries }: { entries: Array<{ key: string; value: string }> }) => {
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 border-t border-border1 pt-3 sm:grid-cols-2">
      {entries.map(entry => (
        <Detail key={entry.key} label={`Config: ${entry.key}`} value={entry.value} />
      ))}
    </div>
  );
};

export const AgentBuilderInfrastructure = () => {
  const { hasPermission } = usePermissions();
  const canViewInfrastructure = hasPermission('infrastructure:read');
  const { data: infrastructureData, isLoading, error } = useInfrastructureStatus({ enabled: canViewInfrastructure });
  const data = infrastructureData as InfrastructureStatusResponse | undefined;

  return (
    <PageLayout width="narrow">
      <PageLayout.TopArea>
        <PageHeader>
          <PageHeader.Title>Infrastructure</PageHeader.Title>
        </PageHeader>
      </PageLayout.TopArea>

      <PageLayout.MainArea className="flex flex-col gap-5 mt-6">
        <SectionCard
          title="Agent Builder Infrastructure"
          description="Deployment-level defaults Agent Builder applies when users create or run builder agents."
        >
          {!canViewInfrastructure ? (
            <Txt variant="ui-sm" className="text-neutral3">
              You do not have permission to view Agent Builder infrastructure.
            </Txt>
          ) : isLoading ? (
            <Txt variant="ui-sm" className="text-neutral3">
              Loading infrastructure configuration…
            </Txt>
          ) : error || !data ? (
            <Txt variant="ui-sm" className="text-neutral3">
              Infrastructure configuration unavailable.
            </Txt>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Txt variant="ui-md" className="font-medium">
                    Channels
                  </Txt>
                  <Txt variant="ui-xs" className="text-neutral3">
                    Configured channel providers available to Agent Builder publish/share flows. Unconfigured providers
                    are omitted until their required environment/config is present.
                  </Txt>
                </div>
                {data.channels.providers.length === 0 ? (
                  <EmptyRow message="No configured channel providers for Agent Builder." />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.channels.providers.map(provider => (
                      <li key={provider.id} className="rounded-md border border-border1 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <Txt variant="ui-sm" className="font-medium">
                              {provider.name}
                            </Txt>
                            <Txt variant="ui-xs" className="text-neutral3">
                              Provider ID: {provider.id}
                            </Txt>
                          </div>
                          <StatusBadge
                            ok={provider.isConfigured}
                            label={provider.isConfigured ? 'Configured' : 'Not configured'}
                          />
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border1 pt-3 sm:grid-cols-2">
                          <Detail label="Registered by" value={`${provider.name} provider`} />
                          <Detail label="Provider routes" value={provider.routeCount} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Txt variant="ui-md" className="font-medium">
                    Browser
                  </Txt>
                  <Txt variant="ui-xs" className="text-neutral3">
                    Browser automation provider configured for builder agents. The card shows the selected provider and
                    only non-default options explicitly passed in configuration.
                  </Txt>
                </div>
                {!data.browser.provider ? (
                  <EmptyRow message="No browser configured." />
                ) : (
                  <div className="rounded-md border border-border1 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <Txt variant="ui-sm" className="font-medium">
                          {data.browser.provider}
                        </Txt>
                        <Txt variant="ui-xs" className="text-neutral3">
                          {data.browser.env ? `Environment: ${data.browser.env}` : 'Environment: provider default'}
                          {data.browser.type ? ` · Type: ${data.browser.type}` : ''}
                        </Txt>
                      </div>
                      <StatusBadge
                        ok={data.browser.registered}
                        label={data.browser.registered ? 'Registered' : 'Not registered'}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border1 pt-3 sm:grid-cols-2">
                      <Detail label="Config type" value={data.browser.type} />
                      <Detail label="Environment" value={data.browser.env ?? 'Provider default'} />
                    </div>
                    <ConfigDetails entries={data.browser.config} />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <Txt variant="ui-md" className="font-medium">
                    Workspace
                  </Txt>
                  <Txt variant="ui-xs" className="text-neutral3">
                    Workspace config used for generated files and sandbox execution. This reports the builder workspace
                    only, not agent-specific runtime workspaces.
                  </Txt>
                </div>
                {!data.workspace.type ? (
                  <EmptyRow message="No workspace configured." />
                ) : (
                  <div className="rounded-md border border-border1 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <Txt variant="ui-sm" className="font-medium">
                          {data.workspace.workspaceId ?? data.workspace.name ?? 'Inline workspace'}
                        </Txt>
                        <Txt variant="ui-xs" className="text-neutral3">
                          Type: {data.workspace.type}
                        </Txt>
                      </div>
                      <div className="flex gap-2">
                        <StatusBadge ok={data.workspace.hasFilesystem} label="Filesystem" />
                        <StatusBadge ok={data.workspace.hasSandbox} label="Sandbox" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border1 pt-3 sm:grid-cols-2">
                      {data.workspace.workspaceId ? (
                        <Detail label="Workspace ID" value={data.workspace.workspaceId} />
                      ) : null}
                      <Detail label="Name" value={data.workspace.name} />
                      {data.workspace.source ? <Detail label="Source" value={data.workspace.source} /> : null}
                      {data.workspace.workspaceId ? (
                        <Detail label="Registered" value={data.workspace.registered ? 'Yes' : 'No'} />
                      ) : null}
                      <Detail label="Filesystem provider" value={data.workspace.filesystemProvider} />
                      <Detail label="Sandbox provider" value={data.workspace.sandboxProvider} />
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
