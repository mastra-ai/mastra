import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';

import type { ChannelOrigin, MessageAuthor } from '../services/message-author';

const CHANNEL_PLATFORM_LABEL: Record<string, string> = {
  slack: 'Slack',
};

export function ChannelOriginBadge({ origin }: { origin: ChannelOrigin }) {
  const label = CHANNEL_PLATFORM_LABEL[origin.platform] ?? origin.platform;
  return (
    <div aria-label={`Sent from ${label}`} className="text-muted-foreground mt-1 flex items-center gap-1">
      {origin.platform === 'slack' && <SlackIcon className="size-3" aria-hidden="true" />}
      <Txt as="span" variant="meta">
        <Metadata>
          <Metadata.Item>via {label}</Metadata.Item>
          {origin.authorName && <Metadata.Item>{origin.authorName}</Metadata.Item>}
        </Metadata>
      </Txt>
    </div>
  );
}

export function SenderAvatar({ author }: { author: MessageAuthor }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={`Sent by ${author.name}`}
            className={`mt-1 shrink-0 rounded-full ${focusRing}`}
            tabIndex={0}
          >
            <Avatar name={author.name} src={author.avatarUrl} size="sm" />
          </span>
        }
      />
      <TooltipContent>{author.name}</TooltipContent>
    </Tooltip>
  );
}
