import { Txt } from '@mastra/playground-ui/components/Txt';
import { MessageRow } from '@mastra/playground-ui/domains/chat/messages/message-row';
import { ReadOnlyToolCallProvider } from '@mastra/playground-ui/domains/traces/components/read-only-tool-call-provider';
import { useId } from 'react';
import { conversationMessages } from '../utils/conversation-messages';
import type { PlaybackTurn } from '../utils/conversation-playback';
import { ComparisonPayload } from './comparison/comparison-payload';

/** Shared by the individual result and side-by-side playback; never mounts a live chat provider. */
export function ExperimentConversationTurn({ turn, fraction = 1 }: { turn: PlaybackTurn; fraction?: number }) {
  const id = useId();
  return (
    <div className="min-w-0 p-3 sm:p-5">
      <ReadOnlyToolCallProvider>
        {conversationMessages(turn, fraction).map(message => (
          <MessageRow key={message.id} message={{ ...message, id: `${id}-${message.id}` }} readOnly />
        ))}
      </ReadOnlyToolCallProvider>
      {!turn.executed && <Txt tone="muted">This turn was not executed.</Txt>}
      {turn.executed && fraction === 0 && <Txt tone="muted">Waiting for playback…</Txt>}
      {turn.executed && fraction > 0 && !turn.text && (
        <ComparisonPayload value={turn.object ?? 'No text response recorded.'} />
      )}
      {fraction >= 1 && turn.error && <Txt role="note">Interrupted: {turn.error}</Txt>}
    </div>
  );
}
