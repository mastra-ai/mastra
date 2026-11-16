/**
 * Names the cards a board lists and when each last changed, whatever their order. The server sends
 * it with the cards that moved; a reader that kept the board computes it over its merged copy, and
 * a different value means that copy missed a change. 32-bit integer sums, so no size of board
 * rounds it.
 */
export function boardCheck(cards: readonly { id: string; changedAt?: Date | string | null }[]): string {
  let sum = 0;
  for (const card of cards) {
    const stamp = `${card.id}:${card.changedAt ? new Date(card.changedAt).getTime() : ''}`;
    // FNV-1a.
    let hash = 0x811c9dc5;
    for (let i = 0; i < stamp.length; i++) hash = Math.imul(hash ^ stamp.charCodeAt(i), 0x01000193);
    sum = (sum + hash) | 0;
  }
  return `${cards.length}.${sum >>> 0}`;
}
