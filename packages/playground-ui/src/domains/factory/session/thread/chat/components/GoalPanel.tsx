import { useChatRuntime } from '../context/useChatRuntime';
import { useChatSessionActions } from '../context/useChatSessionActions';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconTarget } from '@/ds/icons/central/IconTarget';

const goalBar = 'flex shrink-0 items-center gap-2.5 border-b border-border bg-badge-pink-subtle px-4 py-2';

export function GoalPanel() {
  const { sessionEnabled } = useChatSessionContext();
  const { goal } = useChatRuntime();
  const goalActions = useChatSessionActions().goal;

  if (!sessionEnabled || !goal || !goalActions) return null;

  const progress = `${goal.iteration}/${goal.maxRuns}`;

  return (
    <div className={goalBar}>
      <span className="inline-flex text-badge-pink-indicator">
        <IconTarget className="size-icon-md" />
      </span>
      <Txt as="span" variant="column" className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
        {goal.objective}
      </Txt>
      <Txt as="span" variant="caption" tone="muted" className="rounded-full bg-fill px-2 py-px tabular-nums">
        {progress}
      </Txt>
      {goal.reason && (
        <Txt
          as="span"
          variant="caption"
          tone="muted"
          className="max-w-52 overflow-hidden text-ellipsis whitespace-nowrap"
        >
          {goal.reason}
        </Txt>
      )}
      {goal.status === 'active' && (
        <Button size="sm" onClick={() => void goalActions.pause()}>
          Pause
        </Button>
      )}
      {goal.status === 'paused' && (
        <Button variant="primary" size="sm" onClick={() => void goalActions.resume()}>
          Resume
        </Button>
      )}
      <Button size="sm" onClick={() => void goalActions.clear()}>
        Clear
      </Button>
    </div>
  );
}
