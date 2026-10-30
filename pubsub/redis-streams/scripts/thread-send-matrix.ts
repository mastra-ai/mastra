/**
 * Matrix behind the numbers in PR #28948: how often a thread's second message
 * is lost (sendMessage resolves but the model never sees it) or hangs, when it
 * is sent right after the first message's run ended.
 *
 *   pnpm exec tsx scripts/thread-send-matrix.ts [--mode none|restart] [--lanes 4] [--runs 12]
 *
 * Every run is a fresh process with one AgentController on RedisStreamsPubSub
 * (blockMs 200) and in-memory storage, its own non-persistent redis-server on
 * the lane's port, and an AIMock model. It sends message 1, then:
 *   - none:    sends message 2 at once;
 *   - restart: SIGKILLs redis-server, waits 200 ms, starts it empty, then sends
 *              message 2 as soon as it answers PING.
 * Lanes run in parallel. The contention between them is part of the
 * conditions: failures depend on how late this process reads its own events.
 *
 * Outcome per run: pass (model saw message 2), lost (sendMessage settled but
 * the model never saw message 2), hung (no settle within 15 s), rejected.
 * Requires redis-server on PATH. Ports BASE_PORT (default 6391) .. +lanes-1.
 */
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const SEND_TIMEOUT_MS = 15_000;
const RESTART_DOWN_MS = 200;

const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1]!;
};
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function startRedis(port: number): ChildProcess {
  return spawn('redis-server', ['--port', String(port), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
}

async function waitForRedis(port: number) {
  for (let i = 0; i < 200; i++) {
    if (spawnSync('redis-cli', ['-p', String(port), 'ping'], { encoding: 'utf8' }).stdout.trim() === 'PONG') return;
    await sleep(25);
  }
  throw new Error(`redis on ${port} did not start`);
}

async function runOnce(port: number, mode: string) {
  const { LLMock } = await import('@copilotkit/aimock');
  const { createOpenAI } = await import('@ai-sdk/openai-v5');
  const { Agent } = await import('@mastra/core/agent');
  const { AgentController } = await import('@mastra/core/agent-controller');
  const { InMemoryStore } = await import('@mastra/core/storage');
  const { RedisStreamsPubSub } = await import('../src/index');

  let redis = startRedis(port);
  await waitForRedis(port);
  const mock = new LLMock({ port: 0 });
  await mock.start();
  mock.on({ endpoint: 'chat' }, { content: 'pong' });

  const openai = createOpenAI({ apiKey: 'test', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  const agent = new Agent({ id: 'agent', name: 'agent', instructions: 'Reply briefly.', model: openai('gpt-4o-mini') });
  const controller = new AgentController({
    id: 'controller',
    storage: new InMemoryStore(),
    pubsub: new RedisStreamsPubSub({ url: `redis://127.0.0.1:${port}`, keyPrefix: `m-${randomUUID()}`, blockMs: 200 }),
    resourceId: 'resource',
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 's', ownerId: 'owner', threadId: `t-${randomUUID()}` });

  const modelSaw = (text: string) =>
    (mock.getRequests() as any[]).some(request =>
      (request.body?.messages ?? []).some(
        (message: any) => message.role === 'user' && JSON.stringify(message.content).includes(text),
      ),
    );

  await session.sendMessage({ content: 'first' });
  if (mode === 'restart') {
    redis.kill('SIGKILL');
    await sleep(RESTART_DOWN_MS);
    redis = startRedis(port);
    await waitForRedis(port);
  }

  const start = Date.now();
  let outcome: string;
  try {
    const settled = await Promise.race([
      session.sendMessage({ content: 'second' }).then(() => true),
      sleep(SEND_TIMEOUT_MS).then(() => false),
    ]);
    if (!settled) outcome = 'hung';
    else {
      for (let i = 0; i < 40 && !modelSaw('second'); i++) await sleep(50);
      outcome = modelSaw('second') ? 'pass' : 'lost';
    }
  } catch {
    outcome = 'rejected';
  }
  process.stdout.write(`${JSON.stringify({ outcome, ms: Date.now() - start })}\n`);
  redis.kill('SIGKILL');
  process.exit(0);
}

async function lane(port: number, mode: string, runs: number) {
  const outcomes: string[] = [];
  for (let run = 0; run < runs; run++) {
    const child = spawnSync(process.execPath, [...process.execArgv, SCRIPT, '--run', String(port), '--mode', mode], {
      encoding: 'utf8',
      timeout: SEND_TIMEOUT_MS + 30_000,
    });
    spawnSync('redis-cli', ['-p', String(port), 'shutdown', 'nosave'], { stdio: 'ignore' });
    const line = child.stdout?.split('\n').find(l => l.startsWith('{"outcome"'));
    outcomes.push(line ? JSON.parse(line).outcome : 'error');
  }
  return outcomes;
}

if (process.argv.includes('--run')) {
  await runOnce(Number(arg('run', '6391')), arg('mode', 'none'));
} else if (process.argv.includes('--lane')) {
  console.log(JSON.stringify(await lane(Number(arg('lane', '6391')), arg('mode', 'none'), Number(arg('runs', '12')))));
} else {
  const mode = arg('mode', 'none');
  const lanes = Number(arg('lanes', '4'));
  const runs = Number(arg('runs', '12'));
  const basePort = Number(process.env.BASE_PORT ?? 6391);
  // Lanes run as parallel child processes so they contend for CPU.
  const results = await Promise.all(
    Array.from(
      { length: lanes },
      (_, i) =>
        new Promise<string[]>(resolve => {
          const child = spawn(
            process.execPath,
            [...process.execArgv, SCRIPT, '--lane', String(basePort + i), '--mode', mode, '--runs', String(runs)],
            { stdio: ['ignore', 'pipe', 'inherit'] },
          );
          let out = '';
          child.stdout.on('data', d => (out += d));
          child.on('exit', () => resolve(JSON.parse(out.trim().split('\n').pop()!)));
        }),
    ),
  );
  const all = results.flat();
  const count = (o: string) => all.filter(x => x === o).length;
  console.log(
    JSON.stringify({
      mode,
      lanes,
      runs,
      pass: count('pass'),
      lost: count('lost'),
      hung: count('hung'),
      rejected: count('rejected'),
      error: count('error'),
    }),
  );
}
