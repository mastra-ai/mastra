import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { Button } from '@mastra/playground-ui/components/Button';
import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useSetDefaultThinkingLevel } from '../../../../../../hooks/use-default-model';
import {
  ALL_THINKING_LEVEL_OPTIONS,
  personalThinkingDefault,
  THINKING_DEFAULT_SOURCE_LABELS,
} from '../../../../chat/services/thinkingLevels';

interface PersonalThinkingControlProps {
  savedModelId: string | undefined;
  savedThinkingLevel: ThinkingLevelSetting | null;
  saving: boolean;
}

export function PersonalThinkingControl({ savedModelId, savedThinkingLevel, saving }: PersonalThinkingControlProps) {
  const setLevel = useSetDefaultThinkingLevel();

  const unavailable = (reason: string) => (
    <ThinkingLevelUnavailable options={ALL_THINKING_LEVEL_OPTIONS} label="Thinking" reason={reason} />
  );

  if (!savedModelId) return unavailable('Pick a personal default model first.');
  if (saving) return unavailable('Saving your personal defaults…');

  const saveLevel = (next: ThinkingLevelSetting | null) =>
    setLevel
      .mutateAsync(next)
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to change thinking level'));

  const thinkingDefault = personalThinkingDefault(savedThinkingLevel);
  const followsBuiltIn = thinkingDefault.origin === 'built-in';
  return (
    <ThinkingLevelPicker
      options={ALL_THINKING_LEVEL_OPTIONS}
      value={thinkingDefault.level}
      label="Thinking"
      origin={followsBuiltIn ? THINKING_DEFAULT_SOURCE_LABELS['built-in'] : undefined}
      footer={<PersonalThinkingOriginNote followsBuiltIn={followsBuiltIn} onUseDefault={() => saveLevel(null)} />}
      onChange={saveLevel}
    />
  );
}

interface PersonalThinkingOriginNoteProps {
  followsBuiltIn: boolean;
  onUseDefault: () => void;
}

function PersonalThinkingOriginNote({ followsBuiltIn, onUseDefault }: PersonalThinkingOriginNoteProps) {
  if (followsBuiltIn) {
    return (
      <Txt as="p" variant="caption" tone="muted">
        Follows the {THINKING_DEFAULT_SOURCE_LABELS['built-in']}.
      </Txt>
    );
  }
  return (
    <Button variant="ghost" size="sm" className="self-end" onClick={onUseDefault}>
      Use default
    </Button>
  );
}
