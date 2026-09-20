import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../../../storage';
import { Knowledge } from '../../index';
import type { KnowledgeImporterDefinition } from '../types';

const one = { source: 'calendar:primary', scope: 'project:one' } as const;
const structure = {
  scopes: [
    { address: 'org:acme', name: 'Acme' },
    { address: one.scope, name: 'One', parentAddresses: ['org:acme'] },
  ],
};

function definition(id: string, handler: KnowledgeImporterDefinition['handler']): KnowledgeImporterDefinition {
  return { id, access: { 'project:$projectId': 'edit' }, handler };
}

async function waitForRemoval(knowledge: Knowledge, id: string): Promise<void> {
  // Removal defers while the completed run's drain loop is still winding down; reconcile retries it.
  await vi.waitFor(async () => {
    await knowledge.reconcileImportersInternal();
    expect(knowledge.getImporter(id)).toBeUndefined();
  });
}

describe('Knowledge importer resolvers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers array-form importers at construction, before the runner starts', () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'resolver-array-form' }),
      structure,
      importers: [definition('static', async () => {})],
    });
    expect(knowledge.getImporter('static')).toBeDefined();
  });

  it('resolves importers at runner start and runs them', async () => {
    const handler = vi.fn(async () => {});
    const resolver = vi.fn(async () => [definition('remote', handler)]);
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'resolver-start' }),
      structure,
      importers: resolver,
    });
    await knowledge.reconcile();
    expect(knowledge.getImporter('remote')).toBeUndefined();

    knowledge.__registerMastra({} as never);
    await vi.waitFor(() => expect(knowledge.getImporter('remote')).toBeDefined());
    expect(resolver).toHaveBeenCalled();

    await expect(knowledge.getImporter('remote')!.run(one)).resolves.toMatchObject({ status: 'succeeded' });
    expect(handler).toHaveBeenCalledTimes(1);
    await knowledge.shutdownImporters();
  });

  it('starts the runner for an initially empty resolution and registers importers added on a later tick', async () => {
    vi.useFakeTimers();
    const definitions: KnowledgeImporterDefinition[] = [];
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'resolver-tick' }),
      structure,
      importers: async () => [...definitions],
    });
    await knowledge.reconcile();
    knowledge.__registerMastra({} as never);
    await vi.waitFor(() => expect(knowledge.listImporters()).toEqual([]));

    definitions.push(definition('late', async () => {}));
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.waitFor(() => expect(knowledge.getImporter('late')).toBeDefined());
    await knowledge.shutdownImporters();
  });

  it('deregisters removed definitions and preserves durable cursor state across remove and re-add', async () => {
    const observed: Array<string | undefined> = [];
    const handler: KnowledgeImporterDefinition['handler'] = async ctx => {
      observed.push(await ctx.state.get('cursor'));
      await ctx.state.set('cursor', 'v1');
    };
    let definitions = [definition('remote', handler)];
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'resolver-remove-readd' }),
      structure,
      importers: async () => definitions,
    });
    await knowledge.reconcile();
    knowledge.__registerMastra({} as never);
    await vi.waitFor(() => expect(knowledge.getImporter('remote')).toBeDefined());
    await expect(knowledge.getImporter('remote')!.run(one)).resolves.toMatchObject({ status: 'succeeded' });

    definitions = [];
    await waitForRemoval(knowledge, 'remote');
    expect(() => knowledge.runImporter('remote', one)).toThrow('not registered');

    definitions = [definition('remote', handler)];
    await knowledge.reconcileImportersInternal();
    expect(knowledge.getImporter('remote')).toBeDefined();
    await expect(knowledge.getImporter('remote')!.run(one)).resolves.toMatchObject({ status: 'succeeded' });
    expect(observed).toEqual([undefined, 'v1']);
    await knowledge.shutdownImporters();
  });

  it('keeps the previous registration set when the resolver throws', async () => {
    let fail = false;
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'resolver-throw' }),
      structure,
      importers: async () => {
        if (fail) throw new Error('platform unavailable');
        return [definition('remote', async () => {})];
      },
    });
    await knowledge.reconcile();
    knowledge.__registerMastra({} as never);
    await vi.waitFor(() => expect(knowledge.getImporter('remote')).toBeDefined());

    fail = true;
    await knowledge.reconcileImportersInternal();
    expect(knowledge.getImporter('remote')).toBeDefined();
    await expect(knowledge.getImporter('remote')!.run(one)).resolves.toMatchObject({ status: 'succeeded' });
    await knowledge.shutdownImporters();
  });

  it('skips invalid resolved definitions without dropping valid ones', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'resolver-invalid' }),
      structure,
      importers: async () => [{ id: '', handler: async () => {} }, definition('valid', async () => {})],
    });
    await knowledge.reconcile();
    knowledge.__registerMastra({} as never);
    await vi.waitFor(() => expect(knowledge.getImporter('valid')).toBeDefined());
    expect(knowledge.listImporters()).toHaveLength(1);
    await knowledge.shutdownImporters();
  });

  it('never removes manual registrations during resolver reconciliation', async () => {
    let definitions = [definition('remote', async () => {})];
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'resolver-manual' }),
      structure,
      importers: async () => definitions,
    });
    await knowledge.reconcile();
    knowledge.registerImporter(definition('manual', async () => {}));
    knowledge.__registerMastra({} as never);
    await vi.waitFor(() => expect(knowledge.getImporter('remote')).toBeDefined());

    definitions = [];
    await waitForRemoval(knowledge, 'remote');
    expect(knowledge.getImporter('manual')).toBeDefined();
    await expect(knowledge.getImporter('manual')!.run(one)).resolves.toMatchObject({ status: 'succeeded' });
    await knowledge.shutdownImporters();
  });
});
