import { Button } from '@mastra/playground-ui/components/Button';
import { Target } from 'lucide-react';

import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
} from '../../../../../shared/hooks/useAgentControllerGoalMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';

const goalBar = 'flex shrink-0 items-center gap-2.5 border-b border-border1 bg-accent2/5 px-4 py-2 text-xs';

/**
 * Progress bar for an active goal. Renders nothing when no goal is set —
 * goals are started via the `/goal <objective>` slash command, so the chat
 * stays uncluttered by default.
 */
export function GoalPanel() {
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const { transcript } = useChatTranscript();
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);
  const goal = transcript.goal;

  if (!sessionEnabled || !goal) return null;

  const progress = `${goal.iteration}/${goal.maxRuns}`;

  return (
    <div className={goalBar}>
      <span className="text-accent2 inline-flex">
        <Target size={15} />
      </span>
      <span className="text-ui-sm flex-1 overflow-hidden font-medium text-ellipsis whitespace-nowrap">
        {goal.objective}
      </span>
      <span className="border-border1 bg-surface2 text-ui-sm text-icon3 rounded-full border px-2 py-px tabular-nums">
        {progress}
      </span>
      {goal.reason && (
        <span className="text-icon3 max-w-52 overflow-hidden text-ellipsis whitespace-nowrap">{goal.reason}</span>
      )}
      {goal.status === 'active' && (
        <Button size="sm" onClick={() => void pauseGoalMutation.mutateAsync()}>
          Pause
        </Button>
      )}
      {goal.status === 'paused' && (
        <Button variant="primary" size="sm" onClick={() => void resumeGoalMutation.mutateAsync()}>
          Resume
        </Button>
      )}
      <Button size="sm" onClick={() => void clearGoalMutation.mutateAsync()}>
        Clear
      </Button>
    </div>
  );
}
