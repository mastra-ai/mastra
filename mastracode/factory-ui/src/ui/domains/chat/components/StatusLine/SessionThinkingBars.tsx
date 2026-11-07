import { ThinkingLevelBars } from '@mastra/playground-ui/components/ThinkingLevel';

import { useSessionThinking } from './useSessionThinking';

interface SessionThinkingBarsProps {
  modelId: string;
  switchingModel: boolean;
}

/** The thinking level as bars on the model picker's trigger. */
export function SessionThinkingBars({ modelId, switchingModel }: SessionThinkingBarsProps) {
  const { options, state } = useSessionThinking(modelId, switchingModel);
  if ('unavailableReason' in state) return undefined;
  return <ThinkingLevelBars options={options} value={state.effective.level} />;
}
