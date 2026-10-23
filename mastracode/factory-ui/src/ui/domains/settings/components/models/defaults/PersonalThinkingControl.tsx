import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { Button } from '@mastra/playground-ui/components/Button';
import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useSetDefaultThinkingLevel } from '../../../../../../hooks/use-default-model';
import { useFactoryThinkingDefaultQuery } from '../../../../../../hooks/use-thinking';
import {
  ALL_THINKING_LEVEL_OPTIONS,
  routedThinkingDefault,
  THINKING_DEFAULT_SOURCE_LABELS,
} from '../../../../chat/services/thinkingLevels';

interface PersonalThinkingControlProps {
  factoryId: string;
  savedModelId: string | undefined;
  savedThinkingLevel: ThinkingLevelSetting | null;
  saving: boolean;
}

export function PersonalThinkingControl({
  factoryId,
  savedModelId,
  savedThinkingLevel,
  saving,
}: PersonalThinkingControlProps) {
  const factoryLevelQuery = useFactoryThinkingDefaultQuery(factoryId);
  const setLevel = useSetDefaultThinkingLevel();

  const unavailable = (reason: string) => (
    <ThinkingLevelUnavailable options={ALL_THINKING_LEVEL_OPTIONS} label="Thinking" reason={reason} />
  );

  if (!savedModelId) return unavailable('Pick a personal default model first.');
  if (saving) return unavailable('Saving your personal defaults…');
  const thinkingDefault = routedThinkingDefault(savedThinkingLevel, factoryLevelQuery.data);
  if (!thinkingDefault) {
    return unavailable(
      factoryLevelQuery.isError
        ? "The Factory thinking level couldn't be loaded."
        : "The thinking level isn't loaded yet.",
    );
  }

  const saveLevel = (next: ThinkingLevelSetting | null) =>
    setLevel
      .mutateAsync(next)
      .catch(error => toast.error(error instanceof Error ? error.message : 'Failed to change thinking level'));

  const followsFactory = thinkingDefault.origin === 'factory';
  return (
    <ThinkingLevelPicker
      options={ALL_THINKING_LEVEL_OPTIONS}
      value={thinkingDefault.level}
      label="Thinking"
      origin={followsFactory ? THINKING_DEFAULT_SOURCE_LABELS.factory : undefined}
      footer={
        <PersonalThinkingOriginNote followsFactory={followsFactory} onUseFactoryDefault={() => saveLevel(null)} />
      }
      onChange={saveLevel}
    />
  );
}

interface PersonalThinkingOriginNoteProps {
  followsFactory: boolean;
  onUseFactoryDefault: () => void;
}

function PersonalThinkingOriginNote({ followsFactory, onUseFactoryDefault }: PersonalThinkingOriginNoteProps) {
  if (followsFactory) {
    return (
      <Txt as="p" variant="caption" tone="muted">
        Follows the {THINKING_DEFAULT_SOURCE_LABELS.factory}.
      </Txt>
    );
  }
  return (
    <Button variant="ghost" size="sm" className="self-end" onClick={onUseFactoryDefault}>
      Use Factory default
    </Button>
  );
}
