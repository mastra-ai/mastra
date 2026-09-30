import type { FactoryTriageType } from '@mastra/factory/rules/types';

import type { WorkItem, WorkItemSource } from '../factory/services/workItems';
import type { BoardStageId } from '../factory/stages';
import { boardStage } from '../factory/stages';
import type { BoardLayout } from './storyBoards';
import { INCIDENTS_BOARD, SECURITY_REVIEW_STAGE } from './storyBoards';
import type { CardFacts } from './storyState';

type SeedCard = {
  id: string;
  board?: string;
  stage: BoardStageId;
  source: WorkItemSource;
  title: string;
  ageHours: number;
  facts: CardFacts;
  triageType?: FactoryTriageType;
  accepted?: boolean;
  commentCount?: number;
  metadata?: Record<string, unknown>;
};

const BUG = { labels: ['bug'], labelColors: { bug: '#d73a4a' } };
const ENHANCEMENT = { labels: ['enhancement'], labelColors: { enhancement: '#a2eeef' } };
const NEEDS_APPROVAL = { labels: ['status: needs approval'], labelColors: { 'status: needs approval': '#fbca04' } };

const SEED_CARDS: SeedCard[] = [
  {
    id: 'story-seed-intake-webhook',
    stage: 'intake',
    source: 'manual',
    title: 'Webhook delivery retries forever on 410',
    ageHours: 2,
    facts: { author: 'shane', owner: 'shane', lastActor: 'shane', origin: 'board' },
  },
  {
    id: 'story-seed-intake-dark-mode',
    stage: 'intake',
    source: 'github-issue',
    title: 'Dark mode flashes white on first paint',
    ageHours: 5,
    triageType: 'feature request',
    metadata: { githubIssueNumber: 9412, ...ENHANCEMENT },
    facts: { author: 'external', owner: 'factory', lastActor: 'factory', origin: 'auto' },
  },
  {
    id: 'story-seed-intake-default-branch',
    stage: 'intake',
    source: 'github-issue',
    title: 'Crash when a repository has no default branch',
    ageHours: 9,
    commentCount: 3,
    metadata: { githubIssueNumber: 9407, ...BUG },
    facts: { author: 'grayson', owner: 'grayson', lastActor: 'ward', origin: 'slack-channel' },
  },
  {
    id: 'story-seed-triage-audit-csv',
    stage: 'triage',
    source: 'github-issue',
    title: 'Export the audit log as CSV',
    ageHours: 20,
    triageType: 'feature request',
    metadata: { githubIssueNumber: 9388, ...ENHANCEMENT },
    facts: { author: 'ward', owner: 'ward', lastActor: 'ward', origin: 'board', funding: 'ward' },
  },
  {
    id: 'story-seed-triage-rate-limiter',
    stage: 'triage',
    source: 'linear-issue',
    title: 'Rate limiter ignores org overrides',
    ageHours: 26,
    triageType: 'bug',
    metadata: { identifier: 'ENG-412', ...NEEDS_APPROVAL },
    facts: {
      author: 'external',
      owner: 'factory',
      lastActor: 'factory',
      origin: 'auto',
      suggestedBy: 'investigate-needs-approval',
    },
  },
  {
    id: 'story-seed-triage-session-list',
    stage: 'triage',
    source: 'github-issue',
    title: 'Session list jumps when a run finishes',
    ageHours: 31,
    triageType: 'bug',
    metadata: { githubIssueNumber: 9371, ...BUG },
    facts: { author: 'grayson', owner: 'grayson', lastActor: 'grayson', origin: 'board', funding: 'grayson' },
  },
  {
    id: 'story-seed-planning-lane-defaults',
    stage: 'planning',
    source: 'linear-issue',
    title: 'Per-lane model defaults',
    ageHours: 50,
    triageType: 'feature request',
    accepted: true,
    commentCount: 5,
    metadata: { identifier: 'ENG-398', ...ENHANCEMENT },
    facts: {
      author: 'damien',
      owner: 'damien',
      lastActor: 'damien',
      origin: 'board',
      funding: 'damien',
      sessionModel: { model: 'Opus 5.5', provider: 'anthropic' },
    },
  },
  {
    id: 'story-seed-planning-retry-threads',
    stage: 'planning',
    source: 'github-issue',
    title: 'Retry every blocked thread from settings',
    ageHours: 44,
    triageType: 'feature request',
    accepted: true,
    metadata: { githubIssueNumber: 9352 },
    facts: {
      author: 'shane',
      owner: 'factory',
      lastActor: 'factory',
      origin: 'auto',
      suggestedBy: 'plan-accepted-work',
    },
  },
  {
    id: 'story-seed-building-billing-copy',
    stage: 'execute',
    source: 'github-issue',
    title: 'Move billing copy into one module',
    ageHours: 70,
    accepted: true,
    commentCount: 2,
    metadata: { githubIssueNumber: 9330 },
    facts: { author: 'ward', owner: 'shane', lastActor: 'ward', origin: 'board', ownedFrom: 'ward' },
  },
  {
    id: 'story-seed-building-approval',
    stage: 'execute',
    source: 'github-issue',
    title: 'Queue migrations behind a feature flag',
    ageHours: 64,
    accepted: true,
    metadata: { githubIssueNumber: 9318 },
    facts: { author: 'external', owner: 'factory', lastActor: 'factory', origin: 'auto', needsHuman: true },
  },
  {
    id: 'story-seed-review-workflow',
    stage: 'review',
    source: 'linear-issue',
    title: 'Changeset check runs on every pull request',
    ageHours: 80,
    accepted: true,
    metadata: { identifier: 'ENG-377' },
    facts: {
      author: 'grayson',
      owner: 'shane',
      lastActor: 'factory',
      origin: 'board',
      workflow: { id: 'pull-request-checks', stepIndex: 2 },
    },
  },
  {
    id: 'story-seed-review-payer-row',
    stage: 'review',
    source: 'github-issue',
    title: 'Show who pays on every board card',
    ageHours: 96,
    accepted: true,
    commentCount: 4,
    metadata: { githubIssueNumber: 9301, reviewVerdict: 'approve', reviewedHeadSha: 'a41c9e2f0b7d' },
    facts: {
      author: 'shane',
      owner: 'shane',
      lastActor: 'factory',
      origin: 'board',
      funding: 'factory',
      movedFrom: 'shane',
    },
  },
  {
    id: 'story-seed-review-lane-pickers',
    stage: 'review',
    source: 'github-issue',
    title: 'Lane headers become model pickers',
    ageHours: 110,
    accepted: true,
    metadata: { githubIssueNumber: 9288, reviewVerdict: 'request changes', reviewedHeadSha: '7c02d19be845' },
    facts: {
      author: 'damien',
      owner: 'factory',
      lastActor: 'factory',
      origin: 'auto',
      suggestedBy: 'review-open-pull-requests',
    },
  },
  {
    id: 'story-seed-done-onboarding',
    stage: 'done',
    source: 'github-issue',
    title: 'Onboarding lets you skip the Factory account',
    ageHours: 170,
    accepted: true,
    metadata: { githubIssueNumber: 9240 },
    facts: { author: 'damien', owner: 'damien', lastActor: 'damien', origin: 'board', funding: 'damien' },
  },
  {
    id: 'story-seed-done-memory',
    stage: 'done',
    source: 'linear-issue',
    title: 'A failing memory model pauses threads instead of hanging',
    ageHours: 200,
    accepted: true,
    metadata: { identifier: 'ENG-341', ...BUG },
    facts: { author: 'ward', owner: 'ward', lastActor: 'factory', origin: 'slack-channel' },
  },
  {
    id: 'story-seed-canceled-reactions',
    stage: 'canceled',
    source: 'github-issue',
    title: 'Mirror Slack reactions onto card comments',
    ageHours: 240,
    triageType: 'feature request',
    metadata: { githubIssueNumber: 9199, ...ENHANCEMENT },
    facts: { author: 'external', owner: 'factory', lastActor: 'grayson', origin: 'auto' },
  },
  {
    id: 'story-seed-security-scan',
    stage: SECURITY_REVIEW_STAGE,
    source: 'github-issue',
    title: 'Sign webhook payloads with rotating keys',
    ageHours: 30,
    accepted: true,
    metadata: { githubIssueNumber: 9362 },
    facts: {
      author: 'grayson',
      owner: 'shane',
      lastActor: 'factory',
      origin: 'board',
      workflow: { id: 'security-review', stepIndex: 1 },
    },
  },
  {
    id: 'story-seed-security-sign-off',
    stage: SECURITY_REVIEW_STAGE,
    source: 'github-issue',
    title: 'Scope API tokens to one repository',
    ageHours: 40,
    accepted: true,
    commentCount: 1,
    metadata: { githubIssueNumber: 9349 },
    facts: {
      author: 'ward',
      owner: 'ward',
      lastActor: 'factory',
      origin: 'board',
      needsHuman: true,
      workflow: { id: 'security-review', stepIndex: 2 },
    },
  },
  {
    id: 'story-seed-incident-reported',
    board: INCIDENTS_BOARD.id,
    stage: 'reported',
    source: 'manual',
    title: 'Checkout latency p99 above 4s',
    ageHours: 1,
    facts: { author: 'external', owner: 'factory', lastActor: 'factory', origin: 'auto' },
  },
  {
    id: 'story-seed-incident-investigate',
    board: INCIDENTS_BOARD.id,
    stage: 'investigate',
    source: 'incidentio-follow-up',
    title: 'Queue workers restarting every 10 minutes',
    ageHours: 3,
    facts: {
      author: 'external',
      owner: 'damien',
      lastActor: 'factory',
      origin: 'auto',
      workflow: { id: 'incident-triage', stepIndex: 1 },
    },
  },
  {
    id: 'story-seed-incident-mitigate',
    board: INCIDENTS_BOARD.id,
    stage: 'mitigate',
    source: 'incidentio-follow-up',
    title: 'Roll back the session cache change',
    ageHours: 6,
    facts: { author: 'ward', owner: 'ward', lastActor: 'ward', origin: 'board' },
  },
  {
    id: 'story-seed-incident-postmortem',
    board: INCIDENTS_BOARD.id,
    stage: 'postmortem',
    source: 'incidentio-follow-up',
    title: 'Postmortem: expired TLS certificate on api-eu',
    ageHours: 30,
    facts: {
      author: 'shane',
      owner: 'shane',
      lastActor: 'factory',
      origin: 'board',
      workflow: { id: 'postmortem-draft', stepIndex: 0 },
    },
  },
];

const FACTS_BY_ID = new Map(SEED_CARDS.map(card => [card.id, card.facts]));

export function storySeedFacts(itemId: string): CardFacts | undefined {
  return FACTS_BY_ID.get(itemId);
}

export function isStorySeedItem(itemId: string): boolean {
  return FACTS_BY_ID.has(itemId);
}

function onLayout(card: SeedCard, layout: BoardLayout): boolean {
  return layout === 'custom' || boardStage(card.stage) !== undefined;
}

export function storySeedItems(factoryProjectId: string, now: number, kind: string, layout: BoardLayout): WorkItem[] {
  const cards = SEED_CARDS.filter(card => (card.board ?? 'work') === kind && onLayout(card, layout));
  return cards.map(card => {
    const createdAt = new Date(now - card.ageHours * 3_600_000).toISOString();
    return {
      id: card.id,
      orgId: 'storyboard',
      createdBy: 'factory',
      githubProjectId: factoryProjectId,
      board: kind,
      source: card.source,
      sourceKey: null,
      parentWorkItemId: null,
      title: card.title,
      url: null,
      stages: [card.stage],
      stageHistory: [{ stage: card.stage, enteredAt: createdAt, by: 'factory' }],
      sessions: {},
      metadata: { sourceCreatedAt: createdAt, ...card.metadata },
      triageType: card.triageType ?? null,
      acceptedAt: card.accepted ? createdAt : null,
      commentCount: card.commentCount ?? 0,
      feedActivityAt: null,
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    };
  });
}
