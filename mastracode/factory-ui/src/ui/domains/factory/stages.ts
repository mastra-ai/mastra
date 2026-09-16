import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import type { FactoryRuleStage } from '@mastra/factory/rules/types';
import { FACTORY_RULE_STAGES } from '@mastra/factory/rules/types';

const BOARD_STAGE_LABELS = {
  intake: 'Intake',
  triage: 'Triage',
  planning: 'Planning',
  execute: 'Building',
  review: 'Review',
  done: 'Done',
  canceled: 'Canceled',
} satisfies Record<FactoryRuleStage, string>;

export type BoardStageId = FactoryRuleStage;

export interface BoardStage {
  id: BoardStageId;
  label: string;
}

export const BOARD_STAGES: ReadonlyArray<BoardStage> = FACTORY_RULE_STAGES.map(id => ({
  id,
  label: BOARD_STAGE_LABELS[id],
}));

/**
 * Stages that hold work in the pipeline, in column order — the board minus its
 * terminal columns and minus `intake`.
 *
 * Intake is left out because the Board's Intake column merges persisted cards
 * with live GitHub/Linear candidates that have no `work_items` row yet, so any
 * aggregation over persisted rows undercounts it. Charting it means merging the
 * live candidates in first, which needs its own age semantics (upstream open
 * date vs. time in stage).
 */
export const PIPELINE_STAGES: BoardStageId[] = FACTORY_RULE_STAGES.filter(
  id => id !== 'intake' && !isTerminalStage(id),
);

/** Stages where the work has stopped for good. */
export function isTerminalStage(stage: string): boolean {
  return stage === 'done' || stage === 'canceled';
}

/** UI label for a stage, falling back to the raw id for unknown stages. */
export function stageLabel(stage: string): string {
  return BOARD_STAGES.find(s => s.id === stage)?.label ?? stage;
}

/** The board column a raw stage id names, when it names one. */
export function boardStage(stage: string): BoardStageId | undefined {
  return BOARD_STAGES.find(s => s.id === stage)?.id;
}

/** Position of a stage in the board's column order; unknown stages sort last. */
export function stageOrder(stage: string): number {
  const index = BOARD_STAGES.findIndex(s => s.id === stage);
  return index === -1 ? BOARD_STAGES.length : index;
}

const STAGE_TONES = {
  intake: 'neutral',
  triage: 'neutral',
  planning: 'cyan',
  execute: 'blue',
  review: 'purple',
  done: 'green',
  canceled: 'red',
} satisfies Record<BoardStageId, BadgeVariant>;

const stageTones: Record<string, BadgeVariant | undefined> = STAGE_TONES;

/** A stage's colour, so every surface that shows one agrees on it. */
export function stageTone(stage: string): BadgeVariant {
  return stageTones[stage] ?? 'neutral';
}
