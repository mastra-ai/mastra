import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { savedTurn } from '../utils/conversation-playback';
import type { savedConversation } from '../utils/conversation-playback';
import { ExperimentConversationTurn } from './experiment-conversation-turn';

export function ExperimentConversation({
  conversation,
  input,
  onShowTrace,
}: {
  conversation: NonNullable<ReturnType<typeof savedConversation>>;
  input: unknown;
  onShowTrace?: (traceId: string) => void;
}) {
  return (
    <section aria-label="Saved conversation" className="mx-auto w-full max-w-3xl">
      <Txt tone="muted">Saved experiment results</Txt>
      {conversation.error && <Txt role="alert">{conversation.error}</Txt>}
      {Array.from({ length: conversation.count }, (_, index) => {
        const turn = savedTurn(conversation, index, input);
        const traceId = conversation.turns.find(turn => turn.turnIndex === index)?.traceId;
        return (
          <section key={index} aria-label={`Turn ${index + 1}`}>
            <div className="flex items-center justify-between gap-2">
              <Txt variant="subheading">Turn {index + 1}</Txt>
              {typeof traceId === 'string' && onShowTrace && (
                <Button variant="ghost" size="sm" onClick={() => onShowTrace(traceId)}>
                  View turn {index + 1} trace
                </Button>
              )}
            </div>
            <ExperimentConversationTurn turn={turn} />
          </section>
        );
      })}
    </section>
  );
}
