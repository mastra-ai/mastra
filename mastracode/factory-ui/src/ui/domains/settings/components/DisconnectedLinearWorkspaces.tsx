import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link2, Trash2 } from 'lucide-react';

import { useApiConfig } from '../../../../api/config';
import { connectLinear } from '../../factory/services/linear';
import type { DisconnectedLinearWorkspace } from './intakeSourceGroups';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { settingsRowLayout } from './common/settings-row-layout';

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
    <ul aria-label="Disconnected Linear workspaces" className="divide-border border-border divide-y border-b">
      {workspaces.map((workspace, index) => {
        const name = workspaces.length > 1 ? `Other Linear workspace ${index + 1}` : 'Other Linear workspace';
        const count = workspace.sourceIds.length;
        return (
          <li key={workspace.workspaceId} className={cn(settingsRowLayout, 'flex flex-wrap items-center')}>
            <div className="flex min-w-0 flex-1 basis-48 items-center gap-2">
              <span className="shrink-0" aria-hidden>
                <SettingsIntegrationIcon provider="linear" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <Txt as="span" variant="caption" className="wrap-anywhere">
                    {name}
                  </Txt>
                  <Badge size="xs" variant="warning" emphasis="subtle">
                    Disconnected
                  </Badge>
                </span>
                <Txt as="p" variant="meta" tone="muted" className="wrap-anywhere">
                  {count === 1 ? '1 project or team' : `${count} projects and teams`} paused. Reconnect to resume
                  intake.
                </Txt>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}
