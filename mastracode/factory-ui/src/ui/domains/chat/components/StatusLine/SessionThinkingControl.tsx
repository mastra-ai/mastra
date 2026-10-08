import { Button } from '@mastra/playground-ui/components/Button';
import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useModelReasoningOptions } from '../../../../../hooks/useAvailableModels';
import { useChatModels } from '../../context/useChatModels';
import { useChatModes } from '../../context/useChatModes';
import { thinkingLevelOptionsForModel, thinkingSourceLabel } from '../../services/thinkingLevels';
import type { ThinkingLevelOrigin } from '../../services/thinkingLevels';

interface SessionThinkingControlProps {
  modelId: string;
  switchingModel: boolean;
}

function showFailure(fallback: string) {
  return (cause: unknown) => toast.error(cause instanceof Error ? cause.message : fallback);
}

function originLabel(origin: ThinkingLevelOrigin, modeId: string | undefined) {
  return origin === 'session' ? 'this session' : thinkingSourceLabel(origin, modeId ?? null);
}

export function SessionThinkingControl({ modelId, switchingModel }: SessionThinkingControlProps) {
  const { effectiveThinkingLevel, thinkingLevelError, setThinkingLevel, resetThinkingLevel } = useChatModels();
  const { activeModeId } = useChatModes();
  const reasoningOptions = useModelReasoningOptions(modelId);
  const options = thinkingLevelOptionsForModel(modelId, reasoningOptions);

  if (!effectiveThinkingLevel) {
    const reason = thinkingLevelError
      ? "The thinking level couldn't be loaded."
      : "The thinking level isn't loaded yet.";
    return <ThinkingLevelUnavailable options={options} label="Thinking" reason={reason} />;
  }
  if (switchingModel) {
    return <ThinkingLevelUnavailable options={options} label="Thinking" reason="Switching model…" />;
  }

  const { level, origin } = effectiveThinkingLevel;
  const followsDefault = origin !== 'session';
  const source = originLabel(origin, activeModeId);

  return (
    <ThinkingLevelPicker
      options={options}
      value={level}
      label="Thinking"
      origin={source}
      footer={
        <div className="flex items-center justify-between gap-3">
          <Txt as="p" variant="caption" tone="muted">
            {followsDefault ? `Follows the ${source}.` : 'Set for this session.'}
          </Txt>
          {followsDefault ? null : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetThinkingLevel().catch(showFailure('Failed to reset thinking level'))}
            >
              Use default
            </Button>
          )}
        </div>
      }
      onChange={next => setThinkingLevel(next).catch(showFailure('Failed to change thinking level'))}
    />
  );
}
