import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execa, execaNode } from 'execa';
import getPort from 'get-port';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { setupMonorepo } from './prepare';

describe.sequential('generated server recovery admission', () => {
  let fixture: string;
  let output: string;

  beforeAll(async () => {
    fixture = await mkdtemp(join(tmpdir(), 'mastra-native-recovery-'));
    process.env.pnpm_config_registry = inject('registry');
    await setupMonorepo(fixture, 'pnpm');
    const app = join(fixture, 'apps', 'custom');
    await execa('pnpm', ['add', `@mastra/libsql@${inject('tag')}`], { cwd: app, env: process.env });
    await writeFile(
      join(app, 'src', 'mastra', 'index.ts'),
      `
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { LibSQLStore } from '@mastra/libsql';
import { registerApiRoute } from '@mastra/core/server';
let calls = 0;
let result;
let modelCalls = 0;
let text;
let executionError;
const runId = 'disposable-generated-crash';
const storage = new LibSQLStore({ id: 'generated-crash-proof', url: process.env.RECOVERY_DB });
const agent = createDurableAgent({ cleanupTimeoutMs: 0, agent: new Agent({
  id: 'generated-crash-proof', name: 'Generated crash proof', instructions: 'Return the local response.',
  model: {
    specificationVersion: 'v2', provider: 'local-fixture', modelId: 'unpaid', supportedUrls: {},
    doGenerate: async () => { throw new Error('No generation expected'); },
    doStream: async () => {
      modelCalls++;
      if (process.env.CRASH_MODE === 'yes') await new Promise(() => {});
      return { stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: 'text-start', id: 'text-1' });
        controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Recovered local response.' });
        controller.enqueue({ type: 'text-end', id: 'text-1' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 4 } });
        controller.close();
      } }) };
    },
  },
}) });
const recoverOne = agent.recover.bind(agent);
agent.recover = (id, options) => recoverOne(id, { ...options, onFinish: async value => { text = value.text; await options?.onFinish?.(value); } });
export const mastra = new Mastra({
  agents: { agent }, storage,
  recovery: { durableAgents: process.env.RECOVERY_MODE === 'auto' ? 'auto' : 'off' },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.MASTRA_PORT),
    apiRoutes: [
      registerApiRoute('/recovery-status', { method: 'GET', handler: async c => {
        const row = await (await storage.getStore('workflows')).getWorkflowRunById({ workflowName: 'durable-agentic-loop', runId });
        return c.json({ calls, result, modelCalls, text, executionError, savedStatus: row?.snapshot?.status ?? null });
      } }),
      registerApiRoute('/start-crash-run', { method: 'POST', handler: async c => {
        void (async () => {
          const response = await agent.stream('Complete this disposable task.', { runId, maxSteps: 1 });
          for await (const chunk of response.fullStream) void chunk;
        })().catch(error => { executionError = String(error); });
        return c.json({ accepted: true }, 202);
      } }),
    ],
  },
});
const recover = mastra.recoverAllDurableAgents.bind(mastra);
mastra.recoverAllDurableAgents = async () => { calls++; return result = await recover(); };
`,
    );
    await execa('pnpm', ['build'], {
      cwd: app,
      env: {
        ...process.env,
        MASTRA_TELEMETRY_DISABLED: 'true',
        MASTRA_PORT: '0',
        RECOVERY_DB: pathToFileURL(join(fixture, 'build.db')).href,
      },
    });
    output = join(app, '.mastra', 'output');
    // Enforce no outbound traffic in the generated runtime. The test reaches it
    // only through its loopback HTTP listener.
    await writeFile(
      join(output, 'deny-network.mjs'),
      `
import net from 'node:net';
import dns from 'node:dns';
const deny = () => { throw new Error('Outbound network prohibited by recovery test'); };
globalThis.fetch = deny;
net.Socket.prototype.connect = deny;
const lookup = dns.lookup;
dns.lookup = (host, ...args) => host === '127.0.0.1' ? lookup(host, ...args) : deny();
dns.promises.lookup = deny;
`,
    );
    expect(await readFile(join(output, 'index.mjs'), 'utf8')).toContain('createNodeServer');
  }, 10 * 60_000);

  async function start(mode: string, database: string, crash = false) {
    const port = await getPort({ host: '127.0.0.1' });
    const server = execaNode('index.mjs', {
      cwd: output,
      nodeOptions: ['--import', './deny-network.mjs'],
      env: {
        ...process.env,
        MASTRA_PORT: String(port),
        RECOVERY_MODE: mode,
        RECOVERY_DB: pathToFileURL(database).href,
        CRASH_MODE: crash ? 'yes' : 'no',
        MASTRA_TELEMETRY_DISABLED: 'true',
      },
      reject: false,
    });
    const origin = `http://127.0.0.1:${port}`;
    const status = async () => (await fetch(`${origin}/recovery-status`)).json();
    return { server, origin, status };
  }

  it.each(['auto', 'off'])(
    'honors recovery mode %s in generated output',
    async mode => {
      const { server, status } = await start(mode, join(fixture, `${mode}.db`));
      try {
        await expect
          .poll(status, { timeout: 30_000 })
          .toMatchObject(
            mode === 'auto'
              ? { calls: 1, result: { agents: 1, recovered: 0, succeeded: 0, failed: 0 }, modelCalls: 0 }
              : { calls: 0, modelCalls: 0 },
          );
      } finally {
        server.kill('SIGTERM');
        await server;
      }
    },
    45_000,
  );

  it('automatically completes a real crashed run through the generated server', async () => {
    const database = join(fixture, 'crashed.db');
    const first = await start('off', database, true);
    try {
      await expect.poll(first.status, { timeout: 30_000 }).toMatchObject({ calls: 0, modelCalls: 0 });
      expect((await fetch(`${first.origin}/start-crash-run`, { method: 'POST' })).status).toBe(202);
      await expect.poll(first.status, { timeout: 30_000 }).toMatchObject({ modelCalls: 1, savedStatus: 'running' });
    } finally {
      first.server.kill('SIGKILL');
      await first.server;
    }
    const second = await start('auto', database);
    try {
      await expect.poll(second.status, { timeout: 30_000 }).toMatchObject({
        calls: 1,
        result: { agents: 1, recovered: 1, succeeded: 1, failed: 0 },
        modelCalls: 1,
        text: 'Recovered local response.',
        savedStatus: null,
      });
    } finally {
      second.server.kill('SIGTERM');
      await second.server;
    }
  }, 90_000);
});
