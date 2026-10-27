import type { RuleGroup } from '../../rules/rule-group.js';
import type { ProjectBoardConfigInput, StoredBoardInput } from '../../storage/domains/boards/validation.js';
import { CODE_AGENT_ID } from '../agents.js';

const TRIAGE = { type: 'agent', agentId: CODE_AGENT_ID, skill: 'factory-triage', context: 'triage' } as const;
const REVIEW = { type: 'agent', agentId: CODE_AGENT_ID, skill: 'factory-review', context: 'review' } as const;
const COMPLETE = {
  type: 'agent',
  agentId: CODE_AGENT_ID,
  skill: 'factory-complete-issue',
  context: 'triage',
} as const;

/** Cards labelled `effort: low` plan without waiting for anyone. */
const LOW_EFFORT: RuleGroup = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort: low' }],
};
/**
 * Stored form of the built-in Work board, seeded into each project. Phase keys
 * and names match the code board in `boards/work.ts` so existing cards keep
 * their `board`/`stages` values. Every phase runs on Factory's code agent; each phase's built-in
 * skill brings the code that decides each run (PR auto-review, self-review, source fetch hints).
 * Planning and Building share the `build` context, so the builder implements the plan it holds.
 * Building is a status: entering it sets a goal on that session, so it keeps working until the change is handed
 * on. Its `factory-build` skill only runs when review sends findings back.
 * Review's built-in runner still reviews in its own `review` context, apart from the builder.
 * The pipeline is explicit: Triage → Planning or Review, Planning → Building, Building → Review,
 * Review → Building for rework. Event routes obey this graph too; a destination omitted from
 * a phase's nextPhases is rejected rather than silently added by an integration.
 */
export const workBoardTemplate = {
  key: 'work',
  name: 'Work',
  description: 'Issues and pull requests from intake to done.',
  phases: [
    { key: 'intake', name: 'Intake', kind: 'resting' },
    // Triage and Review start on their own. Planning starts on its own only for low-effort
    // cards; any other card's plan waits for a person to approve the run.
    {
      key: 'triage',
      name: 'Triage',
      kind: 'working',
      runner: TRIAGE,
      autoStart: true,
      nextPhases: ['intake', 'planning', 'review', 'done', 'canceled'],
    },
    {
      key: 'planning',
      name: 'Planning',
      kind: 'working',
      runner: { type: 'agent', agentId: CODE_AGENT_ID, skill: 'factory-plan', context: 'build' },
      exitTool: 'submit_plan',
      autoStart: true,
      autoStartWhen: LOW_EFFORT,
      nextPhases: ['execute', 'canceled'],
    },
    {
      key: 'execute',
      name: 'Building',
      kind: 'working',
      runner: { type: 'agent', agentId: CODE_AGENT_ID, skill: 'factory-build', context: 'build' },
      nextPhases: ['review', 'done', 'canceled'],
    },
    {
      key: 'review',
      name: 'Review',
      kind: 'working',
      runner: REVIEW,
      autoStart: true,
      nextPhases: ['execute', 'done', 'canceled'],
    },
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
