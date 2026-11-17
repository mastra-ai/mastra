import { useChatRuntime } from '../../context/useChatRuntime';
import { IconTarget } from '@mastra/playground-ui/icons/central/IconTarget';

/** Goal lifecycle indicator; hidden when there is no goal or it is done. */
export function GoalStatus() {
  const { goal } = useChatRuntime();

  if (!goal || goal.status === 'done') return null;

  return (
    <span className="text-badge-pink-indicator [&_svg]:text-badge-pink-indicator inline-flex items-center gap-1">
      <IconTarget className="size-icon-sm" /> {goal.status === 'paused' ? 'goal paused' : 'pursuing goal'}
    </span>
  );
}
