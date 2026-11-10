import { ThinkingLevelIcon } from '@mastra/playground-ui/components/ThinkingLevel';

import { useSessionThinking } from './useSessionThinking';

interface SessionThinkingIconProps {
  modelId: string | undefined;
  switchingModel: boolean;
}

/** The thinking level as a brain on the model picker's trigger: empty when unavailable, pulsing while loading. */
export function SessionThinkingIcon({ modelId, switchingModel }: SessionThinkingIconProps) {
  const { options, state } = useSessionThinking(modelId, switchingModel);
  const ready = 'effective' in state;
  return (
    <ThinkingLevelIcon
      options={options}
      value={ready ? state.effective.level : undefined}
      loading={!ready && state.loading}
    />
  );
}
