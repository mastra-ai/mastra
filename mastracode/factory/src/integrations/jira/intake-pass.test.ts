/**
 * The pass that keeps a project's Intake candidates, end to end on Jira: real bindings, card and
 * candidate storage, the real Jira rules and the real dispatcher, with only Jira faked at the HTTP
 * edge. Jira sends the server no events, so every state a record can be in is reached here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../../boards/index.js';
import { FactoryDecisionDispatcher } from '../../rules/dispatcher.js';
import { FactoryTransitionService } from '../../rules/transition-service.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../../storage/test-utils.js';
import type { IntegrationContext } from '../base.js';
import { readIntakePassStatus } from '../intake-pass.js';
import type { IntakePass } from '../intake-pass.js';
import { attachJiraIntakePass } from './intake-pass.js';
import { JiraIntegration } from './integration.js';
import { JiraRules } from './rules.js';
import { jiraIssuePayload, matchesJql } from './test-utils.js';
import type { FakeJiraIssue } from './test-utils.js';

const OPS = { projectId: '10000', projectKey: 'OPS' };
const BOUND_AT = '2026-01-05T09:00:00.000Z';
const BEFORE_BINDING = '2025-11-01T00:00:00Z';

interface ListedIssue extends FakeJiraIssue {
  /** Defaults to a time after the source was bound. */
  created?: string;
  summary?: string;
}

const issue = (key: string, extra: Partial<ListedIssue> = {}): ListedIssue => ({ key, labels: [], ...OPS, ...extra });

describe('the intake pass on Jira', () => {
  let seed: FactoryStorageTestSeed;
  let intakePass: IntakePass;
  let factoryProjectId: string;
  /** What Jira holds; its id is its place in this list, so an issue keeps its id while listed. */
  let issues: ListedIssue[];
  let jiraIsDown: boolean;
  let searches: number;
  let offered: ReturnType<typeof vi.spyOn<JiraRules, 'ingest'>>;

  const scope = () => ({ orgId: 'org1', factoryProjectId });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(BOUND_AT));
    issues = [];
    jiraIsDown = false;
    searches = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: URL | string, init?: RequestInit) => {
        const target = String(input);
        if ((init?.method ?? 'GET') !== 'POST' || !target.includes('/rest/api/3/search/jql')) {
          throw new Error(`Unexpected request: ${target}`);
        }
        searches += 1;
        if (jiraIsDown) return new Response('{}', { status: 503 });
        const { jql } = JSON.parse(String(init?.body)) as { jql: string };
        const page = issues.flatMap((listed, index) => {
          if (!matchesJql(jql, listed)) return [];
          const payload = jiraIssuePayload(listed, String(20_000 + index)) as { fields: Record<string, unknown> };
          return [
            {
              ...payload,
              fields: {
                ...payload.fields,
                ...(listed.created ? { created: listed.created } : {}),
                ...(listed.summary ? { summary: listed.summary } : {}),
              },
            },
          ];
        });
        return new Response(JSON.stringify({ issues: page }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    offered = vi.spyOn(JiraRules.prototype, 'ingest');

    seed = await createFactoryStorageForTests();
    const jira = new JiraIntegration({ baseUrl: 'https://acme.atlassian.net', email: 'ops@acme.test', apiToken: 't' });
    intakePass = attachJiraIntakePass(jira, {
      storage: { generic: seed.integrations.forIntegration('jira'), projects: seed.projects, intake: seed.intake },
      runtime: { configVersion: 'factory-config-v1', workItems: seed.workItems, boards: createBoardRegistry() },
    } as unknown as IntegrationContext)!;

    factoryProjectId = (await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'platform' } })).id;
    await seed.intake.saveConfig({ orgId: 'org1', config: { jira: { enabled: true, sourceIds: [OPS.projectId] } } });
    await seed.intake.setSharedBinding({
      orgId: 'org1',
      integrationId: 'jira',
      sourceId: OPS.projectId,
      factoryProjectId,
      labels: null,
    });
    vi.setSystemTime(new Date('2026-01-05T09:10:00.000Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const candidates = async () =>
    (await seed.workItems.listIntakeCandidates({ ...scope(), limit: 100 })).candidates
      .map(candidate => String(candidate.source.metadata.identifier))
      .sort();
  const cards = async () => (await seed.workItems.list(scope())).map(card => String(card.workItem.key)).sort();
  /** Every issue the rules were handed, across all passes so far. */
  const offeredIssues = () =>
    offered.mock.calls.flatMap(([input]) => input.issues.map(offeredIssue => offeredIssue.identifier)).sort();
  const fileProposedCards = async () => {
    const boards = createBoardRegistry();
    await new FactoryDecisionDispatcher({
      controller: {} as never,
      storage: seed.workItems,
      boards,
      transitionService: new FactoryTransitionService({
        storage: seed.workItems,
        boards,
        configVersion: 'factory-config-v1',
      }),
      factoryProjectExists: async () => true,
      ownerId: 'intake-pass-test',
    }).runOnce(new Date(Date.now() + 1_000));
  };
  const status = () =>
    readIntakePassStatus(seed.integrations.forIntegration('jira').settings, { ...scope(), kind: 'issue' });

  it('hands a new issue to the rules once and offers it in Intake until its card is filed', async () => {
    issues = [issue('OPS-1'), issue('OPS-2')];

    expect(await intakePass()).toMatchObject({ failed: 0, offered: 2, stored: 2 });
    expect(await candidates()).toEqual(['OPS-1', 'OPS-2']);
    expect(await cards()).toEqual([]);

    // The cards are not filed yet, and the next pass must not hand the same issues over again.
    expect(await intakePass()).toMatchObject({ failed: 0, offered: 0, stored: 0 });
    expect(offeredIssues()).toEqual(['OPS-1', 'OPS-2']);

    const [first] = (await seed.workItems.listIntakeCandidates({ ...scope(), limit: 100 })).candidates;
    await fileProposedCards();
    expect(await cards()).toEqual(['OPS-1', 'OPS-2']);
    expect(await candidates()).toEqual([]);
    // Filing adopts the candidate: the card stands on the work item Intake was offering.
    const filed = await seed.workItems.getByProjectSource({ ...scope(), source: first!.externalSource });
    expect(filed?.workItem.id).toBe(first!.workItemId);

    expect(await intakePass()).toMatchObject({ failed: 0, offered: 0, stored: 0, removed: 0 });
    expect(offeredIssues()).toEqual(['OPS-1', 'OPS-2']);
  });

  it('offers an issue older than the binding in Intake without handing it to the rules', async () => {
    issues = [issue('OPS-1')];
    await intakePass();
    await fileProposedCards();

    // Reopened in Jira after the import that binding runs: it predates the binding.
    issues = [issue('OPS-1'), issue('OPS-9', { created: BEFORE_BINDING })];
    expect(await intakePass()).toMatchObject({ failed: 0, offered: 0, stored: 1 });

    expect(await candidates()).toEqual(['OPS-9']);
    expect(offeredIssues()).toEqual(['OPS-1']);
    await fileProposedCards();
    expect(await cards()).toEqual(['OPS-1']);
  });

  it('hands the newest issues of a just-bound source to the rules, however old they are', async () => {
    issues = [issue('OPS-1', { created: BEFORE_BINDING })];

    expect(await intakePass()).toMatchObject({ failed: 0, offered: 1 });

    expect(offeredIssues()).toEqual(['OPS-1']);
    expect((await status())?.imported).toEqual({ [OPS.projectId]: BOUND_AT });
  });

  it('refreshes a candidate Jira changed and writes nothing for one it did not', async () => {
    issues = [issue('OPS-9', { created: BEFORE_BINDING })];
    await intakePass();
    await intakePass();
    const changed = vi.fn();
    seed.workItems.onIntakeChanged(changed);
    const written = vi.spyOn(seed.workItems, 'storeIntakeCandidate');

    expect(await intakePass()).toMatchObject({ failed: 0, stored: 0 });
    expect(changed).not.toHaveBeenCalled();
    expect(written).not.toHaveBeenCalled();

    issues = [issue('OPS-9', { created: BEFORE_BINDING, summary: 'Renamed in Jira' })];
    expect(await intakePass()).toMatchObject({ failed: 0, offered: 0, stored: 1 });
    expect(changed).toHaveBeenCalledTimes(1);
    const [candidate] = (await seed.workItems.listIntakeCandidates({ ...scope(), limit: 100 })).candidates;
    expect(candidate?.title).toBe('Renamed in Jira');
  });

  it('stops offering an issue Jira no longer lists as open', async () => {
    issues = [issue('OPS-8', { created: BEFORE_BINDING }), issue('OPS-9', { created: BEFORE_BINDING })];
    await intakePass();
    await intakePass();
    expect(await candidates()).toEqual(['OPS-8', 'OPS-9']);

    issues = [issue('OPS-8', { created: BEFORE_BINDING, done: true }), issue('OPS-9', { created: BEFORE_BINDING })];
    expect(await intakePass()).toMatchObject({ failed: 0, removed: 1 });

    expect(await candidates()).toEqual(['OPS-9']);
  });

  it('removes nothing and says so when Jira cannot be read, then recovers', async () => {
    issues = [issue('OPS-9', { created: BEFORE_BINDING })];
    await intakePass();
    await intakePass();
    const read = (await status())?.completeAt;
    expect(read).toBeTruthy();

    vi.setSystemTime(new Date('2026-01-05T09:20:00.000Z'));
    jiraIsDown = true;
    issues = [];
    expect(await intakePass()).toMatchObject({ failed: 1, removed: 0 });

    expect(await candidates()).toEqual(['OPS-9']);
    expect(await status()).toMatchObject({ completeAt: read, failedAt: '2026-01-05T09:20:00.000Z' });

    vi.setSystemTime(new Date('2026-01-05T09:25:00.000Z'));
    jiraIsDown = false;
    expect(await intakePass()).toMatchObject({ failed: 0, removed: 1 });
    expect(await candidates()).toEqual([]);
    expect(await status()).toMatchObject({ completeAt: '2026-01-05T09:25:00.000Z', failedAt: null, error: null });
  });

  it('offers an open issue again in Intake once its card is deleted, without refiling it', async () => {
    issues = [issue('OPS-1')];
    await intakePass();
    await fileProposedCards();
    const [card] = await seed.workItems.list(scope());

    await seed.workItems.delete({ orgId: 'org1', id: card!.id });
    expect(await candidates()).toEqual(['OPS-1']);

    expect(await intakePass()).toMatchObject({ failed: 0, offered: 0 });
    await fileProposedCards();
    expect(offeredIssues()).toEqual(['OPS-1']);
    expect(await cards()).toEqual([]);
    expect(await candidates()).toEqual(['OPS-1']);
  });

  it('clears the candidates of a source the project no longer takes records from', async () => {
    issues = [issue('OPS-9', { created: BEFORE_BINDING })];
    await intakePass();
    await intakePass();
    expect(await candidates()).toEqual(['OPS-9']);

    await seed.intake.clearBinding({ orgId: 'org1', integrationId: 'jira', sourceId: OPS.projectId, factoryProjectId });
    const before = searches;
    expect(await intakePass()).toMatchObject({ failed: 0, removed: 1 });

    expect(await candidates()).toEqual([]);
    expect(searches).toBe(before);
  });

  it('asks Jira the same number of times beside 1 card and beside 60', async () => {
    issues = [issue('OPS-1'), issue('OPS-9', { created: BEFORE_BINDING })];
    await intakePass();
    await fileProposedCards();
    const callsOf = async () => {
      const before = searches;
      expect(await intakePass()).toMatchObject({ failed: 0 });
      return searches - before;
    };
    const besideOneCard = await callsOf();

    for (let index = 0; index < 59; index += 1) {
      await seed.workItems.upsert({
        ...scope(),
        userId: 'u1',
        input: { title: `Native card ${index}`, phase: 'backlog' } as never,
      });
    }

    expect(besideOneCard).toBe(1);
    expect(await callsOf()).toBe(besideOneCard);
  });
});
