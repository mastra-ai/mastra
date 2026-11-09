import type { ExperimentItemUsage } from '@mastra/react/hooks/experiments';

export function isReplayRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function replayContext(output: unknown) {
  if (!isReplayRecord(output) || !isReplayRecord(output.replay)) return undefined;
  const replay = output.replay;
  if (
    (replay.mode !== 'conversation' &&
      (typeof replay.sourceThreadId !== 'string' || typeof replay.turnIndex !== 'number')) ||
    typeof replay.turnCount !== 'number'
  )
    return undefined;
  return {
    mode: replay.mode === 'conversation' ? 'conversation' : 'turns',
    sourceThreadId: typeof replay.sourceThreadId === 'string' ? replay.sourceThreadId : '',
    turnIndex: typeof replay.turnIndex === 'number' ? replay.turnIndex : 0,
    turnCount: replay.turnCount,
    expectedTrajectory: replay.expectedTrajectory,
    workingMemory: isReplayRecord(replay.memorySeed) ? replay.memorySeed.workingMemory : undefined,
  };
}

export function replayLabel(output: unknown) {
  const replay = replayContext(output);
  if (!replay) return undefined;
  return replay.mode === 'conversation'
    ? `Conversation (${replay.turnCount} turns)`
    : `Turn ${replay.turnIndex + 1} of ${replay.turnCount}`;
}

export function compareReplayOutputs(left: unknown, right: unknown) {
  const a = replayContext(left);
  const b = replayContext(right);
  if (!a || !b) return Number(!!b) - Number(!!a);
  return a.sourceThreadId.localeCompare(b.sourceThreadId) || a.turnIndex - b.turnIndex;
}

export function replayUserMessage(input: unknown): unknown {
  if (isReplayRecord(input) && input.type === 'conversation' && Array.isArray(input.turns)) {
    return input.turns
      .filter(isReplayRecord)
      .map(turn => replayUserMessage(turn.input))
      .join(' → ');
  }
  if (!Array.isArray(input)) return input;
  const message: unknown = input
    .slice()
    .reverse()
    .find((message: unknown) => isReplayRecord(message) && message.role === 'user');
  if (!isReplayRecord(message) || !isReplayRecord(message.content)) return message;
  const parts = message.content.parts;
  if (!Array.isArray(parts)) return message.content;
  return parts
    .filter(isReplayRecord)
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

/** Conversation usage is accumulated across turns; a last-turn trace is not an item total. */
export function replayUsage(output: unknown): ExperimentItemUsage | undefined {
  if (!isReplayRecord(output) || !isReplayRecord(output.usage)) return undefined;
  const usage = output.usage;
  return {
    inputTokens: typeof usage.inputTokens === 'number' ? usage.inputTokens : undefined,
    outputTokens: typeof usage.outputTokens === 'number' ? usage.outputTokens : undefined,
  };
}
