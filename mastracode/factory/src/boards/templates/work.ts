import type { ProjectBoardConfigInput, StoredBoardInput } from '../../storage/domains/boards/validation.js';

const TRIAGE = { type: 'agent', agentId: 'factory-triage', skill: 'factory-triage', context: 'triage' } as const;
const REVIEW = { type: 'agent', agentId: 'factory-review', skill: 'factory-review', context: null } as const;
const COMPLETE = {
  type: 'agent',
  agentId: 'factory-complete',
  skill: 'factory-complete-issue',
  context: 'triage',
} as const;

/**
 * Stored form of the built-in Work board, seeded into each project. Phase keys
 * and names match the code board in `boards/work.ts` so existing cards keep
 * their `board`/`stages` values. Each phase's agent activates the skill it always has; the agent id
 * names the built-in runner that decides when (PR auto-review, self-review, source fetch hints).
 * Building activates no skill, so it names its code runner directly.
 * Building and Review work in the card's main context, so the builder answers feedback on its own change.
 * Review's built-in runner still reviews in its own `review` context, apart from the builder.
 * No phase declares `nextPhases`: any move is allowed, like the code board.
 */
export const workBoardTemplate = {
  key: 'work',
  name: 'Work',
  description: 'Issues and pull requests from intake to done.',
  phases: [
    { key: 'intake', name: 'Intake', kind: 'resting' },
    { key: 'triage', name: 'Triage', kind: 'working', runner: TRIAGE },
    {
      key: 'planning',
      name: 'Planning',
      kind: 'working',
      runner: { type: 'agent', agentId: 'factory-plan', skill: 'factory-plan', context: 'plan' },
      exitTool: 'submit_plan',
      // Triage runs on its own; a person decides what gets planned.
      manualEntry: true,
    },
    { key: 'execute', name: 'Building', kind: 'working', runner: { type: 'workflow', workflowId: 'factory-build' } },
    { key: 'review', name: 'Review', kind: 'working', runner: REVIEW },
    { key: 'done', name: 'Done', kind: 'terminal', runner: COMPLETE },
    { key: 'canceled', name: 'Canceled', kind: 'terminal' },
  ],
  eventRoutes: [
    // Event routes decide where a move the integration's rule proposes lands; the rule keeps its gates
    // (trusted actor, Factory-authored, recorded verdict, PR still open).
    // A pull request that belongs to a card moves it to Review from wherever it is: Factory opens one
    // from Building, and one that fixes the card's issue can arrive before Factory builds anything.
    { event: 'pull_request.opened', toPhaseKey: 'review' },
    {
      event: 'pull_request.merged',
      when: {
        operator: 'AND',
        conditions: [{ field: 'item.hasOtherOpenPullRequest', operator: 'equals', value: false }],
      },
      toPhaseKey: 'done',
    },
    {
      event: 'pull_request.closed',
      when: {
        operator: 'AND',
        conditions: [{ field: 'item.hasOtherOpenPullRequest', operator: 'equals', value: false }],
      },
      toPhaseKey: 'canceled',
    },
    { event: 'pull_request.review_requested', toPhaseKey: 'review' },
    { event: 'pull_request.updated', toPhaseKey: 'review' },
    {
      event: 'issue.closed',
      when: {
        operator: 'AND',
        conditions: [{ field: 'issue.stateReason', operator: 'in', value: ['not_planned', 'duplicate'] }],
      },
      toPhaseKey: 'canceled',
    },
    { event: 'issue.closed', toPhaseKey: 'done' },
  ],
} as const satisfies StoredBoardInput;

/** What a project gets when it has no stored boards: the Work board, with pull requests and issues arriving in Triage. */
export const defaultProjectBoardConfig = {
  boards: [workBoardTemplate],
  intakeRoutes: [
    {
      when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
      boardKey: 'work',
      phaseKey: 'triage',
    },
    // Issues start in Triage so triage runs on arrival; a repository bound to another board still wins.
    { boardKey: 'work', phaseKey: 'triage' },
  ],
} as const satisfies ProjectBoardConfigInput;
