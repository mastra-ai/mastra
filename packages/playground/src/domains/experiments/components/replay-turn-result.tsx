import type { DatasetExperimentResult } from '@mastra/client-js';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { isReplayRecord, replayContext, replayLabel, replayUserMessage } from '../utils/replay';
import { ComparisonPayload } from './comparison/comparison-payload';
import { ComparisonSection } from './comparison/comparison-section';

export function ReplayTurnResult({
  result,
}: {
  result: Pick<DatasetExperimentResult, 'input' | 'output'> &
    Partial<Pick<DatasetExperimentResult, 'groundTruth' | 'toolMockReport'>>;
}) {
  const replay = replayContext(result.output);
  if (!replay || !isReplayRecord(result.output)) return null;
  const candidate = result.output;
  const trajectory = replay.expectedTrajectory;
  const steps =
    isReplayRecord(trajectory) && Array.isArray(trajectory.steps)
      ? trajectory.steps
          .filter(isReplayRecord)
          .map(step => ({ toolName: step.name, args: step.toolArgs, result: step.toolResult }))
      : [];
  const results = Array.isArray(candidate.toolResults)
    ? candidate.toolResults
        .filter(isReplayRecord)
        .map(result => (isReplayRecord(result.payload) ? result.payload : result))
    : [];
  const calls = Array.isArray(candidate.toolCalls)
    ? candidate.toolCalls.filter(isReplayRecord).map(call => {
        const payload = isReplayRecord(call.payload) ? call.payload : call;
        const result = results.find(result => result.toolCallId === payload.toolCallId);
        return { toolName: payload.toolName, args: payload.args, result: result?.result };
      })
    : [];
  const misses = result.toolMockReport?.misses ?? [];
  const reordered =
    result.toolMockReport?.served.filter(call => call.callIndex !== undefined && call.callIndex !== call.mockIndex) ??
    [];
  return (
    <section aria-label="Replay comparison" className="grid gap-4">
      <Txt variant="heading">{replayLabel(result.output)}</Txt>
      <ComparisonSection title="User message" framed>
        <ComparisonPayload value={replayUserMessage(result.input)} />
      </ComparisonSection>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Production" className="grid content-start gap-3">
          <Txt variant="heading">Production</Txt>
          <ComparisonSection title="Recorded tool calls" framed>
            <ComparisonPayload value={steps ?? []} />
          </ComparisonSection>
          <ComparisonSection title="Production reply" framed>
            <ComparisonPayload value={result.groundTruth} />
          </ComparisonSection>
          <ComparisonSection
            title={candidate.conversationTurn ? 'Candidate memory before turn' : 'Working memory seed'}
            framed
          >
            <ComparisonPayload value={replay.workingMemory ?? 'Agent template default'} />
          </ComparisonSection>
        </section>
        <section aria-label="Candidate" className="grid content-start gap-3">
          <Txt variant="heading">Candidate</Txt>
          <ComparisonSection title="Candidate tool calls" framed>
            <ComparisonPayload value={calls} />
          </ComparisonSection>
          {reordered.map(call => (
            <Txt key={call.callIndex} tone="muted">
              Order changed: {call.toolName}, recorded call {call.mockIndex + 1} → candidate call{' '}
              {(call.callIndex ?? 0) + 1}
            </Txt>
          ))}
          <ComparisonSection title="Candidate reply" framed>
            <ComparisonPayload value={candidate.text ?? candidate.object} />
          </ComparisonSection>
          {(candidate.workingMemory != null || replay.workingMemory != null) &&
            candidate.workingMemory !== replay.workingMemory && (
              <ComparisonSection title="Working memory after run" framed>
                <ComparisonPayload value={candidate.workingMemory ?? 'No working memory stored'} />
              </ComparisonSection>
            )}
          {misses.length > 0 && (
            <ComparisonSection title="Mock misses" tone="negative" framed>
              <div className="grid gap-3 p-3">
                {misses.map((miss, index) => (
                  <div key={index}>
                    <Txt>
                      {miss.toolName}: {miss.reason}
                    </Txt>
                    <ComparisonPayload
                      value={{ args: miss.args, ...(miss.closestArgs ? { closestArgs: miss.closestArgs } : {}) }}
                    />
                  </div>
                ))}
              </div>
            </ComparisonSection>
          )}
        </section>
      </div>
    </section>
  );
}
