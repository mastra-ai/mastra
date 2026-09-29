import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { afterEach, describe, expect, it } from 'vitest';
import { createMastraCodeAgentController } from '../../index.js';
import { TOOL_NAME_OVERRIDES } from '../../tool-names.js';
import { setCustomProvidersSource } from '../custom-provider-source.js';
import { TOOL_NAME_OVERRIDES } from '../../tool-names.js';
import { executeSubagent } from './execute.js';
import { exploreSubagent } from './explore.js';
import { planSubagent } from './plan.js';

const directories: string[] = [];
afterEach(async () => {
  setCustomProvidersSource(undefined);
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('native subagents', () => {
  // The model router picks a registered gateway by id prefix or by
  // `handlesModel`; subagent ids routed either way must reach that gateway.
  it.each([
    ['explore', 'prefix'],
    ['execute', 'prefix'],
    ['explore', 'handlesModel'],
  ] as const)(
    'runs native %s against a real workspace through a gateway matched by %s',
    async (agentType, route) => {
      const directory = await mkdtemp(join(tmpdir(), 'native-runtime-'));
      directories.push(directory);
      await writeFile(join(directory, 'input.txt'), 'native fixture');
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: directory }),
        tools: TOOL_NAME_OVERRIDES,
      });
      let calls = 0;
      const model = new MockLanguageModelV3({
        doStream: async options => {
          const names = options.tools?.map(tool => tool.name) ?? [];
          expect(names).toContain('view');
          expect(names).not.toContain('task_write');
          expect(names).not.toContain('subagent');
          if (agentType === 'explore') expect(names).not.toContain('write_file');
          if (++calls === 1) {
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                {
                  type: 'tool-call',
                  toolCallId: 'native-tool',
                  toolName: agentType === 'explore' ? 'view' : 'write_file',
                  input: JSON.stringify(
                    agentType === 'explore' ? { path: 'input.txt' } : { path: 'output.txt', content: 'native output' },
                  ),
                },
                {
                  type: 'finish',
                  finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
                  usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
                },
              ]),
            };
          }
          if (agentType === 'explore') expect(JSON.stringify(options.prompt)).toContain('native fixture');
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'text' },
              { type: 'text-delta', id: 'text', delta: 'Native task completed.' },
              { type: 'text-end', id: 'text' },
              {
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
              },
            ]),
          };
        },
      });
      const { controller } = await createMastraCodeAgentController({
        cwd: directory,
        homeDir: directory,
        settingsPath: join(directory, 'settings.json'),
        storage: new InMemoryStore(),
        storageBackend: 'libsql',
        workspace,
        intervalHandlers: [],
        disableMcp: true,
        disableHooks: true,
        disablePlugins: true,
        disableGithubSignals: true,
      });
      await controller.init();
      controller.getMastra()!.addGateway({
        id: 'native-test',
        name: 'Native test',
        ...(route === 'handlesModel' ? { handlesModel: (id: string) => id === 'fixture/model' } : {}),
        fetchProviders: async () => ({
          fixture: { name: 'Fixture', models: ['model'], apiKeyEnvVar: '', gateway: 'native-test' },
        }),
        buildUrl: () => undefined,
        getApiKey: async () => 'test',
        resolveLanguageModel: () => model,
      });
      const session = await controller.createSession({ id: 'runtime', ownerId: 'test' });
      const toolsets = await controller['buildToolsets'](session, new RequestContext());
      const result = await toolsets.controllerBuiltIn!.subagent!.execute!(
        {
          agentType,
          task: 'Process the fixture',
          modelId: route === 'prefix' ? 'native-test/fixture/model' : 'fixture/model',
        },
        { workspace, agent: { toolCallId: 'native' } },
      );
      expect(result, JSON.stringify(result)).toMatchObject({ isError: false });
      expect(result).toHaveProperty('content', expect.stringContaining('Native task completed.'));
      expect(calls).toBe(2);
      if (agentType === 'execute') expect(await readFile(join(directory, 'output.txt'), 'utf8')).toBe('native output');
    },
    30_000,
  );

  // Issue 25395: a tenant's custom provider is only visible through the calling
  // run's request context, so the subagent must resolve its model with it.
  it("resolves a subagent model through the calling run's request-scoped custom provider", async () => {
    const requests: Array<{ model: string; authorization?: string }> = [];
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        requests.push({ model: JSON.parse(body).model, authorization: req.headers.authorization });
        const chunk = (delta: object, finish: string | null = null) =>
          `data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', created: 0, model: 'tenant-model', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.end(
          chunk({ role: 'assistant', content: 'Tenant provider answered.' }) + chunk({}, 'stop') + 'data: [DONE]\n\n',
        );
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    setCustomProvidersSource(tenant =>
      tenant?.orgId === 'org-1'
        ? [{ name: 'Tenant LLM', url: `http://127.0.0.1:${port}/v1`, apiKey: 'sk-tenant', models: ['tenant-model'] }]
        : [],
    );

    try {
      const directory = await mkdtemp(join(tmpdir(), 'native-subagents-'));
      directories.push(directory);
      const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: directory }) });
      const { controller } = await createMastraCodeAgentController({
        cwd: directory,
        homeDir: directory,
        settingsPath: join(directory, 'settings.json'),
        storage: new InMemoryStore(),
        storageBackend: 'libsql',
        workspace,
        intervalHandlers: [],
        disableMcp: true,
        disableHooks: true,
        disablePlugins: true,
        disableGithubSignals: true,
      });
      await controller.init();
      const session = await controller.createSession({ id: 'tenant', ownerId: 'test' });
      const requestContext = new RequestContext();
      requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
      const toolsets = await controller['buildToolsets'](session, requestContext);

      const result = await toolsets.controllerBuiltIn!.subagent!.execute!(
        { agentType: 'explore', task: 'Answer', modelId: 'tenant-llm/tenant-model' },
        { workspace, requestContext, agent: { toolCallId: 'tenant' } } as any,
      );

      expect(result, JSON.stringify(result)).toMatchObject({ isError: false });
      expect(result).toHaveProperty('content', expect.stringContaining('Tenant provider answered.'));
      expect(requests).toEqual([{ model: 'tenant-model', authorization: 'Bearer sk-tenant' }]);
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  }, 30_000);

  it('keeps isolated definitions free of parent task tools and nested delegation', () => {
    for (const definition of [exploreSubagent, planSubagent, executeSubagent]) {
      expect(definition.forked).not.toBe(true);
      expect(definition.allowedControllerTools ?? []).toEqual([]);
      expect(definition.tools ?? {}).toEqual({});
    }
    for (const definition of [exploreSubagent, planSubagent]) {
      expect(definition.allowedWorkspaceTools).toEqual(['view', 'find_files', 'search_content', 'file_stat']);
    }
    expect(executeSubagent.allowedWorkspaceTools).toContain('write_file');
    expect(executeSubagent.allowedWorkspaceTools).toContain('execute_command');
  });

  it.each([{ subagents: undefined }, { subagents: [] }, { subagents: [exploreSubagent] }])(
    'registers the real SDK tool surface for %j',
    async ({ subagents }) => {
      const directory = await mkdtemp(join(tmpdir(), 'native-subagents-'));
      directories.push(directory);
      const { controller } = await createMastraCodeAgentController({
        cwd: directory,
        homeDir: directory,
        settingsPath: join(directory, 'settings.json'),
        storage: new InMemoryStore(),
        storageBackend: 'libsql',
        workspace: new Workspace({ filesystem: new LocalFilesystem({ basePath: directory }) }),
        intervalHandlers: [],
        disableMcp: true,
        disableHooks: true,
        disablePlugins: true,
        disableGithubSignals: true,
        subagents,
      });
      const session = await controller.createSession({ id: 'test', ownerId: 'test' });
      const toolsets = await controller['buildToolsets'](session, new RequestContext());
      const tool = toolsets.controllerBuiltIn?.subagent;
      if (subagents?.length === 0) {
        expect(tool).toBeUndefined();
      } else {
        expect(tool).toBeDefined();
        const schema = tool!.inputSchema;
        for (const agentType of ['explore', 'plan', 'execute']) {
          expect(schema.safeParse({ agentType, task: 'Inspect the project' }).success).toBe(
            subagents === undefined || subagents.some(agent => agent.id === agentType),
          );
        }
      }
    },
    30_000,
  );
});
