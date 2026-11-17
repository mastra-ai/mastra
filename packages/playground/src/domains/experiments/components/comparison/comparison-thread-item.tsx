import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { savedConversation, savedTurn } from '../../utils/conversation-playback';
import type { PlaybackTurn } from '../../utils/conversation-playback';
import { isReplayRecord, replayUserMessage } from '../../utils/replay';
import { getResultErrorMessage, getResultOutputText, getResultToolCalls } from '../../utils/result-output';
import { ExperimentConversationTurn } from '../experiment-conversation-turn';
import type { ComparisonColumn, ComparisonRow } from './build-comparison-rows';
import { columnLabel } from './constants';

/** Ordinary results are a single exchange; conversation results keep their recorded turn indexes. */
function comparisonTurn(side: ComparisonColumn, index: number, input: unknown): PlaybackTurn {
  const conversation = savedConversation(side.output);
  if (conversation || index > 0) return savedTurn(conversation, index, input);
  const result = { targetType: side.targetType ?? undefined, output: side.output, error: side.error };
  return {
    executed: side.present,
    input: replayUserMessage(input),
    text: getResultOutputText(result) ?? (typeof side.output === 'string' ? side.output : ''),
    object: isReplayRecord(side.output) ? (side.output.object ?? side.output) : side.output,
    toolCalls: getResultToolCalls(result),
    error: getResultErrorMessage(result),
  };
}

/** One shared scroll surface keeps matching turns aligned even when replies have different lengths. */
export function ComparisonThreadItem({ row, itemNumber }: { row: ComparisonRow; itemNumber: number }) {
  const conversations = row.sides.map(side => savedConversation(side.output));
  const turnCount = Math.max(1, ...conversations.map(conversation => conversation?.count ?? 1));
  const columns = { gridTemplateColumns: `repeat(${row.sides.length}, minmax(22rem, 1fr))` };
  return (
    <section aria-label={`Item ${row.itemId}`} className="border-b border-border">
      <div className="flex items-center gap-3 px-5 py-3">
        <Txt as="h2" variant="heading">
          Item {itemNumber}
        </Txt>
        <Txt tone="muted">
          {turnCount} {turnCount === 1 ? 'turn' : 'turns'}
        </Txt>
      </div>
      {Array.from({ length: turnCount }, (_, index) => (
        <section key={index} aria-label={`Turn ${index + 1}`} className="border-t border-border">
          <div className="px-5 py-2">
            <Txt variant="subheading">Turn {index + 1}</Txt>
          </div>
          <div className="grid divide-x divide-border" style={columns}>
            {row.sides.map((side, sideIndex) => {
              const conversation = conversations[sideIndex];
              const turn = comparisonTurn(side, index, row.input);
              return (
                <div key={side.experimentId} role="group" aria-label={columnLabel(sideIndex)} className="min-w-0">
                  {!side.present ? (
                    <div className="p-5">
                      <Txt tone="muted">Not present in this experiment</Txt>
                    </div>
                  ) : (
                    <>
                      {index === 0 && conversation?.error && (
                        <div className="px-5">
                          <Notice variant="warning" title="Conversation interrupted">
                            <Notice.Message>{conversation.error}</Notice.Message>
                          </Notice>
                        </div>
                      )}
                      <ExperimentConversationTurn turn={turn} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}
