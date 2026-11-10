/**
 * Skills Factory's code runs in the built-in boards' phases. The handlers pick them per card at run
 * time, so the stored phases don't name them. Mirrors `mastracode/factory/src/boards/work.ts` and
 * `pull-request-review.ts`.
 */
const PULL_REQUEST_REVIEW = ['factory-review', 'factory-rereview', 'factory-gitlab-review', 'factory-gitlab-rereview'];

const CODE_SKILLS: Record<string, Record<string, readonly string[]>> = {
  work: {
    triage: ['factory-triage'],
    planning: ['factory-plan'],
    // Building runs no skill: its handler writes the prompt.
    execute: [],
    review: ['factory-self-review'],
    'pr-review': PULL_REQUEST_REVIEW,
    // Runs when an issue's card arrives, to close the issue.
    done: ['factory-complete-issue'],
  },
  review: { review: PULL_REQUEST_REVIEW },
};

/**
 * The skills Factory's code may run in a built-in board's phase, most common first. Empty when the
 * code runs no skill; undefined when the phase isn't one of the built-in boards' code phases.
 */
export function codeSkillsOf(boardId: string, phaseKey: string): readonly string[] | undefined {
  return CODE_SKILLS[boardId]?.[phaseKey];
}

/** Every skill Factory's code runs somewhere on a built-in board. */
export function codeSkillsOfBoard(boardId: string): readonly string[] {
  return Object.values(CODE_SKILLS[boardId] ?? {}).flat();
}
