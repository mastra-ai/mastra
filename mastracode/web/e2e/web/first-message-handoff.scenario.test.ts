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
 * that thread with `create({ threadId })`, but the send-message and model routes
 * resolve the session without a thread id. This scenario drives the real
 * client → Hono → @mastra/server → AgentController stack in the order the
 * handoff now uses (send waits for init to bind), and reads the session thread
 * with a fresh client, the way a page refresh does.
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
});
