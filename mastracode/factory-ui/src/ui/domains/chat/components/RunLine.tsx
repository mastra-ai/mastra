import {
  Activity,
  ActivityDetail,
  ActivityHeader,
  ActivityIcon,
  ActivityLabel,
} from '@mastra/playground-ui/components/ai/activity';
import type { ActivityStatus } from '@mastra/playground-ui/components/ai/activity';
import { callPose, liveWords } from '@mastra/playground-ui/domains/chat/activity';
import { AgentIndicator } from '@mastra/playground-ui/components/AgentIndicator';
import type { AgentIndicatorState } from '@mastra/playground-ui/components/AgentIndicator';
import { Arriving } from '@mastra/playground-ui/components/Arrival';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';

import { LABELS, STATUS } from '../services/run-activity';
import type { LineState } from '../services/run-activity';

interface LineLook {
  pose: AgentIndicatorState;
  label: string;
  detail?: string;
  status: ActivityStatus;
}

function lineLook(state: LineState): LineLook {
  if (typeof state === 'string') return { pose: state, label: LABELS[state], status: STATUS[state] };
  const { label, detail } = liveWords([{ ...state, status: 'running' }]);
  return { pose: callPose(state.toolName), label, detail, status: 'running' };
}

/** Born done = the answer or a stretch already said the run is over. */
export function RunLine({ state, live }: { state: LineState; live: boolean }) {
  const [bornDone] = useState(state === 'done');
  if (bornDone) return null;
  const { pose, label, detail, status } = lineLook(state);

  return (
    <Arriving>
      <div
        aria-hidden
        className={cn('transition-opacity duration-300 motion-reduce:duration-0', !live && 'opacity-0 delay-1100')}
      >
        <Activity foldable={false} status={status} appearance="inline">
          <ActivityHeader>
            <ActivityIcon className="[&_svg]:size-4">
              <AgentIndicator state={pose} />
            </ActivityIcon>
            <ActivityLabel className="text-body font-medium">{label}</ActivityLabel>
            {detail && <ActivityDetail className="text-body-sm">{detail}</ActivityDetail>}
          </ActivityHeader>
        </Activity>
      </div>
    </Arriving>
  );
}
