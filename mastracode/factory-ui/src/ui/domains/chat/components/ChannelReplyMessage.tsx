import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';

export const REPLY_IN_THREAD_TOOL = 'reply_in_thread';

type ReplyStatus = 'running' | 'done' | 'error';

/**
 * The agent's `reply_in_thread` call drawn as the message it posted, the way
 * people in the Slack thread read it, instead of a JSON tool card.
 */
export function ChannelReplyMessage({ text, status }: { text: string; status: ReplyStatus }) {
  const label = status === 'error' ? 'Not sent to Slack' : status === 'running' ? 'Sending in Slack…' : 'Sent in Slack';
  return (
    <div role="group" aria-label="Reply in Slack thread" className="my-3">
      <MarkdownRenderer streaming={status === 'running'}>{text}</MarkdownRenderer>
      <div className="text-muted-foreground mt-1 flex items-center gap-1">
        <SlackIcon className="size-3" aria-hidden="true" />
        <Txt as="span" variant="meta" className={status === 'error' ? 'text-destructive-foreground' : undefined}>
          {label}
        </Txt>
      </div>
    </div>
  );
}

const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

/**
 * The reply's `text`: from the parsed args once the call is complete, else
 * decoded from the args JSON streamed so far, which may stop mid-string.
 */
export function replyText(args: unknown, argsText: string | undefined): string | undefined {
  if (args && typeof args === 'object' && 'text' in args && typeof args.text === 'string') return args.text;
  if (!argsText) return undefined;
  const start = /"text"\s*:\s*"/.exec(argsText);
  if (!start) return undefined;
  let out = '';
  for (let i = start.index + start[0].length; i < argsText.length; i++) {
    const ch = argsText[i]!;
    if (ch === '"') break;
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = argsText[i + 1];
    if (next === undefined) break;
    if (next === 'u') {
      const hex = argsText.slice(i + 2, i + 6);
      if (hex.length < 4) break;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      out += ESCAPES[next] ?? next;
      i += 1;
    }
  }
  return out || undefined;
}
