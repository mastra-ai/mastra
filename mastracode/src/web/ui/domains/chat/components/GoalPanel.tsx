import { Button, Input } from '@mastra/playground-ui';
import { Target } from 'lucide-react';
import { useState } from 'react';

import type { GoalSnapshot } from '../services/transcript';

const goalBar = 'flex shrink-0 items-center gap-2.5 border-b border-border1 bg-accent2/5 px-4 py-2 text-xs';

export function GoalPanel({
  goal,
  onSetGoal,
  onPauseGoal,
  onResumeGoal,
  onClearGoal,
}: {
  goal?: GoalSnapshot;
  onSetGoal: (objective: string) => void;
  onPauseGoal: () => void;
  onResumeGoal: () => void;
  onClearGoal: () => void;
}) {
  const [draft, setDraft] = useState('');

  if (!goal) {
    return (
      <form
        className={goalBar}
        onSubmit={e => {
          e.preventDefault();
          if (draft.trim()) {
            onSetGoal(draft.trim());
            setDraft('');
          }
        }}
      >
        <Input
          className="flex-1"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Set a goal objective…"
        />
        <Button variant="primary" size="sm" type="submit">
          Set Goal
        </Button>
      </form>
    );
  }

  const progress = `${goal.iteration}/${goal.maxRuns}`;

  return (
    <div className={goalBar}>
      <span className="inline-flex text-accent2">
        <Target size={15} />
      </span>
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-ui-sm font-medium">
        {goal.objective}
      </span>
      <span className="rounded-full border border-border1 bg-surface2 px-2 py-px text-ui-sm tabular-nums text-icon3">
        {progress}
      </span>
      {goal.reason && (
        <span className="max-w-52 overflow-hidden text-ellipsis whitespace-nowrap text-icon3">{goal.reason}</span>
      )}
      {goal.status === 'active' && (
        <Button size="sm" onClick={onPauseGoal}>
          Pause
        </Button>
      )}
      {goal.status === 'paused' && (
        <Button variant="primary" size="sm" onClick={onResumeGoal}>
          Resume
        </Button>
      )}
      <Button size="sm" onClick={onClearGoal}>
        Clear
      </Button>
    </div>
  );
}
