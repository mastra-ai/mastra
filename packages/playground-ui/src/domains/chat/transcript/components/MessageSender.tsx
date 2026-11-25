import type { ChannelOrigin, MessageAuthor } from '../services/message-author';
import { Avatar } from '@/ds/components/Avatar';
import { Metadata } from '@/ds/components/Metadata';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { SlackIcon } from '@/ds/icons/SlackIcon';

import { focusRing } from '@/ds/primitives/transitions';

const CHANNEL_PLATFORM_LABEL: Record<string, string> = {
  slack: 'Slack',
};

export function ChannelOriginBadge({ origin, author }: { origin: ChannelOrigin; author?: MessageAuthor }) {
  const label = CHANNEL_PLATFORM_LABEL[origin.platform] ?? origin.platform;
  const authorName = origin.authorName ?? author?.name;
  return (
    <div aria-label={`Sent from ${label}`} className="mt-1 flex items-center gap-1 text-muted-foreground">
      {origin.platform === 'slack' && <SlackIcon className="size-icon-xs" aria-hidden="true" />}
      <Txt as="span" variant="meta">
        <Metadata>
          <Metadata.Item>via {label}</Metadata.Item>
          {authorName && (
            <Metadata.Item>
              <span aria-hidden="true">
                <Avatar name={authorName} src={author?.avatarUrl} size="xs" />
              </span>
              {authorName}
            </Metadata.Item>
          )}
        </Metadata>
      </Txt>
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
