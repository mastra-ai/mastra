import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import type { ReactNode } from 'react';

import { LockedThinkingButton } from './LockedThinkingButton';

interface ModelThinkingGroupProps {
  children: ReactNode;
  modelId: string;
  lockedReason: string;
}

export function ModelThinkingGroup({ children, modelId, lockedReason }: ModelThinkingGroupProps) {
  return (
    <ButtonsGroup size="sm" aria-label="Model and thinking">
      {children}
      <LockedThinkingButton modelId={modelId} reason={lockedReason} />
    </ButtonsGroup>
  );
}
