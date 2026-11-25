import { describe, expect, it } from 'vitest';

import { reviewBoard } from './review.js';
import { boardDefinitionOf } from './stored-board.js';
import { workSeedWithSelfReview } from './work-migrations.js';
import { workSeedWithTriage } from './work-seeds.js';
import { workBoard } from './work.js';

/** Every board definition Factory ships, as projects store it. */
const BUNDLED = {
  work: boardDefinitionOf(workBoard),
  'work with triage': workSeedWithTriage(),
  'work with self-review': workSeedWithSelfReview(),
  review: boardDefinitionOf(reviewBoard),
};

describe('bundled boards', () => {
  it.each(Object.entries(BUNDLED))('%s describes every phase', (_name, board) => {
    for (const phase of board.phases) {
      expect(phase.description?.trim(), `phase "${phase.key}"`).toBeTruthy();
    }
  });
});
