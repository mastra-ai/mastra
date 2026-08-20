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
  id => id !== 'intake' && id !== 'done' && id !== 'canceled',
);

/** UI label for a stage, falling back to the raw id for unknown stages. */
export function stageLabel(stage: string): string {
  return BOARD_STAGES.find(s => s.id === stage)?.label ?? stage;
}

/** Position of a stage in the board's column order; unknown stages sort last. */
export function stageOrder(stage: string): number {
  const index = BOARD_STAGES.findIndex(s => s.id === stage);
  return index === -1 ? BOARD_STAGES.length : index;
}

/**
 * Stage hue, shared by every chart so one colour means one stage everywhere.
 * Tailwind cannot build class names at runtime, so both paints are spelled out.
 */
interface StagePaint {
  fill: string;
  stroke: string;
  /** The raw token, for gradient stops — SVG stops take a colour, not a class. */
  color: string;
}

const STAGE_PAINT = {
  intake: { fill: 'fill-icon2', stroke: 'stroke-icon2', color: 'var(--color-icon2)' },
  triage: { fill: 'fill-stage-triage', stroke: 'stroke-stage-triage', color: 'var(--color-stage-triage)' },
  planning: { fill: 'fill-stage-planning', stroke: 'stroke-stage-planning', color: 'var(--color-stage-planning)' },
  execute: { fill: 'fill-stage-execute', stroke: 'stroke-stage-execute', color: 'var(--color-stage-execute)' },
  review: { fill: 'fill-stage-review', stroke: 'stroke-stage-review', color: 'var(--color-stage-review)' },
  done: { fill: 'fill-positive1', stroke: 'stroke-positive1', color: 'var(--color-positive1)' },
  canceled: { fill: 'fill-icon2', stroke: 'stroke-icon2', color: 'var(--color-icon2)' },
} satisfies Record<BoardStageId, StagePaint>;

const PAINT_BY_STAGE: Record<string, StagePaint> = STAGE_PAINT;

export function stagePaint(stage: string): StagePaint {
  return PAINT_BY_STAGE[stage] ?? STAGE_PAINT.intake;
}
