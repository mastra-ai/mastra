import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { afterEach, describe, expect, it } from 'vitest';
import { createMastraCodeAgentController } from '../../index.js';
import { TOOL_NAME_OVERRIDES } from '../../tool-names.js';
import { executeSubagent } from './execute.js';
import { exploreSubagent } from './explore.js';
import { planSubagent } from './plan.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('native subagents', () => {
  it.each(['explore', 'execute'])(
    'runs native %s against a real workspace',
    async agentType => {
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
        { agentType, task: 'Process the fixture', modelId: 'native-test/fixture/model' },
        { workspace, agent: { toolCallId: 'native' } },
      );
      expect(result, JSON.stringify(result)).toMatchObject({ isError: false });
      expect(result).toHaveProperty('content', expect.stringContaining('Native task completed.'));
      expect(calls).toBe(2);
      if (agentType === 'execute') expect(await readFile(join(directory, 'output.txt'), 'utf8')).toBe('native output');
    },
    30_000,
  );

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
