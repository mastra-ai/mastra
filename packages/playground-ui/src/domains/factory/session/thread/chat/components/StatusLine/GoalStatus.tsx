import { useChatRuntime } from '../../context/useChatRuntime';
import { IconTarget } from '@/ds/icons/central/IconTarget';

/** Goal lifecycle indicator; hidden when there is no goal or it is done. */
export function GoalStatus() {
  const { goal } = useChatRuntime();

  if (!goal || goal.status === 'done') return null;

  return (
    <span className="inline-flex items-center gap-1 text-badge-pink-indicator [&_svg]:text-badge-pink-indicator">
      <IconTarget className="size-icon-sm" /> {goal.status === 'paused' ? 'goal paused' : 'pursuing goal'}
    </span>
  );
}
