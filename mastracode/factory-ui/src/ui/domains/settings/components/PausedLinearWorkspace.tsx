import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsItem } from '@mastra/playground-ui/new/settings';
import { useState } from 'react';

import type { LinearWorkspaceConnection } from '../../factory/services/linear';
import { IntegrationItemIcon } from './IntegrationItem';
import { LinearWorkspaceControl } from './LinearWorkspaceControl';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

export function PausedLinearWorkspace({
  workspace,
  count,
  onRemove,
}: {
  workspace: LinearWorkspaceConnection;
  count: number;
  onRemove?: () => void;
}) {
  // Once Linear's status shows the workspace connected, this row unmounts; a
  // connect that finished active and leaves it mounted connected some other workspace.
  // One still activating says nothing yet about which workspace it serves.
  const [error, setError] = useState<string>();
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
          {error && <span className="text-destructive-foreground block">{error}</span>}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <LinearWorkspaceControl
          workspace={workspace}
          onFinished={outcome =>
            setError(
              outcome === 'done'
                ? `This workspace is still disconnected. Choose ${workspace.name} when authorizing in Linear.`
                : undefined,
            )
          }
        />
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
