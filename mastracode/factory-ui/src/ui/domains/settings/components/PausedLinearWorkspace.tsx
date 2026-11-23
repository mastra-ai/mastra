import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsItem } from '@mastra/playground-ui/new/settings';
import type { LinearWorkspaceConnection } from '../../factory/services/linear';
import type { LinearReconnectResult } from '../hooks/useLinearReconnectResult';
import { IntegrationItemIcon } from './IntegrationItem';
import { LinearWorkspaceControl } from './LinearWorkspaceControl';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

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
  onRemove?: () => void;
}) {
  return (
    <SettingsItem
      media={<IntegrationItemIcon provider="linear" />}
      title={
        <span className="flex items-center gap-2">
          <span className="truncate">{workspace.name}</span>
          <Badge size="xs" variant="warning" emphasis="subtle">
            Disconnected
          </Badge>
        </span>
      }
      description={
        <span className="whitespace-normal">
          {count} {count === 1 ? 'project or team' : 'projects and teams'} paused. Reconnect to resume. Your saved
          routing is kept.
          {/* Under the description in the destructive tone, where the row's field error used to sit. */}
          {reconnect.error && <span className="text-destructive-foreground block">{reconnect.error}</span>}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {reconnect.unverified && (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        )}
        <LinearWorkspaceControl workspace={workspace} targeted />
        {onRemove && (
          <Button
            size="sm"
            variant="ghost"
            icon={<TrashIcon />}
            aria-label={`Remove sources from ${workspace.name}`}
            onClick={onRemove}
          >
            Remove
          </Button>
        )}
      </div>
    </SettingsItem>
  );
}
