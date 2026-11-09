import { beforeEach, describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { InMemoryStore } from '../../storage/mock';
import { KnowledgeRun } from '../run';
import { KnowledgeScopeRuntime } from '../scope-runtime';

const provenance = { author: 'host' };

/** Counts the scope lookups and per-scope materialize calls a write start makes against a real in-memory store. */
function counted(store: KnowledgeStorage) {
  const calls = { lookups: 0, materialize: [] as string[] };
  const lookup = store.getScopesByAddress.bind(store);
  const materialize = store.materializeScope.bind(store);
  store.getScopesByAddress = async addresses => {
    calls.lookups++;
    return lookup(addresses);
  };
  store.materializeScope = async input => {
    calls.materialize.push(input.address);
    return materialize(input);
  };
  return calls;
}

function context(scopes: string[]) {
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, scopes);
  return { requestContext };
}

describe('Knowledge write-run start scope materialization', () => {
  let store: KnowledgeStorage;
  let warnings: string[];
  let runtime: KnowledgeScopeRuntime;

  beforeEach(async () => {
    store = (await new InMemoryStore().getStore('knowledge'))!;
    await store.init();
    warnings = [];
    runtime = new KnowledgeScopeRuntime(
      {
        'org:$orgId': {},
        'project:$projectId': { belongsTo: 'org:$orgId' },
        'team:$teamId': { children: [{ name: 'internal' }] },
        'repo:$repoId': { pages: [{ key: 'readme', name: 'Readme' }] },
      },
      async () => store,
      message => warnings.push(message),
    );
  });

  const projects = (n: number) => Array.from({ length: n }, (_, i) => `project:p${i}`);

  it('does one scope lookup and no writes when every held scope already exists and is placed', async () => {
    const principals = ['org:acme', ...projects(50)];
    await KnowledgeRun.start(runtime, store, context(principals), { write: true });
    const calls = counted(store);
    await KnowledgeRun.start(runtime, store, context(principals), { write: false });
    const readLookups = calls.lookups;
    calls.lookups = 0;

    const run = await KnowledgeRun.start(runtime, store, context(principals), { write: true });

    expect(calls.materialize).toEqual([]);
    // One lookup for materialization on top of what the read scope needs.
    expect(calls.lookups).toBe(readLookups + 1);
    expect(run.principals).toEqual(principals);
    expect(warnings).toEqual([]);
  });

  it('materializes a shared belongsTo parent once per start, not once per child', async () => {
    const calls = counted(store);
    await KnowledgeRun.start(runtime, store, context(['org:acme', ...projects(20)]), { write: true });

    expect(calls.materialize.filter(address => address === 'org:acme')).toHaveLength(1);
    expect(calls.materialize).toHaveLength(21);
    const [acme] = await store.getScopesByAddress(['org:acme']);
    const scopes = await store.getScopesByAddress(projects(20));
    expect(scopes).toHaveLength(20);
    expect(scopes.every(scope => scope.parentId === acme!.id)).toBe(true);
  });

  it('late-links an existing unplaced scope and still warns from the single lookup', async () => {
    await KnowledgeRun.start(runtime, store, context(['project:p1']), { write: true });
    const calls = counted(store);
    await KnowledgeRun.start(runtime, store, context(['project:p1', 'org:acme']), { write: true });
    const [acme] = await store.getScopesByAddress(['org:acme']);
    const [p1] = await store.getScopesByAddress(['project:p1']);
    expect(p1!.parentId).toBe(acme!.id);
    expect(calls.materialize.sort()).toEqual(['org:acme', 'project:p1']);

    const steady = counted(store);
    await KnowledgeRun.start(runtime, store, context(['project:p1', 'org:globex']), { write: true });
    expect(steady.materialize).toEqual(['org:globex']);
    expect(warnings).toEqual([
      'Knowledge scope "project:p1" already belongs to "org:acme"; ignoring requested parent "org:globex".',
    ]);

    warnings.length = 0;
    await KnowledgeRun.start(runtime, store, context(['project:p2', 'org:acme', 'org:globex']), { write: true });
    await KnowledgeRun.start(runtime, store, context(['project:p2', 'org:acme', 'org:globex']), { write: true });
    expect(warnings).toHaveLength(2);
    expect(warnings.every(message => /ambiguous belongsTo/.test(message))).toBe(true);
  });

  it('skips placed scopes with template children but keeps declarations with template pages on the store path', async () => {
    await KnowledgeRun.start(runtime, store, context(['team:t1', 'repo:r1']), { write: true });
    const calls = counted(store);
    await KnowledgeRun.start(runtime, store, context(['team:t1', 'repo:r1']), { write: true });
    expect(calls.materialize).toEqual(['repo:r1']);
    expect(await store.getScopesByAddress(['team:t1/internal'])).toHaveLength(1);
  });
});

describe('Knowledge write-run start matches per-scope materialization', () => {
  const declarations = {
    'org:$orgId': { pages: [{ key: 'about', name: 'About' }] },
    'team:$teamId': { belongsTo: 'org:$orgId', children: [{ name: 'internal' }] },
    'project:$projectId': { belongsTo: 'team:$teamId' },
    'a:$id': { belongsTo: 'b:$id' },
    'b:$id': { belongsTo: 'a:$id' },
  };

  async function harness() {
    const store = (await new InMemoryStore().getStore('knowledge'))!;
    await store.init();
    const warnings: string[] = [];
    const runtime = new KnowledgeScopeRuntime(
      declarations,
      async () => store,
      message => warnings.push(message),
    );
    return { store, warnings, runtime };
  }

  async function tree(store: KnowledgeStorage, addresses: string[]) {
    const scopes = await store.getScopesByAddress(addresses);
    const byId = new Map(scopes.map(scope => [scope.id, scope.address]));
    return Object.fromEntries(
      scopes.map(scope => [scope.address, scope.parentId ? (byId.get(scope.parentId) ?? 'other') : null]),
    );
  }

  /** Runs each start through the old per-principal loop and through materializeScopes, comparing outcomes. */
  async function same(starts: string[][]) {
    const serial = await harness();
    const batch = await harness();
    const all = [...new Set(starts.flat().flatMap(a => [a, `${a}/internal`]))];
    for (const principals of starts) {
      serial.warnings.length = 0;
      batch.warnings.length = 0;
      const old = await (async () => {
        for (const principal of principals) await serial.runtime.materializeScope(principal, principals, provenance);
      })().then(
        () => 'ok',
        (error: Error) => error.message,
      );
      const now = await batch.runtime.materializeScopes(principals, principals, provenance).then(
        () => 'ok',
        (error: Error) => error.message,
      );
      expect(now).toBe(old);
      expect(batch.warnings).toEqual(serial.warnings);
      expect(await tree(batch.store, all)).toEqual(await tree(serial.store, all));
    }
    return serial.warnings;
  }

  it('matches for a placed chain with a conflicting held parent', async () => {
    await same([
      ['org:acme', 'team:t1', 'project:p1'],
      ['org:globex', 'team:t1', 'project:p1', 'project:p2'],
      ['org:globex', 'team:t1', 'project:p1', 'project:p2'],
    ]);
  });

  it('matches for late links, ambiguity and template-child principals', async () => {
    await same([
      ['team:t1/internal'],
      ['team:t1'],
      ['team:t1', 'org:acme'],
      ['team:t1', 'org:acme', 'org:globex', 'team:t1/internal'],
      ['team:t2/internal', 'org:acme'],
    ]);
  });

  it('matches for mutual belongsTo cycles, including the error', async () => {
    const warnings = await same([
      ['a:x', 'b:x'],
      ['a:x', 'b:x'],
      ['b:y', 'a:y'],
    ]);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
