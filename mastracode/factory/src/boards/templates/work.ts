import type { ProjectBoardConfigInput, StoredBoardInput } from '../../storage/domains/boards/validation.js';

/**
 * Stored form of the built-in Work board, seeded into each project. Phase keys
 * and names match the code board in `boards/work.ts` so existing cards keep
 * their `board`/`stages` values. Runners name built-in code runners by id.
 * No phase declares `nextPhases`: any move is allowed, like the code board.
 */
export const workBoardTemplate = {
  key: 'work',
  name: 'Work',
  description: 'Issues and pull requests from intake to done.',
  phases: [
    { key: 'intake', name: 'Intake', kind: 'resting' },
    { key: 'triage', name: 'Triage', kind: 'working', runner: { type: 'workflow', workflowId: 'factory-triage' } },
    {
      key: 'planning',
      name: 'Planning',
      kind: 'working',
      runner: { type: 'workflow', workflowId: 'factory-plan' },
      exitTool: 'submit_plan',
    },
    { key: 'execute', name: 'Building', kind: 'working', runner: { type: 'workflow', workflowId: 'factory-build' } },
    { key: 'review', name: 'Review', kind: 'working', runner: { type: 'workflow', workflowId: 'factory-review' } },
    { key: 'done', name: 'Done', kind: 'terminal', runner: { type: 'workflow', workflowId: 'factory-complete' } },
    { key: 'canceled', name: 'Canceled', kind: 'terminal' },
  ],
  eventRoutes: [
    // Event routes decide where a move the integration's rule proposes lands; the rule keeps its gates
    // (trusted actor, Factory-authored, recorded verdict, PR still open).
    { event: 'pull_request.opened', fromPhases: ['execute'], toPhaseKey: 'review' },
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

/** What a project gets when it has no stored boards: the Work board, PRs into Triage, everything else into Intake. */
export const defaultProjectBoardConfig = {
  boards: [workBoardTemplate],
  intakeRoutes: [
    {
      when: { operator: 'AND', conditions: [{ field: 'source.kind', operator: 'equals', value: 'pull_request' }] },
      boardKey: 'work',
      phaseKey: 'triage',
    },
    { boardKey: 'work' },
  ],
} as const satisfies ProjectBoardConfigInput;
