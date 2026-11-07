import { Button } from '@mastra/playground-ui/components/Button';
import { Target } from 'lucide-react';
import { useEffect } from 'react';

import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatRuntime } from '../context/useChatRuntime';
import {
  useAgentControllerGoal,
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
} from '../../../../hooks/useAgentControllerGoalMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { Txt } from '@mastra/playground-ui/components/Txt';

const goalBar = 'flex shrink-0 items-center gap-2.5 border-b border-border bg-badge-pink-subtle px-4 py-2';

export function GoalPanel() {
  const { sessionId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { goal: evaluation } = useChatRuntime();
  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  };
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);
  const goalQuery = useAgentControllerGoal(hookArgs);
  const { refetch } = goalQuery;

  // The stored goal is the source of truth (set, paused, cleared); each judge verdict moves it on.
  useEffect(() => {
    if (evaluation) void refetch();
  }, [evaluation, refetch]);

  const goal = goalQuery.data;
  if (!sessionEnabled || !goal) return null;

  const latest = evaluation?.objective === goal.objective ? evaluation : undefined;
  const maxRuns = goal.maxRuns ?? latest?.maxRuns;
  const progress = maxRuns ? `${goal.runsUsed}/${maxRuns}` : `${goal.runsUsed}`;
  const reason = goal.status === 'paused' ? (goal.pausedReason ?? latest?.reason) : latest?.reason;

  return (
    <div className={goalBar}>
      <span className="text-badge-pink-indicator inline-flex">
        <Target size={15} />
      </span>
      <Txt as="span" variant="column" className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        {goal.objective}
      </Txt>
      <Txt as="span" variant="caption" tone="muted" className="bg-fill rounded-full px-2 py-px tabular-nums">
        {progress}
      </Txt>
      {reason && (
        <Txt
          as="span"
          variant="caption"
          tone="muted"
          className="max-w-52 overflow-hidden text-ellipsis whitespace-nowrap"
        >
          {reason}
        </Txt>
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
