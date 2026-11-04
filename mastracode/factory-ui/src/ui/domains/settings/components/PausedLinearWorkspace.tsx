import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { Trash2 } from 'lucide-react';

import type { LinearWorkspaceConnection } from '../../factory/services/linear';
import { LinearWorkspaceControl } from './LinearWorkspaceControl';

export function PausedLinearWorkspace({
  workspace,
  count,
  pending,
  onRemove,
}: {
  workspace: LinearWorkspaceConnection;
  count: number;
  pending: boolean;
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
    >
      <div className="flex flex-wrap items-center gap-2">
        <LinearWorkspaceControl workspace={workspace} targeted />
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 />}
          disabled={pending}
          aria-label={`Remove sources from ${workspace.name}`}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </SettingsRow>
  );
}
