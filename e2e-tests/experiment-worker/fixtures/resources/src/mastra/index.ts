import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { z } from 'zod';

const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

function textModel(text: string) {
  return {
    specificationVersion: 'v2' as const,
    provider: 'experiment-e2e',
    modelId: 'deterministic-model',
    supportedUrls: {},
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage,
      content: [{ type: 'text' as const, text }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          for (const event of [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'response-1', modelId: 'deterministic-model', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: text },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage },
          ]) {
            controller.enqueue(event);
          }
          controller.close();
        },
      }),
    }),
  };
}

// The workspace root is created at worker startup relative to the artifact so
// the fixture stays relocation-safe: no build-machine paths are baked in.
const workspaceRoot = join(process.cwd(), 'workspace-root');
const skillFile = join(workspaceRoot, 'skills', 'sandbox-echo-skill', 'SKILL.md');
if (!existsSync(skillFile)) {
  mkdirSync(join(workspaceRoot, 'skills', 'sandbox-echo-skill'), { recursive: true });
  writeFileSync(
    skillFile,
    [
      '---',
      'name: sandbox-echo-skill',
      'description: Echoes deterministic workspace notes from the local sandbox.',
      '---',
      '',
      '# Sandbox Echo Skill',
      '',
      'Run `cat note.txt` inside the workspace sandbox to read the current note.',
      '',
    ].join('\n'),
  );
}

const workspace = new Workspace({
  id: 'resources-workspace',
  filesystem: new LocalFilesystem({ basePath: workspaceRoot }),
  sandbox: new LocalSandbox({ id: 'resources-sandbox', workingDirectory: workspaceRoot }),
  skills: ['skills'],
});

async function inheritedWorkspace(mastra: Mastra | undefined) {
  const inherited = mastra?.getWorkspace();
  if (!inherited) throw new Error('global workspace was not inherited');
  if (inherited.status !== 'running') await inherited.init();
  return inherited;
}

// Reports whether workspace skill metadata was injected into the prompt, which
// proves the agent inherited the global workspace and discovered the real skill.
const skillAwareModel = {
  ...textModel('workspace response'),
  doGenerate: async (options: { prompt?: unknown } = {}) => {
    const visible = JSON.stringify(options.prompt ?? '').includes('sandbox-echo-skill');
    return textModel(`skills:${visible ? 'visible' : 'missing'}`).doGenerate();
  },
};

const workspaceAgent = new Agent({
  id: 'workspace-agent',
  name: 'Workspace Agent',
  instructions: 'Report whether workspace skills are visible.',
  model: skillAwareModel,
});

const workspaceStep = createStep({
  id: 'workspace-step',
  inputSchema: z.object({ note: z.string() }),
  outputSchema: z.object({ sandboxOutput: z.string(), exitCode: z.number(), skillNames: z.array(z.string()) }),
  execute: async ({ inputData, mastra }) => {
    const ws = await inheritedWorkspace(mastra);
    await ws.filesystem.writeFile('note.txt', inputData.note);
    const result = await ws.sandbox.executeCommand('cat', ['note.txt']);
    const skills = (await ws.skills?.list()) ?? [];
    return {
      sandboxOutput: result.stdout.trim(),
      exitCode: result.exitCode,
      skillNames: skills.map(skill => skill.name),
    };
  },
});

const workspaceWorkflow = createWorkflow({
  id: 'workspace-workflow',
  inputSchema: z.object({ note: z.string() }),
  outputSchema: z.object({ sandboxOutput: z.string(), exitCode: z.number(), skillNames: z.array(z.string()) }),
})
  .then(workspaceStep)
  .commit();

const sandboxHangStep = createStep({
  id: 'sandbox-hang-step',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ done: z.boolean() }),
  execute: async ({ mastra }) => {
    const ws = await inheritedWorkspace(mastra);
    const handle = await ws.sandbox.processes!.spawn('sleep', { args: ['600'] });
    await writeFile(join(process.cwd(), 'sandbox-descendant.json'), JSON.stringify({ pid: handle.pid }));
    await new Promise(() => {});
    return { done: true };
  },
});

const sandboxHangWorkflow = createWorkflow({
  id: 'sandbox-hang-workflow',
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ done: z.boolean() }),
})
  .then(sandboxHangStep)
  .commit();

const persistenceStep = createStep({
  id: 'persistence-step',
  inputSchema: z.object({ threadId: z.string() }),
  outputSchema: z.object({ threadId: z.string(), topMatch: z.string().nullable() }),
  execute: async ({ inputData, mastra }) => {
    const storage = mastra?.getStorage();
    if (!storage) throw new Error('application storage is not configured');
    const memory = await storage.getStore('memory');
    if (!memory) throw new Error('memory storage domain is unavailable');
    const now = new Date();
    await memory.saveThread({
      thread: {
        id: inputData.threadId,
        resourceId: 'resources-fixture',
        title: 'experiment worker persistence proof',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
    });

    const vector = mastra!.getVector('libsql');
    await vector.createIndex({ indexName: 'e2e_vectors', dimension: 4 });
    await vector.upsert({
      indexName: 'e2e_vectors',
      vectors: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
      ],
      ids: ['vec-a', 'vec-b'],
    });
    const matches = await vector.query({ indexName: 'e2e_vectors', queryVector: [1, 0, 0, 0], topK: 1 });
    return { threadId: inputData.threadId, topMatch: matches[0]?.id ?? null };
  },
});

const persistenceWorkflow = createWorkflow({
  id: 'persistence-workflow',
  inputSchema: z.object({ threadId: z.string() }),
  outputSchema: z.object({ threadId: z.string(), topMatch: z.string().nullable() }),
})
  .then(persistenceStep)
  .commit();

const resourceScorer = createScorer({
  id: 'resource-score',
  name: 'Resource Score',
  description: 'Returns a deterministic score for resource scenarios.',
}).generateScore(() => 1);

console.error('resources experiment fixture initialized');

export const mastra = new Mastra({
  agents: { workspaceAgent },
  workflows: { workspaceWorkflow, sandboxHangWorkflow, persistenceWorkflow },
  scorers: { resourceScorer },
  storage: new LibSQLStore({ id: 'resources-store', url: 'file:app-storage.db' }),
  vectors: { libsql: new LibSQLVector({ id: 'resources-vector', url: 'file:vector-store.db' }) },
  workspace,
  bundler: { externals: ['execa'] },
});
