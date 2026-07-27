/**
 * The Factory board's stage vocabulary, shared by the Board (columns) and the
 * Metrics page (stage labels/ordering). Stages are plain strings server-side —
 * this is purely the UI's naming and ordering of them.
 */
export const BOARD_STAGES = [
  { id: 'intake', label: 'Intake' },
  { id: 'triage', label: 'Triage' },
  { id: 'planning', label: 'Planning' },
  { id: 'execute', label: 'Building' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
  { id: 'canceled', label: 'Canceled' },
] as const;

export type BoardStageId = (typeof BOARD_STAGES)[number]['id'];

/** UI label for a stage, falling back to the raw id for unknown stages. */
export function stageLabel(stage: string): string {
  return BOARD_STAGES.find(s => s.id === stage)?.label ?? stage;
}

/** Position of a stage in the board's column order; unknown stages sort last. */
export function stageOrder(stage: string): number {
  const index = BOARD_STAGES.findIndex(s => s.id === stage);
  return index === -1 ? BOARD_STAGES.length : index;
}
