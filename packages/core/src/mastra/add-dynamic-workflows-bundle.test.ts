/**
 * `Mastra.addDynamicWorkflows` — saving a root workflow together with the
 * helper workflows it nests, none of which exist yet.
 *
 * The contract that matters is all-or-nothing: a bundle either registers
 * every member or registers none of them. Partial application would leave
 * orphaned helper workflows in the registry that the author never approved,
 * which is the whole reason this primitive exists rather than callers looping
 * over `addDynamicWorkflow`.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryStore, WorkflowDefinitionOwnershipConflictError } from '../storage';
import { createTool } from '../tools';
import { Mastra } from './index';

const lookupCustomer = createTool({
  id: 'lookup-customer',
  description: 'Looks a customer up by email',
  inputSchema: z.object({ email: z.string() }),
  outputSchema: z.object({ customerId: z.string(), email: z.string() }),
  execute: async ({ email }) => ({ customerId: 'customer-123', email }),
});

const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
});
const stringSchema = { type: 'string' };
const customerSchema = objectSchema({ customerId: stringSchema, email: stringSchema }, ['customerId', 'email']);

/** A helper that pulls one email field off a two-email input and looks it up. */
function helperDefinition(id: string, sourceField: string) {
  return {
    id,
    description: `Looks up the customer named by "${sourceField}".`,
    inputSchema: objectSchema({ email1: stringSchema, email2: stringSchema }, ['email1', 'email2']),
    outputSchema: customerSchema,
    graph: [
      {
        type: 'mapping' as const,
        id: `${id}-input`,
        mapConfig: JSON.stringify({ email: { initData: true, path: sourceField } }),
      },
      { type: 'tool' as const, id: `${id}-lookup`, toolId: 'lookup-customer' },
    ],
  };
}

/** The root: a real parallel over both helpers, merged by call-site id. */
const rootDefinition = {
  id: 'parallel-customer-lookup',
  description: 'Looks up two customers in parallel.',
  inputSchema: objectSchema({ email1: stringSchema, email2: stringSchema }, ['email1', 'email2']),
  outputSchema: objectSchema({ first: customerSchema, second: customerSchema }, ['first', 'second']),
  graph: [
    {
      type: 'parallel' as const,
      steps: [
        { type: 'workflow' as const, id: 'first-branch', workflowId: 'lookup-first-customer' },
        { type: 'workflow' as const, id: 'second-branch', workflowId: 'lookup-second-customer' },
      ],
    },
    {
      type: 'mapping' as const,
      id: 'parallel-customer-results',
      mapConfig: JSON.stringify({
        first: { step: 'first-branch', path: '' },
        second: { step: 'second-branch', path: '' },
      }),
    },
  ],
};

function createMastra(id: string) {
  return new Mastra({
    logger: false,
    tools: { 'lookup-customer': lookupCustomer } as any,
    storage: new InMemoryStore({ id }),
  });
}

describe('Mastra.addDynamicWorkflows', () => {
  it('registers a root together with the helpers it nests, which do not exist yet', async () => {
    const mastra = createMastra('bundle-happy');

    await expect(
      mastra.addDynamicWorkflows([
        helperDefinition('lookup-first-customer', 'email1'),
        helperDefinition('lookup-second-customer', 'email2'),
        rootDefinition,
      ]),
    ).resolves.toBeUndefined();

    expect(mastra.getWorkflow('lookup-first-customer')).toBeDefined();
    expect(mastra.getWorkflow('lookup-second-customer')).toBeDefined();
    expect(mastra.getWorkflow('parallel-customer-lookup')).toBeDefined();
  });

  it('derives hydration order rather than trusting the caller to sort the bundle', async () => {
    const mastra = createMastra('bundle-unsorted');

    // Root first — hydrating it before its helpers would fail to resolve them.
    await expect(
      mastra.addDynamicWorkflows([
        rootDefinition,
        helperDefinition('lookup-second-customer', 'email2'),
        helperDefinition('lookup-first-customer', 'email1'),
      ]),
    ).resolves.toBeUndefined();

    expect(mastra.getWorkflow('parallel-customer-lookup')).toBeDefined();
  });

  it('runs the bundled root end to end, routing each branch to its own email', async () => {
    const mastra = createMastra('bundle-runnable');

    await mastra.addDynamicWorkflows([
      helperDefinition('lookup-first-customer', 'email1'),
      helperDefinition('lookup-second-customer', 'email2'),
      rootDefinition,
    ]);

    const run = await mastra.getWorkflow('parallel-customer-lookup').createRun();
    const result = await run.start({ inputData: { email1: 'ada@example.com', email2: 'grace@example.com' } });

    expect(result.status).toBe('success');
    // The distinct emails are what prove each branch mapped its own field
    // instead of both branches collapsing onto the same shared input.
    expect((result as { result: unknown }).result).toEqual({
      first: { customerId: 'customer-123', email: 'ada@example.com' },
      second: { customerId: 'customer-123', email: 'grace@example.com' },
    });
  });

  it('registers nothing when one member is invalid', async () => {
    const mastra = createMastra('bundle-invalid-member');

    await expect(
      mastra.addDynamicWorkflows([
        helperDefinition('lookup-first-customer', 'email1'),
        {
          ...helperDefinition('lookup-second-customer', 'email2'),
          graph: [{ type: 'tool' as const, id: 'missing', toolId: 'no-such-tool' }],
        },
        rootDefinition,
      ]),
    ).rejects.toThrow(/no-such-tool/);

    // The valid helper must not survive the rejected bundle.
    expect(() => mastra.getWorkflow('lookup-first-customer')).toThrow();
    expect(() => mastra.getWorkflow('lookup-second-customer')).toThrow();
    expect(() => mastra.getWorkflow('parallel-customer-lookup')).toThrow();
  });

  it('rejects a bundle whose members nest each other in a cycle', async () => {
    const mastra = createMastra('bundle-cycle');

    const cyclic = (id: string, nests: string) => ({
      id,
      inputSchema: objectSchema({ email1: stringSchema, email2: stringSchema }, ['email1', 'email2']),
      outputSchema: customerSchema,
      graph: [{ type: 'workflow' as const, id: `${id}-call`, workflowId: nests }],
    });

    await expect(
      mastra.addDynamicWorkflows([cyclic('cycle-a', 'cycle-b'), cyclic('cycle-b', 'cycle-a')]),
    ).rejects.toThrow(/circular nested-workflow dependency among: cycle-a, cycle-b/);

    expect(() => mastra.getWorkflow('cycle-a')).toThrow();
    expect(() => mastra.getWorkflow('cycle-b')).toThrow();
  });

  it('rejects a bundle carrying the same id twice', async () => {
    const mastra = createMastra('bundle-duplicate');

    await expect(
      mastra.addDynamicWorkflows([
        helperDefinition('lookup-first-customer', 'email1'),
        helperDefinition('lookup-first-customer', 'email2'),
      ]),
    ).rejects.toThrow(/more than one definition with id "lookup-first-customer"/);

    expect(() => mastra.getWorkflow('lookup-first-customer')).toThrow();
  });

  /**
   * The tests above are all rejected during validation, which runs before
   * anything is mutated. These two fail during PERSISTENCE — after every
   * member has already been hydrated and live-registered — so they are the
   * ones that actually exercise the registry rollback.
   */
  it('unregisters every member when persistence fails partway through the bundle', async () => {
    const storage = new InMemoryStore({ id: 'bundle-rollback-persist' });
    const mastra = new Mastra({ logger: false, tools: { 'lookup-customer': lookupCustomer } as any, storage });

    const store = (await storage.getStore('workflowDefinitions'))!;
    const realUpsert = store.upsert.bind(store);
    let upserts = 0;
    store.upsert = (async (definition: Parameters<typeof realUpsert>[0]) => {
      upserts += 1;
      if (upserts === 2) throw new Error('storage exploded mid-bundle');
      return realUpsert(definition);
    }) as typeof store.upsert;

    await expect(
      mastra.addDynamicWorkflows([
        helperDefinition('lookup-first-customer', 'email1'),
        helperDefinition('lookup-second-customer', 'email2'),
        rootDefinition,
      ]),
    ).rejects.toThrow('storage exploded mid-bundle');

    // All three were registered before the write failed; none may survive it.
    expect(() => mastra.getWorkflow('lookup-first-customer')).toThrow();
    expect(() => mastra.getWorkflow('lookup-second-customer')).toThrow();
    expect(() => mastra.getWorkflow('parallel-customer-lookup')).toThrow();
  });

  it('restores the previous registration when a bundle replacing it fails to persist', async () => {
    const storage = new InMemoryStore({ id: 'bundle-rollback-existing' });
    const mastra = new Mastra({ logger: false, tools: { 'lookup-customer': lookupCustomer } as any, storage });

    await mastra.addDynamicWorkflows([helperDefinition('lookup-first-customer', 'email1')]);
    const original = mastra.getWorkflow('lookup-first-customer');

    const store = (await storage.getStore('workflowDefinitions'))!;
    store.upsert = (async () => {
      throw new Error('storage exploded on replace');
    }) as typeof store.upsert;

    await expect(
      mastra.addDynamicWorkflows([
        helperDefinition('lookup-first-customer', 'email2'),
        helperDefinition('lookup-second-customer', 'email2'),
      ]),
    ).rejects.toThrow('storage exploded on replace');

    // The surviving workflow must be the ORIGINAL instance, not the
    // replacement that shipped in the rejected bundle.
    expect(mastra.getWorkflow('lookup-first-customer')).toBe(original);
    expect(() => mastra.getWorkflow('lookup-second-customer')).toThrow();
  });

  it('persists every member so the bundle survives a restart', async () => {
    const storage = new InMemoryStore({ id: 'bundle-persistence' });
    const mastra = new Mastra({ logger: false, tools: { 'lookup-customer': lookupCustomer } as any, storage });

    await mastra.addDynamicWorkflows([
      helperDefinition('lookup-first-customer', 'email1'),
      helperDefinition('lookup-second-customer', 'email2'),
      rootDefinition,
    ]);

    const store = await storage.getStore('workflowDefinitions');
    const { definitions } = await store!.list({ status: 'active' });
    expect(definitions.map(definition => definition.id).sort()).toEqual([
      'lookup-first-customer',
      'lookup-second-customer',
      'parallel-customer-lookup',
    ]);
  });

  it('persists one trusted author for every member outside the workflow definitions', async () => {
    const storage = new InMemoryStore({ id: 'bundle-author' });
    const mastra = new Mastra({ logger: false, tools: { 'lookup-customer': lookupCustomer } as any, storage });

    const untrustedHelper = {
      ...helperDefinition('lookup-first-customer', 'email1'),
      authorId: 'forged-author',
    };

    await mastra.addDynamicWorkflows(
      [untrustedHelper, helperDefinition('lookup-second-customer', 'email2'), rootDefinition],
      { authorId: 'verified-author' },
    );

    const store = (await storage.getStore('workflowDefinitions'))!;
    const { definitions } = await store.list({ status: 'active' });

    expect(definitions).toHaveLength(3);
    expect(definitions.every(definition => definition.authorId === 'verified-author')).toBe(true);
  });

  it('rejects an authored bundle before live registration when workflow definition storage is unavailable', async () => {
    const storage = new InMemoryStore({ id: 'bundle-author-no-definition-store' });
    const getStore = storage.getStore.bind(storage);
    storage.getStore = (async domain =>
      domain === 'workflowDefinitions' ? undefined : getStore(domain)) as typeof storage.getStore;
    const mastra = new Mastra({ logger: false, tools: { 'lookup-customer': lookupCustomer } as any, storage });

    await expect(
      mastra.addDynamicWorkflow(helperDefinition('lookup-first-customer', 'email1'), {
        authorId: 'verified-author',
      }),
    ).rejects.toThrow(/workflowDefinitions storage domain is required/);

    expect(() => mastra.getWorkflow('lookup-first-customer')).toThrow();
  });

  it('preserves an existing author when a trusted author is omitted on replacement', async () => {
    const storage = new InMemoryStore({ id: 'bundle-author-preserved' });
    const mastra = new Mastra({ logger: false, tools: { 'lookup-customer': lookupCustomer } as any, storage });

    await mastra.addDynamicWorkflow(helperDefinition('lookup-first-customer', 'email1'), {
      authorId: 'verified-author',
    });
    await mastra.addDynamicWorkflow(helperDefinition('lookup-first-customer', 'email2'));

    const store = (await storage.getStore('workflowDefinitions'))!;
    const definition = await store.get('lookup-first-customer');

    expect(definition?.authorId).toBe('verified-author');
  });

  it('rejects a different trusted author and restores the previous registration', async () => {
    const storage = new InMemoryStore({ id: 'bundle-author-conflict' });
    const mastra = new Mastra({ logger: false, tools: { 'lookup-customer': lookupCustomer } as any, storage });

    await mastra.addDynamicWorkflow(helperDefinition('lookup-first-customer', 'email1'), {
      authorId: 'verified-author',
    });
    const original = mastra.getWorkflow('lookup-first-customer');

    await expect(
      mastra.addDynamicWorkflow(helperDefinition('lookup-first-customer', 'email2'), {
        authorId: 'other-author',
      }),
    ).rejects.toBeInstanceOf(WorkflowDefinitionOwnershipConflictError);

    expect(mastra.getWorkflow('lookup-first-customer')).toBe(original);
    const store = (await storage.getStore('workflowDefinitions'))!;
    expect((await store.get('lookup-first-customer'))?.authorId).toBe('verified-author');
  });

  it('serializes overlapping bundles so a rejected owner cannot roll back the winner', async () => {
    const storage = new InMemoryStore({ id: 'bundle-concurrent-owner-conflict' });
    const mastra = new Mastra({ logger: false, tools: { 'lookup-customer': lookupCustomer } as any, storage });
    const store = (await storage.getStore('workflowDefinitions'))!;
    const realUpsert = store.upsert.bind(store);

    let releaseFirstUpsert!: () => void;
    const firstUpsertEntered = new Promise<void>(resolve => {
      releaseFirstUpsert = resolve;
    });
    let upsertCalls = 0;
    store.upsert = (async definition => {
      upsertCalls += 1;
      if (upsertCalls === 1) {
        releaseFirstUpsert();
        // Keep the first bundle inside persistence for one event-loop turn.
        // Without registration serialization, the overlapping bundle can
        // replace its registry slots and win storage before this write resumes.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
      return realUpsert(definition);
    }) as typeof store.upsert;

    const winner = mastra.addDynamicWorkflows(
      [
        { ...helperDefinition('shared-helper', 'email1'), description: 'winner' },
        helperDefinition('winner-only', 'email1'),
      ],
      { authorId: 'winner-author' },
    );
    await firstUpsertEntered;

    const loser = mastra.addDynamicWorkflows(
      [
        { ...helperDefinition('shared-helper', 'email2'), description: 'loser' },
        helperDefinition('loser-only', 'email2'),
      ],
      { authorId: 'loser-author' },
    );

    const [winnerResult, loserResult] = await Promise.allSettled([winner, loser]);
    expect(winnerResult.status).toBe('fulfilled');
    expect(loserResult).toMatchObject({
      status: 'rejected',
      reason: expect.any(WorkflowDefinitionOwnershipConflictError),
    });

    expect(await store.get('shared-helper')).toMatchObject({ authorId: 'winner-author', description: 'winner' });
    expect(await store.get('winner-only')).toMatchObject({ authorId: 'winner-author' });
    expect(await store.get('loser-only')).toBeNull();

    expect(mastra.getWorkflow('shared-helper').description).toBe('winner');
    expect(mastra.getWorkflow('winner-only')).toBeDefined();
    expect(() => mastra.getWorkflow('loser-only')).toThrow();
  });

  it('does not let a hung write block unrelated ids and times out an overlapping waiter before mutation', async () => {
    const storage = new InMemoryStore({ id: 'bundle-keyed-registration-queue' });
    const mastra = new Mastra({ logger: false, tools: { 'lookup-customer': lookupCustomer } as any, storage });
    const store = (await storage.getStore('workflowDefinitions'))!;
    const realUpsert = store.upsert.bind(store);

    let releaseHungWrite!: () => void;
    const hungWrite = new Promise<void>(resolve => {
      releaseHungWrite = resolve;
    });
    let markHungWriteEntered!: () => void;
    const hungWriteEntered = new Promise<void>(resolve => {
      markHungWriteEntered = resolve;
    });
    const mutatedDescriptions: string[] = [];
    store.upsert = (async definition => {
      if (definition.id === 'blocked' && definition.description === 'first') {
        markHungWriteEntered();
        await hungWrite;
      }
      mutatedDescriptions.push(definition.description ?? '');
      return realUpsert(definition);
    }) as typeof store.upsert;

    const first = mastra.addDynamicWorkflow(
      { ...helperDefinition('blocked', 'email1'), description: 'first' },
      { authorId: 'owner' },
    );
    await hungWriteEntered;

    await expect(
      mastra.addDynamicWorkflow(
        { ...helperDefinition('unrelated', 'email1'), description: 'unrelated' },
        { authorId: 'owner' },
      ),
    ).resolves.toBeUndefined();

    await expect(
      mastra.addDynamicWorkflow(
        { ...helperDefinition('blocked', 'email2'), description: 'timed-out' },
        { authorId: 'owner', waitTimeoutMs: 1 },
      ),
    ).rejects.toThrow(/Timed out waiting/);
    const controller = new AbortController();
    controller.abort(new Error('caller cancelled'));
    await expect(
      mastra.addDynamicWorkflow(
        { ...helperDefinition('blocked', 'email2'), description: 'cancelled' },
        { authorId: 'owner', signal: controller.signal },
      ),
    ).rejects.toThrow(/caller cancelled/);
    expect(mutatedDescriptions).not.toContain('timed-out');
    expect(mutatedDescriptions).not.toContain('cancelled');
    expect(mastra.getWorkflow('blocked').description).toBe('first');

    let laterSettled = false;
    const later = mastra
      .addDynamicWorkflow({ ...helperDefinition('blocked', 'email2'), description: 'later' }, { authorId: 'owner' })
      .finally(() => {
        laterSettled = true;
      });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(laterSettled).toBe(false);

    releaseHungWrite();
    await first;
    await later;
    expect(await store.get('blocked')).toMatchObject({ description: 'later', authorId: 'owner' });
    expect(await store.get('unrelated')).toMatchObject({ description: 'unrelated', authorId: 'owner' });
    expect(mutatedDescriptions).not.toContain('timed-out');
    expect(mutatedDescriptions).not.toContain('cancelled');
    expect(mutatedDescriptions).toContain('later');
  });

  it('is a no-op for an empty bundle', async () => {
    const mastra = createMastra('bundle-empty');
    await expect(mastra.addDynamicWorkflows([])).resolves.toBeUndefined();
  });
});
