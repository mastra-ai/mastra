import { useId } from 'react';
import type { ComponentType } from 'react';

import type { StarterKind } from '../../../factory/starterPrompts';
import { StarterBugArt } from './art/starter-bug-art';
import { StarterDecideArt } from './art/starter-decide-art';
import { StarterFeedbackArt } from './art/starter-feedback-art';
import { StarterReviewArt } from './art/starter-review-art';
import { StarterStaleArt } from './art/starter-stale-art';
import { StarterSweepArt } from './art/starter-sweep-art';
import { StarterTriageArt } from './art/starter-triage-art';
import { StarterUnblockArt } from './art/starter-unblock-art';

const ART: Record<StarterKind, ComponentType<{ id: string }>> = {
  bug: StarterBugArt,
  decide: StarterDecideArt,
  feedback: StarterFeedbackArt,
  review: StarterReviewArt,
  stale: StarterStaleArt,
  sweep: StarterSweepArt,
  triage: StarterTriageArt,
  unblock: StarterUnblockArt,
};

export function StarterArt({ kind }: { kind: StarterKind }) {
  const id = useId();
  const Art = ART[kind];
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden
      className="text-foreground pointer-events-none absolute top-1.5 right-1.5 size-20 [--color-background:var(--color-card)] max-sm:hidden dark:[--color-background:var(--color-muted)] [&_*]:[vector-effect:non-scaling-stroke]"
    >
      <Art id={id} />
    </svg>
  );
}
