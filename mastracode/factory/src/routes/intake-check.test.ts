import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { IntakeItemLookup } from '../boards/intake-lookup.js';
import { ProjectBoardCache } from '../boards/project-boards.js';
import { createTriageWorkRegistry } from '../boards/test-utils.js';
import { AuditStorage } from '../storage/domains/audit/base.js';
import { AuditDomain } from '../storage/domains/audit/domain.js';
import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { IntakeRouteRoutes } from './intake-routes.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const ADMIN = 'admin-user';
const MEMBER = 'member-user';

const labelled = (label: string) => ({
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: label }],
});
const docsBoard = {
  key: 'docs',
  name: 'Docs',
  phases: [
    { key: 'inbox', name: 'Inbox', kind: 'resting' },
    { key: 'published', name: 'Published', kind: 'terminal' },
  ],
};

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('intake dry run and tester on %s', backend => {
  async function setup(options: { evaluator?: 'route-list' | 'intake-order' } = {}) {
    const storage =
      backend === 'postgres'
        ? new PgFactoryStorage({ id: `intake-check-${randomUUID()}`, connectionString: postgresUrl! })
        : new LibSQLFactoryStorage({ id: `intake-check-${randomUUID()}`, url: ':memory:' });
    const domains = {
      projects: storage.registerDomain(new FactoryProjectsStorage()),
      workItems: storage.registerDomain(new WorkItemsStorage()),
      boards: storage.registerDomain(new StoredBoardsStorage()),
      audit: storage.registerDomain(new AuditStorage()),
    };
    await storage.init();
    onTestFinished(() => storage.close());

    const orgId = `org-${randomUUID()}`;
    const project = await domains.projects.create({ orgId, userId: ADMIN, input: { name: 'Acme' } });
    const scope = { orgId, factoryProjectId: project.id };
    for (const route of (await domains.boards.listIntakeRoutes(scope)).toReversed()) {
      await domains.boards.deleteIntakeRoute(scope, route.id, { expectedRevision: route.revision });
    }
    await domains.boards.create(scope, docsBoard, ADMIN);
    const docsRule = await domains.boards.createIntakeRoute(
      scope,
      { name: 'Docs', when: labelled('docs'), target: { boardKey: 'docs' } },
      ADMIN,
    );
    const workAll = await domains.boards.createIntakeRoute(
      scope,
      { name: 'Everything else', when: null, target: { boardKey: 'work' } },
      ADMIN,
    );
    await domains.boards.setIntakeOrder(scope, ['work', 'docs'], { boards: ['work', 'docs'] });

    const lookups: { url: string }[] = [];
    const lookup: IntakeItemLookup = {
      async lookup(_scope, url) {
        if (!url.startsWith('https://github.com/')) return undefined;
        lookups.push({ url });
        if (url.includes('/elsewhere/')) return { status: 'not_linked' };
        if (url.endsWith('/404')) return { status: 'not_found' };
        const pullRequest = url.includes('/pull/');
        return {
          status: 'found',
          title: pullRequest ? 'Fresh pull request' : 'Fresh issue',
          url,
          facts: { 'item.labels': ['docs'], 'source.kind': pullRequest ? 'pull_request' : 'issue' },
        };
      },
    };

    const cache = new ProjectBoardCache({
      codeRegistry: createTriageWorkRegistry(),
      storage: domains.boards,
      projects: domains.projects,
      recheckMs: 1000,
      now: () => 0,
      warn: () => {},
    });
    const auth = fakeRouteAuth({ isOrganizationAdmin: async (_org, userId) => userId === ADMIN });
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('factoryAuthUser' as never, { workosId: c.req.header('x-user') ?? ADMIN, organizationId: orgId } as never);
      await next();
    });
    mountApiRoutes(
      app,
      new IntakeRouteRoutes({
        auth,
        audit: new AuditDomain({ auth, audit: domains.audit, projects: domains.projects }),
        projects: domains.projects,
        workItems: domains.workItems,
        storage: domains.boards,
        boards: cache,
        intakeEvaluator: options.evaluator ?? 'intake-order',
        intakeLookups: [lookup],
      }).routes(),
    );
    const projectPath = `/web/factory/projects/${project.id}`;
    async function send(path: string, body: unknown, user = ADMIN) {
      const response = await app.request(`${projectPath}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user': user },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    }

    const card = async (n: number, labels: string[]) =>
      (
        await domains.workItems.upsert({
          ...scope,
          userId: ADMIN,
          input: {
            title: `Issue ${n}`,
            board: 'work',
            stages: ['intake'],
            metadata: { labels },
            externalSource: {
              integrationId: 'github',
              type: 'issue',
              externalId: `github:1:issue:${n}`,
              url: `https://github.com/acme/app/issues/${n}`,
            },
          },
        })
      ).item;
    const docsCard = await card(1, ['docs']);
    await card(2, ['bug']);
    const notRouted = await domains.boards.recordIntakeDecision(scope, {
      idempotencyKey: 'arrival-3',
      outcome: 'not_routed',
      evaluator: 'intake-order',
      sourceKey: 'github:1:issue:3',
      title: 'Issue 3',
      url: 'https://github.com/acme/app/issues/3',
      arrival: {
        type: 'upsertLinkedWorkItem',
        idempotencyKey: 'arrival-3',
        board: 'work',
        source: 'github-issue',
        sourceKey: 'github:1:issue:3',
        title: 'Issue 3',
        stage: 'intake',
        metadata: { labels: ['docs'] },
      },
    });
    await domains.boards.recordIntakeDecision(scope, {
      idempotencyKey: 'arrival-1',
      outcome: 'placed',
      evaluator: 'intake-order',
      boardKey: 'work',
      routeId: workAll.id,
      title: 'Issue 1',
    });

    /** Everything a dry run or test could write: if any of it changes, it wrote. */
    const snapshot = async () => ({
      cards: (await domains.workItems.list(scope)).map(item => [item.id, item.revision]),
      decisions: await domains.boards.listNotRouted(scope),
      placed: await domains.boards.countPlacedByRoute(scope, new Date(0)),
      deferred: await domains.workItems.listDeferredDecisions(orgId, project.id),
      audit: (await domains.audit.list({ orgId })).events.length,
      routes: await domains.boards.listIntakeRoutes(scope),
      order: await domains.boards.readIntakeOrder(scope, { boards: ['work', 'docs'] }),
    });
    return { send, docsRule, workAll, docsCard, notRouted, lookups, snapshot, domains, scope };
  }

  it('dry-runs the saved rules for a member, with live counts, and writes nothing', async () => {
    const { send, docsRule, workAll, snapshot } = await setup();
    const before = await snapshot();
    const response = await send('/intake/dry-run', {}, MEMBER);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      sampled: 3,
      notRouted: [],
      canEdit: false,
      boards: [
        {
          boardKey: 'work',
          takes: expect.arrayContaining(['github:1:issue:3', 'github:1:issue:2', 'github:1:issue:1']),
          rules: [{ routeId: workAll.id, filed: 1 }],
        },
        {
          boardKey: 'docs',
          takes: [],
          lostTo: [{ boardKey: 'work', keys: expect.arrayContaining(['github:1:issue:3', 'github:1:issue:1']) }],
          rules: [{ routeId: docsRule.id, filed: 0, lost: [{ boardKey: 'work', keys: expect.any(Array) }] }],
        },
      ],
    });
    expect(response.body.changed).toBeUndefined();
    expect(response.body.evaluator).toBe('intake-order');
    expect(await snapshot()).toEqual(before);
  });

  it('says which evaluator files the project, so a route-list project knows these answers are intake order', async () => {
    const { send, docsCard } = await setup({ evaluator: 'route-list' });
    expect((await send('/intake/dry-run', {}, MEMBER)).body.evaluator).toBe('route-list');
    expect((await send('/intake/test', { itemId: docsCard.id }, MEMBER)).body.evaluator).toBe('route-list');
  });

  it('refuses a draft that saving would refuse: an order missing, repeating or inventing a board, or two rules on one id', async () => {
    const { send, docsRule, snapshot } = await setup();
    const before = await snapshot();
    // A repeat fails the same schema the save uses; a missing or unknown board fails the save's membership check.
    for (const [order, error] of [
      [['work'], 'intake_order_set_mismatch'],
      [['work', 'docs', 'ship'], 'intake_order_set_mismatch'],
      [['work', 'docs', 'docs'], 'invalid_intake_route'],
    ] as const) {
      expect(await send('/intake/dry-run', { order })).toMatchObject({ status: 422, body: { error } });
      expect(await send('/intake/test', { order, url: 'https://github.com/acme/app/issues/1' })).toMatchObject({
        status: 422,
        body: { error },
      });
    }
    const id = randomUUID();
    const twice = {
      boards: [
        { boardKey: 'work', routes: [{ id, name: 'A', target: {} }] },
        { boardKey: 'docs', routes: [{ id, name: 'B', target: {} }] },
      ],
    };
    const clash = { boards: [{ boardKey: 'work', routes: [{ id: docsRule.id, name: 'Copied', target: {} }] }] };
    for (const draft of [twice, clash]) {
      expect(await send('/intake/dry-run', draft)).toMatchObject({
        status: 422,
        body: { error: 'intake_draft_rule_id_repeated' },
      });
    }
    expect(await snapshot()).toEqual(before);
  });

  it('previews an unsaved order and unsaved rules for an admin only, and still writes nothing', async () => {
    const { send, docsRule, snapshot } = await setup();
    const before = await snapshot();
    expect((await send('/intake/dry-run', { order: ['docs', 'work'] }, MEMBER)).status).toBe(403);

    const reordered = await send('/intake/dry-run', { order: ['docs', 'work'] });
    expect(reordered).toMatchObject({ status: 200, body: { changed: 2, canEdit: true } });
    expect(reordered.body.items.find((item: { key: string }) => item.key === 'github:1:issue:1')).toMatchObject({
      before: { boardKey: 'work' },
      placement: { boardKey: 'docs', routeId: docsRule.id },
    });

    // Work's draft drops its catch-all for a `bug` rule: the docs items now fall through to Docs.
    const drafted = await send('/intake/dry-run', {
      boards: [{ boardKey: 'work', routes: [{ name: 'Bugs', when: labelled('bug'), target: {} }] }],
    });
    expect(drafted.status).toBe(200);
    expect(drafted.body.changed).toBe(2);
    expect(drafted.body.boards[0].rules).toMatchObject([
      { routeId: 'draft:work:0', name: 'Bugs', takes: ['github:1:issue:2'] },
    ]);

    expect(await send('/intake/dry-run', { boards: [{ boardKey: 'nope', routes: [] }] })).toMatchObject({
      status: 422,
      body: { error: 'intake_board_not_found' },
    });
    // A draft rule is held to the same target checks as saving it, rather than quietly landing elsewhere.
    for (const path of ['/intake/dry-run', '/intake/test']) {
      expect(
        await send(path, {
          ...(path === '/intake/test' && { url: 'https://github.com/acme/app/issues/1' }),
          boards: [{ boardKey: 'work', routes: [{ name: 'Typo', when: null, target: { phaseKey: 'nope' } }] }],
        }),
      ).toMatchObject({ status: 422, body: { error: 'unknown_phase', message: 'Board "work" has no phase "nope".' } });
    }
    expect(await snapshot()).toEqual(before);
  });

  it('traces a recent card, a Not routed item and a known URL rule by rule, naming the failing condition', async () => {
    const { send, docsRule, workAll, docsCard, notRouted, lookups, snapshot } = await setup();
    const before = await snapshot();
    const draft = { boards: [{ boardKey: 'work', routes: [{ name: 'Bugs', when: labelled('bug'), target: {} }] }] };

    const traced = await send('/intake/test', { itemId: notRouted.id, ...draft });
    expect(traced).toMatchObject({
      status: 200,
      body: {
        item: { kind: 'not_routed', id: notRouted.id, title: 'Issue 3' },
        placement: { boardKey: 'docs', routeId: docsRule.id },
        reason: null,
        boards: [
          {
            boardKey: 'work',
            rules: [
              {
                routeId: 'draft:work:0',
                outcome: 'no_match',
                failed: [{ field: 'item.labels', operator: 'contains', value: 'bug', actual: ['docs'] }],
              },
            ],
          },
          { boardKey: 'docs', rules: [{ routeId: docsRule.id, outcome: 'took' }] },
        ],
      },
    });
    expect((await send('/intake/test', { itemId: notRouted.id, ...draft }, MEMBER)).status).toBe(403);

    const byId = await send('/intake/test', { itemId: docsCard.id }, MEMBER);
    expect(byId.body).toMatchObject({
      item: { kind: 'card', id: docsCard.id },
      placement: { boardKey: 'work', routeId: workAll.id },
      boards: [
        { rules: [{ outcome: 'took' }] },
        { rules: [{ routeId: docsRule.id, outcome: 'lost', to: { boardKey: 'work', routeId: workAll.id } }] },
      ],
    });
    const byUrl = await send('/intake/test', { url: 'https://github.com/acme/app/issues/1/' }, MEMBER);
    expect(byUrl.body).toMatchObject({ item: { kind: 'card', id: docsCard.id } });
    expect(lookups).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });

  it('resolves a pull request attached to a card to that card, by URL, without asking its provider', async () => {
    const { send, docsCard, lookups, snapshot, domains } = await setup();
    await domains.workItems.attachSource({
      orgId: docsCard.orgId,
      id: docsCard.id,
      source: {
        integrationId: 'github',
        type: 'pull-request',
        externalId: 'github:1:pull-request:8',
        url: 'https://github.com/acme/app/pull/8',
      },
      metadata: { githubPullRequestNumber: 8, state: 'open' },
    });
    const before = await snapshot();
    const event = { type: 'work_item.updated', labels: { added: ['docs'], removed: [] } };
    const tested = await send('/intake/test', { url: 'https://github.com/acme/app/pull/8', event });
    expect(tested).toMatchObject({
      status: 200,
      body: { item: { kind: 'card', id: docsCard.id }, current: { boardKey: 'work' }, note: null },
    });
    expect(tested.body.moves).toHaveLength(1);
    expect(lookups).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });

  it('reads an unseen URL once from its provider, and refuses URLs it may not or cannot read', async () => {
    const { send, docsRule, lookups, snapshot } = await setup();
    const before = await snapshot();
    const fresh = await send('/intake/test', { url: 'https://github.com/acme/app/issues/99', order: ['docs', 'work'] });
    expect(fresh.body).toMatchObject({
      item: { kind: 'fetched', id: null, title: 'Fresh issue' },
      placement: { boardKey: 'docs', routeId: docsRule.id },
    });
    expect(lookups).toEqual([{ url: 'https://github.com/acme/app/issues/99' }]);
    expect(fresh.body.note).toBeNull();
    // A fetched pull request may instead join a card (a closed issue's, or one whose branch it's on); that isn't checked.
    const pull = await send('/intake/test', { url: 'https://github.com/acme/app/pull/98' });
    expect(pull.body).toMatchObject({ item: { kind: 'fetched' }, note: expect.stringMatching(/joins? .*card/) });

    expect(await send('/intake/test', { url: 'https://github.com/elsewhere/app/issues/1' })).toMatchObject({
      status: 422,
      body: { error: 'not_linked' },
    });
    expect(await send('/intake/test', { url: 'https://github.com/acme/app/issues/404' })).toMatchObject({
      status: 404,
      body: { error: 'intake_item_not_found' },
    });
    expect(await send('/intake/test', { url: 'https://linear.app/acme/issue/ENG-1' })).toMatchObject({
      status: 422,
      body: { error: 'intake_url_unsupported' },
    });
    expect(await send('/intake/test', { itemId: randomUUID() })).toMatchObject({
      status: 404,
      body: { error: 'intake_item_not_found' },
    });
    expect((await send('/intake/test', { url: 'https://github.com/a/b/issues/1', itemId: randomUUID() })).status).toBe(
      422,
    );
    expect(await snapshot()).toEqual(before);
  });

  it('replays a long burst of pending updates as one, reading each earlier update about once', async () => {
    const { send, docsCard, domains, scope } = await setup();
    for (let n = 0; n < 30; n++) {
      const committed = await domains.workItems.commitRuleEvaluation({
        ...scope,
        workItemId: docsCard.id,
        ingress: { identity: `burst-${n}`, triggerType: 'github.issueUpdated' },
        configVersion: 'test',
        expectedRevision: (await domains.workItems.get({ orgId: scope.orgId, id: docsCard.id }))!.revision,
        actor: { type: 'system', id: 'rules' },
        outcome: { status: 'accepted' },
        decisions: [
          {
            type: 'routeEvent',
            idempotencyKey: `burst-${n}:event-route`,
            event: { type: 'work_item.updated', labels: { added: [`label-${n}`], removed: [] } },
          },
        ],
        causalChain: [],
        now: new Date(Date.UTC(2030, 0, 1, 0, 0, n)),
      });
      expect(committed.status).toBe('committed');
    }
    const lookups = vi.spyOn(domains.workItems, 'getTransitionResultByIngress');
    const tested = await send('/intake/test', { itemId: docsCard.id }, MEMBER);
    expect(tested.body.moves).toHaveLength(1);
    expect(tested.body.moves[0].event.labels.added).toHaveLength(30);
    expect(lookups.mock.calls.length).toBeLessThanOrEqual(30);
  });

  it("replays a card's recent events and a tried one through its board's card-move rules, writing nothing", async () => {
    const { send, docsCard, notRouted, snapshot, domains, scope } = await setup();
    const shipAdded = await domains.boards.createIntakeRoute(
      scope,
      {
        name: 'Docs label added',
        on: ['work_item.updated'],
        when: { operator: 'AND', conditions: [{ field: 'event.labels.added', operator: 'contains', value: 'docs' }] },
        target: { boardKey: 'work', moveToBoardKey: 'docs', phaseKey: null },
      },
      ADMIN,
    );
    // A label update the dispatcher hasn't filed yet: the card's own history holds it.
    const committed = await domains.workItems.commitRuleEvaluation({
      ...scope,
      workItemId: docsCard.id,
      ingress: { identity: 'update-1', triggerType: 'github.issueUpdated' },
      configVersion: 'test',
      expectedRevision: docsCard.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'routeEvent',
          idempotencyKey: 'update-1:event-route',
          event: { type: 'work_item.updated', labels: { added: ['bug'], removed: [] } },
        },
      ],
      causalChain: [],
      now: new Date('2030-01-01T00:00:00Z'),
    });
    expect(committed.status).toBe('committed');
    const before = await snapshot();

    const tried = await send(
      '/intake/test',
      { itemId: docsCard.id, event: { type: 'work_item.updated', labels: { added: ['docs'] } } },
      MEMBER,
    );
    expect(tried.status).toBe(200);
    expect(tried.body.item).toMatchObject({ kind: 'card', id: docsCard.id });
    expect(tried.body.current).toEqual({ boardKey: 'work', phase: 'intake', routeId: null });
    expect(tried.body.moves).toMatchObject([
      {
        decisionId: null,
        event: { type: 'work_item.updated', labels: { added: ['docs'], removed: [] } },
        outcome: 'moves',
        to: { boardKey: 'docs', phase: 'inbox', routeId: shipAdded.id },
        rules: [{ routeId: shipAdded.id, name: 'Docs label added', outcome: 'took' }],
      },
      {
        decisionId: expect.any(String),
        at: '2030-01-01T00:00:00.000Z',
        outcome: 'stays',
        to: null,
        rules: [
          {
            routeId: shipAdded.id,
            outcome: 'no_match',
            failed: [{ field: 'event.labels.added', operator: 'contains', value: 'docs', actual: ['bug'] }],
          },
        ],
      },
    ]);

    // A draft card-move rule is tried the same way, by an admin.
    const drafted = await send('/intake/test', {
      itemId: docsCard.id,
      event: { type: 'work_item.closed', reason: 'completed' },
      boards: [
        {
          boardKey: 'work',
          routes: [
            { name: 'Closed', on: ['work_item.closed'], target: { moveToBoardKey: 'docs', phaseKey: 'published' } },
          ],
        },
      ],
    });
    expect(drafted.body.moves[0]).toMatchObject({
      outcome: 'moves',
      to: { boardKey: 'docs', phase: 'published', routeId: 'draft:work:0' },
    });

    // Only a card moves; an item without one is refused before anything is read for it.
    expect(await send('/intake/test', { itemId: notRouted.id, event: { type: 'work_item.closed' } })).toMatchObject({
      status: 422,
      body: { error: 'intake_event_needs_card' },
    });
    expect(await snapshot()).toEqual(before);
  });
});
