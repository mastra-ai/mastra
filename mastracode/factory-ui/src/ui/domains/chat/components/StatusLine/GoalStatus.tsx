import { Target } from 'lucide-react';

import { useChatRuntime } from '../../context/useChatRuntime';

/** Goal lifecycle indicator; hidden when there is no goal or it is done. */
export function GoalStatus() {
  const { goal } = useChatRuntime();

  if (!goal || goal.status === 'done') return null;

  return (
    <span className="text-destructive-fg [&_svg]:text-destructive-fg inline-flex items-center gap-1">
      <Target size={13} /> {goal.status === 'paused' ? 'goal paused' : 'pursuing goal'}
    </span>
  );
}
