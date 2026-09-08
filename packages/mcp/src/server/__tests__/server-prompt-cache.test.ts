import { describe, expect, it, vi } from 'vitest';

import { MCPServer } from '../server';
import { makeMockExtra } from './mock-extra';

/**
 * Regression tests for cross-tenant prompt leakage.
 *
 * @see https://github.com/mastra-ai/mastra/issues/22208
 */
describe('MCPServer dynamic prompt provider does not leak across callers', () => {
  const makeExtra = (subject: string) => makeMockExtra({ authInfo: { subject } });

  const createTenantServer = () => {
    const listPrompts = vi.fn(async ({ extra }: { extra: any }) => {
      const tenant = extra.authInfo.subject;
      return [
        {
          name: `${tenant}-prompt`,
          description: `Prompt for ${tenant}`,
          version: `${tenant}-version`,
          arguments: [{ name: 'input', required: true }],
        },
      ];
    });
    const getPromptMessages = vi.fn(async ({ name, extra }: { name: string; extra: any }) => [
      { role: 'user' as const, content: { type: 'text' as const, text: `${extra.authInfo.subject}:${name}` } },
    ]);

    const server = new MCPServer({
      name: 'tenant-server',
      version: '1.0.0',
      tools: {},
      prompts: { listPrompts, getPromptMessages },
    });

    return { server, listPrompts, getPromptMessages };
  };

  it('serves each caller their own prompts from prompts/list', async () => {
    const { server, listPrompts } = createTenantServer();
    const listHandler = (server.getServer() as any)._requestHandlers.get('prompts/list');

    const tenantA = await listHandler({ method: 'prompts/list' }, makeExtra('tenant-A'));
    const tenantB = await listHandler({ method: 'prompts/list' }, makeExtra('tenant-B'));

    expect(tenantA.prompts[0]).toMatchObject({ name: 'tenant-A-prompt', description: 'Prompt for tenant-A' });
    expect(tenantB.prompts[0]).toMatchObject({ name: 'tenant-B-prompt', description: 'Prompt for tenant-B' });
    expect(listPrompts).toHaveBeenCalledTimes(2);
  });

  it('resolves prompts/get against the current caller after another caller lists prompts', async () => {
    const { server, listPrompts, getPromptMessages } = createTenantServer();
    const handlers = (server.getServer() as any)._requestHandlers;

    await handlers.get('prompts/list')({ method: 'prompts/list' }, makeExtra('tenant-A'));
    const result = await handlers.get('prompts/get')(
      { method: 'prompts/get', params: { name: 'tenant-B-prompt', arguments: { input: 'hello' } } },
      makeExtra('tenant-B'),
    );

    expect(result.description).toBe('Prompt for tenant-B');
    expect(result.messages[0].content.text).toBe('tenant-B:tenant-B-prompt');
    expect(listPrompts).toHaveBeenCalledTimes(2);
    expect(getPromptMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'tenant-B-prompt',
        version: 'tenant-B-version',
        extra: expect.objectContaining({ authInfo: { subject: 'tenant-B' } }),
      }),
    );
  });

  it("does not let a caller resolve another caller's prompt", async () => {
    const { server, getPromptMessages } = createTenantServer();
    const getHandler = (server.getServer() as any)._requestHandlers.get('prompts/get');

    await expect(
      getHandler(
        { method: 'prompts/get', params: { name: 'tenant-A-prompt', arguments: { input: 'hello' } } },
        makeExtra('tenant-B'),
      ),
    ).rejects.toThrow('Prompt "tenant-A-prompt" not found');
    expect(getPromptMessages).not.toHaveBeenCalled();
  });
});
