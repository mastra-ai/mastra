import { Button } from '@mastra/playground-ui/components/Button';
import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useChatModelScope } from '../../context/useChatModelScope';

import { useAvailableModelsQuery, useModelReasoningOptions } from '../../../../../hooks/useAvailableModels';
import type { ChatThinkingApi } from '../../context/ChatThinkingContext';
import { useChatThinking } from '../../context/useChatThinking';
import { FACTORY_THINKING_SOURCE_LABEL, thinkingLevelOptionsForModel } from '../../services/thinkingLevels';
import type { EffectiveThinkingLevel, ThinkingLevelOrigin } from '../../services/thinkingLevels';
import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';

interface SessionThinkingControlProps {
  modelId: string;
  switchingModel: boolean;
  lockedReason?: string;
}

type ThinkingControlState =
  | { unavailableReason: string; lockedLevel?: ThinkingLevelSetting }
  | { effective: EffectiveThinkingLevel };

function thinkingControlState({
  catalog,
  thinking,
  switchingModel,
  lockedReason,
}: {
  catalog: { isPending: boolean };
  thinking: ChatThinkingApi;
  switchingModel: boolean;
  lockedReason: string | undefined;
}): ThinkingControlState {
  if (catalog.isPending) return { unavailableReason: "This model's thinking levels aren't loaded yet." };
  if (thinking.loadError) return { unavailableReason: "The thinking level couldn't be loaded." };
  if (!thinking.level) return { unavailableReason: "The thinking level isn't loaded yet." };
  if (switchingModel) return { unavailableReason: 'Switching model…' };
  if (lockedReason) return { unavailableReason: lockedReason, lockedLevel: thinking.level.level };
  return { effective: thinking.level };
}

function showFailure(fallback: string) {
  return (cause: unknown) => toast.error(cause instanceof Error ? cause.message : fallback);
}

function originLabel(origin: ThinkingLevelOrigin) {
  return origin === 'session' ? 'this session' : FACTORY_THINKING_SOURCE_LABEL;
}

export function SessionThinkingControl({ modelId, switchingModel, lockedReason }: SessionThinkingControlProps) {
  const thinking = useChatThinking();
  const { catalogTarget } = useChatModelScope();
  const catalog = useAvailableModelsQuery(catalogTarget);
  const reasoningOptions = useModelReasoningOptions(modelId, catalogTarget);
  const options = thinkingLevelOptionsForModel(modelId, reasoningOptions);
  const state = thinkingControlState({ catalog, thinking, switchingModel, lockedReason });

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

  const { level, origin } = state.effective;
  const source = originLabel(origin);

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
