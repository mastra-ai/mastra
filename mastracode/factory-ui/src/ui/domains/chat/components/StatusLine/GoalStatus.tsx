import { Target } from 'lucide-react';

import { useChatGoal } from '../../context/useChatGoal';

/** Goal lifecycle indicator; hidden when there is no goal or it is done. */
export function GoalStatus() {
  const { goal } = useChatGoal();

  if (!goal || goal.status === 'done') return null;

  return (
    <span className="text-accent2 [&_svg]:text-accent2 inline-flex items-center gap-1">
      <Target size={13} /> {goal.status === 'paused' ? 'goal paused' : 'pursuing goal'}
    </span>
  );
}
