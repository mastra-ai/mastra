import type { FactoryRuleStage } from '@mastra/factory/rules/types';

/**
 * The default board's phases, in column order: its columns' labels and colours when no catalog
 * names them. `review` is the self-review phase Work held before it dropped it; projects stored
 * then still have it.
 */
const WORK_STAGES = ['intake', 'triage', 'planning', 'execute', 'review', 'pr-review', 'done', 'canceled'] as const;

const BOARD_STAGE_LABELS = {
  intake: 'Intake',
  triage: 'Triage',
  planning: 'Planning',
  execute: 'Building',
  review: 'Self-review',
  'pr-review': 'Review',
  done: 'Done',
  canceled: 'Canceled',
} satisfies Record<(typeof WORK_STAGES)[number], string>;

export type BoardStageId = FactoryRuleStage;

export interface BoardStage {
  id: BoardStageId;
  label: string;
}

export const BOARD_STAGES: ReadonlyArray<BoardStage> = WORK_STAGES.map(id => ({
  id,
  label: BOARD_STAGE_LABELS[id],
}));

/** UI label for a stage, falling back to the raw id for unknown stages. */
export function stageLabel(stage: string): string {
  return BOARD_STAGES.find(s => s.id === stage)?.label ?? stage;
}

/** Position of a stage in the board's column order; unknown stages sort last. */
export function stageOrder(stage: string): number {
  const index = BOARD_STAGES.findIndex(s => s.id === stage);
  return index === -1 ? BOARD_STAGES.length : index;
}

export { stageTone } from '@mastra/playground-ui/domains/factory';
