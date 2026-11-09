import { ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';

import { useSessionThinking } from './useSessionThinking';

interface LockedThinkingButtonProps {
  modelId: string;
  reason: string;
}

/** The session's thinking level beside a locked model, read-only and explaining why. */
export function LockedThinkingButton({ modelId, reason }: LockedThinkingButtonProps) {
  const { options, state } = useSessionThinking(modelId, false);
  const ready = 'effective' in state;
  return (
    <ThinkingLevelUnavailable
      options={options}
      label="Thinking"
      reason={ready ? reason : state.unavailableReason}
      value={ready ? state.effective.level : undefined}
    />
  );
}
