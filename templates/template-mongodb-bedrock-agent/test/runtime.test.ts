import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
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
  let body = '';
  for await (const chunk of req) body += chunk;
  requests.push(JSON.parse(body));
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
