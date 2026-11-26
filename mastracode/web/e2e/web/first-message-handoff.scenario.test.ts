import { randomUUID } from 'node:crypto';

import { MastraClient } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, it, expect } from 'vitest';

import { runScenario } from './scenario-runner';
import type { ScenarioContext } from './scenario-runner';

/**
 * First prompt of a new user session (Factory UI draft → thread handoff).
 *
 * The page owns a session whose thread id is its session id. Only an explicit
 * start (`create({ threadId })`, which the Factory runs when it creates the
 * session row) may create the session and its thread. Every other route acts on
 * a started session, or on one rebuilt from its stored thread after a restart,
 * and is refused otherwise — so a write can never land on a stray random-id
 * thread the page does not read. These scenarios drive the real client → Hono →
 * @mastra/server → AgentController stack and read the session thread with a
 * fresh client, the way a page refresh does.
 */

const PROMPT = 'First message of a new session';
const AFTER_RESTART = 'Second message after a restart';

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
  it('refuses a send to a session that was never started, then persists the first prompt once it is', async () => {
    await runScenario({
      name: 'first-message-handoff-start-first',
      description: 'A send before the session starts is refused; after the start it lands on the session thread.',
      aimockFixture: 'first-message-handoff.json',
      server: { memory: true },
      run: async ctx => {
        const sessionId = randomUUID();
        const session = pageSession(ctx, sessionId);

        await expect(session.sendMessage(PROMPT)).rejects.toMatchObject({ status: 404 });
        expect(await session.listThreads()).toEqual([]);

        const created = await session.create({ threadId: sessionId });
        expect(created.threadId).toBe(sessionId);
        await session.sendMessage(PROMPT);

        await expect.poll(() => reloadSessionThread(ctx, sessionId), { timeout: 5000 }).toContain(PROMPT);
        const threads = await session.listThreads();
        expect(threads.map(thread => thread.id)).toEqual([sessionId]);
      },
    });
  });

  it('resumes the stored session thread after a restart without the page starting it again', async () => {
    await runScenario({
      name: 'first-message-handoff-restart',
      description: 'After a restart, a send without init lands on the thread the session was started on.',
      aimockFixture: 'first-message-handoff.json',
      server: { memory: true },
      run: async ctx => {
        const sessionId = randomUUID();
        const session = pageSession(ctx, sessionId);
        await session.create({ threadId: sessionId });
        await session.sendMessage(PROMPT);
        await expect.poll(() => reloadSessionThread(ctx, sessionId), { timeout: 5000 }).toContain(PROMPT);

        await ctx.restartServer();
        const afterRestart = pageSession(ctx, sessionId);
        await afterRestart.sendMessage(AFTER_RESTART);

        await expect
          .poll(() => reloadSessionThread(ctx, sessionId), { timeout: 5000 })
          .toEqual(expect.arrayContaining([PROMPT, AFTER_RESTART]));
        const threads = await afterRestart.listThreads();
        expect(threads.map(thread => thread.id)).toEqual([sessionId]);
      },
    });
  });
});
