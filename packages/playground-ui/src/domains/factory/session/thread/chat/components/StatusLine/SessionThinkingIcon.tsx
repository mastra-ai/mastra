import { useSessionThinking } from './useSessionThinking';

import { ThinkingLevelIcon } from '@/ds/components/ThinkingLevel';

interface SessionThinkingIconProps {
  modelId: string | undefined;
  switchingModel: boolean;
}

/** The thinking level as a brain on the model picker's trigger: empty when unavailable, pulsing while loading. */
export function SessionThinkingIcon({ modelId, switchingModel }: SessionThinkingIconProps) {
  const thinking = useSessionThinking(modelId, switchingModel);
  if (!thinking) return null;
  const { options, state } = thinking;
  const ready = 'effective' in state;
  return (
    <ThinkingLevelIcon
      options={options}
      value={ready ? state.effective.level : undefined}
      loading={!ready && state.loading}
    />
  );
}
