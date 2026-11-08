import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

  it('binds signed ids to the owning resource', async () => {
    const computers = new Computers({ provider: provider(), secret: 'secret' });
    const created = await (computers.tools().mastra_workspace_computer_create as any).execute({ persist: true }, context);
    const attached = await (computers.tools().mastra_workspace_computer_attach as any).execute(
      { id: created.computer.id },
      { agent: { resourceId: 'other', threadId: 'thread' } },
    );
    expect(attached).toBe('computer not found');
  });
});
