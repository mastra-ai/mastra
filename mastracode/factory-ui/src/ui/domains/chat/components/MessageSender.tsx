import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';

import type { ChannelOrigin, MessageAuthor } from '../services/message-author';

const CHANNEL_PLATFORM_LABEL: Record<string, string> = {
  slack: 'Slack',
};

export function ChannelOriginBadge({ origin }: { origin: ChannelOrigin }) {
  const label = CHANNEL_PLATFORM_LABEL[origin.platform] ?? origin.platform;
  return (
    <div className="text-ui-xs text-icon3 mt-1 flex items-center gap-1" aria-label={`Sent from ${label}`}>
      {origin.platform === 'slack' && <SlackIcon className="size-3" aria-hidden="true" />}
      <span>
        via {label}
        {origin.authorName ? ` · ${origin.authorName}` : ''}
      </span>
    </div>
  );
}

/** The bubble beside a message someone else sent; hover or focus it for their name. */
export function SenderAvatar({ author }: { author: MessageAuthor }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={`Sent by ${author.name}`}
            className="focus-visible:ring-accent1 mt-1 shrink-0 rounded-full outline-hidden focus-visible:ring-2"
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
