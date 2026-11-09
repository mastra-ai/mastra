import { ThinkingLevelBars } from '@mastra/playground-ui/components/ThinkingLevel';

import { useSessionThinking } from './useSessionThinking';

interface SessionThinkingBarsProps {
  modelId: string | undefined;
  switchingModel: boolean;
}

/** The thinking level as bars on the model picker's trigger: empty when unavailable, pulsing while loading. */
export function SessionThinkingBars({ modelId, switchingModel }: SessionThinkingBarsProps) {
  const { options, state } = useSessionThinking(modelId, switchingModel);
  if ('unavailableReason' in state) {
    return <ThinkingLevelBars options={options} value={undefined} loading={state.loading} />;
  }
  return <ThinkingLevelBars options={options} value={state.effective.level} />;
}
