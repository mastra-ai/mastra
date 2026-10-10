import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

import { Agent } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PlatformMemoryClient } from './client';
import { PlatformMemory } from './platform-memory';

/**
 * Live parity check against a local Platform API started with
 * MEMORY_TEST_MODEL_URL=http://localhost:4555/v1. The scripted model returns the
 * same observer output as @mastra/memory's createMockObserverModel, so the
 * hosted observer must produce the observations a local Memory would.
 */
const live = process.env.PLATFORM_MEMORY_LIVE;
const BODY = `Date: Jan 1, 2026
* 🔴 User's name is Ada and she lives in Kyoto.`;
const TAIL = `<current-task>Chatting with Ada.</current-task>
<suggested-response>Greet Ada by name.</suggested-response>`;

function scriptedModel(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      const stream = raw && JSON.parse(raw).stream;
      // Resource scope asks for one <thread id> block per observed thread.
      const ids = [...new Set([...raw.matchAll(/<thread id=\\?"([^"\\]+)/g)].map(m => m[1]))];
      const OBSERVATIONS = ids.length
        ? `<observations>\n${ids.map(id => `<thread id="${id}">\n${BODY}\n</thread>`).join('\n')}\n</observations>\n${TAIL}`
        : `<observations>\n${BODY}\n</observations>\n${TAIL}`;
      const base = { id: 'x', object: 'chat.completion', created: 0, model: 'scripted' };
      if (!stream) {
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            ...base,
            choices: [{ index: 0, message: { role: 'assistant', content: OBSERVATIONS }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
          }),
        );
        return;
      }
      res.setHeader('content-type', 'text/event-stream');
      const send = (d: unknown) => res.write(`data: ${JSON.stringify(d)}\n\n`);
      send({
        ...base,
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content: OBSERVATIONS } }],
      });
      send({
        ...base,
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });
      res.end('data: [DONE]\n\n');
    });
  });
  return new Promise(r => server.listen(port, () => r(server)));
}

describe.skipIf(!live)('PlatformMemory parity (live local API)', () => {
  let server: Server;
  beforeAll(async () => {
    server = await scriptedModel(4555);
  });
  afterAll(() => server?.close());

  it('observes a conversation server-side and recalls it on a new turn like Memory', async () => {
    const { instanceId, token } = JSON.parse(readFileSync(live!, 'utf8'));
    const client = new PlatformMemoryClient({
      apiUrl: 'http://127.0.0.1:3010',
      actingUserId: 'user_ada',
      accessToken: token,
      instanceId,
    });
    const memory = new PlatformMemory({ client });
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'parity',
      name: 'parity',
      instructions: 'be brief',
      memory,
      model: createMockModel({ mockText: 'Nice to meet you, Ada.', spyGenerate: p => prompts.push(p) } as never),
    });
    const thread = `parity-${Date.now()}`;
    const opts = { memory: { thread, resource: 'user_ada' } };

    await agent.generate("Hi, I'm Ada and I live in Kyoto.", opts);
    const res = await fetch(`http://127.0.0.1:3010/v1/memory/${instanceId}/threads/${thread}/observe`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const { record } = await res.json();
    expect(record?.activeObservations ?? '').toContain('Ada');

    const ctx = await client.getContext(thread, 'user_ada');
    expect(ctx.system).toContain('lives in Kyoto');
    expect(ctx.continuation).toContain('<system-reminder>');

    await agent.generate('Where do I live?', opts);
    expect(JSON.stringify(prompts.at(-1))).toContain('lives in Kyoto');
  }, 60_000);
});
