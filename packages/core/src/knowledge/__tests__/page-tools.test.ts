import { beforeEach, describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { standardSchemaToJSONSchema } from '../../schema';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { InMemoryStore } from '../../storage/mock';
import { validateToolInput } from '../../tools/validation';
import { KnowledgeDeclarationError, knowledgeMemoryScopes, knowledgeRoleAtLeast } from '../declarations';
import type { KnowledgeScopeDeclarations } from '../declarations';
import { buildKnowledgePageTools } from '../page-tools';
import { KnowledgeScopeRuntime } from '../scope-runtime';

/** The §10 reference setup of the access spec. */
const scopes: KnowledgeScopeDeclarations = {
  ...knowledgeMemoryScopes(),
  'role:$orgId:admin': { description: 'Org administrators' },
  'role:$orgId:support': { description: 'Support agents', pins: ['policy:$orgId#refund-policy'] },
  'role:$orgId:sales': { description: 'Sales' },
  'role:$orgId:policy-admin': { description: 'Edits company policy' },
  'role:$orgId:account-manager': { description: 'Account managers' },
  'audience:$orgId:public': { description: 'Public-facing agents' },
  'agent:$orgId:$agentId': { description: 'Private agent notes', access: [{ principal: 'self', role: 'owner' }] },
  'policy:$orgId': {
    access: [
      { principal: 'org:$orgId', role: 'viewer' },
      { principal: 'role:$orgId:policy-admin', role: 'owner' },
    ],
    pages: [{ key: 'refund-policy', name: 'Refund Policy' }],
  },
  'team:$orgId:$teamId': {
    access: [
      { principal: 'self', role: 'editor' },
      { principal: 'role:$orgId:admin', role: 'editor' },
    ],
  },
  'team-public:$orgId:$teamId': {
    access: [
      { principal: 'team:$orgId:$teamId', role: 'editor' },
      { principal: 'org:$orgId', role: 'viewer' },
    ],
  },
  'account:$orgId:$accountId': {
    access: [
      { principal: 'role:$orgId:support', role: 'viewer' },
      { principal: 'role:$orgId:account-manager', role: 'editor' },
    ],
    children: [{ name: 'internal', access: [{ principal: 'role:$orgId:account-manager', role: 'editor' }] }],
  },
  'kb-public:$orgId': {
    access: [
      { principal: 'org:$orgId', role: 'contributor' },
      { principal: 'audience:$orgId:public', role: 'viewer' },
    ],
  },
  'kb-internal:$orgId': { access: [{ principal: 'org:$orgId', role: 'contributor' }] },
  'feature:$orgId:$featureId': { description: 'Product features' },
  'feature:acme:a': {
    access: [
      { principal: 'team:acme:eng', role: 'editor' },
      { principal: 'team:acme:support', role: 'contributor' },
    ],
  },
};

type Result = Record<string, any>;

describe('Knowledge page tools (spec §10 scenarios, in-memory store)', () => {
  let store: KnowledgeStorage;
  let tools: ReturnType<typeof buildKnowledgePageTools>;
  let runtime: KnowledgeScopeRuntime;

  /** Runs a tool as an agent holding `held` (raw run scopes). */
  const as = (agentId: string, held: string[]) => {
    const call = async (tool: string, input: Record<string, unknown>): Promise<Result> => {
      const requestContext = new RequestContext();
      setRunAgentScopes(requestContext, held);
      return (await tools[tool]!.execute!(input as never, { requestContext, agent: { agentId } } as never)) as Result;
    };
    return {
      call,
      search: (query: string, scope?: string[]) => call('knowledge_search', { query, ...(scope ? { scope } : {}) }),
      read: (page?: string) => call('knowledge_read', page ? { page } : {}),
      page: (input: Record<string, unknown>) => call('knowledge_page', input),
      note: (input: Record<string, unknown>) => call('knowledge_note', input),
      pin: (input: Record<string, unknown>) => call('knowledge_pin', input),
    };
  };

  const admin = () => as('admin', ['org:acme', 'role:acme:admin', 'role:acme:policy-admin', 'resource:u-admin']);
  const support = () => as('support', ['org:acme', 'role:acme:support', 'team:acme:support', 'resource:u-42']);
  const sales = () => as('sales', ['org:acme', 'role:acme:sales', 'resource:u-sales']);
  const globex = () => as('globex', ['org:globex', 'role:globex:admin', 'role:globex:support', 'resource:u-g']);

  beforeEach(async () => {
    store = (await new InMemoryStore().getStore('knowledge'))!;
    await store.init();
    runtime = new KnowledgeScopeRuntime(
      scopes,
      async () => store,
      () => {},
    );
    tools = buildKnowledgePageTools(
      { runtime, getStorage: async () => store },
      { read: true, write: true, pins: true },
    );
  });

  it('1: support reads the org policy but cannot edit it by key, id or exact name; the policy admin can', async () => {
    await admin().page({ op: 'write', page: 'policy:acme#refund-policy', body: 'Refunds over $500 need approval.' });
    const read = await support().read('policy:acme#refund-policy');
    expect(read.page.body).toBe('Refunds over $500 need approval.');

    for (const ref of ['policy:acme#refund-policy', read.page.id, 'Refund Policy']) {
      await expect(support().page({ op: 'write', page: ref, body: 'Refunds always approved.' })).rejects.toThrow(
        /needs editor on "policy:acme"; this run has viewer/,
      );
    }
    await expect(support().page({ op: 'write', scope: 'policy:acme', name: 'Loophole' })).rejects.toThrow(
      /needs contributor on "policy:acme"/,
    );
    expect((await admin().read('policy:acme#refund-policy')).page.body).toBe('Refunds over $500 need approval.');
  });

  it('1 (alpha bypass): adding a note to a read-only page by exact name is refused and never rescopes the page', async () => {
    await admin().page({ op: 'write', page: 'policy:acme#refund-policy', body: 'Original.' });
    await expect(
      support().note({ op: 'add', page: 'Refund Policy', scope: ['org:acme'], text: 'Refunds are optional.' }),
    ).rejects.toThrow(/needs contributor on "policy:acme"/);
    const read = await sales().read('Refund Policy');
    expect(read.page.scope).toBe('policy:acme');
    expect(read.notes).toEqual([]);
  });

  it('2: pins need editor on the page and authority over the audience; support cannot unpin', async () => {
    await admin().pin({ op: 'pin', page: 'policy:acme#refund-policy', audience: ['org:acme'] });
    await expect(
      support().pin({ op: 'unpin', page: 'policy:acme#refund-policy', audience: ['org:acme'] }),
    ).rejects.toThrow(/needs editor on "policy:acme"/);
    await expect(
      admin().pin({ op: 'pin', page: 'policy:acme#refund-policy', audience: ['role:globex:support'] }),
    ).rejects.toThrow(/Pinning for "role:globex:support"/);
    const read = (await store.listPins({ audience: 'all', read: 'all' })).pins;
    expect(read.map(pin => pin.audience)).toEqual([['org:acme']]);
  });

  it('3 and 4: team pages are private to the team; the org admin reaches every Acme team but no Globex team', async () => {
    await support().page({ op: 'write', scope: 'team:acme:support', name: 'Chargeback Playbook', body: 'Steps.' });
    await as('eng', ['org:acme', 'team:acme:eng']).page({
      op: 'write',
      scope: 'team:acme:eng',
      name: 'Deploy Runbook',
    });

    expect((await support().search('Runbook')).results).toEqual([]);
    await expect(support().read('Deploy Runbook')).rejects.toThrow(/not found/);
    await expect(support().page({ op: 'write', scope: 'team:acme:eng', name: 'Sneaky' })).rejects.toThrow(/not found/);

    const adminHits = (await admin().search('Playbook')).results;
    expect(adminHits.map((hit: Result) => hit.page.name)).toEqual(['Chargeback Playbook']);
    await admin().page({ op: 'write', page: 'Chargeback Playbook', body: 'Reviewed steps.' });
    expect((await globex().search('Playbook')).results).toEqual([]);
    await expect(globex().page({ op: 'write', scope: 'team:acme:support', name: 'X' })).rejects.toThrow(/not found/);
  });

  it('5: a note stamped with a private agent scope on a shared org page is hidden from colleagues', async () => {
    const alex = as('alex', ['org:acme', 'agent:acme:alex']);
    const bea = as('bea', ['org:acme', 'agent:acme:bea']);
    await alex.page({ op: 'write', scope: 'org:acme', name: 'Billing Service' });
    await alex.note({ op: 'add', page: 'Billing Service', scope: ['org:acme'], text: 'Owned by payments.' });
    const priv = await alex.note({
      op: 'add',
      page: 'Billing Service',
      scope: ['agent:acme:alex'],
      text: 'Retries in v2 are flaky.',
    });

    expect((await alex.read('Billing Service')).notes.map((n: Result) => n.text)).toEqual([
      'Owned by payments.',
      'Retries in v2 are flaky.',
    ]);
    const beaRead = await bea.read('Billing Service');
    expect(beaRead.page.scope).toBe('org:acme');
    expect(beaRead.notes.map((n: Result) => n.text)).toEqual(['Owned by payments.']);
    expect((await bea.search('flaky')).results).toEqual([]);
    await expect(bea.note({ op: 'remove', note: priv.note.id })).rejects.toThrow(/not found/);
    await expect(
      bea.note({ op: 'add', page: 'Billing Service', scope: ['agent:acme:alex'], text: 'Spoof.' }),
    ).rejects.toThrow(/not found/);
  });

  it('a note accepts a plain date or a date-time for when', async () => {
    const schema = tools.knowledge_note!.inputSchema as Parameters<typeof validateToolInput>[0];
    const modelSchema = standardSchemaToJSONSchema(schema!, { io: 'input' }) as {
      properties: { when: Record<string, unknown> };
    };
    expect(modelSchema.properties.when).toEqual({ type: 'string', description: expect.stringContaining('2026-10-29') });
    for (const when of ['2026-10-29', '2026-10-29T14:00:00Z']) {
      const input = { op: 'add', page: 'Launch', scope: ['org:acme'], text: 'Shipped.', when };
      expect(validateToolInput(schema, input, 'knowledge_note')).toEqual({ data: input });
    }
    const alex = as('alex', ['org:acme']);
    await alex.page({ op: 'write', scope: 'org:acme', name: 'Launch' });
    const dated = await alex.note({
      op: 'add',
      page: 'Launch',
      scope: ['org:acme'],
      text: 'Shipped.',
      when: '2026-10-29',
    });
    const timed = await alex.note({
      op: 'add',
      page: 'Launch',
      scope: ['org:acme'],
      text: 'Announced.',
      when: '2026-10-29T14:00:00Z',
    });
    expect(dated.note.when).toBe('2026-10-29T00:00:00.000Z');
    expect(timed.note.when).toBe('2026-10-29T14:00:00.000Z');
    await expect(
      alex.note({ op: 'add', page: 'Launch', scope: ['org:acme'], text: 'Bad.', when: 'next week' }),
    ).rejects.toThrow(/Invalid when/);
  });

  it('7 and 8: thread scratch is promoted by restamping and by moving across scopes the run owns', async () => {
    const user = as('assistant', ['org:acme', 'resource:u-42', 'thread:t-9']);
    const other = as('assistant', ['org:acme', 'resource:u-99']);
    await user.page({ op: 'write', scope: 'thread:t-9', name: 'Scratch plan', body: 'Draft.' });
    const note = await user.note({ op: 'add', page: 'Scratch plan', scope: ['thread:t-9'], text: 'Prefers email.' });
    await user.note({ op: 'restamp', note: note.note.id, scope: ['resource:u-42'] });
    const moved = await user.page({ op: 'move', page: 'Scratch plan', scope: 'resource:u-42' });
    expect(moved.page.scope).toBe('resource:u-42');

    const later = as('assistant', ['org:acme', 'resource:u-42', 'thread:t-10']);
    expect((await later.read('Scratch plan')).notes.map((n: Result) => n.text)).toEqual(['Prefers email.']);
    expect((await other.search('Scratch')).results).toEqual([]);
    await expect(user.page({ op: 'move', page: 'Scratch plan', scope: 'org:acme' })).rejects.toThrow(
      /needs owner on "org:acme"; this run has editor/,
    );
  });

  it('9: a concrete feature share lets eng edit and support only contribute stamped notes', async () => {
    const eng = as('eng', ['org:acme', 'team:acme:eng']);
    await eng.page({ op: 'write', scope: 'feature:acme:a', name: 'Feature A', body: 'Spec.' });
    await support().note({
      op: 'add',
      page: 'Feature A',
      scope: ['team:acme:support'],
      text: 'Customers confuse it with B.',
    });
    await support().page({ op: 'write', scope: 'feature:acme:a', name: 'Feature A FAQ' });
    await expect(support().page({ op: 'write', page: 'Feature A', body: 'Rewritten.' })).rejects.toThrow(
      /needs editor on "feature:acme:a"; this run has contributor/,
    );
    expect((await eng.read('Feature A')).notes).toEqual([]);
    expect((await sales().search('Feature')).results).toEqual([]);
  });

  it('10: internal account children and notes mentioning them stay hidden from support', async () => {
    const am = as('am', ['org:acme', 'role:acme:account-manager']);
    await am.page({ op: 'write', scope: 'account:acme:123', name: 'Acme Account 123' });
    await am.page({ op: 'write', scope: 'account:acme:123/internal', name: 'Renewal Risk' });
    await am.note({
      op: 'add',
      page: 'Acme Account 123',
      scope: ['account:acme:123'],
      text: 'See [[Renewal Risk]] before calls.',
    });
    await am.note({ op: 'add', page: 'Acme Account 123', scope: ['account:acme:123'], text: 'Uses SSO.' });

    const supportRead = await support().read('account:acme:123');
    expect(supportRead.childScopes ?? []).toEqual([]);
    expect((await support().read('Acme Account 123')).notes.map((n: Result) => n.text)).toEqual(['Uses SSO.']);
    expect((await am.read('Acme Account 123')).notes).toHaveLength(2);
    expect((await am.read('account:acme:123')).childScopes.map((s: Result) => s.address)).toEqual([
      'account:acme:123/internal',
    ]);
  });

  it('12: the public bot reads only published knowledge; publishing names kb-public explicitly', async () => {
    await support().page({ op: 'write', scope: 'kb-public:acme', name: 'Reset Password', body: 'Use the link.' });
    await support().page({ op: 'write', scope: 'kb-internal:acme', name: 'Escalation Tree', body: 'Call Bea.' });
    const bot = as('faq', ['audience:acme:public']);
    expect((await bot.search('Reset')).results.map((hit: Result) => hit.page.name)).toEqual(['Reset Password']);
    expect((await bot.search('Escalation')).results).toEqual([]);
    await expect(bot.page({ op: 'write', scope: 'kb-public:acme', name: 'Spam' })).rejects.toThrow(
      /needs contributor on "kb-public:acme"; this run has viewer/,
    );
  });

  it("13: teams read each other's public overviews and edit only their own", async () => {
    const eng = as('eng', ['org:acme', 'team:acme:eng']);
    await eng.page({ op: 'write', scope: 'team-public:acme:eng', name: 'Eng Overview' });
    await support().page({ op: 'write', scope: 'team-public:acme:support', name: 'Support Overview' });
    expect((await support().read('Eng Overview')).page.scope).toBe('team-public:acme:eng');
    await expect(support().page({ op: 'write', page: 'Eng Overview', body: 'x' })).rejects.toThrow(
      /needs editor on "team-public:acme:eng"; this run has viewer/,
    );
  });

  it('refuses undeclared run scopes, and ambiguous names list candidates', async () => {
    await expect(as('typo', ['org:acme', 'role:acme:suport']).search('x')).rejects.toThrow(
      /"role:acme:suport" does not match a declared scope type.*knowledgeMemoryScopes/,
    );

    await admin().page({ op: 'write', scope: 'org:acme', name: 'Roadmap' });
    await admin().page({ op: 'write', scope: 'team:acme:support', name: 'Roadmap' });
    await expect(admin().read('Roadmap')).rejects.toThrow(/ambiguous; use one of these ids/);
    expect((await sales().read('Roadmap')).page.scope).toBe('org:acme');
  });

  describe('explainAccess', () => {
    const actors: Record<string, string[]> = {
      admin: ['org:acme', 'role:acme:admin', 'role:acme:policy-admin', 'resource:u-admin'],
      support: ['org:acme', 'role:acme:support', 'team:acme:support', 'resource:u-42'],
      sales: ['org:acme', 'role:acme:sales', 'resource:u-sales'],
      eng: ['org:acme', 'team:acme:eng'],
      manager: ['org:acme', 'role:acme:account-manager'],
      alex: ['org:acme', 'agent:acme:alex'],
      bot: ['audience:acme:public'],
      globex: ['org:globex', 'role:globex:admin', 'resource:u-g'],
    };
    const homes: Array<[string, string]> = [
      ['admin', 'policy:acme'],
      ['admin', 'team:acme:support'],
      ['eng', 'team-public:acme:eng'],
      ['eng', 'feature:acme:a'],
      ['manager', 'account:acme:x'],
      ['manager', 'account:acme:x/internal'],
      ['admin', 'kb-public:acme'],
      ['admin', 'kb-internal:acme'],
      ['alex', 'agent:acme:alex'],
      ['support', 'resource:u-42'],
      ['admin', 'org:acme'],
      ['globex', 'org:globex'],
    ];

    it('agrees with what the tools let every §10 actor read and edit, on every page', async () => {
      const pages: Array<{ id: string; scope: string }> = [];
      for (const [creator, scope] of homes) {
        const written = await as(creator, actors[creator]!).page({ op: 'write', scope, name: `Page in ${scope}` });
        pages.push({ id: written.page.id, scope });
      }

      let checked = 0;
      for (const [actor, held] of Object.entries(actors)) {
        for (const page of pages) {
          const explained = await runtime.explainAccess(held, { page: page.id });
          const readable = await as(actor, held)
            .read(page.id)
            .then(() => true)
            .catch(() => false);
          expect({ actor, scope: page.scope, readable }).toEqual({
            actor,
            scope: page.scope,
            readable: explained.role !== null,
          });
          expect(explained.page).toEqual({ id: page.id, scope: page.scope });
          expect(explained.reason).toBe(explained.role ? undefined : 'hidden');

          const editable = await as(actor, held)
            .page({ op: 'write', page: page.id, body: `edited by ${actor}` })
            .then(() => true)
            .catch(() => false);
          expect({ actor, scope: page.scope, editable }).toEqual({
            actor,
            scope: page.scope,
            editable: knowledgeRoleAtLeast(explained.role, 'editor'),
          });
          checked++;
        }
      }
      expect(checked).toBe(Object.keys(actors).length * homes.length);
    });

    it('names the rules behind a role, by page id or <scope>#<key> and by scope', async () => {
      await as('eng', actors.eng!).page({ op: 'write', scope: 'feature:acme:a', key: 'spec', name: 'Feature A spec' });

      const byKey = await runtime.explainAccess(actors.support!, { page: 'feature:acme:a#spec' });
      expect(byKey.role).toBe('contributor');
      expect(byKey.reasons).toEqual([
        { principal: 'team:acme:support', role: 'contributor', rule: 'feature:acme:a', via: 'rule' },
      ]);

      const own = await runtime.explainAccess(['org:acme', 'agent:acme:alex'], { scope: 'agent:acme:alex' });
      expect(own).toEqual({
        role: 'owner',
        reasons: [{ principal: 'agent:acme:alex', role: 'owner', rule: 'agent:$orgId:$agentId', via: 'self' }],
      });

      // Unmaterialized scopes are explained from their declarations alone.
      const unseen = await runtime.explainAccess(actors.support!, { scope: 'account:acme:new' });
      expect(unseen.role).toBe('viewer');
      expect(await store.getScopesByAddress(['account:acme:new'])).toEqual([]);
    });

    it('tells a hidden page from a missing one, and a scope with no rule', async () => {
      const internal = await as('manager', actors.manager!).page({
        op: 'write',
        scope: 'account:acme:x/internal',
        key: 'notes',
        name: 'Internal account notes',
      });

      expect(await runtime.explainAccess(actors.support!, { page: internal.page.id })).toEqual({
        role: null,
        reasons: [],
        page: { id: internal.page.id, scope: 'account:acme:x/internal' },
        reason: 'hidden',
      });
      expect(await runtime.explainAccess(actors.support!, { page: 'account:acme:x/internal#notes' })).toMatchObject({
        reason: 'hidden',
      });
      expect(await runtime.explainAccess(actors.support!, { page: 'no-such-page' })).toEqual({
        role: null,
        reasons: [],
        reason: 'missing',
      });
      expect(await runtime.explainAccess(actors.support!, { page: 'account:acme:x/internal#nope' })).toMatchObject({
        reason: 'missing',
      });
      expect(await runtime.explainAccess(actors.sales!, { scope: 'kb-internal:acme' })).toMatchObject({
        role: 'contributor',
      });
      expect(await runtime.explainAccess(actors.bot!, { scope: 'kb-internal:acme' })).toEqual({
        role: null,
        reasons: [],
        reason: 'no-rule',
      });
    });

    it("refuses a typo'd run scope the way a run does, and takes raw run scopes", async () => {
      await expect(runtime.explainAccess(['org:acme', 'role:acme:suport'], { scope: 'org:acme' })).rejects.toThrow(
        KnowledgeDeclarationError,
      );
      await expect(as('typo', ['org:acme', 'role:acme:suport']).read()).rejects.toThrow(/role:acme:suport/);

      // A raw resource id with "/" is encoded exactly like run ingress encodes it.
      const raw = await runtime.explainAccess(['resource:user/1'], { scope: 'resource:user%2F1' });
      expect(raw.role).toBe('owner');
    });
  });
});
