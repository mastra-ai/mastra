import { ACTIVITY_RECAPS, ActivityBand, RecapButton } from '@mastra/playground-ui/domains/factory';
import { useState } from 'react';

import { usePromptButton } from '../../../chat/hooks/usePromptButton';
import { SESSION_STATUS_LABELS } from '../../../workspaces/services/sessionRows';
import { useFactoryActivity } from '../../hooks/useFactoryActivity';
import { DEFAULT_ACTIVITY_PERIOD } from '../../periodActivity';
import type { ActivityPeriod } from '../../periodActivity';

function FactoryRecapButton({ period }: { period: ActivityPeriod }) {
  const { label, prompt } = ACTIVITY_RECAPS[period];
  return <RecapButton label={label} {...usePromptButton(prompt)} />;
}

export function FactoryActivity({ factoryId }: { factoryId: string }) {
  const [period, setPeriod] = useState(DEFAULT_ACTIVITY_PERIOD);
  const { hasCards, activity, runs, live } = useFactoryActivity(factoryId, period);
  if (!hasCards) return null;
  return (
    <ActivityBand
      period={period}
      onPeriodChange={setPeriod}
      activity={activity}
      runs={runs}
      live={[
        { count: live.working, label: SESSION_STATUS_LABELS.working },
        { count: live.waiting, label: SESSION_STATUS_LABELS.waiting },
      ]}
      recap={<FactoryRecapButton period={period} />}
    />
  );
}
