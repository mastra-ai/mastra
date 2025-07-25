import { MastraScorer } from './base';
import type { ScorerOptions } from './types';

export function createScorer(opts: ScorerOptions) {
  const scorer = new MastraScorer({
    name: opts.name,
    description: opts.description,
    extract: opts.extract,
    analyze: opts.analyze,
    reason: opts.reason,
  });

  return scorer;
}
