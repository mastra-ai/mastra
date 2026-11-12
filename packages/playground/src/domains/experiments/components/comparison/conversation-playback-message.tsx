import { Badge } from '@mastra/playground-ui/components/Badge';
import { MarkdownRenderer } from '@mastra/playground-ui/components/MarkdownRenderer';
import { Message } from '@mastra/playground-ui/components/Message';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { revealReply } from '../../utils/conversation-playback';
import type { PlaybackTurn } from '../../utils/conversation-playback';
import { ComparisonPayload } from './comparison-payload';

export function ConversationPlaybackMessage({ turn, fraction }: { turn: PlaybackTurn; fraction: number }) {
  const text = revealReply(turn.text, fraction);
  return (
    <div className="min-w-0 space-y-4 p-3 sm:p-5">
      <Message from="user" aria-label="User message">
        {typeof turn.input === 'string' ? (
          <Txt className="whitespace-pre-wrap">{turn.input}</Txt>
        ) : (
          <ComparisonPayload value={turn.input ?? 'User message unavailable'} />
        )}
      </Message>
      <Message from="assistant" aria-label="Saved assistant response">
        {!turn.executed ? (
          <Txt tone="muted">This turn was not executed.</Txt>
        ) : (
          <div className="grid gap-3">
            {fraction === 0 ? (
              <Txt tone="muted">Waiting for playback…</Txt>
            ) : (
              <>
                {turn.toolCount > 0 && (
                  <Badge variant="neutral" emphasis="subtle">
                    {turn.toolCount} recorded tool {turn.toolCount === 1 ? 'call' : 'calls'}
                  </Badge>
                )}
                {turn.text ? (
                  <MarkdownRenderer streaming={fraction < 1}>{text || '…'}</MarkdownRenderer>
                ) : (
                  <ComparisonPayload value={turn.object ?? 'No text response recorded.'} />
                )}
                {fraction >= 1 && turn.error && <Txt role="note">Interrupted: {turn.error}</Txt>}
              </>
            )}
          </div>
        )}
      </Message>
    </div>
  );
}
