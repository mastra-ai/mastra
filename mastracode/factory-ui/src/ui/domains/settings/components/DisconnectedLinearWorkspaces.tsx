import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsItem } from '@mastra/playground-ui/new/settings';
import { Link2, Trash2 } from 'lucide-react';

import { useApiConfig } from '../../../../api/config';
import { connectLinear } from '../../factory/services/linear';
import type { DisconnectedLinearWorkspace } from './intakeSourceGroups';
import { IntegrationItemIcon } from './IntegrationItem';

/**
 * Saved Linear sources from workspaces that are no longer connected. Their
 * names can't be fetched, so each workspace collapses to one row; the saved
 * sources and their routing stay put so reconnecting resumes intake.
 */
export function DisconnectedLinearWorkspaces({
  workspaces,
  onRemove,
}: {
  workspaces: DisconnectedLinearWorkspace[];
  onRemove: (sourceIds: string[]) => void;
}) {
  const { baseUrl } = useApiConfig();
  return (
    // One cell of the provider's card, so the rows take the card's row spacing themselves.
    <ul aria-label="Disconnected Linear workspaces" className="divide-border flex flex-col divide-y">
      {workspaces.map((workspace, index) => {
        const name = workspaces.length > 1 ? `Other Linear workspace ${index + 1}` : 'Other Linear workspace';
        const count = workspace.sourceIds.length;
        return (
          <li key={workspace.workspaceId} className="py-3.25 first:pt-0 last:pb-0">
            <SettingsItem
              media={<IntegrationItemIcon provider="linear" />}
              title={
                <span className="flex items-center gap-2">
                  <span className="truncate">{name}</span>
                  <Badge size="xs" variant="warning" emphasis="subtle">
                    Disconnected
                  </Badge>
                </span>
              }
              description={
                <span className="whitespace-normal">
                  {count === 1 ? '1 project or team' : `${count} projects and teams`} paused. Reconnect to resume
                  intake.
                </span>
              }
            >
              <Button size="sm" variant="ghost" icon={<Link2 />} onClick={() => connectLinear(baseUrl)}>
                Reconnect
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 />}
                aria-label={`Remove ${name}`}
                onClick={() => onRemove(workspace.sourceIds)}
              >
                Remove
              </Button>
            </SettingsItem>
          </li>
        );
      })}
    </ul>
  );
}
