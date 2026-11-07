import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';

import { ThinkingLevelOriginNote } from './ThinkingLevelOriginNote';
import { useSessionThinking } from './useSessionThinking';

interface SessionThinkingControlProps {
  modelId: string;
  switchingModel: boolean;
  lockedReason?: string;
}

/** A standalone thinking control, for when the model can't be switched and there is no picker to hold it. */
export function SessionThinkingControl({ modelId, switchingModel, lockedReason }: SessionThinkingControlProps) {
  const { options, state, setLevel, resetLevel } = useSessionThinking(modelId, switchingModel, lockedReason);

  if ('unavailableReason' in state) {
    return (
      <ThinkingLevelUnavailable
        options={options}
        label="Thinking"
        reason={state.unavailableReason}
        value={state.lockedLevel}
      />
    );
  }

  return (
    <ThinkingLevelPicker
      options={options}
      value={state.effective.level}
      label="Thinking"
      origin={state.source}
      footer={
        <ThinkingLevelOriginNote
          source={state.source}
          setForSession={state.effective.origin === 'session'}
          onUseDefault={resetLevel}
        />
      }
      onChange={setLevel}
    />
  );
}
