/**
 * Moves the server took on (`202` with an input id) and answers later on the project's feed
 * stream. The stream and the move are held by different parts of the page, so they meet here.
 */

/** How a submitted move ended, as the feed stream's `move` frame tells it. */
export type MoveAnswer =
  | { inputId: string; status: 'accepted' }
  | { inputId: string; status: 'rejected'; code: string; reason: string };

/** A frame can beat the `202` it answers; this many answers are kept for a move that asks after. */
const KEPT_ANSWERS = 50;

const waiting = new Map<string, (answer: MoveAnswer | undefined) => void>();
const answered = new Map<string, MoveAnswer>();

/** Reads a `move` frame's data; nothing for a frame this page can't make sense of. */
export function parseMoveAnswer(data: string): MoveAnswer | undefined {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const { inputId, status, code, reason } = value as Record<string, unknown>;
  if (typeof inputId !== 'string') return undefined;
  if (status === 'accepted') return { inputId, status };
  if (status === 'rejected' && typeof code === 'string' && typeof reason === 'string') {
    return { inputId, status, code, reason };
  }
  return undefined;
}

/** The feed stream heard how a move ended. */
export function moveAnswered(answer: MoveAnswer): void {
  const tell = waiting.get(answer.inputId);
  if (tell) return tell(answer);
  answered.set(answer.inputId, answer);
  const oldest = answered.keys().next();
  if (answered.size > KEPT_ANSWERS && !oldest.done) answered.delete(oldest.value);
}

/**
 * The feed stream was down and is back: an answer sent meanwhile is lost, so every waiting move
 * stops waiting and the board is read instead.
 */
export function moveAnswersMayBeMissed(): void {
  for (const tell of [...waiting.values()]) tell(undefined);
}

/**
 * Waits for the answer to a submitted move. Nothing when none came within `waitMs` (the server
 * that took the move on may be gone) or the stream may have missed it.
 */
export function awaitMoveAnswer(inputId: string, waitMs: number): Promise<MoveAnswer | undefined> {
  const early = answered.get(inputId);
  if (early) {
    answered.delete(inputId);
    return Promise.resolve(early);
  }
  return new Promise(resolve => {
    const timer = setTimeout(() => tell(undefined), waitMs);
    const tell = (answer: MoveAnswer | undefined) => {
      clearTimeout(timer);
      waiting.delete(inputId);
      resolve(answer);
    };
    waiting.set(inputId, tell);
  });
}
