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
    async destroy() {},
    async captureCheckpoint() {
      return { status: 'captured' };
    },
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

  it('hydrates persistent attachments and human control across a process restart', async () => {
    const storage = new InMemoryStore();
    storage.stores.computers = new InMemoryComputersStorage();
    const first = new Computers({ provider: provider(), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: first });
    const created = await (first.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context);
    expect(created.computer.id).toMatch(/^cmp_p2_[0-9a-f]{32}_[A-Za-z0-9_-]{22}$/);
    await first.control(created.computer.id, { resourceId: 'resource', threadId: 'thread' }, { action: 'take' });

    const second = new Computers({ provider: provider(), secret: 'secret' });
    new Mastra({ logger: false, storage, computers: second });
    await expect(second.controlState(created.computer.id, { resourceId: 'resource', threadId: 'thread' })).resolves.toMatchObject({
      holder: 'human',
      revision: 1,
    });
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
