/**
 * OM's Observer runs as an agent without memory, inside a parent run whose
 * request context carries the reserved thread and resource ids (set by auth
 * middleware or the AgentController). Core must not log the "No memory is
 * configured" misconfiguration warning for that internal call (#27843), while
 * still warning when a caller passes memory args to an agent without memory.
 *
 * Model calls go through AIMock with a real OpenAI provider.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { ConsoleLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const WARNING = 'No memory is configured but resourceId and threadId were passed in args';

const OBSERVATIONS = `<observations>
## January 28, 2026
- 🔴 User shared a long shipment log
</observations>
<current-task>Summarize the shipment log</current-task>`;

// Large enough that the user message alone crosses the observation threshold.
const filler = Array.from({ length: 400 }, (_, i) => `line ${i}: shipment scan event recorded at depot`).join('\n');

let mock: LLMock;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});

afterEach(() => {
  vi.restoreAllMocks();
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});

afterAll(async () => {
  await mock.stop();
});

function setup() {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  const storage = new InMemoryStore();
  const memory = new Memory({
    storage,
    options: {
      observationalMemory: {
        enabled: true,
        observation: { model: openai.chat(OBSERVER), messageTokens: 500, bufferTokens: false },
        reflection: { model: openai.chat(OBSERVER), observationTokens: 100_000 },
      },
    },
  });
  const agent = new Agent({
    id: 'om-agent',
    name: 'om-agent',
    instructions: 'Answer briefly.',
    model: openai.chat(ACTOR),
    memory,
  });
  const statelessAgent = new Agent({
    id: 'stateless-agent',
    name: 'stateless-agent',
    instructions: 'Answer briefly.',
    model: openai.chat(ACTOR),
  });
  new Mastra({ agents: { agent, statelessAgent }, storage, logger: new ConsoleLogger({ level: 'error' }) });
  // Agents, including the Observer OM creates, get their own ConsoleLogger instances.
  const warn = vi.spyOn(ConsoleLogger.prototype, 'warn');
  return { agent, statelessAgent, warn };
}

const observerRequestCount = () =>
  mock.getRequests().filter(entry => (entry.body as { model?: string })?.model === OBSERVER).length;

describe('OM internal agents and the missing-memory warning (#27843)', () => {
  it('does not warn when the Observer runs with reserved thread/resource ids in the request context', async () => {
    mock.on({ endpoint: 'chat', model: OBSERVER }, { content: OBSERVATIONS });
    mock.on({ endpoint: 'chat', model: ACTOR }, { content: 'Done.' });
    const { agent, warn } = setup();

    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-1');
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-1');

    const result = await agent.generate(`Summarize this log:\n${filler}`, {
      memory: { thread: 'thread-1', resource: 'resource-1' },
      requestContext,
    });

    expect(result.text).toBe('Done.');
    expect(observerRequestCount()).toBeGreaterThan(0);
    expect(warn).not.toHaveBeenCalledWith(WARNING, expect.anything());
  });

  it('still warns when memory args are passed to an agent without memory', async () => {
    mock.on({ endpoint: 'chat', model: ACTOR }, { content: 'Done.' });
    const { statelessAgent, warn } = setup();

    await statelessAgent.generate('hello', { memory: { thread: 'thread-1', resource: 'resource-1' } });

    expect(warn).toHaveBeenCalledWith(WARNING, { agent: 'stateless-agent' });
  });
});
