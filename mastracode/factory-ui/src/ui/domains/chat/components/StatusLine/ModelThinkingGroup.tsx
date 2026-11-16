import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import type { ReactNode } from 'react';

import { useSessionThinking } from './useSessionThinking';

interface ModelThinkingGroupProps {
  children: ReactNode;
  modelId: string;
  lockedReason: string;
}

/** A locked model beside its read-only thinking level, which explains why it can't change. */
export function ModelThinkingGroup({ children, modelId, lockedReason }: ModelThinkingGroupProps) {
  const { options, state } = useSessionThinking(modelId, false);
  const ready = 'effective' in state;
  return (
    <ButtonsGroup size="sm" aria-label="Model and thinking">
      {children}
      <ThinkingLevelUnavailable
        options={options}
        label="Thinking"
        reason={ready ? lockedReason : state.unavailableReason}
        value={ready ? state.effective.level : undefined}
      />
    </ButtonsGroup>
  );
}
