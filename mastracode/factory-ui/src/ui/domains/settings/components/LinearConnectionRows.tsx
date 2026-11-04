import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { Link2, Plus, Settings2 } from 'lucide-react';

import { useApiConfig } from '../../../../api/config';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { SettingsRowsSkeleton } from '../../../ui/SettingsRowsSkeleton';
import { connectLinear } from '../../factory/services/linear';
import { useLinearReconnectResult } from '../hooks/useLinearReconnectResult';
import { IntegrationLabel } from './IntegrationLabel';
import { LinearWorkspaceControl } from './LinearWorkspaceControl';
import { accessDescription, NotConfiguredRow, RetryRow } from './common/ConnectionStateRows';

export function LinearConnectionRows({ showAvailable }: { showAvailable: boolean }) {
  const { baseUrl } = useApiConfig();
  const query = useLinearStatusQuery();
  const status = query.data;
  const { resultFor, retry } = useLinearReconnectResult(query);
  const label = <IntegrationLabel provider="linear" name="Linear" />;
  if (query.isPending) return <SettingsRowsSkeleton label="Loading Linear connections" rows={1} />;
  if (query.isError || status?.reason === 'unavailable') {
    return <RetryRow label={label} errorMsg="Couldn't load Linear connections." onRetry={() => void retry()} />;
  }
  const access = accessDescription(status?.reason, 'Linear');
  if (access) return <SettingsRow label={label} description={access} />;
  if (!status?.enabled) return <NotConfiguredRow label={label} showAvailable={showAvailable} />;
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
        const { error, unverified } = resultFor(workspace);
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
            errorMsg={error}
          >
            <div className="flex flex-wrap items-center gap-2">
              {unverified && (
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
