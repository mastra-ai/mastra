import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { Button } from '@mastra/playground-ui/components/Button';
import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useSetDefaultThinkingLevel } from '../../../../../../hooks/use-default-model';
import { useFactoryThinkingDefaultQuery } from '../../../../../../hooks/use-thinking';
import { ALL_THINKING_LEVEL_OPTIONS, THINKING_DEFAULT_SOURCE_LABELS } from '../../../../chat/services/thinkingLevels';

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
  const level = savedThinkingLevel ?? factoryLevelQuery.data;
  if (level === undefined) {
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

  return (
    <ThinkingLevelPicker
      options={ALL_THINKING_LEVEL_OPTIONS}
      value={level}
      label="Thinking"
      origin={savedThinkingLevel === null ? THINKING_DEFAULT_SOURCE_LABELS.factory : undefined}
      description="Used by your sessions on personal defaults until they pick their own level. Each session caps it at what its model supports."
      footer={
        <PersonalThinkingOriginNote
          followsFactory={savedThinkingLevel === null}
          onUseFactoryDefault={() => saveLevel(null)}
        />
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
        Follows the Factory default.
      </Txt>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <Txt as="p" variant="caption" tone="muted">
        Set for your personal defaults.
      </Txt>
      <Button variant="ghost" size="sm" onClick={onUseFactoryDefault}>
        Use Factory default
      </Button>
    </div>
  );
}
