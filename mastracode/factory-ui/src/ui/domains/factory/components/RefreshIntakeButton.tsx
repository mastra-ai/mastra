import { Button } from '@mastra/playground-ui/components/Button';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';

import type { IntakeRefreshResponse } from '../../../../api/types';
import { useIntakeRefresh } from '../../../../hooks/useIntakeRefresh';

const INTEGRATION_NAMES: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  'incident-io': 'incident.io',
  jira: 'Jira',
  linear: 'Linear',
  vanta: 'Vanta',
};

function integrationName(id: string) {
  return INTEGRATION_NAMES[id] ?? id;
}

function announce({ integrations }: IntakeRefreshResponse) {
  if (integrations.length === 0) {
    toast.info('No intake source can be refreshed yet');
    return;
  }
  const failed = integrations.flatMap(entry =>
    entry.status === 'failed' ? [integrationName(entry.integrationId)] : [],
  );
  const itemFailures = integrations.reduce(
    (count, entry) => count + (entry.status === 'refreshed' ? entry.summary.failed : 0),
    0,
  );
  if (failed.length > 0) toast.error(`Couldn't refresh ${failed.join(', ')}`);
  else if (itemFailures > 0) toast.warning(`Intake refreshed, but ${itemFailures} item(s) couldn't be read`);
  else toast.success('Intake refreshed');
}

/** Re-reads the project's intake sources now, for when an event was dropped. */
export function RefreshIntakeButton({ factoryId }: { factoryId: string }) {
  const refresh = useIntakeRefresh(factoryId);
  return (
    <Button
      variant="default"
      size="icon-sm"
      aria-label="Refresh intake"
      tooltip="Refresh intake"
      disabled={refresh.isPending}
      aria-busy={refresh.isPending}
      onClick={() =>
        refresh.mutate(undefined, {
          onSuccess: announce,
          onError: error => toast.error(error.message || "Couldn't refresh intake"),
        })
      }
    >
      <IconArrowRotateClockwise
        aria-hidden
        className={refresh.isPending ? 'motion-safe:animate-spin motion-reduce:animate-none' : undefined}
      />
    </Button>
  );
}
