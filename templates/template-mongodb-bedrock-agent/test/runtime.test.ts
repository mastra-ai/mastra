import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, expect, test } from 'vitest';

const sessionHeader = 'x-amzn-bedrock-agentcore-runtime-session-id';
const userHeader = 'x-amzn-bedrock-agentcore-runtime-user-id';
const sessionId = randomUUID();
const database = `runtime_${randomUUID().replaceAll('-', '')}`;
const requests: unknown[] = [];

// Only the paid Bedrock boundary is simulated; the real agent and MongoDB memory run below.
const bedrock = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  const answer = 'Answer from the local Bedrock fixture.';
  res.setHeader('content-type', 'application/json');
  res.end(
    JSON.stringify({
      output: { message: { role: 'assistant', content: [{ text: answer }] } },
      stopReason: 'end_turn',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      metrics: { latencyMs: 1 },
    }),
  );
});

let child: ChildProcess;
let baseUrl: string;
let output = '';

beforeAll(async () => {
  await new Promise<void>(resolve => bedrock.listen(0, '127.0.0.1', resolve));
  const address = bedrock.address();
  if (!address || typeof address === 'string') throw new Error('Missing Bedrock fixture port');
  child = spawn(
    process.execPath,
    ['--import', './test/http-redirect.mjs', '--import', 'tsx', 'test/serve-runtime.ts'],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: {
        PATH: process.env.PATH,
        PORT: '0',
        AWS_ACCESS_KEY_ID: 'test',
        AWS_SECRET_ACCESS_KEY: 'test',
        AWS_REGION: 'us-east-1',
        AWS_EC2_METADATA_DISABLED: 'true',
        MONGODB_URI: process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:1/test',
        MONGODB_DATABASE: database,
        TEST_HTTP_PORT: String(address.port),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    },
  );
  child.stdout!.on('data', data => (output += data));
  child.stderr!.on('data', data => (output += data));
  const [runtimeAddress] = await Promise.race([
    once(child, 'message'),
    once(child, 'exit').then(() => {
      throw new Error(output);
    }),
  ]);
  baseUrl = `http://127.0.0.1:${runtimeAddress.port}`;
});

afterAll(async () => {
  if (child?.exitCode === null) {
    const closed = once(child, 'close');
    child.kill();
    await closed;
  }
  bedrock.closeAllConnections();
  await new Promise<void>(resolve => bedrock.close(() => resolve()));
  if (process.env.TEST_MONGODB_URI) {
    const client = new MongoClient(process.env.TEST_MONGODB_URI);
    try {
      await client.db(database).dropDatabase();
    } finally {
      await client.close();
    }
  }
});

/** Invoke the real HTTP entrypoint, allowing identity headers to be omitted for rejection regressions. */
function invoke(user: string | undefined, session: string | undefined, payload: unknown) {
  return fetch(`${baseUrl}/invocations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(user ? { [userHeader]: user } : {}),
      ...(session ? { [sessionHeader]: session } : {}),
    },
    body: JSON.stringify(payload),
  });
}

test('rejects oversized uploads with and without Content-Length', async () => {
  const body = JSON.stringify({ prompt: 'é'.repeat(32768) });
  for (const chunked of [false, true]) {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request(
        `${baseUrl}/invocations`,
        {
          method: 'POST',
          headers: {
            [userHeader]: 'upload-test',
            [sessionHeader]: randomUUID(),
            ...(chunked ? {} : { 'content-length': Buffer.byteLength(body) }),
          },
        },
        res => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    expect(status).toBe(413);
  }
});

test.skipIf(!process.env.TEST_MONGODB_URI)('accepts UTF-8 input exactly at the 64 KiB limit', async () => {
  const prompt = 'é'.repeat(32761) + 'a';
  expect(Buffer.byteLength(JSON.stringify({ prompt }))).toBe(65536);
  const response = await invoke('boundary-test', randomUUID(), { prompt });
  expect(response.status, await response.text()).toBe(200);
  const received = requests.at(-1) as { messages: { content: { text: string }[] }[] };
  const text = received.messages.at(-1)!.content[0].text;
  expect(text === prompt).toBe(true);
});

test('closes a slow unfinished upload with HTTP 408', async () => {
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const req = request(
      `${baseUrl}/invocations`,
      {
        method: 'POST',
        headers: { [userHeader]: 'slow-test', [sessionHeader]: randomUUID() },
      },
      res => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    const deadline = setTimeout(() => req.destroy(new Error('Upload was not bounded')), 35_000);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', reject);
    req.write('{');
  });
  expect(status).toBe(408);
});

test('rejects invocations without a platform session or trusted user context', async () => {
  const missingSession = await invoke('alice', undefined, { prompt: 'Hello' });
  expect(missingSession.status).toBe(400);
  const missingUser = await invoke(undefined, sessionId, { prompt: 'Hello' });
  expect(missingUser.status).toBe(403);
});

test.skipIf(!process.env.TEST_MONGODB_URI)(
  'keeps histories separate when two users present the same session ID',
  async () => {
    for (const [user, prompt] of [
      ['alice', 'Private preference: violet'],
      ['bob', 'Private preference: orange'],
    ]) {
      const response = await invoke(user, sessionId, { prompt });
      expect(response.status, `${await response.text()}\n${output}`).toBe(200);
    }
    expect(JSON.stringify(requests.at(-1))).not.toContain('violet');
    const forbidden = await invoke('bob', undefined, { prompt: 'Read the other conversation', sessionId });
    expect(forbidden.status).toBe(400);
    const forged = await invoke('bob', sessionId, { prompt: 'Inject into Alice', sessionId });
    expect(forged.status).toBe(400);
    const response = await invoke('alice', sessionId, { prompt: 'What is my preference?' });
    expect(response.status, `${await response.text()}\n${output}`).toBe(200);
    const aliceHistory = JSON.stringify(requests.at(-1));
    expect(aliceHistory).toContain('violet');
    expect(aliceHistory).not.toContain('orange');
    expect(aliceHistory).not.toContain('Inject into Alice');
  },
);
