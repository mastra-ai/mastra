import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { LinearWorkspaceConnection } from '../../factory/services/linear';
import type { LinearReconnectResult } from '../hooks/useLinearReconnectResult';
import { LinearWorkspaceControl } from './LinearWorkspaceControl';
import { IconTrashCan } from '@mastra/playground-ui/icons/central/IconTrashCan';

export function PausedLinearWorkspace({
  workspace,
  count,
  reconnect,
  onRetry,
  onRemove,
}: {
  workspace: LinearWorkspaceConnection;
  count: number;
  reconnect: LinearReconnectResult;
  onRetry: () => void;
  onRemove: () => void;
}) {
  return (
    <SettingsRow
      label={
        <span className="flex flex-wrap items-center gap-2">
          {workspace.name}
          <Badge size="xs" variant="warning" emphasis="subtle">
            Disconnected
          </Badge>
        </span>
      }
      description={`${count} ${count === 1 ? 'project or team' : 'projects and teams'} paused. Reconnect to resume. Your saved routing is kept.`}
      errorMsg={reconnect.error}
    >
      <div className="flex flex-wrap items-center gap-2">
        {reconnect.unverified && (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        )}
        <LinearWorkspaceControl workspace={workspace} targeted />
        <Button
          size="sm"
          variant="ghost"
          icon={<IconTrashCan />}
          aria-label={`Remove sources from ${workspace.name}`}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </SettingsRow>
  );
}
