import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { Workspace } from '@mastra/core/workspace';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const { appDataDir, previousAppDataDir, previousOffline } = vi.hoisted(() => {
  const appDataDir = `${process.env.TMPDIR ?? '/tmp'}/subagent-thinking-app-${process.pid}-${Date.now()}`;
  const previousAppDataDir = process.env.MASTRA_APP_DATA_DIR;
  const previousOffline = process.env.MASTRA_OFFLINE;
  process.env.MASTRA_APP_DATA_DIR = appDataDir;
  process.env.MASTRA_OFFLINE = 'true';
  return { appDataDir, previousAppDataDir, previousOffline };
});

// Optional integrations are unused; keep SDK/controller/model/provider execution real.
vi.mock('./mcp/index.js', () => ({ createMcpManager: () => undefined }));
vi.mock('@mastra/github-signals', () => ({ GithubSignals: class {} }));
vi.mock('./utils/local-observability.js', () => ({
  openLocalObservabilityStore: () => {
    throw new Error('unused');
  },
}));
import { setCustomProvidersSource } from './agents/model.js';
import { createMastraCodeAgentController } from './index.js';

type ChatRequest = { model: string; reasoning_effort?: string; messages: Array<{ role: string }> };

describe('subagent thinking inherited from the calling session', () => {
  const cleanup: Array<() => Promise<unknown>> = [];
  afterEach(async () => {
    setCustomProvidersSource(undefined);
    for (const close of cleanup.splice(0).reverse()) await close();
  });
  afterAll(async () => {
    await rm(appDataDir, { recursive: true, force: true });
    if (previousAppDataDir === undefined) delete process.env.MASTRA_APP_DATA_DIR;
    else process.env.MASTRA_APP_DATA_DIR = previousAppDataDir;
    if (previousOffline === undefined) delete process.env.MASTRA_OFFLINE;
    else process.env.MASTRA_OFFLINE = previousOffline;
  });

  it.each([
    ['session override', 'high', 'low', undefined, true, false, 'high'],
    ['explicit off', 'off', 'high', undefined, true, false, undefined],
    ['global default', undefined, 'medium', undefined, true, false, 'medium'],
    ['mode default', undefined, 'low', 'high', false, false, 'high'],
    ['modeless global default', undefined, 'low', 'high', true, false, 'low'],
    ['explicit custom gateway', 'high', 'low', undefined, true, true, undefined],
  ] as const)(
    'preserves %s on the child provider request',
    async (_label, sessionThinking, globalThinking, modeThinking, modeless, otherGateway, expected) => {
      const dir = await mkdtemp(join(tmpdir(), 'subagent-thinking-'));
      cleanup.push(() => rm(dir, { recursive: true, force: true }));
      const requests: ChatRequest[] = [];
      const server = createServer(async (req, res) => {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const body = JSON.parse(raw) as ChatRequest;
        requests.push(body);
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        const chunk = { id: 'response', object: 'chat.completion.chunk', created: 0, model: body.model };
        const callSubagent = body.model === 'parent' && !body.messages.some(message => message.role === 'tool');
        const delta = callSubagent
          ? {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'delegate',
                  type: 'function',
                  function: { name: 'subagent', arguments: JSON.stringify({ agentType: 'explore', task: 'Explore' }) },
                },
              ],
            }
          : { role: 'assistant', content: 'Done.' };
        res.write(`data: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`);
        res.write(
          `data: ${JSON.stringify({ ...chunk, choices: [{ index: 0, delta: {}, finish_reason: callSubagent ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })}\n\n`,
        );
        res.end('data: [DONE]\n\n');
      });
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      cleanup.push(async () => {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      });
      const customProvider = {
        name: 'Local Test',
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
        models: ['parent', 'child'],
        apiKey: 'local-test-key',
      };
      setCustomProvidersSource(() => [customProvider]);
      const settingsPath = join(dir, 'settings.json');
      await writeFile(
        settingsPath,
        JSON.stringify({
          customProviders: [customProvider],
          preferences: { thinkingLevel: globalThinking },
          models: { modeThinkingDefaults: { build: modeThinking } },
        }),
      );
      const storage = new InMemoryStore();
      const base = await createMastraCodeAgentController({
        cwd: dir,
        settingsPath,
        memory: new Memory({ storage, options: { lastMessages: 10 } }),
        modes: modeless ? false : undefined,
        storage,
        storageBackend: 'libsql',
        workspace: new Workspace({ name: 'test', skills: [join(dir, 'skills')] }),
        intervalHandlers: [],
        disableMcp: true,
        disableHooks: true,
        disablePlugins: true,
        disableEnvFile: true,
        subagents: [
          {
            id: 'explore',
            name: 'Explore',
            description: 'Explore',
            instructions: 'Explore',
            defaultModelId: otherGateway ? 'external/local/child' : 'local-test/child',
          },
        ],
        initialState: sessionThinking ? { thinkingLevel: sessionThinking } : {},
      });
      cleanup.push(async () => {
        await base.stopNotificationDispatch();
        await base.controller.destroy();
      });
      await base.controller.init();
      if (otherGateway) {
        const provider = createOpenAICompatible({
          name: 'external',
          baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
          apiKey: 'local-key',
        });
        base.controller.getMastra()!.addGateway({
          id: 'external',
          name: 'External',
          fetchProviders: async () => ({}),
          buildUrl: () => undefined,
          getApiKey: async () => 'local-key',
          resolveLanguageModel: ({ modelId }) => provider.chatModel(modelId),
        });
      }
      const session = await base.controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
      const errors: unknown[] = [];
      session.subscribe(event => {
        if (event.type === 'error') errors.push(event.error);
      });
      await session.model.switch('local-test/parent');
      await session.sendMessage({ content: 'Delegate to explore' });
      expect(errors).toEqual([]);
      expect(requests.filter(body => body.model === 'child').map(body => body.reasoning_effort)).toEqual([expected]);
    },
  );
});
