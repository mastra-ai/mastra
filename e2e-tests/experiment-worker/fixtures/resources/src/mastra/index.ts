import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import type { MastraBrowser } from '@mastra/core/browser';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { executeCommandTool, LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';
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

function createSkillWorkspace(id: string, skillName: string) {
  const root = join(process.cwd(), `${id}-root`);
  const path = join(root, 'skills', skillName, 'SKILL.md');
  mkdirSync(join(root, 'skills', skillName), { recursive: true });
  writeFileSync(path, `---\nname: ${skillName}\ndescription: ${skillName} workspace marker.\n---\n\n# ${skillName}\n`);
  return new Workspace({
    id,
    filesystem: new LocalFilesystem({ basePath: root }),
    skills: ['skills'],
  });
}

const agentOwnedWorkspace = createSkillWorkspace('agent-owned-workspace', 'agent-owned-skill');
const tenantAWorkspace = createSkillWorkspace('tenant-a-workspace', 'tenant-a-skill');
const tenantBWorkspace = createSkillWorkspace('tenant-b-workspace', 'tenant-b-skill');

const workspaceMarkerModel = {
  ...textModel('workspace marker missing'),
  doGenerate: async (options: { prompt?: unknown } = {}) => {
    const prompt = JSON.stringify(options.prompt ?? '');
    const marker = ['agent-owned-skill', 'tenant-a-skill', 'tenant-b-skill'].find(name => prompt.includes(name));
    return textModel(marker ?? 'workspace marker missing').doGenerate();
  },
};

const agentOwnedWorkspaceAgent = new Agent({
  id: 'agent-owned-workspace-agent',
  name: 'Agent Owned Workspace Agent',
  instructions: 'Report the workspace marker skill.',
  model: workspaceMarkerModel,
  workspace: agentOwnedWorkspace,
});

const dynamicWorkspaceAgent = new Agent({
  id: 'dynamic-workspace-agent',
  name: 'Dynamic Workspace Agent',
  instructions: 'Report the workspace marker skill.',
  model: workspaceMarkerModel,
  workspace: ({ mastra, requestContext }) => {
    const workspaceId = requestContext.get('workspaceId');
    if (typeof workspaceId !== 'string') throw new Error('workspaceId is required');
    const resolved = mastra?.getWorkspaceById(workspaceId);
    if (!resolved) throw new Error(`unknown workspace: ${workspaceId}`);
    return resolved;
  },
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
    const processes = ws.sandbox.processes;
    if (!processes) throw new Error('sandbox process manager is unavailable');
    const handle = await processes.spawn('sleep', { args: ['600'] });
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

    if (!mastra) throw new Error('Mastra instance is unavailable');
    const vector = mastra.getVector('libsql');
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

const searchRoot = join(process.cwd(), 'search-workspace-root');
mkdirSync(join(searchRoot, 'docs'), { recursive: true });
writeFileSync(
  join(searchRoot, 'docs', 'deployment.md'),
  'Production deployment guide with release and rollback steps.',
);
writeFileSync(join(searchRoot, 'docs', 'cooking.md'), 'A recipe for baking bread with flour and yeast.');

const searchVector = new LibSQLVector({ id: 'workspace-search-vector', url: 'file:workspace-search.db' });
const searchWorkspace = new Workspace({
  id: 'search-workspace',
  filesystem: new LocalFilesystem({ basePath: searchRoot }),
  bm25: true,
  vectorStore: searchVector,
  embedder: async (text: string) => {
    let hash = 0;
    for (const character of text) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    return [(hash & 0xff) / 255, ((hash >>> 8) & 0xff) / 255, ((hash >>> 16) & 0xff) / 255];
  },
  searchIndexName: 'workspace_search',
  autoIndexPaths: ['docs'],
});

const searchStep = createStep({
  id: 'search-step',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ bm25: z.string(), vector: z.string(), hybrid: z.string() }),
  execute: async ({ inputData }) => {
    if (searchWorkspace.status !== 'running') await searchWorkspace.init();
    const bm25 = await searchWorkspace.search(inputData.query, { mode: 'bm25', topK: 5 });
    const vector = await searchWorkspace.search(inputData.query, { mode: 'vector', topK: 5 });
    const hybrid = await searchWorkspace.search(inputData.query, { mode: 'hybrid', topK: 5 });
    return { bm25: JSON.stringify(bm25), vector: JSON.stringify(vector), hybrid: JSON.stringify(hybrid) };
  },
});

const searchWorkflow = createWorkflow({
  id: 'search-workflow',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ bm25: z.string(), vector: z.string(), hybrid: z.string() }),
})
  .then(searchStep)
  .commit();

const projectMountRoot = join(process.cwd(), 'mount-project-root');
const sharedMountRoot = join(process.cwd(), 'mount-shared-root');
mkdirSync(projectMountRoot, { recursive: true });
mkdirSync(sharedMountRoot, { recursive: true });
writeFileSync(join(sharedMountRoot, 'reference.txt'), 'shared mount reference');
const mountedWorkspace = new Workspace({
  id: 'mounted-workspace',
  mounts: {
    '/project': new LocalFilesystem({ basePath: projectMountRoot }),
    '/shared': new LocalFilesystem({ basePath: sharedMountRoot, readOnly: true }),
  },
});

const mountStep = createStep({
  id: 'mount-step',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ project: z.string(), shared: z.string(), readOnlyRejected: z.boolean() }),
  execute: async ({ inputData }) => {
    if (mountedWorkspace.status !== 'running') await mountedWorkspace.init();
    await mountedWorkspace.filesystem.writeFile('/project/output.txt', inputData.value);
    const project = await mountedWorkspace.filesystem.readFile('/project/output.txt');
    const shared = await mountedWorkspace.filesystem.readFile('/shared/reference.txt');
    let readOnlyRejected = false;
    try {
      await mountedWorkspace.filesystem.writeFile('/shared/rejected.txt', 'must fail');
    } catch {
      readOnlyRejected = true;
    }
    return { project: String(project), shared: String(shared), readOnlyRejected };
  },
});

const mountWorkflow = createWorkflow({
  id: 'mount-workflow',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ project: z.string(), shared: z.string(), readOnlyRejected: z.boolean() }),
})
  .then(mountStep)
  .commit();

const lspRoot = join(process.cwd(), 'lsp-workspace-root');
mkdirSync(lspRoot, { recursive: true });
const lspWorkspace = new Workspace({
  id: 'lsp-workspace',
  sandbox: new LocalSandbox({ id: 'lsp-sandbox', workingDirectory: lspRoot }),
  lsp: {
    root: lspRoot,
    initTimeout: 15_000,
    diagnosticTimeout: 5_000,
    binaryOverrides: {
      typescript: `${JSON.stringify(process.execPath)} ${JSON.stringify(join(process.cwd(), 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs'))} --stdio`,
    },
  },
});

const lspStep = createStep({
  id: 'lsp-step',
  inputSchema: z.object({ source: z.string() }),
  outputSchema: z.object({ serverName: z.string(), hover: z.string(), diagnosticCount: z.number() }),
  execute: async ({ inputData }) => {
    if (lspWorkspace.status !== 'running') await lspWorkspace.init();
    const filePath = join(lspRoot, 'index.ts');
    await writeFile(filePath, inputData.source);
    const query = await lspWorkspace.lsp?.prepareQuery(filePath);
    if (!query) throw new Error('TypeScript language server was not available');
    const hover = await query.client.queryHover(query.uri, { line: 1, character: 8 });
    const diagnostics = await lspWorkspace.lsp?.getDiagnostics(filePath, inputData.source);
    return {
      serverName: query.serverName,
      hover: JSON.stringify(hover),
      diagnosticCount: diagnostics?.length ?? 0,
    };
  },
});

const lspWorkflow = createWorkflow({
  id: 'lsp-workflow',
  inputSchema: z.object({ source: z.string() }),
  outputSchema: z.object({ serverName: z.string(), hover: z.string(), diagnosticCount: z.number() }),
})
  .then(lspStep)
  .commit();

const browserRoot = join(process.cwd(), 'browser-workspace-root');
mkdirSync(browserRoot, { recursive: true });
const browserCliPath = join(browserRoot, 'agent-browser');
writeFileSync(browserCliPath, '#!/bin/sh\nprintf "%s\\n" "$*" > browser-command.txt\n');
chmodSync(browserCliPath, 0o755);
const browserEventsPath = join(process.cwd(), 'browser-events.json');
const browserEvents: string[] = [];
const runningBrowserThreads = new Set<string>();
const browserClosedListeners = new Set<() => void>();
const browserProvider = {
  id: 'fixture-browser',
  name: 'Fixture Browser',
  provider: 'fixture',
  providerType: 'cli',
  isBrowserRunning: () => runningBrowserThreads.size > 0,
  launch: async (threadId = 'default') => {
    browserEvents.push(`launch:${threadId}`);
    runningBrowserThreads.add(threadId);
    writeFileSync(browserEventsPath, JSON.stringify(browserEvents));
  },
  getCdpUrl: () => 'ws://127.0.0.1:9222/devtools/browser/fixture',
  connectToExternalCdp: async () => {},
  onBrowserClosed: (listener: () => void) => {
    browserClosedListeners.add(listener);
    return () => browserClosedListeners.delete(listener);
  },
  close: async () => {
    browserEvents.push('close');
    runningBrowserThreads.clear();
    for (const listener of browserClosedListeners) listener();
    writeFileSync(browserEventsPath, JSON.stringify(browserEvents));
  },
} as unknown as MastraBrowser;
const browserWorkspace = new Workspace({
  id: 'browser-workspace',
  sandbox: new LocalSandbox({
    id: 'browser-sandbox',
    workingDirectory: browserRoot,
    env: { PATH: `${browserRoot}:${process.env.PATH ?? ''}` },
  }),
  browser: browserProvider,
});

const browserStep = createStep({
  id: 'browser-step',
  inputSchema: z.object({ threadId: z.string() }),
  outputSchema: z.object({ lazyBefore: z.boolean(), launched: z.boolean(), commandRan: z.boolean() }),
  execute: async ({ inputData }) => {
    if (browserWorkspace.status !== 'running') await browserWorkspace.init();
    const lazyBefore = !browserProvider.isBrowserRunning();
    await executeCommandTool.execute(
      { command: 'agent-browser open https://example.com', timeout: 10, cwd: browserRoot, tail: 0 },
      { workspace: browserWorkspace, threadId: inputData.threadId },
    );
    return {
      lazyBefore,
      launched: browserProvider.isBrowserRunning(),
      commandRan: existsSync(join(browserRoot, 'browser-command.txt')),
    };
  },
});

const browserWorkflow = createWorkflow({
  id: 'browser-workflow',
  inputSchema: z.object({ threadId: z.string() }),
  outputSchema: z.object({ lazyBefore: z.boolean(), launched: z.boolean(), commandRan: z.boolean() }),
})
  .then(browserStep)
  .commit();

const lifecycleFailureStep = createStep({
  id: 'lifecycle-failure-step',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ initFailed: z.boolean(), destroyFailed: z.boolean(), invalidConfigs: z.number() }),
  execute: async () => {
    const initFailure = new Workspace({
      id: 'init-failure-workspace',
      sandbox: new (class extends LocalSandbox {
        override async start() {
          throw new Error('expected workspace init failure');
        }
      })({ id: 'init-failure-sandbox', workingDirectory: workspaceRoot }),
    });
    let initFailed = false;
    try {
      await initFailure.init();
    } catch {
      initFailed = initFailure.status === 'error';
    }

    const destroyFailure = new Workspace({
      id: 'destroy-failure-workspace',
      sandbox: new LocalSandbox({
        id: 'destroy-failure-sandbox',
        workingDirectory: workspaceRoot,
        onDestroy: () => {
          throw new Error('expected workspace destroy failure');
        },
      }),
    });
    await destroyFailure.init();
    let destroyFailed = false;
    try {
      await destroyFailure.destroy();
    } catch {
      destroyFailed = destroyFailure.status === 'error';
    }

    let invalidConfigs = 0;
    for (const construct of [
      () => new Workspace({ id: 'empty-workspace' }),
      () =>
        new Workspace({
          id: 'filesystem-and-mounts',
          filesystem: new LocalFilesystem({ basePath: workspaceRoot }),
          mounts: { '/other': new LocalFilesystem({ basePath: workspaceRoot }) },
        }),
      () =>
        new Workspace({
          id: 'vector-without-embedder',
          filesystem: new LocalFilesystem({ basePath: workspaceRoot }),
          vectorStore: searchVector,
        }),
    ]) {
      try {
        construct();
      } catch {
        invalidConfigs += 1;
      }
    }
    return { initFailed, destroyFailed, invalidConfigs };
  },
});

const lifecycleFailureWorkflow = createWorkflow({
  id: 'lifecycle-failure-workflow',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ initFailed: z.boolean(), destroyFailed: z.boolean(), invalidConfigs: z.number() }),
})
  .then(lifecycleFailureStep)
  .commit();

const resourceScorer = createScorer({
  id: 'resource-score',
  name: 'Resource Score',
  description: 'Returns a deterministic score for resource scenarios.',
}).generateScore(() => 1);

console.error('resources experiment fixture initialized');

export const mastra = new Mastra({
  agents: { workspaceAgent, agentOwnedWorkspaceAgent, dynamicWorkspaceAgent },
  workflows: {
    workspaceWorkflow,
    sandboxHangWorkflow,
    persistenceWorkflow,
    searchWorkflow,
    mountWorkflow,
    lspWorkflow,
    browserWorkflow,
    lifecycleFailureWorkflow,
  },
  scorers: { resourceScorer },
  storage: new LibSQLStore({ id: 'resources-store', url: 'file:app-storage.db' }),
  vectors: { libsql: new LibSQLVector({ id: 'resources-vector', url: 'file:vector-store.db' }) },
  workspace,
  bundler: {
    externals: [
      'execa',
      'typescript',
      'typescript-language-server',
      'vscode-jsonrpc',
      'vscode-languageserver-protocol',
    ],
  },
});

for (const registeredWorkspace of [
  agentOwnedWorkspace,
  tenantAWorkspace,
  tenantBWorkspace,
  searchWorkspace,
  mountedWorkspace,
  lspWorkspace,
  browserWorkspace,
]) {
  mastra.addWorkspace(registeredWorkspace);
}
