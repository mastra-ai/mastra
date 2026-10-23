import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { ThinkingLevelPicker, ThinkingLevelUnavailable } from '@mastra/playground-ui/components/ThinkingLevel';
import { toast } from '@mastra/playground-ui/components/Toaster';

import {
  useFactoryThinkingDefaultQuery,
  useSetFactoryThinkingDefaultMutation,
} from '../../../../../../hooks/use-thinking';
import { ALL_THINKING_LEVEL_OPTIONS } from '../../../../chat/services/thinkingLevels';

function thinkingWriteFailureMessage(error: unknown) {
  if (!(error instanceof Error)) return 'Failed to change thinking level';
  if ('status' in error && error.status === 403) return 'Only organization admins can change the thinking level';
  return error.message;
}

export function FactoryThinkingControl({ factoryId }: { factoryId: string }) {
  const levelQuery = useFactoryThinkingDefaultQuery(factoryId);
  const setLevel = useSetFactoryThinkingDefaultMutation(factoryId);

  if (levelQuery.isError) {
    return (
      <ThinkingLevelUnavailable
        options={ALL_THINKING_LEVEL_OPTIONS}
        label="Thinking"
        reason="The thinking level couldn't be loaded."
      />
    );
  }
  if (levelQuery.data === undefined) {
    return (
      <ThinkingLevelUnavailable
        options={ALL_THINKING_LEVEL_OPTIONS}
        label="Thinking"
        reason="The thinking level isn't loaded yet."
      />
    );
  }

  return (
    <ThinkingLevelPicker
      options={ALL_THINKING_LEVEL_OPTIONS}
      value={levelQuery.data}
      label="Thinking"
      description="Used by sessions and work-item runs on the Factory defaults, and by anyone whose personal defaults have no level. Each run caps it at what its model supports."
      onChange={(level: ThinkingLevelSetting) =>
        setLevel.mutateAsync(level).catch(error => toast.error(thinkingWriteFailureMessage(error)))
      }
    />
  );
}
