const BOARD_TONES = [
  'text-chart-blue',
  'text-chart-purple',
  'text-chart-green',
  'text-chart-orange',
  'text-chart-cyan',
  'text-chart-pink',
] as const;

/** A board's colour on a map, stable for as long as the catalog keeps its order. */
export function boardTone(boardIds: readonly string[], boardId: string): string {
  const index = boardIds.indexOf(boardId);
  return BOARD_TONES[(index < 0 ? 0 : index) % BOARD_TONES.length] ?? BOARD_TONES[0];
}
