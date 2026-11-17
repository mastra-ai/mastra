import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { FactoryDecisionDispatcher } from '../rules/dispatcher.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { resolveIncidentioRules } from './incidentio/default-rules.js';
import { IncidentioRules } from './incidentio/rules.js';
import { resolveJiraRules } from './jira/default-rules.js';
import { JiraRules } from './jira/rules.js';
import { resolveLinearRules } from './linear/default-rules.js';
import { LinearRules } from './linear/rules.js';

type Seeded = Awaited<ReturnType<typeof createFactoryStorageForTests>>;
type Scope = { orgId: string; userId: string; factoryProjectId: string };
type Item = Record<string, unknown> & { labels: string[]; updatedAt: string };
interface Provider {
  name: string;
  item: Item;
  sync(seeded: Seeded, boards: BoardRegistry, scope: Scope, item: Item): Promise<unknown>;
}

const common = { title: 'Fix intake sync', stateType: 'unstarted', priorityLabel: 'High', labels: ['bug'] };
const created = '2026-07-01T00:00:00Z';
// Linear, Jira and incident.io are polled: each sync hands over the item as it is now.
const PROVIDERS: Provider[] = [
  {
    name: 'Linear',
    item: { ...common, id: 'issue-1', identifier: 'ENG-42', url: 'https://linear.app/acme/issue/ENG-42', state: 'Todo', assignee: 'ada', creator: 'grace', team: 'ENG', createdAt: created, updatedAt: created },
    sync: (seeded, boards, scope, item) =>
      new LinearRules({ projects: seeded.projects, storage: seeded.workItems, configVersion: 'v1', boards, linearRules: resolveLinearRules() }).ingest({ ...scope, issues: [item as never] }),
  },
  {
    name: 'Jira',
    item: { ...common, id: 'jira-issue:conn-1:ENG-42:10001', identifier: 'ENG-42', url: 'https://acme.atlassian.net/browse/ENG-42', state: 'To Do', assignee: 'ada', author: 'grace', project: 'ENG', site: 'acme.atlassian.net', createdAt: created, updatedAt: created },
    sync: (seeded, boards, scope, item) =>
      new JiraRules({ projects: seeded.projects, storage: seeded.workItems, configVersion: 'v1', boards, jiraRules: resolveJiraRules() }).ingest({ ...scope, issues: [item as never] }),
  },
  {
    name: 'incident.io',
    item: { ...common, id: 'incidentio:follow-up:01HFOLLOWUP', identifier: 'INC-42', url: 'https://app.incident.io/org/follow-ups/01HFOLLOWUP', state: 'outstanding', assignee: 'Grace Hopper', author: 'Ada Lovelace', incident: 'INC-42', createdAt: created, updatedAt: created },
    sync: (seeded, boards, scope, item) =>
      new IncidentioRules({ projects: seeded.projects, storage: seeded.workItems, configVersion: 'v1', boards, incidentioRules: resolveIncidentioRules() }).ingest({ ...scope, issues: [item as never] }),
  },
];

const SHIP = { field: 'event.labels.added', operator: 'contains', value: 'ship' } as const;

async function setup(provider: Provider, options: { onlyShipFiles?: boolean } = {}) {
  const seeded = await createFactoryStorageForTests();
  const boards = createBoardRegistry();
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'acme/repo' } });
  const routeScope = { orgId: 'org-1', factoryProjectId: project.id };
  if (options.onlyShipFiles) {
    for (const route of (await seeded.boards.listIntakeRoutes(routeScope)).reverse()) {
      await seeded.boards.deleteIntakeRoute(routeScope, route.id, { expectedRevision: route.revision });
    }
    await seeded.boards.createIntakeRoute(
      routeScope,
      {
        name: 'Ship issues go to Work',
        on: ['work_item.opened'],
        when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: 'ship' }] },
        target: { boardKey: 'work', phaseKey: 'intake' },
      },
      'admin',
    );
  } else {
    await seeded.boards.createIntakeRoute(
      routeScope,
      { name: 'Ship it', on: ['work_item.updated'], when: { operator: 'AND', conditions: [SHIP] }, target: { boardKey: 'work', phaseKey: 'done' } },
      'admin',
    );
  }
  const dispatcher = new FactoryDecisionDispatcher({
    controller: {} as never,
    storage: seeded.workItems,
    boards,
    transitionService: new FactoryTransitionService({ storage: seeded.workItems, boards, configVersion: 'v1' }),
    intakeRoutes: seeded.boards,
    intakeEvaluator: 'intake-order',
    ownerId: 'polled-updates',
  });
  const scope = { orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id };
  const sync = (updatedAt: string, labels: string[]) => provider.sync(seeded, boards, scope, { ...provider.item, labels, updatedAt });
  const drain = () => dispatcher.runOnce(new Date(Date.now() + 60_000));
  const cards = async () => seeded.workItems.list({ orgId: 'org-1', factoryProjectId: project.id });
  const file = async () => {
    await sync(created, ['bug']);
    await drain();
    // The first sync after filing records what the card shows: it changed nothing.
    await sync(created, ['bug']);
    const [card] = await cards();
    return card!;
  };
  const updates = async (workItemId: string) =>
    (await seeded.workItems.listDeferredDecisions('org-1', project.id, { workItemId }))
      .filter(record => record.decision.type === 'routeEvent')
      .map(record => record.decision.event);
  const current = async (id: string) => (await seeded.workItems.get({ orgId: 'org-1', id }))!;
  return { seeded, project, sync, drain, cards, file, updates, current };
}

const SHIPPED = [{ type: 'work_item.updated', labels: { added: ['ship'], removed: [] } }];

describe.each(PROVIDERS)('a $name sync changing labels', provider => {
  it("moves the card by its work_item.updated route once a sync sees a label added, and only once", async () => {
    const { sync, drain, file, updates, current } = await setup(provider);
    const card = await file();
    await sync('2026-07-03T00:00:00Z', ['bug', 'ship']);
    await sync('2026-07-04T00:00:00Z', ['bug', 'ship']);
    expect(await updates(card.id)).toEqual(SHIPPED);

    await drain();
    expect((await current(card.id)).stages).toEqual(['done']);
  });

  it('hands the change over when the same sighting is polled again after queueing it failed', async () => {
    const { seeded, sync, file, updates } = await setup(provider);
    const card = await file();
    const commit = seeded.workItems.commitRuleEvaluation.bind(seeded.workItems);
    const spy = vi.spyOn(seeded.workItems, 'commitRuleEvaluation').mockImplementation(async input => {
      if (input.ingress.identity.endsWith(':update')) throw new Error('database unavailable');
      return commit(input);
    });
    await expect(sync('2026-07-03T00:00:00Z', ['bug', 'ship'])).rejects.toThrow('database unavailable');
    spy.mockImplementation(commit);
    // Nothing changed at the provider since, so the next poll sees the very same sighting.
    await sync('2026-07-03T00:00:00Z', ['bug', 'ship']);
    expect(await updates(card.id)).toEqual(SHIPPED);
  });

  // Each sighting is [updatedAt, labels], after the card was filed with ['bug'].
  it.each([
    {
      case: 'an earlier sighting replayed after a newer one',
      sightings: [['2026-07-04T00:00:00Z', ['bug', 'ship']], ['2026-07-02T00:00:00Z', ['bug']], ['2026-07-05T00:00:00Z', ['bug', 'ship']]],
      updates: SHIPPED,
      labels: ['bug', 'ship'],
    },
    {
      case: 'an older sighting arriving after an unchanged newer one',
      sightings: [['2026-07-03T00:00:00Z', ['bug']], ['2026-07-02T00:00:00Z', ['bug', 'ship']]],
      updates: [],
      labels: ['bug'],
    },
  ] as const)('never rolls the labels back or reports a change in reverse for $case', async ({ sightings, updates: expected, labels }) => {
    const { sync, file, updates, current } = await setup(provider);
    const card = await file();
    for (const [at, observed] of sightings) await sync(at, [...observed]);
    expect(await updates(card.id)).toEqual(expected);
    expect((await current(card.id)).workItem.labels).toEqual(labels);
  });

  it('lets only the newer of two syncs racing for the same card record its change', async () => {
    const { seeded, sync, file, updates, current } = await setup(provider);
    const card = await file();
    // The older sync reads the card, then the newer one commits before the older one does.
    const commit = seeded.workItems.commitRuleEvaluation.bind(seeded.workItems);
    let raced = false;
    vi.spyOn(seeded.workItems, 'commitRuleEvaluation').mockImplementation(async input => {
      if (!raced && input.ingress.identity.endsWith(':update')) {
        raced = true;
        await sync('2026-07-03T00:00:00Z', ['bug', 'ship']);
      }
      return commit(input);
    });
    await sync('2026-07-02T00:00:00Z', ['bug', 'wip']);
    expect(await updates(card.id)).toEqual(SHIPPED);
    expect((await current(card.id)).workItem.labels).toEqual(['bug', 'ship']);
  });

  it('files an item no board took once a later sync shows it matching a board', async () => {
    const { seeded, project, sync, drain, cards } = await setup(provider, { onlyShipFiles: true });
    const scope = { orgId: 'org-1', factoryProjectId: project.id };
    await sync(created, ['bug']);
    await drain();
    expect(await cards()).toEqual([]);
    expect((await seeded.boards.listNotRouted(scope)).notRouted).toHaveLength(1);

    await sync('2026-07-03T00:00:00Z', ['bug', 'ship']);
    await drain();
    expect((await cards()).map(card => card.stages)).toEqual([['intake']]);
  });
});
