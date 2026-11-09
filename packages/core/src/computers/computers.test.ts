import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Mastra } from '../mastra';
import { InMemoryComputersStorage, InMemoryStore } from '../storage';
import { Computers } from './computers.js';
import type { ComputerProvider, ComputerSandbox } from './computers.js';

const context = { agent: { resourceId: 'resource', threadId: 'thread' } } as any;

function sandbox(id = 'sandbox-1'): ComputerSandbox {
  return {
    sandboxId: id,
    async start() {},
    destroy: vi.fn(async () => {}),
    captureCheckpoint: vi.fn(async () => ({ status: 'captured' as const })),
    async executeCommand() {
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    computer: {
      async screenshot() {
        return { data: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), mediaType: 'image/png' };
      },
      async leftClick() {},
      async rightClick() {},
      async doubleClick() {},
      async moveMouse() {},
      async drag() {},
      async scroll() {},
      async type() {},
      async press() {},
      async getScreenSize() {
        return { width: 1024, height: 640 };
      },
      async getCursorPosition() {
        return { x: 0, y: 0 };
      },
    },
  };
}

function provider(created: ComputerSandbox[] = []): ComputerProvider {
  return {
    id: 'test',
    macContext: 'test-context',
    create(input) {
      const next = sandbox(input.sandboxId);
      created.push(next);
      return next;
    },
    async viewer(machine) {
      return machine.sandboxId ? { url: `https://viewer.test/${machine.sandboxId}`, headers: {} } : null;
    },
  };
}

describe('Computers', () => {
  beforeEach(() => {
    process.env.MASTRA_EXPERIMENTAL_COMPUTER = 'true';
  });

  afterEach(() => {
    delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
  });

  it('stays disabled without the experimental flag', () => {
    delete process.env.MASTRA_EXPERIMENTAL_COMPUTER;
    expect(() => new Computers({ provider: provider(), secret: 'secret' })).toThrow('MASTRA_EXPERIMENTAL_COMPUTER');
  });

  it('owns the fixed tool ids and emits provider-neutral attachments', async () => {
    const computers = new Computers({ provider: provider(), secret: 'secret' });
    expect(Object.keys(computers.tools())).toEqual([
      'mastra_workspace_computer_list',
      'mastra_workspace_computer_create',
      'mastra_workspace_computer_attach',
      'mastra_workspace_computer_release',
      'mastra_workspace_computer_request_human',
      'mastra_workspace_computer_snapshot',
      'mastra_workspace_computer_destroy',
    ]);
    for (const [id, tool] of Object.entries(computers.tools())) {
      expect(tool.id).toBe(id);
      expect((tool as typeof tool & { orderedToolGroup?: string }).orderedToolGroup).toBe('workspace-computer');
    }
    const result = await (computers.tools().mastra_workspace_computer_create as any).execute({ persist: false }, context);
    expect(result.computer).toMatchObject({ status: 'attached', persistent: false });
    expect(result.computer.id).toMatch(/^cmp_e_sandbox-1_[A-Za-z0-9_-]{22}$/);
    await expect(computers.viewer(result.computer.id, { resourceId: 'resource', threadId: 'thread' })).resolves.toEqual({
      url: 'https://viewer.test/sandbox-1',
      headers: {},
    });
  });

  it('mints provider embeds only for an attached owner scope', async () => {
    const embed: NonNullable<ComputerProvider['embed']> = vi.fn(
      async (_machine, options) => `https://embed.test/${options.mode}`,
    );
    const computers = new Computers({ provider: { ...provider(), embed }, secret: 'secret' });
    const created = await (computers.tools().mastra_workspace_computer_create as any).execute({ persist: false }, context);
    const scope = { resourceId: 'resource', threadId: 'thread' };

    await expect(computers.embed(created.computer.id, scope, { origin: 'https://app.slack.com', mode: 'watch' })).resolves.toBe(
      'https://embed.test/watch',
    );
    expect(embed).toHaveBeenCalledWith(expect.objectContaining({ sandboxId: 'sandbox-1' }), {
      origin: 'https://app.slack.com',
      mode: 'watch',
    });
    await expect(
      computers.embed(created.computer.id, { ...scope, threadId: 'other' }, { origin: 'https://app.slack.com', mode: 'watch' }),
    ).rejects.toThrow();
  });

  it('binds signed ids to the owning resource', async () => {
    const computers = new Computers({ provider: provider(), secret: 'secret' });
    const created = await (computers.tools().mastra_workspace_computer_create as any).execute({ persist: false }, context);
    const attached = await (computers.tools().mastra_workspace_computer_attach as any).execute(
      { id: created.computer.id },
      { agent: { resourceId: 'other', threadId: 'thread' } },
    );
    expect(attached).toBe('computer not found');
  });

  it('increments control revisions and reference-counts duplicate subscriber owners', async () => {
    const computers = new Computers({ provider: provider(), secret: 'secret' });
    const created = await (computers.tools().mastra_workspace_computer_create as any).execute({}, context);
    const revisions: number[] = [];
    const enforce = async ({ control }: any) => {
      revisions.push(control.revision);
      return { status: 'enforced' as const, enforcedRevision: control.revision };
    };
    const subscriber = { id: 'relay', required: true, enforce };
    const disposeFirst = computers.registerControlSubscriber(subscriber);
    const disposeSecond = computers.registerControlSubscriber(subscriber);
    disposeFirst();

    await expect(
      computers.control(created.computer.id, { resourceId: 'resource', threadId: 'thread' }, { action: 'take' }),
    ).resolves.toMatchObject({ holder: 'human', revision: 1 });
    expect(await computers.controlState(created.computer.id, { resourceId: 'resource', threadId: 'thread' })).toMatchObject({
      holder: 'human',
      revision: 1,
    });
    await expect(
      computers.control(created.computer.id, { resourceId: 'resource', threadId: 'thread' }, { action: 'release' }),
    ).resolves.toMatchObject({ holder: 'agent', revision: 2 });
    expect(revisions).toEqual([1, 2]);

    disposeSecond();
  });

  it('snapshots a persistent attachment after process restart without an explicit attach', async () => {
    const storage = new InMemoryStore();
    storage.stores.computers = new InMemoryComputersStorage();
    const first = new Computers({ provider: provider(), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: first });
    await (first.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context);

    const reattached: ComputerSandbox[] = [];
    const second = new Computers({ provider: provider(reattached), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: second });
    await expect((second.tools().mastra_workspace_computer_snapshot as any).execute({}, context)).resolves.toEqual({
      status: 'captured',
    });
    expect(reattached).toHaveLength(1);
    expect(reattached[0]!.captureCheckpoint).toHaveBeenCalledOnce();
  });

  it('serializes snapshots behind mutations and rechecks control before capture', async () => {
    const createdSandboxes: ComputerSandbox[] = [];
    const computers = new Computers({ provider: provider(createdSandboxes), secret: 'secret' });
    const created = await (computers.tools().mastra_workspace_computer_create as any).execute({}, context);
    const captureCheckpoint = vi.fn(async () => ({ status: 'captured' as const }));
    createdSandboxes[0]!.captureCheckpoint = captureCheckpoint;
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>(resolve => (release = resolve));
    const started = new Promise<void>(resolve => (entered = resolve));
    const mutation = computers.runComputerAction(
      { sandboxId: 'sandbox-1', action: 'mutate', context },
      async () => {
        entered();
        await blocked;
      },
    );
    await started;

    const snapshot = (computers.tools().mastra_workspace_computer_snapshot as any).execute({}, context);
    await Promise.resolve();
    expect(captureCheckpoint).not.toHaveBeenCalled();
    await computers.control(created.computer.id, { resourceId: 'resource', threadId: 'thread' }, { action: 'take' });
    release();
    await mutation;

    await expect(snapshot).resolves.toBe('the user has control of this computer; wait for them to hand it back');
    expect(captureCheckpoint).not.toHaveBeenCalled();
  });

  it('fails managed mutations closed until required subscribers enforce the revision', async () => {
    const computers = new Computers({ provider: provider(), secret: 'secret' });
    const created = await (computers.tools().mastra_workspace_computer_create as any).execute({}, context);
    computers.registerControlSubscriber({
      id: 'relay',
      required: true,
      async enforce() {
        return { status: 'retryable', error: 'relay unavailable' };
      },
    });
    await computers.control(created.computer.id, { resourceId: 'resource', threadId: 'thread' }, { action: 'take' });
    await computers.control(created.computer.id, { resourceId: 'resource', threadId: 'thread' }, { action: 'release' });
    await expect(
      computers.runComputerAction(
        { sandboxId: 'sandbox-1', action: 'mutate', context },
        async () => 'mutated',
      ),
    ).rejects.toThrow('still being enforced');
  });

  it('bounds request_human enforcement and refuses later queued actions while pending', async () => {
    vi.useFakeTimers();
    try {
      const computers = new Computers({ provider: provider(), secret: 'secret' });
      await (computers.tools().mastra_workspace_computer_create as any).execute({}, context);
      computers.registerControlSubscriber({
        id: 'hanging-request-human-relay',
        required: true,
        async enforce() {
          return new Promise(() => {});
        },
      });

      let settled = false;
      const requested = (computers.tools().mastra_workspace_computer_request_human as any)
        .execute({ reason: 'log in' }, context)
        .then((result: unknown) => {
          settled = true;
          return result;
        });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(settled).toBe(true);
      await expect(requested).resolves.toMatchObject({ control: 'human', revision: 1, enforced: false });
      await expect(
        computers.runComputerAction(
          { sandboxId: 'sandbox-1', action: 'mutate', context },
          async () => 'mutated',
        ),
      ).rejects.toThrow('the user has control of this computer; wait for them to hand it back');
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds control enforcement and reports pending state when a subscriber hangs', async () => {
    vi.useFakeTimers();
    try {
      const computers = new Computers({ provider: provider(), secret: 'secret' });
      const created = await (computers.tools().mastra_workspace_computer_create as any).execute({}, context);
      computers.registerControlSubscriber({
        id: 'hung-relay',
        required: true,
        enforce: async () => new Promise(() => {}),
      });

      const change = computers.control(
        created.computer.id,
        { resourceId: 'resource', threadId: 'thread' },
        { action: 'take' },
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(change).resolves.toMatchObject({ holder: 'human', notified: false, reason: 'not-delivered' });
      await expect(
        computers.controlState(created.computer.id, { resourceId: 'resource', threadId: 'thread' }),
      ).resolves.toMatchObject({ holder: 'human', enforced: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it('persists request_human control across restart and refuses agent pixel actions', async () => {
    const storage = new InMemoryStore();
    storage.stores.computers = new InMemoryComputersStorage();
    const first = new Computers({ provider: provider(), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: first });
    const created = await (first.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context);
    await expect(
      (first.tools().mastra_workspace_computer_request_human as any).execute({ reason: 'sign in' }, context),
    ).resolves.toMatchObject({ control: 'human', revision: 1, enforced: true });

    const second = new Computers({ provider: provider(), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: second });
    const restartedContext = { agent: { resourceId: 'resource', threadId: 'after-restart' } } as any;
    await (second.tools().mastra_workspace_computer_attach as any).execute({ id: created.computer.id }, restartedContext);
    await expect(
      second.controlState(created.computer.id, { resourceId: 'resource', threadId: 'after-restart' }),
    ).resolves.toMatchObject({ holder: 'human', reason: 'sign in', revision: 1, enforced: true });
    await expect(
      second.runComputerAction(
        { sandboxId: 'sandbox-1', action: 'mutate', context: restartedContext },
        async () => 'mutated',
      ),
    ).rejects.toThrow('the user has control of this computer; wait for them to hand it back');
  });

  it('restores persistent control when attaching after restart', async () => {
    const storage = new InMemoryStore();
    storage.stores.computers = new InMemoryComputersStorage();
    const first = new Computers({ provider: provider(), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: first });
    const created = await (first.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context);
    expect(created.computer.id).toMatch(/^cmp_p2_[0-9a-f]{32}_[A-Za-z0-9_-]{22}$/);
    await first.control(created.computer.id, { resourceId: 'resource', threadId: 'thread' }, { action: 'take' });

    const second = new Computers({ provider: provider(), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: second });
    const otherContext = { agent: { resourceId: 'resource', threadId: 'other-thread' } };
    await (second.tools().mastra_workspace_computer_attach as any).execute({ id: created.computer.id }, otherContext);
    await expect(second.controlState(created.computer.id, { resourceId: 'resource', threadId: 'other-thread' })).resolves.toMatchObject({
      holder: 'human',
      revision: 1,
    });
  });

  it('does not let an older thread pointer regress live persistent control', async () => {
    const storage = new InMemoryStore();
    storage.stores.computers = new InMemoryComputersStorage();
    const first = new Computers({ provider: provider(), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: first });
    const created = await (first.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context);
    await first.control(created.computer.id, { resourceId: 'resource', threadId: 'thread' }, { action: 'take' });

    const second = new Computers({ provider: provider(), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: second });
    const otherScope = { resourceId: 'resource', threadId: 'other-thread' };
    await (second.tools().mastra_workspace_computer_attach as any).execute(
      { id: created.computer.id },
      { agent: otherScope },
    );
    await second.control(created.computer.id, otherScope, { action: 'release' });

    await expect(second.controlState(created.computer.id, { resourceId: 'resource', threadId: 'thread' })).resolves.toMatchObject({
      holder: 'agent',
      revision: 2,
    });
  });

  it('rolls back persistent creation when the attachment catalog update fails', async () => {
    const storage = new InMemoryStore();
    const computerStorage = new InMemoryComputersStorage();
    const setComputer = computerStorage.setComputer.bind(computerStorage);
    let writes = 0;
    computerStorage.setComputer = vi.fn(async record => {
      writes += 1;
      if (writes === 2) throw new Error('attachment catalog unavailable');
      await setComputer(record);
    });
    storage.stores.computers = computerStorage;
    const created: ComputerSandbox[] = [];
    const computers = new Computers({ provider: provider(created), secret: 'secret' });
    new Mastra({ logger: false, storage, computers });

    await expect(
      (computers.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context),
    ).rejects.toThrow('attachment catalog unavailable');
    expect(created[0]!.destroy).toHaveBeenCalledOnce();
    await expect(computerStorage.listComputers('resource')).resolves.toEqual([]);
    await expect((computers.tools().mastra_workspace_computer_list as any).execute({}, context)).resolves.toEqual({ computers: [] });
    await expect(
      storage.stores.threadState!.getState({ threadId: 'thread', type: 'mastra-computer:resource' }),
    ).resolves.toBeUndefined();
  });

  it('rolls back persistent creation when the attachment thread-state write fails', async () => {
    const storage = new InMemoryStore();
    const computerStorage = new InMemoryComputersStorage();
    storage.stores.computers = computerStorage;
    storage.stores.threadState!.setState = vi.fn(async () => {
      throw new Error('thread state unavailable');
    });
    const created: ComputerSandbox[] = [];
    const computers = new Computers({ provider: provider(created), secret: 'secret' });
    new Mastra({ logger: false, storage, computers });

    await expect(
      (computers.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context),
    ).rejects.toThrow('thread state unavailable');
    expect(created[0]!.destroy).toHaveBeenCalledOnce();
    await expect(computerStorage.listComputers('resource')).resolves.toEqual([]);
    await expect((computers.tools().mastra_workspace_computer_list as any).execute({}, context)).resolves.toEqual({ computers: [] });
    await expect(
      storage.stores.threadState!.getState({ threadId: 'thread', type: 'mastra-computer:resource' }),
    ).resolves.toBeUndefined();
  });

  it('destroys a provisioned sandbox when the persistent catalog write fails', async () => {
    const storage = new InMemoryStore();
    const computerStorage = new InMemoryComputersStorage();
    computerStorage.setComputer = vi.fn(async () => {
      throw new Error('catalog unavailable');
    });
    storage.stores.computers = computerStorage;
    const created: ComputerSandbox[] = [];
    const computers = new Computers({ provider: provider(created), secret: 'secret' });
    new Mastra({ logger: false, storage, computers });

    await expect(
      (computers.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context),
    ).rejects.toThrow('catalog unavailable');
    expect(created).toHaveLength(1);
    expect(created[0]!.destroy).toHaveBeenCalledOnce();
  });

  it('fails persistent creation before provisioning when computer storage is unavailable', async () => {
    const created: ComputerSandbox[] = [];
    const computers = new Computers({ provider: provider(created), secret: 'secret' });
    new Mastra({ logger: false, storage: new InMemoryStore(), computers });
    await expect((computers.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context)).resolves.toBe(
      'persistent computers require computers and thread-state storage',
    );
    expect(created).toEqual([]);
  });
});
