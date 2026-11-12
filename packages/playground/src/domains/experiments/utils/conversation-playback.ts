import { isReplayRecord, replayContext, replayUserMessage } from './replay';

/** Read only the saved result envelope. Gaps stay indexed, so an interrupted run cannot shift alignment. */
export function savedConversation(output: unknown) {
  const context = replayContext(output);
  if (context?.mode !== 'conversation' || !isReplayRecord(output) || !Array.isArray(output.turns)) return undefined;
  if (!Number.isSafeInteger(context.turnCount) || context.turnCount < 1) return undefined;
  return { count: context.turnCount, turns: output.turns.filter(isReplayRecord) };
}

export function savedTurn(conversation: ReturnType<typeof savedConversation>, index: number, input: unknown) {
  const turn = conversation?.turns.find(turn => turn.turnIndex === index);
  const sourceTurns = isReplayRecord(input) && Array.isArray(input.turns) ? input.turns : [];
  const source: unknown = sourceTurns[index];
  const sourceInput = isReplayRecord(source) ? source.input : undefined;
  const output = turn && isReplayRecord(turn.output) ? turn.output : undefined;
  const error =
    turn && isReplayRecord(turn.error) && typeof turn.error.message === 'string' ? turn.error.message : undefined;
  return {
    executed: Boolean(turn),
    input: replayUserMessage(turn?.input ?? sourceInput),
    text: typeof output?.text === 'string' ? output.text : '',
    object: output?.object,
    toolCount: Array.isArray(output?.toolCalls) ? output.toolCalls.length : 0,
    error,
  };
}

export type PlaybackTurn = ReturnType<typeof savedTurn>;

/** Reveal whole words, preserving the recorded whitespace and Unicode text. */
export function revealReply(text: string, fraction: number) {
  if (fraction >= 1) return text;
  const words = text.match(/\S+\s*|\s+/gu) ?? [];
  return words.slice(0, Math.floor(words.length * fraction)).join('');
}
