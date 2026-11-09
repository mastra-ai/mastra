import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { isReplayRecord, replayContext } from '../utils/replay';
import { ComparisonPayload } from './comparison/comparison-payload';
import { ComparisonSection } from './comparison/comparison-section';
import { ReplayTurnResult } from './replay-turn-result';

/** Turn selection stays local to the existing result panel; references come from the saved run. */
export function ConversationReplayResult({
  output,
  onShowTrace,
  selectedTurn,
  onSelectTurn,
}: {
  output: Record<string, unknown>;
  onShowTrace?: (traceId: string) => void;
  selectedTurn?: number;
  onSelectTurn?: (turnIndex: number) => void;
}) {
  const [localTurn, setLocalTurn] = useState(0);
  const selected = selectedTurn ?? localTurn;
  const selectTurn = onSelectTurn ?? setLocalTurn;
  const replay = replayContext(output);
  if (!replay || !Array.isArray(output.turns)) return null;
  const turns = output.turns.filter(isReplayRecord);
  const turn = turns.find(turn => turn.turnIndex === selected);
  const completed = turns.filter(turn => !turn.error).length;
  const misses = turns.flatMap(turn =>
    isReplayRecord(turn.toolMockReport) && Array.isArray(turn.toolMockReport.misses)
      ? turn.toolMockReport.misses.filter(isReplayRecord)
      : [],
  );
  const unresolved = turns.reduce(
    (count, turn) => count + (Array.isArray(turn.unresolvedToolCalls) ? turn.unresolvedToolCalls.length : 0),
    0,
  );
  const scores = turn && Array.isArray(turn.scores) ? turn.scores.filter(isReplayRecord) : [];
  const candidate = turn && isReplayRecord(turn.output) ? turn.output : {};
  const error =
    turn && isReplayRecord(turn.error) && typeof turn.error.message === 'string' ? turn.error.message : undefined;
  const interruption =
    !error && isReplayRecord(output.error) && typeof output.error.message === 'string'
      ? output.error.message
      : undefined;
  const traceId = turn && typeof turn.traceId === 'string' ? turn.traceId : undefined;
  return (
    <section aria-label="Conversation replay" className="grid gap-4">
      <Txt variant="heading">
        {completed} of {replay.turnCount} turns completed
      </Txt>
      <Txt tone="muted">Scores summarize available turns. Inspect each turn for regressions and missing evidence.</Txt>
      {misses.length > 0 && (
        <Txt role="alert">
          Missing recordings: {misses.length} tool calls could not be replayed. Scores may be incomplete.
        </Txt>
      )}
      {unresolved > 0 && <Txt role="alert">The recording has {unresolved} tool calls without recorded results.</Txt>}
      <nav aria-label="Conversation turns" className="flex flex-wrap gap-2">
        {Array.from({ length: replay.turnCount }, (_, index) => {
          const entry = turns.find(turn => turn.turnIndex === index);
          const status = !entry ? 'Not executed' : entry.error ? 'Interrupted' : 'Completed';
          return (
            <Button
              key={index}
              variant={selected === index ? 'primary' : 'default'}
              aria-pressed={selected === index}
              disabled={!entry}
              onClick={event => {
                event.stopPropagation();
                selectTurn(index);
              }}
            >
              Turn {index + 1}: {status}
            </Button>
          );
        })}
      </nav>
      {!turn && <Txt>This turn was not executed.</Txt>}
      {(error || interruption) && <Txt role="alert">{error ?? interruption}</Txt>}
      {traceId && onShowTrace && (
        <Button
          variant="default"
          onClick={event => {
            event.stopPropagation();
            onShowTrace(traceId);
          }}
        >
          View turn trace
        </Button>
      )}
      {scores.length > 0 && (
        <ComparisonSection title="Turn scores" framed>
          <div className="grid gap-2 p-3">
            {scores.map((score, index) => (
              <div key={index} className="grid gap-0.5">
                <Txt>
                  {typeof score.scorerName === 'string' ? score.scorerName : 'Scorer'}:{' '}
                  {typeof score.score === 'number'
                    ? score.score
                    : typeof score.error === 'string'
                      ? score.error
                      : 'Unscored'}
                </Txt>
                {typeof score.reason === 'string' && <Txt tone="muted">{score.reason}</Txt>}
              </div>
            ))}
          </div>
        </ComparisonSection>
      )}
      {turn && (
        <ReplayTurnResult
          result={{
            input: turn.input,
            groundTruth: turn.groundTruth,
            output: {
              ...candidate,
              conversationTurn: true,
              replay: {
                sourceThreadId: replay.sourceThreadId,
                turnIndex: selected,
                turnCount: replay.turnCount,
                expectedTrajectory: turn.expectedTrajectory,
                memorySeed: { workingMemory: turn.workingMemoryBefore },
              },
            },
          }}
        />
      )}
      {turn &&
        isReplayRecord(turn.toolMockReport) &&
        Array.isArray(turn.toolMockReport.misses) &&
        turn.toolMockReport.misses.length > 0 && (
          <ComparisonSection title="Missing recordings on this turn" tone="negative" framed>
            <ComparisonPayload value={turn.toolMockReport.misses} />
          </ComparisonSection>
        )}
    </section>
  );
}
