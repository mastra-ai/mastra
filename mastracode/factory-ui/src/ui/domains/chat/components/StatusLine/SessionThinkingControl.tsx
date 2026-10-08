import { Button } from '@mastra/playground-ui/components/Button';
import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useAvailableModelsQuery, useModelReasoningOptions } from '../../../../../hooks/useAvailableModels';
import type { ChatThinkingApi } from '../../context/ChatThinkingContext';
import { useChatModes } from '../../context/useChatModes';
import { useChatThinking } from '../../context/useChatThinking';
import { thinkingLevelOptionsForModel, thinkingSourceLabel } from '../../services/thinkingLevels';
import type { EffectiveThinkingLevel, ThinkingLevelOrigin } from '../../services/thinkingLevels';

interface SessionThinkingControlProps {
  modelId: string;
  switchingModel: boolean;
}

type ThinkingControlState = { unavailableReason: string } | { effective: EffectiveThinkingLevel };

function thinkingControlState({
  catalog,
  thinking,
  switchingModel,
}: {
  catalog: { isPending: boolean };
  thinking: ChatThinkingApi;
  switchingModel: boolean;
}): ThinkingControlState {
  if (catalog.isPending) return { unavailableReason: "This model's thinking levels aren't loaded yet." };
  if (thinking.loadError) return { unavailableReason: "The thinking level couldn't be loaded." };
  if (!thinking.level) return { unavailableReason: "The thinking level isn't loaded yet." };
  if (switchingModel) return { unavailableReason: 'Switching model…' };
  return { effective: thinking.level };
}

function showFailure(fallback: string) {
  return (cause: unknown) => toast.error(cause instanceof Error ? cause.message : fallback);
}

function originLabel(origin: ThinkingLevelOrigin, modeId: string | undefined) {
  return origin === 'session' ? 'this session' : thinkingSourceLabel(origin, modeId);
}

export function SessionThinkingControl({ modelId, switchingModel }: SessionThinkingControlProps) {
  const thinking = useChatThinking();
  const { activeModeId } = useChatModes();
  const catalog = useAvailableModelsQuery();
  const reasoningOptions = useModelReasoningOptions(modelId);
  const options = thinkingLevelOptionsForModel(modelId, reasoningOptions);
  const state = thinkingControlState({ catalog, thinking, switchingModel });

  if ('unavailableReason' in state) {
    return <ThinkingLevelUnavailable options={options} label="Thinking" reason={state.unavailableReason} />;
  }

  const { level, origin } = state.effective;
  const source = originLabel(origin, activeModeId);

  return (
    <ThinkingLevelPicker
      options={options}
      value={level}
      label="Thinking"
      origin={source}
      footer={
        <ThinkingLevelOriginNote
          source={source}
          setForSession={origin === 'session'}
          onUseDefault={() => thinking.resetLevel().catch(showFailure('Failed to reset thinking level'))}
        />
      }
      onChange={next => thinking.setLevel(next).catch(showFailure('Failed to change thinking level'))}
    />
  );
}

interface ThinkingLevelOriginNoteProps {
  source: string;
  setForSession: boolean;
  onUseDefault: () => void;
}

function ThinkingLevelOriginNote({ source, setForSession, onUseDefault }: ThinkingLevelOriginNoteProps) {
  if (!setForSession) {
    return (
      <Txt as="p" variant="caption" tone="muted">
        Follows the {source}.
      </Txt>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <Txt as="p" variant="caption" tone="muted">
        Set for this session.
      </Txt>
      <Button variant="ghost" size="sm" onClick={onUseDefault}>
        Use default
      </Button>
    </div>
  );
}
