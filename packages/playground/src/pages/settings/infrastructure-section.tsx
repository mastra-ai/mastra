import { SectionCard, Txt } from '@mastra/playground-ui';

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

/**
 * Admin-only Infrastructure section for the Studio Settings page.
 *
 * Surfaces the runtime state of Mastra-opinionated primitives (channels,
 * browser, workspaces). Backed by `GET /editor/builder/infrastructure`,
 * which is gated by the `*` permission on the server.
 */
export const InfrastructureSection = () => {
  const { data, isLoading, error } = useInfrastructureStatus();

  if (isLoading) {
    return (
      <SectionCard title="Infrastructure" description="Runtime state of channels, browser, and workspaces.">
        <Txt variant="ui-sm" className="text-neutral3">
          Loading infrastructure status…
        </Txt>
      </SectionCard>
    );
  }

  if (error || !data) {
    return null;
  }

  const { channels, browser, workspaces } = data;

  return (
    <SectionCard title="Infrastructure" description="Runtime state of channels, browser, and workspaces.">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Txt variant="ui-md" className="font-medium">
            Channels
          </Txt>
          {channels.providers.length === 0 ? (
            <EmptyRow message="No channel providers registered." />
          ) : (
            <ul className="flex flex-col gap-1">
              {channels.providers.map(provider => (
                <li
                  key={provider.id}
                  className="flex items-center justify-between rounded-md border border-border1 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <Txt variant="ui-sm" className="font-medium">
                      {provider.name}
                    </Txt>
                    <Txt variant="ui-xs" className="text-neutral3">
                      {provider.id}
                    </Txt>
                  </div>
                  <StatusBadge
                    ok={provider.isConfigured}
                    label={provider.isConfigured ? 'Configured' : 'Not configured'}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Txt variant="ui-md" className="font-medium">
            Browser
          </Txt>
          {!browser.registered ? (
            <EmptyRow message="No browser provider registered." />
          ) : (
            <div className="flex items-center justify-between rounded-md border border-border1 px-3 py-2">
              <div className="flex flex-col">
                <Txt variant="ui-sm" className="font-medium">
                  {browser.provider ?? 'Unknown provider'}
                </Txt>
                <Txt variant="ui-xs" className="text-neutral3">
                  {browser.env ? `Environment: ${browser.env}` : 'No environment configured'}
                </Txt>
              </div>
              <StatusBadge ok={true} label="Registered" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Txt variant="ui-md" className="font-medium">
            Workspaces
          </Txt>
          {workspaces.length === 0 ? (
            <EmptyRow message="No workspaces registered." />
          ) : (
            <ul className="flex flex-col gap-1">
              {workspaces.map(workspace => (
                <li
                  key={`${workspace.source}:${workspace.id}`}
                  className="flex items-center justify-between rounded-md border border-border1 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <Txt variant="ui-sm" className="font-medium">
                      {workspace.id}
                    </Txt>
                    <Txt variant="ui-xs" className="text-neutral3">
                      Source: {workspace.source}
                      {workspace.agentName ? ` · Agent: ${workspace.agentName}` : ''}
                    </Txt>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge ok={workspace.hasFilesystem} label="Filesystem" />
                    <StatusBadge ok={workspace.hasSandbox} label="Sandbox" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionCard>
  );
};
