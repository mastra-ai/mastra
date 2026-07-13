import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowUp, Target } from 'lucide-react';
import { useState } from 'react';

import { useChatRuntime } from '../context/useChatRuntime';
import { useChatSessionContext } from '../context/useChatSessionContext';
import {
  useClearAgentControllerGoalMutation,
  usePauseAgentControllerGoalMutation,
  useResumeAgentControllerGoalMutation,
  useSetAgentControllerGoalMutation,
} from '../../../../../shared/hooks/useAgentControllerGoalMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';

import { ComposerInput } from './ComposerInput';
import type { ComposerVariant } from './ComposerInput';

type GoalPanelProps = {
  composerVariant?: ComposerVariant;
  draft?: string;
  onDraftChange?: (draft: string) => void;
};

export function GoalPanel({ composerVariant = 'inline', draft: controlledDraft, onDraftChange }: GoalPanelProps) {
  const [uncontrolledDraft, setUncontrolledDraft] = useState('');
  const draft = controlledDraft ?? uncontrolledDraft;

  const updateDraft = (next: string) => {
    if (onDraftChange) onDraftChange(next);
    else setUncontrolledDraft(next);
  };
  const { resourceId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { goal } = useChatRuntime();
  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const setGoalMutation = useSetAgentControllerGoalMutation(hookArgs);
  const pauseGoalMutation = usePauseAgentControllerGoalMutation(hookArgs);
  const resumeGoalMutation = useResumeAgentControllerGoalMutation(hookArgs);
  const clearGoalMutation = useClearAgentControllerGoalMutation(hookArgs);

  if (!sessionEnabled) return null;

  if (!goal) {
    return (
      <form
        className="relative flex w-full flex-col gap-2"
        onSubmit={event => {
          event.preventDefault();
          if (draft.trim()) {
            void setGoalMutation.mutateAsync(draft.trim());
            updateDraft('');
          }
        }}
      >
        <ComposerInput
          value={draft}
          onChange={event => updateDraft(event.target.value)}
          placeholder="Describe your goal…"
          composerVariant={composerVariant}
          className="pr-12"
          aria-label="Goal objective"
        />
        <Button
          className="absolute bottom-2 right-2"
          type="submit"
          size="icon-sm"
          disabled={!draft.trim()}
          aria-label="Set goal"
        >
          <ArrowUp size={16} />
        </Button>
      </form>
    );
  }

  const progress = `${goal.iteration}/${goal.maxRuns}`;
  const objective = goal.reason ? `${goal.objective}\n${goal.reason}` : goal.objective;

  return (
    <div className="relative flex w-full flex-col gap-2">
      <ComposerInput
        value={objective}
        readOnly
        composerVariant={composerVariant}
        className="pr-40"
        aria-label="Goal objective"
      />
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        <span className="rounded-full border border-border1 bg-surface2 px-2 py-px text-ui-sm tabular-nums text-icon3">
          {progress}
        </span>
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
        <Button size="icon-sm" onClick={() => void clearGoalMutation.mutateAsync()} aria-label="Clear goal">
          <Target size={15} />
        </Button>
      </div>
    </div>
  );
}
