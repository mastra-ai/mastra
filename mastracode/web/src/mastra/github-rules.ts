import type { GithubRuleOverrides } from '@mastra/factory';
import { defaultGithubRules } from '@mastra/factory/integrations/github/default-rules';
import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';

/**
 * Maintainer-applied label for an issue that needs a person's attention before
 * Factory works on it.
 */
const NEEDS_TRIAGE_LABEL = 'needs-triage';

/** GitHub labels are case-insensitive, and labels reach us as their author typed them. */
function has(labels: readonly string[], label: string): boolean {
  return labels.some(candidate => candidate.toLowerCase() === label);
}

/**
 * GitHub event rules this deployment overrides.
 *
 * A newly opened issue is routed by its labels, three ways:
 *
 * - `needs-triage` lands on Work › Intake and rests there until a person starts
 *   a run. A maintainer's explicit "needs attention" flag outranks any
 *   automated stamp, so the label wins even when `status: auto-triaged` is
 *   present too.
 * - `status: auto-triaged` — the label the triage skill applies when it
 *   finishes — is filed straight on Work › Planning, and nothing is started for
 *   it: the card is published to the board (a person may pick it up and run the
 *   planning phase), not launched. Triage already happened, so re-running it
 *   would be work done twice.
 * - neither label says who should look at it first, so it lands on Work ›
 *   Triage: that phase's entry rule runs the moment the card materializes,
 *   putting the triage agent on it and leaving the card ready to plan.
 *
 * The same rule answers for an issue whose card already exists — the reconcile
 * sweep replays it whenever the issue's live labels differ from the card's, so
 * a label gained or lost while Factory was not looking still lands the card
 * where the labels put it. A card that has already left Intake is re-placed by
 * relocation (no phase rule runs for it, per the `skipRules` contract) because
 * it is not arriving: it sits past the landing phase precisely because a
 * placement put it there. A card still resting on Intake is landed normally, so
 * Triage's entry rule runs and can start it.
 *
 * Issues placed by one of a project's own label routes keep the built-in
 * landing as well: the route owns the board and its initial phase.
 */
export const githubRules: GithubRuleOverrides = {
  issueOpened: context => {
    const decision = defaultGithubRules.issueOpened(context);
    if (!decision || !context.issue) return decision;
    // A project label route owns the board and its initial phase.
    if (context.intake) return decision;
    const labels = context.issue.labels ?? [];
    // `decision.stage` is the landing phase a fresh arrival would get: a card
    // already past it is being re-placed, not entered.
    const moved =
      context.item !== undefined &&
      ((context.board !== undefined && context.board !== decision.board) ||
        !context.item.stages.includes(decision.stage));
    if (has(labels, NEEDS_TRIAGE_LABEL)) return moved ? { ...decision, skipRules: true } : decision;
    if (has(labels, AUTO_TRIAGED_LABEL)) return { ...decision, stage: 'planning', skipRules: true };
    return moved ? { ...decision, stage: 'triage', skipRules: true } : { ...decision, stage: 'triage' };
  },
};
