import { randomUUID } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { GoogleCloudPubSub } from './index';

const EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST ?? 'localhost:8085';
const SCENARIO_MODEL_ID = 'gpt-4o-mini';

/**
 * Mirror of `packages/core/.../evented-unix-pubsub.scenario.test.ts` and
 * `pubsub/redis-streams/.../agentic-loop-pubsub.test.ts`, but pointed at
 * `GoogleCloudPubSub` (running against the Pub/Sub emulator).
 *
 * The agentic loop must complete cleanly when the evented engine ships
 * `workflow.events.v2` and step-result snapshots through a real Pub/Sub
 * broker, including tool outputs carrying non-JSON-safe payloads
 * (Date, Map, Error). This guards against regressions where `localOnly`
 * tagging or `RunScope` plumbing fails to keep live runtime state out of
 * the wire path.
 */
describe('AIMock loop scenario: evented + GoogleCloudPubSub', () => {
  let mock: LLMock | undefined;
  const pubsubs: GoogleCloudPubSub[] = [];

  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
    process.env.MASTRA_EVENTED_EXECUTION = 'true';
  });

  afterEach(async () => {
    mock?.clearFixtures();
    mock?.clearRequests();
    mock?.resetMatchCounts();
    await Promise.allSettled(pubsubs.splice(0).map(p => p.flush().catch(() => {})));
  });

  afterAll(async () => {
    await mock?.stop();
    mock = undefined;
    delete process.env.MASTRA_EVENTED_EXECUTION;
  });

  it('round-trips a tool result containing Date/Map/Error across the evented pubsub', async () => {
    if (!mock) throw new Error('AIMock server is not running');

    const pubsub = new GoogleCloudPubSub({
      projectId: `aimock-${randomUUID().slice(0, 8)}`,
      apiEndpoint: EMULATOR_HOST,
    });
    pubsubs.push(pubsub);

    const reportedAt = new Date('2024-06-15T12:34:56.789Z');

    const lookupTool = createTool({
      id: 'lookup_status',
      description: 'Look up a status payload with non-JSON-safe fields.',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.any(),
      execute: async ({ query }) => ({
        status: `STATUS_OK:${query}`,
        reportedAt,
        tags: new Map([
          ['priority', 'high'],
          ['source', query],
        ]),
        warning: new Error(`slow_response:${query}`),
      }),
    });

    mock.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [
          {
            id: 'call_lookup_alpha',
            name: 'lookup_status',
            arguments: { query: 'alpha' },
          },
        ],
      },
    );
    mock.on(
      { endpoint: 'chat', toolCallId: 'call_lookup_alpha', hasToolResult: true },
      { content: 'The status for alpha is STATUS_OK:alpha.' },
    );

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const agentId = `aimock-gcp-scenario-${randomUUID()}`;
    const agent = new Agent({
      id: agentId,
      name: 'AIMock GCP Scenario Agent',
      instructions: 'You are a test agent driven by scripted AIMock responses.',
      model: openai(SCENARIO_MODEL_ID),
      tools: { lookup_status: lookupTool },
    });

    const mastra = new Mastra({
      agents: { [agentId]: agent },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const registered = mastra.getAgent(agentId);
    const output = await registered.stream('Look up the status for query alpha.', {
      stopWhen: stepCountIs(5),
    });
    await output.consumeStream();

    const requests = mock.getRequests();
    expect(requests).toHaveLength(2);

    const text = await output.text;
    expect(text).toContain('STATUS_OK:alpha');

    const toolResults = await output.toolResults;
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]?.payload.toolName).toBe('lookup_status');
    const toolResult = toolResults[0]?.payload.result as { status: string };
    expect(toolResult.status).toBe('STATUS_OK:alpha');

    const turn2Messages = requests[1]?.body?.messages ?? [];
    const toolMessage = turn2Messages.find(message => (message as { role?: string }).role === 'tool') as
      { tool_call_id?: string; content?: string } | undefined;
    expect(toolMessage?.tool_call_id).toBe('call_lookup_alpha');
    expect(toolMessage?.content).toContain('STATUS_OK:alpha');
  });
});
