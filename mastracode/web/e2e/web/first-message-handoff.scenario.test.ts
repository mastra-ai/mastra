import { randomUUID } from 'node:crypto';

import { MastraClient } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';
import type { ScenarioContext } from './scenario-runner';

/**
 * First prompt of a new user session (Factory UI draft → thread handoff).
 *
 * The page owns a session whose thread id is its session id. Session init binds
 * that thread with `create({ threadId })`. A send or model switch that reaches
 * the server first must bind the same thread, or the prompt lands on a stray
 * random-id thread the page never reads. These scenarios drive the real
 * client → Hono → @mastra/server → AgentController stack and read the session
 * thread with a fresh client, the way a page refresh does.
 */

const PROMPT = 'First message of a new session';

function userTexts(messages: MastraDBMessage[]): string[] {
  return messages
    .filter(message => message.role === 'user' || message.role === 'signal')
    .flatMap(message => message.content.parts)
    .flatMap(part => (part.type === 'text' ? [part.text] : []));
}

function pageSession({ baseUrl, fetch }: ScenarioContext, sessionId: string) {
  const client = new MastraClient({ baseUrl, fetch: fetch as typeof globalThis.fetch });
  return client.getAgentController('code').session(sessionId);
}

/** Reload the session thread with a new client, as a page refresh does. */
async function reloadSessionThread(ctx: ScenarioContext, sessionId: string): Promise<string[]> {
  return userTexts(await pageSession(ctx, sessionId).listMessages(sessionId));
}

describe('web scenario: first message handoff', () => {
  it('persists the first prompt to the session thread when the send waits for init to bind it', async () => {
    await runScenario({
      name: 'first-message-handoff-bound',
      description: 'Init binds the session thread, then the handoff sends the first prompt.',
      aimockFixture: 'first-message-handoff.json',
      server: { memory: true },
      run: async ctx => {
        const sessionId = randomUUID();
        const session = pageSession(ctx, sessionId);

        const created = await session.create({ threadId: sessionId });
        // The handoff gate: connection thread === session thread.
        expect(created.threadId).toBe(sessionId);
        expect((await session.state({ threadId: sessionId })).threadId).toBe(sessionId);

        await session.sendMessage(PROMPT);

        await expect.poll(() => reloadSessionThread(ctx, sessionId), { timeout: 5000 }).toContain(PROMPT);
        const threads = await session.listThreads();
        expect(threads.map(thread => thread.id)).toEqual([sessionId]);
      },
    });
  });

  it('persists the first prompt to the session thread when the send reaches the server before init', async () => {
    await runScenario({
      name: 'first-message-handoff-send-first',
      description: 'The first send arrives before init binds the session thread.',
      aimockFixture: 'first-message-handoff.json',
      server: { memory: true },
      run: async ctx => {
        const sessionId = randomUUID();
        const session = pageSession(ctx, sessionId);

        await session.sendMessage(PROMPT, { threadId: sessionId });
        await expect.poll(() => reloadSessionThread(ctx, sessionId), { timeout: 5000 }).toContain(PROMPT);

        // Init lands late; it must keep the session on the thread holding the prompt.
        const created = await session.create({ threadId: sessionId });
        expect(created.threadId).toBe(sessionId);
        expect(await reloadSessionThread(ctx, sessionId)).toContain(PROMPT);
        const threads = await session.listThreads();
        expect(threads.map(thread => thread.id)).toEqual([sessionId]);
      },
    });
  });
});
