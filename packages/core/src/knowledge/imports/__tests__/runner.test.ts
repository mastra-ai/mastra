import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '../../../agent';
import { InMemoryStore, knowledgeImporterBindingKey } from '../../../storage';
import { Knowledge } from '../../index';

const one = { source: 'calendar:primary', scope: 'project:one' } as const;
const two = { source: 'calendar:secondary', scope: 'project:two' } as const;
const structure = {
  scopes: [
    { address: 'org:acme', name: 'Acme' },
    { address: one.scope, name: 'One', parentAddresses: ['org:acme'] },
    { address: two.scope, name: 'Two', parentAddresses: ['org:acme'] },
  ],
} as const;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Knowledge importer runner', () => {
  it('runs programmatic imports FIFO per binding and advances staged state after graph writes', async () => {
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const order: string[] = [];
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'import-runner-fifo' }),
      structure,
      importers: [
        {
          id: 'calendar',
          access: { 'project:$projectId': 'edit' },
          handler: async ctx => {
            const payload = ctx.payload as { address: string };
            order.push(`start:${payload.address}`);
            if (payload.address === 'first') {
              firstStarted.resolve();
              await releaseFirst.promise;
            }
            const importer = await ctx.importer();
            await importer.upsertNode(payload.address, { name: payload.address, metadata: { kind: 'event' } });
            await ctx.state.set('cursor', payload.address);
            order.push(`end:${payload.address}`);
          },
        },
      ],
    });
    await knowledge.reconcile();

    const importer = knowledge.getImporter('calendar')!;
    const first = importer.run(one, { address: 'first' });
    await firstStarted.promise;
    const second = importer.run(one, { address: 'second' });
    const binding = knowledgeImporterBindingKey(one);
    expect(
      (await knowledge.getImportStateInternal({ importerId: 'calendar', binding, key: 'cursor' }))?.value,
    ).toBeUndefined();
    releaseFirst.resolve();

    await expect(first).resolves.toMatchObject({ status: 'succeeded' });
    await expect(second).resolves.toMatchObject({ status: 'succeeded' });
    expect(order).toEqual(['start:first', 'end:first', 'start:second', 'end:second']);
    expect(await knowledge.getImportStateInternal({ importerId: 'calendar', binding, key: 'cursor' })).toMatchObject({
      value: 'second',
    });
  });

  it('runs different bindings concurrently while preserving same-binding serialization', async () => {
    const started = new Set<string>();
    const bothStarted = deferred();
    const release = deferred();
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'import-runner-bindings' }),
      structure,
      importers: [
        {
          id: 'issues',
          access: { 'project:$projectId': 'append' },
          handler: async ctx => {
            started.add(ctx.run.binding);
            if (started.size === 2) bothStarted.resolve();
            await release.promise;
          },
        },
      ],
    });
    await knowledge.reconcile();

    const importer = knowledge.getImporter('issues')!;
    const first = importer.run(one);
    const second = importer.run(two);
    await bothStarted.promise;
    expect(started).toEqual(new Set([knowledgeImporterBindingKey(one), knowledgeImporterBindingKey(two)]));
    release.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ status: 'succeeded' }),
      expect.objectContaining({ status: 'succeeded' }),
    ]);
  });

  it('skips overlapping cron runs and queues overlapping webhook runs for declared bindings', async () => {
    const started = deferred();
    const release = deferred();
    const handler = vi.fn(async () => {
      started.resolve();
      await release.promise;
    });
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'import-runner-triggers' }),
      structure,
      importers: [
        {
          id: 'calendar',
          access: { 'project:$projectId': 'append' },
          triggers: {
            cron: { schedule: '0 0 1 1 *', bindings: [one] },
            webhook: { bindings: [one] },
          },
          handler,
        },
      ],
    });
    await knowledge.reconcile();

    const running = knowledge.runImporter('calendar', one, undefined, { triggerKind: 'cron' });
    await started.promise;
    await expect(knowledge.runImporter('calendar', one, undefined, { triggerKind: 'cron' })).resolves.toMatchObject({
      status: 'skipped',
      triggerKind: 'cron',
    });
    const webhook = knowledge.runImporter('calendar', one, undefined, { triggerKind: 'webhook' });
    await expect(knowledge.runImporter('calendar', two, undefined, { triggerKind: 'webhook' })).rejects.toThrow(
      'does not allow this webhook binding',
    );
    release.resolve();
    await expect(Promise.all([running, webhook])).resolves.toEqual([
      expect.objectContaining({ status: 'succeeded', triggerKind: 'cron' }),
      expect.objectContaining({ status: 'succeeded', triggerKind: 'webhook' }),
    ]);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('fans scheduled cron runs out across each declared binding', async () => {
    vi.useFakeTimers();
    try {
      const handler = vi.fn(async () => {});
      const knowledge = new Knowledge({
        storage: new InMemoryStore({ id: 'import-runner-cron-fanout' }),
        structure,
        importers: [
          {
            id: 'calendar',
            access: { 'project:$projectId': 'append' },
            triggers: { cron: { schedule: '* * * * * *', bindings: [one, two] } },
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

  it('recovers stale running work from its durable payload after restart', async () => {
    const storage = new InMemoryStore({ id: 'import-runner-restart' });
    const processed: string[] = [];
    const handler = vi.fn(async context => {
      processed.push((context.payload as { event: string }).event);
    });
    const definition = {
      id: 'calendar',
      access: { 'project:$projectId': 'append' as const },
      handler,
    };
    const first = new Knowledge({ storage, structure, importers: [definition] });
    await first.reconcile();
    const domain = await first.getStorageInternal();
    const binding = knowledgeImporterBindingKey(one);
    await domain.enqueueImportRun({
      id: 'crashed-run',
      importerId: 'calendar',
      binding,
      importKind: 'static',
      triggerKind: 'programmatic',
      payloadKey: '__mastra_internal/import-payload/crashed-run',
      payload: JSON.stringify({ payload: { event: '42' } }),
      queuedAt: new Date('2020-01-01T00:00:00.000Z'),
    });
    await domain.claimImportRun({
      importerId: 'calendar',
      binding,
      workerId: 'dead-worker',
      leaseKey: '__mastra_internal/import-lease/',
      timestamp: new Date('2020-01-01T00:00:01.000Z'),
    });
    await domain.enqueueImportRun({
      id: 'queued-successor',
      importerId: 'calendar',
      binding,
      importKind: 'static',
      triggerKind: 'webhook',
      payloadKey: '__mastra_internal/import-payload/queued-successor',
      payload: JSON.stringify({ payload: { event: '43' } }),
      queuedAt: new Date('2020-01-01T00:00:00.000Z'),
    });

    const restarted = new Knowledge({ storage, structure, importers: [definition] });
    restarted.__registerMastra({} as never);
    await vi.waitFor(() => expect(processed).toEqual(['42', '43']));
    await vi.waitFor(async () => {
      const runs = await restarted.listImportRunsInternal({ importerId: 'calendar' });
      expect(runs.runs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'crashed-run', status: 'interrupted' }),
          expect.objectContaining({ status: 'succeeded' }),
        ]),
      );
    });
    await restarted.shutdownImporters();
  });

  it('leaves aborted shutdown work recoverable instead of failing it', async () => {
    const started = deferred();
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'import-runner-shutdown' }),
      structure,
      importers: [
        {
          id: 'calendar',
          access: { 'project:$projectId': 'append' },
          handler: async ctx => {
            started.resolve();
            await new Promise<void>((_resolve, reject) => {
              ctx.signal.addEventListener('abort', () => reject(ctx.signal.reason), { once: true });
            });
          },
        },
      ],
    });
    await knowledge.reconcile();

    const pending = knowledge.getImporter('calendar')!.run(one);
    const pendingAssertion = expect(pending).rejects.toThrow('shut down before the run completed');
    await started.promise;
    await knowledge.shutdownImporters();
    await pendingAssertion;
    expect((await knowledge.listImportRunsInternal({ importerId: 'calendar' })).runs).toEqual([
      expect.objectContaining({ status: 'running' }),
    ]);
  });

  it('replays a failed window after graph writes without duplicates and commits its cursor last', async () => {
    let attempt = 0;
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'import-runner-replay' }),
      structure,
      importers: [
        {
          id: 'calendar',
          access: { 'project:$projectId': 'edit' },
          handler: async ctx => {
            const importer = await ctx.importer();
            await importer.upsertNode('event:42', { name: 'Architecture review' });
            await ctx.state.set('cursor', 'event:42');
            if (attempt++ === 0) throw new Error('failure after graph write');
          },
        },
      ],
    });
    await knowledge.reconcile();
    const binding = knowledgeImporterBindingKey(one);

    await expect(knowledge.getImporter('calendar')!.run(one)).resolves.toMatchObject({ status: 'failed' });
    expect(await knowledge.getImportStateInternal({ importerId: 'calendar', binding, key: 'cursor' })).toBeNull();
    await expect(knowledge.getImporter('calendar')!.run(one)).resolves.toMatchObject({ status: 'succeeded' });
    expect(await knowledge.getImportStateInternal({ importerId: 'calendar', binding, key: 'cursor' })).toMatchObject({
      value: 'event:42',
    });

    const scope = await (await knowledge.getStorageInternal()).getScopeAddress(one.scope);
    expect(scope).toBeTruthy();
    expect(
      (await knowledge.listNodes({ scopeIds: [scope!.scopeNodeId] })).filter(
        node => node.name === 'Architecture review',
      ),
    ).toHaveLength(1);
  });

  it('sanitizes failures, keeps staged state unchanged, and rejects late runs during shutdown', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'import-runner-failure' }),
      structure,
      importers: [
        {
          id: 'calendar',
          access: { 'project:$projectId': 'append' },
          handler: async ctx => {
            await ctx.state.set('cursor', 'unsafe');
            throw new Error('secret\u0000token');
          },
        },
      ],
    });
    await knowledge.reconcile();

    await expect(knowledge.getImporter('calendar')!.run(one)).resolves.toMatchObject({
      status: 'failed',
      error: 'Error: secret token',
    });
    expect(
      await knowledge.getImportStateInternal({
        importerId: 'calendar',
        binding: knowledgeImporterBindingKey(one),
        key: 'cursor',
      }),
    ).toBeNull();
    await knowledge.shutdownImporters();
    await expect(knowledge.getImporter('calendar')!.run(one)).rejects.toThrow('shutting down');
  });

  it('runs registered agents with stable observational identity, bound tools, and checkpoint evidence', async () => {
    const executions: Array<{ prompt: string; options: Record<string, any> }> = [];
    const agent = {
      getMemory: async () => ({
        getMergedThreadConfig: () => ({ observationalMemory: { scope: 'resource' } }),
      }),
      generate: vi.fn(async (prompt: string, options: Record<string, any>) => {
        executions.push({ prompt, options });
        const tools = options.toolsets.knowledgeImport as Record<string, { execute: (input: any) => Promise<any> }>;
        const tool = (name: string) => Object.entries(tools).find(([key]) => key.endsWith(`_${name}`))![1];
        const node = await tool('upsertNode').execute({
          address: 'thread:architecture',
          name: 'Architecture decision',
        });
        const existing = await tool('listRecords').execute({
          address: 'thread:architecture',
        });
        if (!existing.some((record: { text: string }) => record.text === 'Use the canonical scope-node model.')) {
          await tool('appendRecord').execute({
            address: 'thread:architecture',
            text: 'Use the canonical scope-node model.',
            metadata: { checkpoint: 'message-42' },
          });
        }
        expect(node.name).toBe('Architecture decision');
        return { text: 'Done. <import-complete checkpoint="message-42" />' };
      }),
    } as unknown as Agent;
    const knowledge = new Knowledge({
      id: 'shipyard',
      description: 'Curated Shipyard feature knowledge',
      storage: new InMemoryStore({ id: 'import-runner-agentic' }),
      structure,
      importers: [
        {
          id: 'slack-distiller',
          access: { 'project:$projectId': 'edit' },
          agentic: { agent, maxSteps: 8 },
          handler: async ctx => {
            const payload = ctx.payload as { checkpoint: string };
            await ctx.agentImport!({
              instructions: 'Integrate architecture decisions.',
              data: { messages: ['canonical scope-node model'] },
              checkpoint: payload.checkpoint,
            });
            await ctx.state.set('checkpoint', payload.checkpoint);
          },
        },
      ],
    });
    await knowledge.reconcile();
    const importer = knowledge.getImporter('slack-distiller')!;

    const first = await importer.run(one, { checkpoint: 'message-42' });
    const second = await importer.run(one, { checkpoint: 'message-42' });

    expect(first.error).toBeUndefined();
    expect(first).toMatchObject({ status: 'succeeded', importKind: 'agentic' });
    expect(first.transcriptThreadId).toBe(`knowledge-import-run:${first.id}`);
    expect(second.transcriptThreadId).toBe(`knowledge-import-run:${second.id}`);
    expect(executions[0]!.options.memory.resource).toBe(executions[1]!.options.memory.resource);
    expect(executions[0]!.options.memory.thread).not.toBe(executions[1]!.options.memory.thread);
    expect(executions[0]!.options.maxSteps).toBe(8);
    expect(
      executions[0]!.options.prepareStep().activeTools.map((name: string) => name.slice(name.lastIndexOf('_') + 1)),
    ).toEqual(['getNode', 'listNodes', 'upsertNode', 'removeNode', 'appendRecord', 'listRecords', 'removeRecord']);
    expect(executions[0]!.options.prepareStep().activeTools).not.toEqual(
      executions[1]!.options.prepareStep().activeTools,
    );
    expect(executions[0]!.prompt).toContain('Curated Shipyard feature knowledge');
    expect(
      await knowledge.getImportStateInternal({
        importerId: 'slack-distiller',
        binding: knowledgeImporterBindingKey(one),
        key: 'checkpoint',
      }),
    ).toMatchObject({ value: 'message-42' });
    const scope = await (await knowledge.getStorageInternal()).getScopeAddress(one.scope);
    const nodes = await knowledge.listNodes({ scopeIds: [scope!.scopeNodeId] });
    const imported = nodes.filter(node => node.name === 'Architecture decision');
    expect(imported).toHaveLength(1);
    await expect(
      knowledge.listRecords({ node: imported[0]!.id, scopeIds: [scope!.scopeNodeId] }),
    ).resolves.toMatchObject({
      records: [expect.objectContaining({ text: 'Use the canonical scope-node model.' })],
    });
  });

  it('fails agentic runs without checkpoint evidence and keeps staged state uncommitted', async () => {
    const agent = {
      getMemory: async () => ({
        getMergedThreadConfig: () => ({ observationalMemory: { scope: 'resource' } }),
      }),
      generate: async (_prompt: string, options: Record<string, any>) => {
        const tools = options.toolsets.knowledgeImport as Record<string, { execute: (input: any) => Promise<any> }>;
        const upsert = Object.entries(tools).find(([key]) => key.endsWith('_upsertNode'))![1];
        await upsert.execute({ address: 'message:43', name: 'Failed import evidence' });
        return { text: 'I stopped before acknowledging the checkpoint.' };
      },
    } as unknown as Agent;
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'import-runner-agentic-failure' }),
      structure,
      importers: [
        {
          id: 'slack-distiller',
          access: { 'project:$projectId': 'edit' },
          agentic: { agent },
          handler: async ctx => {
            await ctx.agentImport!({ instructions: 'Integrate evidence.', data: {}, checkpoint: 'message-43' });
            await ctx.state.set('checkpoint', 'message-43');
          },
        },
      ],
    });
    await knowledge.reconcile();

    const run = await knowledge.getImporter('slack-distiller')!.run(one);

    expect(run).toMatchObject({
      status: 'failed',
      importKind: 'agentic',
      transcriptThreadId: `knowledge-import-run:${run.id}`,
    });
    expect(run.error).toContain('did not acknowledge checkpoint message-43');
    expect(
      await knowledge.getImportStateInternal({
        importerId: 'slack-distiller',
        binding: knowledgeImporterBindingKey(one),
        key: 'checkpoint',
      }),
    ).toBeNull();
  });
});
