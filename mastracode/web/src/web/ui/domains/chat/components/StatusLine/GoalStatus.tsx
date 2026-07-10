import { Target } from 'lucide-react';

import { useChatSession } from '../../context/ChatSessionProvider';

/** Goal lifecycle indicator; hidden when there is no goal or it is done. */
export function GoalStatus() {
  const { transcript } = useChatSession();
  const { goal } = transcript;

  if (!goal || goal.status === 'done') return null;

  return (
    <span className="inline-flex items-center gap-1 text-accent2 [&_svg]:text-accent2">
      <Target size={13} /> {goal.status === 'paused' ? 'goal paused' : 'pursuing goal'}
    </span>
  );
}
