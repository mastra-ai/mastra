import { ChannelName } from './ChannelName';
import { Txt } from '@/ds/components/Txt';
import { SlackIcon } from '@/ds/icons/SlackIcon';

export interface ChannelThreadStartProps {
  /** The channel's platform, from the thread's metadata, e.g. `slack`. */
  platform: string;
  /** The channel the thread lives in. */
  channelName?: string;
  /** Opens the channel in its app. Without it the channel name is plain text. */
  channelUrl?: string;
  /** Who wrote the message that started the thread. */
  authorName?: string;
}

function platformName(platform: string) {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

/** The top of a thread that came in from a channel: where it started, and who started it. */
export function ChannelThreadStart({ platform, channelName, channelUrl, authorName }: ChannelThreadStartProps) {
  return (
    <div role="note" className="my-3 flex items-center gap-3 text-muted-foreground">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      <span className="flex max-w-full min-w-0 items-center gap-1.5">
        {platform === 'slack' ? <SlackIcon aria-hidden="true" className="size-icon-xs shrink-0" /> : null}
        <Txt
          as="span"
          variant="label"
          tone="muted"
          className="flex max-w-full min-w-0 flex-wrap items-center justify-center gap-x-1"
        >
          Started in {channelName ? <ChannelName name={channelName} url={channelUrl} /> : platformName(platform)}
          {authorName ? <span className="min-w-0 break-words"> by {authorName}</span> : null}
        </Txt>
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}
