import { ThinkingLevelRamp } from '@mastra/playground-ui/components/ThinkingLevel';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { ThinkingLevelOriginNote } from './ThinkingLevelOriginNote';
import { useSessionThinking } from './useSessionThinking';

interface SessionThinkingSettingsProps {
  modelId: string;
  switchingModel: boolean;
}

/** The thinking level inside the model picker, under the model list. */
export function SessionThinkingSettings({ modelId, switchingModel }: SessionThinkingSettingsProps) {
  const { options, state, setLevel, resetLevel } = useSessionThinking(modelId, switchingModel);

  if ('unavailableReason' in state) {
    return (
      <div
        role="group"
        aria-label={`Thinking: unavailable. ${state.unavailableReason}`}
        className="flex flex-col gap-1"
      >
        <Txt as="p" variant="label">
          Thinking
        </Txt>
        <Txt as="p" variant="caption" tone="muted">
          {state.unavailableReason}
        </Txt>
      </div>
    );
  }

  const levelLabel = options.find(option => option.value === state.effective.level)?.label ?? state.effective.level;
  return (
    <div role="group" aria-label={`Thinking: ${levelLabel} (${state.source})`} className="flex flex-col gap-3">
      <ThinkingLevelRamp options={options} value={state.effective.level} label="Thinking" onChange={setLevel} />
      <ThinkingLevelOriginNote
        source={state.source}
        setForSession={state.effective.origin === 'session'}
        onUseDefault={resetLevel}
      />
    </div>
  );
}
