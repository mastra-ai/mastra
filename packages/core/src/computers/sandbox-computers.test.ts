import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceSandbox } from '../workspace/sandbox';
import { Workspace } from '../workspace/workspace';
import { SandboxComputers } from './sandbox-computers';

function sandbox(id = 'desktop-1', streamUrl?: string): WorkspaceSandbox {
  return {
    id,
    name: 'Desktop',
    provider: 'test',
    status: 'running',
    async start() {},
    async stop() {},
    async destroy() {},
    async snapshot() {},
    async isReady() { return true; },
    async getInfo() { return { id, name: 'Desktop', provider: 'test', status: 'running', createdAt: new Date() }; },
    computer: {
      async screenshot() { return { data: new Uint8Array(), mediaType: 'image/png' }; },
      async leftClick() {}, async rightClick() {}, async doubleClick() {}, async moveMouse() {},
      async drag() {}, async scroll() {}, async type() {}, async press() {},
      async getScreenSize() { return { width: 1, height: 1 }; },
      async getCursorPosition() { return { x: 0, y: 0 }; },
      async streamUrl() { return streamUrl ?? null; },
    },
  } as WorkspaceSandbox;
}

const context = { agent: { resourceId: 'resource', threadId: 'thread' } } as any;

describe('SandboxComputers', () => {
  beforeEach(() => { process.env.MASTRA_EXPERIMENTAL_COMPUTER = 'true'; });
  afterEach(() => { delete process.env.MASTRA_EXPERIMENTAL_COMPUTER; });

  it('lists, attaches, views, and releases a borrowed static sandbox without lifecycle calls', async () => {
    const machine = sandbox('desktop-1', 'https://viewer.test');
    const destroy = vi.spyOn(machine, 'destroy');
    const computers = new SandboxComputers({ workspace: new Workspace({ sandbox: machine }), secret: 'secret' });
    expect(Object.keys(computers.tools())).toEqual([
      'mastra_workspace_computer_list',
      'mastra_workspace_computer_attach',
      'mastra_workspace_computer_release',
    ]);
    const listed = await (computers.tools().mastra_workspace_computer_list as any).execute({}, context);
    expect(listed.computers).toHaveLength(1);
    const id = listed.computers[0].id;
    await expect((computers.tools().mastra_workspace_computer_attach as any).execute({ id }, context)).resolves.toMatchObject({
      computer: { id, status: 'attached' },
    });
    await expect(computers.viewer(id, { resourceId: 'resource', threadId: 'thread' })).resolves.toEqual({
      url: 'https://viewer.test', headers: {},
    });
    await (computers.tools().mastra_workspace_computer_release as any).execute({}, context);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('resolves once per request context and refuses a changed or unsupported sandbox without attaching', async () => {
    let current = sandbox('one');
    const resolver = vi.fn(async () => current);
    const workspace = new Workspace({ sandbox: resolver, computerTools: 'resolve' });
    const computers = new SandboxComputers({ workspace, secret: 'secret' });
    const listed = await (computers.tools().mastra_workspace_computer_list as any).execute({}, context);
    current = sandbox('two');
    const changedContext = { ...context, requestContext: undefined };
    await expect(
      (computers.tools().mastra_workspace_computer_attach as any).execute({ id: listed.computers[0].id }, changedContext),
    ).resolves.toBe('computer not found');
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('refuses a viewer when the borrowed sandbox changes after attachment', async () => {
    let current = sandbox('one', 'https://viewer.test/one');
    const workspace = new Workspace({ sandbox: async () => current, computerTools: 'resolve' });
    const computers = new SandboxComputers({ workspace, secret: 'secret' });
    const listed = await (computers.tools().mastra_workspace_computer_list as any).execute({}, context);
    const id = listed.computers[0].id;
    await (computers.tools().mastra_workspace_computer_attach as any).execute({ id }, context);

    current = sandbox('two', 'https://viewer.test/two');

    await expect(computers.viewer(id, { resourceId: 'resource', threadId: 'thread' })).rejects.toThrow(
      'no computer attached',
    );
  });

  it('binds signed ids to the resource', async () => {
    const computers = new SandboxComputers({ workspace: new Workspace({ sandbox: sandbox() }), secret: 'secret' });
    const listed = await (computers.tools().mastra_workspace_computer_list as any).execute({}, context);
    await expect(
      (computers.tools().mastra_workspace_computer_attach as any).execute(
        { id: listed.computers[0].id },
        { agent: { resourceId: 'other', threadId: 'thread' } },
      ),
    ).resolves.toBe('computer not found');
  });
});
