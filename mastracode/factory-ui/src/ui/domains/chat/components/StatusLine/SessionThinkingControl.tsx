import { Button } from '@mastra/playground-ui/components/Button';
import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useModelReasoningOptions } from '../../../../../hooks/useAvailableModels';
import { useChatModes } from '../../context/useChatModes';
import { useChatThinking } from '../../context/useChatThinking';
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
  return origin === 'session' ? 'this session' : thinkingSourceLabel(origin, modeId);
}

export function SessionThinkingControl({ modelId, switchingModel }: SessionThinkingControlProps) {
  const thinking = useChatThinking();
  const { activeModeId } = useChatModes();
  const reasoningOptions = useModelReasoningOptions(modelId);
  const options = thinkingLevelOptionsForModel(modelId, reasoningOptions);

  if (!thinking.level) {
    const reason = thinking.loadError
      ? "The thinking level couldn't be loaded."
      : "The thinking level isn't loaded yet.";
    return <ThinkingLevelUnavailable options={options} label="Thinking" reason={reason} />;
  }
  if (switchingModel) {
    return <ThinkingLevelUnavailable options={options} label="Thinking" reason="Switching model…" />;
  }

  const { level, origin } = thinking.level;
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
