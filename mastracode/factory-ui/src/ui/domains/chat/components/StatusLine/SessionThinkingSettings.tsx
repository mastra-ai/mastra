import { ThinkingLevelRamp } from '@mastra/playground-ui/components/ThinkingLevel';

import { useSessionThinking } from './useSessionThinking';

interface SessionThinkingSettingsProps {
  modelId: string | undefined;
  switchingModel: boolean;
}

/** The thinking level inside the model picker, under the model list. Same size while loading or unavailable. */
export function SessionThinkingSettings({ modelId, switchingModel }: SessionThinkingSettingsProps) {
  const { options, state, summary, setLevel, resetLevel } = useSessionThinking(modelId, switchingModel);

  if ('unavailableReason' in state) {
    return (
      <div
        role="group"
        aria-label={state.loading ? 'Thinking: loading' : `Thinking: unavailable. ${state.unavailableReason}`}
      >
        <ThinkingLevelRamp
          options={options}
          value={undefined}
          label="Thinking"
          loading={state.loading}
          unavailableReason={state.loading ? undefined : state.unavailableReason}
          onChange={setLevel}
        />
      </div>
    );
  }

  return (
    <div role="group" aria-label={`Thinking: ${summary} (${state.source})`}>
      <ThinkingLevelRamp
        options={options}
        value={state.effective.level}
        label="Thinking"
        onChange={setLevel}
        reset={state.resettable ? { label: 'Use default', onClick: resetLevel } : undefined}
      />
    </div>
  );
}
