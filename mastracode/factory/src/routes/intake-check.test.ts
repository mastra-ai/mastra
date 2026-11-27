import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { DispatcherBoardEngine } from '../board-engine/engine.js';
import { createBoardRegistry } from '../boards/index.js';
import type { IntakeItemLookup } from '../boards/intake-lookup.js';
import { ProjectBoardCache } from '../boards/project-boards.js';
import { createTriageWorkRegistry } from '../boards/test-utils.js';
import { AuditStorage } from '../storage/domains/audit/base.js';
import { AuditDomain } from '../storage/domains/audit/domain.js';
import { StoredBoardsStorage } from '../storage/domains/boards/base.js';
import { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { CARD_HISTORY } from './intake-check.js';
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
        boardEngine: new DispatcherBoardEngine({
          workItems: domains.workItems,
          boards: createBoardRegistry(),
          transitionService: {
            transition: () => Promise.reject(new Error('An intake check moves no card.')),
          },
        }),
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
    // The sample skips manual cards and counts a source once, however it was seen.
    await domains.workItems.upsert({
      ...scope,
      userId: ADMIN,
      input: { title: 'Manual', board: 'work', stages: ['intake'] },
    });
    await domains.boards.recordIntakeDecision(scope, {
      idempotencyKey: 'arrival-1-again',
      outcome: 'not_routed',
      evaluator: 'intake-order',
      sourceKey: 'github:1:issue:1',
      title: 'Issue 1',
      arrival: {
        type: 'upsertLinkedWorkItem',
        board: 'work',
        source: 'github-issue',
        sourceKey: 'github:1:issue:1',
        title: 'Issue 1',
        stage: 'intake',
        metadata: { labels: ['docs'] },
      },
    });
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
    return { send, docsRule, workAll, docsCard, notRouted, lookups, snapshot, domains, scope, storage };
  }

  it('lets members dry-run and test the saved rules, keeps drafts to admins, and writes nothing', async () => {
    const { send, docsRule, workAll, docsCard, notRouted, snapshot } = await setup();
    const before = await snapshot();
    expect(await send('/intake/dry-run', {}, MEMBER)).toMatchObject({
      status: 200,
      body: {
        sampled: 3,
        evaluator: 'intake-order',
        canEdit: false,
        boards: [
          { boardKey: 'work', rules: [{ routeId: workAll.id, filed: 1 }] },
          { boardKey: 'docs', takes: [], lostTo: [{ boardKey: 'work', keys: expect.any(Array) }] },
        ],
      },
    });
    expect(await send('/intake/test', { itemId: docsCard.id }, MEMBER)).toMatchObject({
      status: 200,
      body: { item: { kind: 'card' }, placement: { boardKey: 'work', routeId: workAll.id } },
    });

    const order = { order: ['docs', 'work'] };
    expect((await send('/intake/dry-run', order, MEMBER)).status).toBe(403);
    expect((await send('/intake/test', { itemId: docsCard.id, ...order }, MEMBER)).status).toBe(403);
    const reordered = await send('/intake/dry-run', order);
    expect(reordered.body).toMatchObject({ changed: 2, canEdit: true });
    expect(reordered.body.items.find((item: { key: string }) => item.key === 'github:1:issue:1')).toMatchObject({
      before: { boardKey: 'work' },
      placement: { boardKey: 'docs', routeId: docsRule.id },
    });
    const draft = { boards: [{ boardKey: 'work', routes: [{ name: 'Bugs', when: labelled('bug'), target: {} }] }] };
    expect(await send('/intake/test', { itemId: notRouted.id, ...draft })).toMatchObject({
      body: { item: { kind: 'not_routed' }, placement: { boardKey: 'docs' } },
    });
    expect(await snapshot()).toEqual(before);
  });

  it("previews a board's saved rules sent back unchanged as no change, a rule joining closed issues included", async () => {
    const { send, domains, scope, workAll } = await setup();
    const joining = await domains.boards.createIntakeRoute(
      scope,
      {
        name: 'Closes an issue',
        on: ['pull_request.opened'],
        when: null,
        target: { boardKey: 'work', joinClosedIssue: true },
      },
      ADMIN,
    );
    const asDraft = (route: typeof joining) => ({
      id: route.id,
      name: route.name,
      when: route.when,
      on: route.on,
      target: { phaseKey: route.target.phaseKey, joinClosedIssue: route.target.joinClosedIssue },
    });
    const draft = { boards: [{ boardKey: 'work', routes: [asDraft(joining), asDraft(workAll)] }] };
    expect(await send('/intake/dry-run', draft)).toMatchObject({ status: 200, body: { changed: 0 } });
  });

  it('says which evaluator files the project, so a route-list project knows these answers are intake order', async () => {
    const { send, docsCard } = await setup({ evaluator: 'route-list' });
    expect((await send('/intake/dry-run', {}, MEMBER)).body.evaluator).toBe('route-list');
    expect((await send('/intake/test', { itemId: docsCard.id }, MEMBER)).body.evaluator).toBe('route-list');
  });

  it("previews a draft rule filing into a phase the board's first phase can't move to, as filing would", async () => {
    const { send, docsCard } = await setup();
    // Work's Intake can't move to Execute; an intake rule may still file there.
    const draft = {
      boards: [{ boardKey: 'work', routes: [{ name: 'Straight to Execute', target: { phaseKey: 'execute' } }] }],
    };
    expect(await send('/intake/test', { itemId: docsCard.id, ...draft })).toMatchObject({
      status: 200,
      body: { placement: { boardKey: 'work', phase: 'execute' } },
    });
    expect((await send('/intake/dry-run', draft)).status).toBe(200);
  });

  it('refuses what saving would refuse, and items it cannot read, before reading or writing anything', async () => {
    const { send, docsRule, notRouted, snapshot } = await setup();
    const before = await snapshot();
    const url = 'https://github.com/acme/app/issues/1';
    const rules = (routes: unknown[], boardKey = 'work') => ({ boards: [{ boardKey, routes }] });
    const id = randomUUID();
    const cases: [string, Record<string, unknown>, number, string][] = [
      ['/intake/dry-run', { order: ['work'] }, 422, 'intake_order_set_mismatch'],
      ['/intake/test', { url, order: ['work', 'docs', 'ship'] }, 422, 'intake_order_set_mismatch'],
      ['/intake/dry-run', { order: ['work', 'docs', 'docs'] }, 422, 'invalid_intake_route'],
      [
        '/intake/dry-run',
        {
          boards: [
            { boardKey: 'work', routes: [{ id, name: 'A', target: {} }] },
            { boardKey: 'docs', routes: [{ id, name: 'B', target: {} }] },
          ],
        },
        422,
        'intake_draft_rule_id_repeated',
      ],
      [
        '/intake/dry-run',
        rules([{ id: docsRule.id, name: 'Copied', target: {} }]),
        422,
        'intake_draft_rule_id_repeated',
      ],
      ['/intake/dry-run', rules([], 'nope'), 422, 'intake_board_not_found'],
      ['/intake/test', { url, ...rules([{ name: 'Typo', target: { phaseKey: 'nope' } }]) }, 422, 'unknown_phase'],
      ['/intake/test', { itemId: notRouted.id, event: { type: 'work_item.reopened' } }, 422, 'intake_event_needs_card'],
      ['/intake/test', { url: 'https://github.com/elsewhere/app/issues/1' }, 422, 'not_linked'],
      ['/intake/test', { url: 'https://github.com/acme/app/issues/404' }, 404, 'intake_item_not_found'],
      ['/intake/test', { url: 'https://linear.app/acme/issue/ENG-1' }, 422, 'intake_url_unsupported'],
      ['/intake/test', { itemId: randomUUID() }, 404, 'intake_item_not_found'],
      ['/intake/test', { url, itemId: randomUUID() }, 422, 'invalid_intake_route'],
    ];
    for (const [path, body, status, error] of cases) {
      expect(await send(path, body), `${path} ${JSON.stringify(body)}`).toMatchObject({ status, body: { error } });
    }
    expect(await snapshot()).toEqual(before);
  });

  it('resolves a URL to the card holding it, else reads it once from its provider, a Not routed item included', async () => {
    const { send, docsCard, lookups, domains } = await setup();
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
    const event = { type: 'work_item.updated', labels: { added: ['docs'], removed: [] } };
    // Any URL naming the same item finds its card: a tab of the pull request, a query, other case.
    for (const url of ['https://github.com/acme/app/pull/8', 'https://www.GitHub.com/Acme/App/pull/8/files?w=1#top']) {
      expect(await send('/intake/test', { url, event })).toMatchObject({
        body: { item: { kind: 'card', id: docsCard.id }, current: { boardKey: 'work' }, moves: [{ decisionId: null }] },
      });
    }
    expect(lookups).toEqual([]);

    // A Not routed item may have been labelled or reopened since: its URL reads the provider again.
    expect((await send('/intake/test', { url: 'https://github.com/acme/app/issues/3' })).body.item.kind).toBe(
      'fetched',
    );
    expect((await send('/intake/test', { url: 'https://github.com/acme/app/issues/99' })).body).toMatchObject({
      item: { kind: 'fetched', title: 'Fresh issue' },
      note: null,
    });
    // A fetched pull request may instead join a card (a closed issue's, or one whose branch it's on); that isn't checked.
    expect((await send('/intake/test', { url: 'https://github.com/acme/app/pull/98' })).body.note).toMatch(
      /joins? .*card/,
    );
    expect(lookups).toHaveLength(3);
  });

  it("reads only a card's newest decisions, however long its history, to replay its recent events", async () => {
    const { send, docsCard, domains, scope } = await setup();
    for (let n = 0; n < CARD_HISTORY + 5; n++) {
      const { revision } = (await domains.workItems.get({ orgId: scope.orgId, id: docsCard.id }))!;
      await domains.workItems.commitRuleEvaluation({
        ...scope,
        workItemId: docsCard.id,
        ingress: { identity: `history-${n}` },
        configVersion: 'test',
        expectedRevision: revision,
        actor: { type: 'system', id: 'rules' },
        outcome: { status: 'accepted' },
        decisions: [
          {
            type: 'routeEvent',
            idempotencyKey: `history-${n}`,
            event: { type: n % 2 ? 'work_item.closed' : 'work_item.reopened' },
          },
        ],
        causalChain: [],
        now: new Date(Date.UTC(2030, 0, 1, 0, 0, 0, n)),
      });
    }
    const listed = vi.spyOn(domains.workItems, 'listDeferredDecisions');
    const { body } = await send('/intake/test', { itemId: docsCard.id }, MEMBER);
    expect(body.moves).toHaveLength(10);
    expect(body.moves[0].at).toBe(new Date(Date.UTC(2030, 0, 1, 0, 0, 0, CARD_HISTORY + 4)).toISOString());
    const rows = await Promise.all(listed.mock.results.map(result => result.value));
    expect(rows.map(read => read.length)).toEqual([CARD_HISTORY + 1]);
  });

  it("replays an outsider's push past a rule stored before rules decided, as dispatch skips it, in a saved run and a draft echoing it", async () => {
    const { send, docsCard, workAll, domains, scope, storage } = await setup();
    const review = await domains.boards.createIntakeRoute(
      scope,
      {
        name: 'Pushes go back to Triage',
        when: null,
        on: ['pull_request.synchronized'],
        target: { boardKey: 'work', phaseKey: 'triage' },
      },
      ADMIN,
    );
    // As stored before the column existed: NULL, never backfilled, so the old gate holds.
    await storage.ops.updateMany(
      'factory_intake_routes',
      { org_id: scope.orgId, factory_project_id: scope.factoryProjectId, id: review.id },
      { outsider_pull_requests_gated: null },
    );
    const { revision } = (await domains.workItems.get({ orgId: scope.orgId, id: docsCard.id }))!;
    await domains.workItems.commitRuleEvaluation({
      ...scope,
      workItemId: docsCard.id,
      ingress: { identity: 'outsider-push' },
      configVersion: 'test',
      expectedRevision: revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'routeEvent',
          idempotencyKey: 'outsider-push',
          event: { type: 'pull_request.synchronized', pullRequestTrusted: false },
        },
      ],
      causalChain: [],
      now: new Date(Date.UTC(2030, 0, 1)),
    });
    const gatedSkip = {
      routeId: review.id,
      outcome: 'skipped',
      reason: "the pull request's author is an outsider, and this older rule skips outside authors' pull requests",
    };

    const saved = await send('/intake/test', { itemId: docsCard.id }, MEMBER);
    expect(saved.status).toBe(200);
    expect(saved.body.moves[0]).toMatchObject({ outcome: 'stays', to: null });
    expect(saved.body.moves[0].rules).toContainEqual(expect.objectContaining(gatedSkip));

    // A draft sending the saved rules back unchanged answers the same: the preview never widens the rule.
    const asDraft = (route: typeof review) => ({
      id: route.id,
      name: route.name,
      when: route.when,
      on: route.on,
      target: { phaseKey: route.target.phaseKey, joinClosedIssue: route.target.joinClosedIssue },
    });
    const echoed = await send('/intake/test', {
      itemId: docsCard.id,
      boards: [{ boardKey: 'work', routes: [asDraft(review), asDraft(workAll)] }],
    });
    expect(echoed.status).toBe(200);
    expect(echoed.body.moves[0]).toMatchObject({ outcome: 'stays', to: null });
    expect(echoed.body.moves[0].rules).toContainEqual(expect.objectContaining(gatedSkip));

    // A new draft rule decides for itself: with no gate and no trust condition it takes the outsider's push.
    const fresh = await send('/intake/test', {
      itemId: docsCard.id,
      boards: [
        {
          boardKey: 'work',
          routes: [
            { name: 'Pushes go back to Triage', on: review.on, target: { phaseKey: 'triage' } },
            asDraft(workAll),
          ],
        },
      ],
    });
    expect(fresh.status).toBe(200);
    expect(fresh.body.moves[0]).toMatchObject({
      outcome: 'moves',
      to: expect.objectContaining({ boardKey: 'work', phase: 'triage' }),
    });
  });

  it("won't say where a burst lands when part of it is older than the decisions it reads", async () => {
    const { send, docsCard, domains, scope } = await setup();
    // The oldest update adds docs; dispatch folds it into the newest, past the history the tester reads.
    for (let n = 0; n <= CARD_HISTORY; n++) {
      const { revision } = (await domains.workItems.get({ orgId: scope.orgId, id: docsCard.id }))!;
      await domains.workItems.commitRuleEvaluation({
        ...scope,
        workItemId: docsCard.id,
        ingress: { identity: `burst-${n}` },
        configVersion: 'test',
        expectedRevision: revision,
        actor: { type: 'system', id: 'rules' },
        outcome: { status: 'accepted' },
        decisions: [
          {
            type: 'routeEvent',
            idempotencyKey: `burst-${n}`,
            event: { type: 'work_item.updated', labels: { added: [n === 0 ? 'docs' : `l-${n}`], removed: [] } },
          },
        ],
        causalChain: [],
        now: new Date(Date.UTC(2030, 0, 1, 0, 0, 0, n)),
      });
    }
    const { body } = await send('/intake/test', { itemId: docsCard.id }, MEMBER);
    expect(body.moves).toHaveLength(1);
    expect(body.moves[0]).toMatchObject({ outcome: 'unknown', to: null, rules: [] });
    expect(body.moves[0].reason).toMatch(/older than/);
  });
});
