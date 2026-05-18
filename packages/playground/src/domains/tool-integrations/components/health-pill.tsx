import { Button, Popover, PopoverContent, PopoverTrigger, Txt, cn } from '@mastra/playground-ui';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

import type { AgentHealthResult, IntegrationHealth } from '../hooks/use-agent-health';
import { useAuthorize } from '../hooks/use-authorize';

export interface HealthPillProps {
  health: AgentHealthResult;
  /** Visible label next to the status glyph. */
  label?: string;
  disabled?: boolean;
}

const stateGlyph = (state: 'ok' | 'warn' | 'error' | 'empty') => {
  switch (state) {
    case 'ok':
      return <CheckCircle2 className="size-3.5 text-success" />;
    case 'warn':
      return <AlertTriangle className="size-3.5 text-warning" />;
    case 'error':
      return <XCircle className="size-3.5 text-error" />;
    case 'empty':
      return null;
  }
};

const stateLabel = (state: 'ok' | 'warn' | 'error' | 'empty') => {
  switch (state) {
    case 'ok':
      return 'All connected';
    case 'warn':
      return 'Partially connected';
    case 'error':
      return 'Disconnected';
    case 'empty':
      return 'No connections';
  }
};

export const HealthPill = ({ health, label = 'Integrations', disabled }: HealthPillProps) => {
  const authorize = useAuthorize();

  if (health.state === 'empty') return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-border1 bg-surface2 px-2.5 py-1',
            'text-ui-xs text-neutral5 hover:bg-surface3 disabled:opacity-50',
          )}
          aria-label={`${label}: ${stateLabel(health.state)}`}
          data-testid="health-pill"
          data-state={health.state}
        >
          {stateGlyph(health.state)}
          <Txt as="span" variant="ui-xs">
            {label}
          </Txt>
          <Txt as="span" variant="ui-xs" className="tabular-nums text-neutral3">
            {health.connected}/{health.total}
          </Txt>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 py-3 px-3">
        <div className="flex flex-col gap-3">
          {health.integrations.map(integration => (
            <IntegrationRow
              key={integration.integrationId}
              integration={integration}
              onReauthorize={async (toolService, connectionId) => {
                const result = await authorize.mutateAsync({
                  integrationId: integration.integrationId,
                  toolService,
                  connectionId,
                });
                if (result.status === 'completed') {
                  await health.invalidateIntegration(integration.integrationId);
                }
              }}
              isPending={authorize.isPending}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface IntegrationRowProps {
  integration: IntegrationHealth;
  onReauthorize: (toolService: string, connectionId: string) => Promise<void> | void;
  isPending: boolean;
}

const IntegrationRow = ({ integration, onReauthorize, isPending }: IntegrationRowProps) => {
  return (
    <div className="flex flex-col gap-1.5" data-testid={`health-integration-${integration.integrationId}`}>
      <div className="flex items-center gap-2">
        {stateGlyph(integration.state)}
        <Txt as="span" variant="ui-sm" className="font-medium text-neutral6">
          {integration.integrationId}
        </Txt>
        <Txt as="span" variant="ui-xs" className="tabular-nums text-neutral3">
          {integration.connected}/{integration.total}
        </Txt>
      </div>
      <ul className="flex flex-col gap-1 pl-5">
        {integration.byToolService.map(service => {
          const disconnectedCount = service.total - service.connected;
          const state: 'ok' | 'warn' | 'error' =
            disconnectedCount === 0 ? 'ok' : disconnectedCount === service.total ? 'error' : 'warn';
          return (
            <li
              key={service.toolService}
              className="flex flex-col gap-1"
              data-testid={`health-service-${integration.integrationId}-${service.toolService}`}
            >
              <div className="flex items-center gap-2">
                {stateGlyph(state)}
                <Txt as="span" variant="ui-sm" className="text-neutral5">
                  {service.toolService}
                </Txt>
                <Txt as="span" variant="ui-xs" className="tabular-nums text-neutral3">
                  {service.connected}/{service.total}
                </Txt>
              </div>
              {service.disconnectedConnections.map(conn => (
                <div
                  key={conn.connectionId}
                  className="flex items-center justify-between gap-2 pl-5"
                  data-testid={`health-disconnected-${integration.integrationId}-${service.toolService}-${conn.connectionId}`}
                >
                  <Txt as="span" variant="ui-xs" className="text-neutral3 truncate">
                    {conn.label}
                  </Txt>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => onReauthorize(service.toolService, conn.connectionId)}
                    aria-label={`Reauthorize ${conn.label}`}
                    data-testid={`health-reauthorize-${integration.integrationId}-${service.toolService}-${conn.connectionId}`}
                  >
                    <RefreshCw className="size-3" />
                    Reauthorize
                  </Button>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
