import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v6';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Scenario: a tool's input schema decodes the model's `url` string into a `URL` (#27259).
 *
 * The tool builder validated and decoded the arguments, then `Tool.execute` validated the decoded
 * `URL` against the same schema and rejected it ("expected string, received URL"). The handler
 * never ran. Models with a schema compat layer (for example OpenAI, Anthropic, Google) skipped the
 * second validation, so the scenario uses a provider without one.
 */

const URL_ARG = 'https://example.com/docs';
const ARGS = { url: URL_ARG };

function makeFetchTool(received: unknown[], requireApproval = false) {
  return createTool({
    id: 'fetch_page',
    description: 'Fetch a web page',
    inputSchema: z.object({ url: z.string().transform(s => new URL(s)) }),
    requireApproval,
    execute: async ({ url }) => {
      received.push(url);
      return { host: url.host, path: url.pathname };
    },
  });
}

// No schema compat layer matches this provider or model ID (see the layers in CoreToolBuilder.build).
// If one is added for it, the scenario passes without the fix and stops covering #27259.
function modelWithoutCompatLayer(llm: { url: string }) {
  return createOpenAICompatible({
    name: 'alibaba',
    apiKey: 'aimock-test-key',
    baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
  }).chatModel('qwen3.8-max');
}

function expectToolRanWithUrl(received: unknown[], requests: { body: unknown }[]) {
  expect(received).toHaveLength(1);
  expect(received[0]).toBeInstanceOf(URL);
  expect((received[0] as URL).href).toBe(URL_ARG);
  // The model receives the tool's result.
  const toolMessage = ((requests[1]?.body as any)?.messages ?? []).find((m: any) => m.role === 'tool');
  expect(JSON.parse(toolMessage?.content ?? 'null')).toEqual({ host: 'example.com', path: '/docs' });
}

function scriptFetchCall(mock: { on: (...args: any[]) => unknown }) {
  mock.on(
    { endpoint: 'chat', hasToolResult: false },
    { toolCalls: [{ id: 'call-fetch', name: 'fetch_page', arguments: ARGS }] },
  );
  mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Fetched example.com/docs.' });
}

describeForAllEngines('AIMock scenario: tool input schema decodes the model arguments', engine => {
  const getMock = useLoopScenarioAimock();

  it('the tool runs with the decoded URL (#27259)', async () => {
    const received: unknown[] = [];
    const llm = getMock();
    const { requests } = await runLoopScenario({
      engine,
      llm,
      model: modelWithoutCompatLayer(llm),
      prompt: `Fetch ${URL_ARG}`,
      tools: { fetch_page: makeFetchTool(received) },
      stopWhen: stepCountIs(3),
      fixtures: scriptFetchCall,
    });

    expectToolRanWithUrl(received, requests);
  });

  it('an approved call runs with the decoded URL (#27259)', async () => {
    const received: unknown[] = [];
    const memory = new MockMemory();
    const llm = getMock();
    const shared = await createSharedAgent(llm, {
      tools: { fetch_page: makeFetchTool(received, true) },
      model: modelWithoutCompatLayer(llm),
      memory,
      engine,
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm,
      sharedAgent: shared,
      prompt: `Fetch ${URL_ARG}`,
      memory,
      threadId: `transformed-input-approval-${engine}`,
      resourceId: 'reader',
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: scriptFetchCall,
    });

    const approvals = (chunks ?? []).filter(c => c.type === 'tool-call-approval') as any[];
    expect(approvals.map(c => c.payload.toolCallId)).toEqual(['call-fetch']);
    expect(received).toHaveLength(0);

    const resumed = await shared.agent.approveToolCall({ runId: output.runId, toolCallId: 'call-fetch' });
    for await (const _chunk of resumed.fullStream) {
      // drain
    }
    expectToolRanWithUrl(received, llm.getRequests() as { body: unknown }[]);
  });
});
