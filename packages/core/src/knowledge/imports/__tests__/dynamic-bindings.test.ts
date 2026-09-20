import { describe, expect, it, vi } from 'vitest';
import { InMemoryStore, knowledgeImporterBindingKey } from '../../../storage';
import { Knowledge } from '../../index';
import type { KnowledgeImporterBindingInput, KnowledgeImporterHandlerContext } from '../types';

const noopHandler = async (_context: KnowledgeImporterHandlerContext) => {};

const one = { source: 'tickets:primary', scope: 'project:one' } as const;
const two = { source: 'tickets:primary', scope: 'project:two' } as const;
const structure = {
  scopes: [
    { address: 'org:acme', name: 'Acme' },
    { address: one.scope, name: 'One', parentAddresses: ['org:acme'] },
    { address: two.scope, name: 'Two', parentAddresses: ['org:acme'] },
  ],
};

describe('Knowledge importer dynamic cron bindings', () => {
  it('fans a cron fire out across the bindings the resolver returns', async () => {
    vi.useFakeTimers();
    try {
      const handler = vi.fn(noopHandler);
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: 'dynamic-bindings-fanout' }),
        structure,
        importers: [
          {
            id: 'tickets',
            access: { 'project:$projectId': 'append' },
            triggers: {
              cron: { schedule: '* * * * * *', resolveBindings: async () => [one, two] },
            },
            handler,
          },
        ],
      });
      await knowledge.reconcile();
      knowledge.__registerMastra({} as never);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
      expect(handler.mock.calls.map(([context]) => context.run.binding)).toEqual(
        expect.arrayContaining([knowledgeImporterBindingKey(one), knowledgeImporterBindingKey(two)]),
      );
      await knowledge.shutdownImporters();
    } finally {
      vi.useRealTimers();
    }
  });

  it('picks up bindings added between fires and stops firing removed ones', async () => {
    vi.useFakeTimers();
    try {
      const current: KnowledgeImporterBindingInput[] = [one];
      const handled: string[] = [];
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: 'dynamic-bindings-drift' }),
        structure,
        importers: [
          {
            id: 'tickets',
            access: { 'project:$projectId': 'append' },
            triggers: {
              cron: { schedule: '* * * * * *', resolveBindings: () => [...current] },
            },
            handler: async ctx => {
              handled.push(ctx.run.binding);
            },
          },
        ],
      });
      await knowledge.reconcile();
      knowledge.__registerMastra({} as never);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handled).toEqual([knowledgeImporterBindingKey(one)]));

      current.length = 0;
      current.push(two);
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handled).toContain(knowledgeImporterBindingKey(two)));
      expect(handled.filter(binding => binding === knowledgeImporterBindingKey(one))).toHaveLength(1);
      await knowledge.shutdownImporters();
    } finally {
      vi.useRealTimers();
    }
  });

  it('unions resolved bindings with static ones, deduplicated by binding key', async () => {
    vi.useFakeTimers();
    try {
      const handler = vi.fn(noopHandler);
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: 'dynamic-bindings-union' }),
        structure,
        importers: [
          {
            id: 'tickets',
            access: { 'project:$projectId': 'append' },
            triggers: {
              cron: {
                schedule: '* * * * * *',
                bindings: [one],
                // Overlaps the static binding — the union must not double-fire it.
                resolveBindings: async () => [one, two],
              },
            },
            handler,
          },
        ],
      });
      await knowledge.reconcile();
      knowledge.__registerMastra({} as never);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
      expect(handler.mock.calls.map(([context]) => context.run.binding).sort()).toEqual(
        [knowledgeImporterBindingKey(one), knowledgeImporterBindingKey(two)].sort(),
      );
      await knowledge.shutdownImporters();
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to static bindings when the resolver throws and retries on the next fire', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const handled: string[] = [];
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: 'dynamic-bindings-failure' }),
        structure,
        importers: [
          {
            id: 'tickets',
            access: { 'project:$projectId': 'append' },
            triggers: {
              cron: {
                schedule: '* * * * * *',
                bindings: [one],
                resolveBindings: async () => {
                  calls += 1;
                  if (calls === 1) throw new Error('platform unavailable');
                  return [two];
                },
              },
            },
            handler: async ctx => {
              handled.push(ctx.run.binding);
            },
          },
        ],
      });
      await knowledge.reconcile();
      knowledge.__registerMastra({} as never);

      // First fire: resolver throws — static binding still runs, no crash.
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handled).toContain(knowledgeImporterBindingKey(one)));
      expect(handled).not.toContain(knowledgeImporterBindingKey(two));

      // Second fire: resolver recovers — dynamic binding joins the static one.
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handled).toContain(knowledgeImporterBindingKey(two)));
      await knowledge.shutdownImporters();
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to the last successfully resolved set when a later resolution throws', async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const handled: string[] = [];
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: 'dynamic-bindings-last-good' }),
        structure,
        importers: [
          {
            id: 'tickets',
            access: { 'project:$projectId': 'append' },
            triggers: {
              cron: {
                schedule: '* * * * * *',
                resolveBindings: async () => {
                  calls += 1;
                  if (calls > 1) throw new Error('platform unavailable');
                  return [two];
                },
              },
            },
            handler: async ctx => {
              handled.push(ctx.run.binding);
            },
          },
        ],
      });
      await knowledge.reconcile();
      knowledge.__registerMastra({} as never);

      // First fire: resolver succeeds — the dynamic binding runs.
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handled).toContain(knowledgeImporterBindingKey(two)));
      handled.length = 0;

      // Second fire: resolver throws — the last-good set keeps the sync alive
      // instead of dropping every dynamic destination for the fire.
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handled).toContain(knowledgeImporterBindingKey(two)));
      expect(calls).toBeGreaterThan(1);
      await knowledge.shutdownImporters();
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips invalid resolved entries without blocking valid ones', async () => {
    vi.useFakeTimers();
    try {
      const handler = vi.fn(noopHandler);
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: 'dynamic-bindings-invalid-entry' }),
        structure,
        importers: [
          {
            id: 'tickets',
            access: { 'project:$projectId': 'append' },
            triggers: {
              cron: {
                schedule: '* * * * * *',
                resolveBindings: async () => [{ source: 'tickets:primary', scope: '' }, one],
              },
            },
            handler,
          },
        ],
      });
      await knowledge.reconcile();
      knowledge.__registerMastra({} as never);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
      expect(handler.mock.calls[0]![0].run.binding).toBe(knowledgeImporterBindingKey(one));
      await knowledge.shutdownImporters();
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats an empty resolution as no destinations, not an error', async () => {
    vi.useFakeTimers();
    try {
      const handler = vi.fn(noopHandler);
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: 'dynamic-bindings-empty' }),
        structure,
        importers: [
          {
            id: 'tickets',
            access: { 'project:$projectId': 'append' },
            triggers: {
              cron: { schedule: '* * * * * *', resolveBindings: async () => [] },
            },
            handler,
          },
        ],
      });
      await knowledge.reconcile();
      knowledge.__registerMastra({} as never);

      await vi.advanceTimersByTimeAsync(2_000);
      expect(handler).not.toHaveBeenCalled();
      await knowledge.shutdownImporters();
    } finally {
      vi.useRealTimers();
    }
  });

  it('validates external cron-kind runs against a fresh resolution', async () => {
    const handler = vi.fn(noopHandler);
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'dynamic-bindings-assert' }),
      structure,
      importers: [
        {
          id: 'tickets',
          access: { 'project:$projectId': 'append' },
          triggers: {
            // Yearly schedule: nothing fires during the test; we drive runs manually.
            cron: { schedule: '0 0 1 1 *', resolveBindings: async () => [one] },
          },
          handler,
        },
      ],
    });
    await knowledge.reconcile();
    knowledge.__registerMastra({} as never);

    await expect(knowledge.runImporter('tickets', one, undefined, { triggerKind: 'cron' })).resolves.toMatchObject({
      status: 'succeeded',
    });
    await expect(knowledge.runImporter('tickets', two, undefined, { triggerKind: 'cron' })).rejects.toThrow(
      'does not allow this cron binding',
    );
    await knowledge.shutdownImporters();
  });

  it('keeps per-binding cursor state across a binding disappearing and returning', async () => {
    vi.useFakeTimers();
    try {
      const current: KnowledgeImporterBindingInput[] = [one];
      const seenCursors: (string | undefined)[] = [];
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: 'dynamic-bindings-cursor' }),
        structure,
        importers: [
          {
            id: 'tickets',
            access: { 'project:$projectId': 'append' },
            triggers: {
              cron: { schedule: '* * * * * *', resolveBindings: () => [...current] },
            },
            handler: async ctx => {
              seenCursors.push(await ctx.state.get('cursor'));
              await ctx.state.set('cursor', 'advanced');
            },
          },
        ],
      });
      await knowledge.reconcile();
      knowledge.__registerMastra({} as never);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(seenCursors).toHaveLength(1));
      expect(seenCursors[0]).toBeUndefined();

      // Binding disappears for a fire, then returns — its cursor must survive.
      current.length = 0;
      await vi.advanceTimersByTimeAsync(1_000);
      current.push(one);
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(seenCursors).toHaveLength(2));
      expect(seenCursors[1]).toBe('advanced');
      await knowledge.shutdownImporters();
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects invalid trigger declarations at registration', () => {
    const storage = new InMemoryStore({ id: 'dynamic-bindings-validation' });
    const handler = async () => {};

    // resolveBindings must be a function.
    expect(
      () =>
        new Knowledge({
          storage,
          importers: [
            {
              id: 'bad-resolver',
              triggers: { cron: { schedule: '* * * * *', resolveBindings: 'nope' as never } },
              handler,
            },
          ],
        }),
    ).toThrow('cron resolveBindings must be a function');

    // Without a resolver, the existing non-empty bindings rule still holds.
    expect(
      () =>
        new Knowledge({
          storage,
          importers: [{ id: 'no-bindings', triggers: { cron: { schedule: '* * * * *' } }, handler }],
        }),
    ).toThrow('bindings cannot be empty');
  });
});
