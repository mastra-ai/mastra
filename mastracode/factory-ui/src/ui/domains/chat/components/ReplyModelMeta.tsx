import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { MessageMetadata } from '@mastra/playground-ui/components/Message';
import { ThinkingLevelBars } from '@mastra/playground-ui/components/ThinkingLevel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { formatModelName } from '@mastra/playground-ui/utils/model';

import { ALL_THINKING_LEVEL_OPTIONS, THINKING_LEVEL_LABELS } from '../services/thinkingLevels';

interface ReplyModelMetaProps {
  modelId: string;
  thinkingLevel: ThinkingLevelSetting | undefined;
}

export function ReplyModelMeta({ modelId, thinkingLevel }: ReplyModelMetaProps) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger render={<MessageMetadata tabIndex={0}>{formatModelName(modelId)}</MessageMetadata>} />
        <TooltipContent>{modelId}</TooltipContent>
      </Tooltip>
      {thinkingLevel && <ReplyThinkingLevel level={thinkingLevel} />}
    </>
  );
}

function ReplyThinkingLevel({ level }: { level: ThinkingLevelSetting }) {
  const description = `Thinking: ${THINKING_LEVEL_LABELS[level]}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <MessageMetadata role="img" tabIndex={0} aria-label={description}>
            <ThinkingLevelBars options={ALL_THINKING_LEVEL_OPTIONS} value={level} />
          </MessageMetadata>
        }
      />
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}
