export { toJsonl, toJsonlBuffer, parseJsonl, parseJsonlBuffer, streamJsonlLines } from './jsonl';

export { renderSftJsonl, renderSftJsonlWithOptions, getSftStats, type SftRenderOptions } from './sft-renderer';

export {
  renderDpoJsonl,
  renderSimpleDpoJsonl,
  renderDpoJsonlWithOptions,
  getDpoStats,
  type DpoRenderOptions,
} from './dpo-renderer';

import type { TrainingMethod, Scorecard } from '../types';
import { renderSftJsonl } from './sft-renderer';
import { renderDpoJsonl } from './dpo-renderer';
import { getSftStats } from './sft-renderer';
import { getDpoStats } from './dpo-renderer';

/**
 * Render training data based on method.
 */
export function renderTrainingData(method: TrainingMethod, data: Scorecard[]): Uint8Array {
  switch (method) {
    case 'sft':
      return renderSftJsonl(data);
    case 'dpo':
      return renderDpoJsonl(data);
    default:
      throw new Error(`Unknown training method: ${method}`);
  }
}

/**
 * Render validation data based on method.
 */
export function renderValidationData(method: TrainingMethod, data: Scorecard[]): Uint8Array {
  switch (method) {
    case 'sft':
      return renderSftJsonl(data);
    case 'dpo':
      return renderDpoJsonl(data);
    default:
      throw new Error(`Unknown training method: ${method}`);
  }
}

/**
 * Get stats for training data based on method.
 */
export function getTrainingStats(method: TrainingMethod, data: Scorecard[]): Record<string, unknown> {
  switch (method) {
    case 'sft':
      return getSftStats(data);
    case 'dpo':
      return getDpoStats(data);
    default:
      throw new Error(`Unknown training method: ${method}`);
  }
}
