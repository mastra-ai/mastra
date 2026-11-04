import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { Link2, Plus, RotateCcw, Settings2 } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { SettingsRowsSkeleton } from '../../../ui/SettingsRowsSkeleton';
import { connectLinear } from '../../factory/services/linear';
import { IntegrationLabel } from './IntegrationLabel';
import { LinearWorkspaceControl } from './LinearWorkspaceControl';

export function LinearConnectionRows({ showAvailable }: { showAvailable: boolean }) {
  const { baseUrl } = useApiConfig();
  const query = useLinearStatusQuery();
  const status = query.data;
  const [params, setParams] = useSearchParams();
  const retry = async () => {
    const result = await query.refetch();
    if (!result.data || result.data.reason === 'unavailable') return;
    setParams(
      current => {
        current.delete('linear_reconnect');
        current.delete('linear_workspace_id');
        return current;
      },
      { replace: true },
    );
  };
  const label = <IntegrationLabel provider="linear" name="Linear" />;
  if (query.isPending) return <SettingsRowsSkeleton label="Loading Linear connections" rows={1} />;
  if (query.isError || status?.reason === 'unavailable') {
    return (
      <SettingsRow label={label} errorMsg="Couldn't load Linear connections.">
        <Button size="sm" icon={<RotateCcw />} onClick={() => void retry()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }
  if (status?.reason === 'auth_required') {
    return <SettingsRow label={label} description="Sign in to manage organization connections." />;
  }
  if (status?.reason === 'organization_required') {
    return <SettingsRow label={label} description="Select an organization to connect Linear." />;
  }
  if (!status?.enabled) {
    return showAvailable ? <SettingsRow label={label} description="Not configured on this server." /> : null;
  }
  const workspaces =
    status.workspaces ??
    (status.connected
      ? [
          {
            id: 'direct',
            name: status.workspace?.name || status.workspace?.urlKey || 'Linear workspace',
            urlKey: status.workspace?.urlKey ?? null,
            connected: true,
          },
        ]
      : []);
  if (workspaces.length === 0) {
    return showAvailable ? (
      <SettingsRow label={label} description="Connect Linear to import issues.">
        <Button size="sm" icon={<Link2 />} onClick={() => connectLinear(baseUrl)}>
          Connect Linear
        </Button>
      </SettingsRow>
    ) : null;
  }
  return (
    <>
      {workspaces.map(workspace => {
        const returnedHere = params.get('linear_workspace_id') === workspace.id;
        const result = returnedHere ? params.get('linear_reconnect') : undefined;
        const reconnectError =
          result === 'not_connected'
            ? `This workspace is still disconnected. Choose ${workspace.name} when authorizing in Linear.`
            : result === 'unavailable'
              ? "Couldn't verify this connection. Retry to check its status."
              : undefined;
        return (
          <SettingsRow
            key={workspace.id}
            label={label}
            description={
              <span className="flex flex-wrap gap-x-1">
                <span>{workspace.name}</span>
                <span aria-hidden>·</span>
                <span>{workspace.connected ? 'Connected' : 'Disconnected · Intake paused'}</span>
              </span>
            }
            errorMsg={reconnectError}
          >
            <div className="flex flex-wrap items-center gap-2">
              {result === 'unavailable' && (
                <Button size="sm" variant="ghost" onClick={() => void retry()}>
                  Retry
                </Button>
              )}
              <LinearWorkspaceControl
                workspace={workspace}
                targeted={status.mode === 'platform'}
                icon={workspace.connected ? <Settings2 /> : <Link2 />}
              />
            </div>
          </SettingsRow>
        );
      })}
      {showAvailable && status.mode === 'platform' && (
        <SettingsRow label={label} description="Authorize another workspace in Linear.">
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus />}
            aria-label="Add Linear workspace"
            onClick={() => connectLinear(baseUrl)}
          >
            Add workspace
          </Button>
        </SettingsRow>
      )}
    </>
  );
}
