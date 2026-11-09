import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import type { ReactNode } from 'react';

import { SessionThinkingControl } from './SessionThinkingControl';

interface ModelThinkingGroupProps {
  children: ReactNode;
  modelId?: string;
  switchingModel: boolean;
  lockedReason?: string;
}

export function ModelThinkingGroup({ children, modelId, switchingModel, lockedReason }: ModelThinkingGroupProps) {
  return (
    <ButtonsGroup size="sm" aria-label="Model and thinking">
      {children}
      {modelId ? (
        <SessionThinkingControl modelId={modelId} switchingModel={switchingModel} lockedReason={lockedReason} />
      ) : null}
    </ButtonsGroup>
  );
}
