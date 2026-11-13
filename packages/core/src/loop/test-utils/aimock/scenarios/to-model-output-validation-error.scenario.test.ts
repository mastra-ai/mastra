import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool, isValidationError } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Scenario: a tool with `toModelOutput` fails input or output validation.
 *
 * `execute` resolves with a ValidationError (`{ error: true, message, validationErrors }`)
 * instead of the tool's output. `toModelOutput` is typed as receiving only the output, so a
 * mapper that picks fields from it turned the error into `{}`. The model never saw why the
 * call failed, could not retry with fixed arguments, and could report the empty result as a
 * success. The loop must skip `toModelOutput` for validation errors and send the error to the
 * model as-is, tagged `error-json` so providers still flag the call as failed, while still
 * applying the mapping to valid results. (#30211)
 */

const SECRET = 'internal-only-secret';

type LookupToolOptions = { output?: unknown; background?: boolean; requireTenant?: boolean };

function createLookupTool(opts: LookupToolOptions = {}) {
  const mapperCalls: unknown[] = [];
  const tool = createTool({
    id: 'lookup',
    description: 'Look up an answer',
    inputSchema: z.object({ query: z.string().min(1) }),
    outputSchema: z.object({ answer: z.string(), secret: z.string() }),
    ...(opts.background ? { background: { enabled: true, timeoutMs: 5000 } } : {}),
    ...(opts.requireTenant ? { requestContextSchema: z.object({ tenantId: z.string() }) } : {}),
    execute: async () => (opts.output ?? { answer: '42', secret: SECRET }) as { answer: string; secret: string },
    toModelOutput: output => {
      mapperCalls.push(output);
      return { type: 'json', value: { answer: output.answer } };
    },
  });
  return { tool, mapperCalls };
}

/**
 * The model output the loop recorded for the call: the validation error itself, unchanged,
 * tagged as an error result. MessageList substitutes this into the model prompt.
 */
function expectErrorSentUnchanged(toolResult: { payload?: { result?: unknown; providerMetadata?: any } } | undefined) {
  expect(isValidationError(toolResult?.payload?.result)).toBe(true);
  expect(toolResult?.payload?.providerMetadata?.mastra?.modelOutput).toEqual({
    type: 'error-json',
    value: toolResult?.payload?.result,
  });
}

/** Everything the model received on a request, as one string. */
function seenByModel(request: { body?: unknown } | undefined): string {
  return JSON.stringify(request?.body ?? null);
}

describeForAllEngines('AIMock scenario: toModelOutput and tool validation errors (#30211)', engine => {
  const getMock = useLoopScenarioAimock();

  async function callLookup(args: Record<string, unknown>, opts: LookupToolOptions = {}) {
    const { tool, mapperCalls } = createLookupTool(opts);
    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Look up the answer.',
      tools: { lookup: tool },
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: args }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_lookup', hasToolResult: true }, { content: 'Done.' });
      },
    });
    await output.text;
    return { mapperCalls, requests, toolResults: await output.toolResults };
  }

  it('the model sees why its arguments were rejected instead of an empty mapped result', async () => {
    const { mapperCalls, requests, toolResults } = await callLookup({ query: '' });

    // The mapper written for successful output never receives the error.
    expect(mapperCalls).toEqual([]);

    // The caller still gets the raw validation error, and the model gets it unchanged.
    expectErrorSentUnchanged(toolResults[0]);

    // The model receives the validation error, so it can retry with fixed arguments.
    expect(requests).toHaveLength(2);
    const followUp = seenByModel(requests[1]);
    expect(followUp).toContain('Tool input validation failed');
    expect(followUp).toContain('validationErrors');
  });

  it('the model sees an output validation failure instead of an empty mapped result', async () => {
    const { mapperCalls, requests, toolResults } = await callLookup(
      { query: 'meaning of life' },
      { output: { answer: 42, secret: SECRET } },
    );

    expect(mapperCalls).toEqual([]);
    expectErrorSentUnchanged(toolResults[0]);

    expect(requests).toHaveLength(2);
    const followUp = seenByModel(requests[1]);
    expect(followUp).toContain('Tool output validation failed');
    expect(followUp).toContain('validationErrors');
  });

  it('the model sees a request-context validation failure instead of an empty mapped result', async () => {
    // The tool needs a tenantId in the request context; the caller sent none.
    const { mapperCalls, requests, toolResults } = await callLookup(
      { query: 'meaning of life' },
      { requireTenant: true },
    );

    expect(mapperCalls).toEqual([]);
    expectErrorSentUnchanged(toolResults[0]);

    expect(requests).toHaveLength(2);
    const followUp = seenByModel(requests[1]);
    expect(followUp).toContain('Request context validation failed');
    expect(followUp).toContain('validationErrors');
  });

  it('an Anthropic model gets the rejected call flagged as an error, with the error text', async () => {
    // OpenAI chat has no error flag on tool results; Anthropic's `is_error` shows the
    // provider-level error tag survived. AIMock normalizes Anthropic requests to chat for
    // fixture matching, so the raw wire body is captured from the provider's fetch.
    const llm = getMock();
    const sentBodies: any[] = [];
    const model = createAnthropic({
      apiKey: 'aimock-test-key',
      baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
      fetch: async (url, init) => {
        sentBodies.push(JSON.parse(init!.body as string));
        return fetch(url, init);
      },
    })(SCENARIO_MODEL_ID);
    const { tool, mapperCalls } = createLookupTool();

    const { output } = await runLoopScenario({
      engine,
      llm,
      model,
      prompt: 'Look up the answer.',
      tools: { lookup: tool },
      stopWhen: stepCountIs(3),
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: { query: '' } }] },
        );
        mock.on({ endpoint: 'chat', toolCallId: 'call_lookup', hasToolResult: true }, { content: 'Done.' });
      },
    });
    await output.text;

    expect(mapperCalls).toEqual([]);
    const toolResult = sentBodies
      .flatMap(body => body.messages ?? [])
      .flatMap((message: any) => (Array.isArray(message.content) ? message.content : []))
      .find((block: any) => block.type === 'tool_result' && block.tool_use_id === 'call_lookup');
    expect(toolResult?.is_error).toBe(true);
    expect(JSON.stringify(toolResult?.content)).toContain('Tool input validation failed');
  });

  it('a valid result is still mapped, so the model never sees fields the mapper drops', async () => {
    const { mapperCalls, requests } = await callLookup({ query: 'meaning of life' });

    expect(mapperCalls).toEqual([{ answer: '42', secret: SECRET }]);
    expect(requests).toHaveLength(2);
    const followUp = seenByModel(requests[1]);
    expect(followUp).toContain('42');
    expect(followUp).not.toContain(SECRET);
  });

  it('a supervisor sees why its call to a subagent was rejected, not an empty reply', async () => {
    const mock = getMock();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const writer = new Agent({
      id: 'writer',
      name: 'Writer',
      description: 'Drafts written content',
      instructions: 'You are a writer subagent.',
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'Ask the writer for a tagline.',
      agents: { writer },
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        // `prompt` is required by the subagent tool's input schema; a number fails validation.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_writer', name: 'agent-writer', arguments: { prompt: 7 } }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_writer', hasToolResult: true }, { content: 'Retrying.' });
      },
    });
    await output.text;

    // The subagent never ran, and the supervisor's next request carries the validation error.
    const followUp = requests.at(-1);
    expect(requests).toHaveLength(2);
    expect(seenByModel(followUp)).toContain('Tool input validation failed');
  });

  it('a client tool that answers with a validation error reaches the model as that error', async () => {
    // Server-declared, client-executed tool: the client's own `createTool` validated and
    // sent back a ValidationError as the result.
    const mapperCalls: unknown[] = [];
    const browserTool = createTool({
      id: 'browserTool',
      description: 'Runs in the browser',
      inputSchema: z.object({ url: z.string() }),
      outputSchema: z.object({ fileId: z.string() }),
      toModelOutput: output => {
        mapperCalls.push(output);
        return { type: 'text', value: `Screenshot uploaded as ${output.fileId}` };
      },
    });
    const clientError = {
      error: true,
      message: 'Tool input validation failed for browserTool. url: Required',
      validationErrors: { errors: [], fields: { url: { errors: ['Required'], fields: {} } } },
    };

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: [
        { role: 'user', content: 'Take a screenshot.' },
        {
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: 'call_browser', toolName: 'browserTool', args: {} }],
        },
        {
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: 'call_browser', toolName: 'browserTool', result: clientError }],
        },
      ],
      tools: { browserTool },
      clientTools: {
        browserTool: {
          description: 'Runs in the browser',
          inputSchema: { type: 'object', properties: { url: { type: 'string' } } },
        },
      },
      stopWhen: stepCountIs(2),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The screenshot failed.' });
      },
    });
    await output.text;

    expect(mapperCalls).toEqual([]);
    expect(requests).toHaveLength(1);
    const seen = seenByModel(requests[0]);
    expect(seen).toContain('Tool input validation failed for browserTool');
    expect(seen).not.toContain('Screenshot uploaded as');
  });
});

describeForAllEngines(
  'AIMock scenario: toModelOutput and background tool validation errors (#30211)',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('a background tool whose arguments are rejected reports the error to the model', async () => {
      const { tool, mapperCalls } = createLookupTool({ background: true });

      const { output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Look up the answer in the background.',
        tools: { lookup: tool },
        agentBackgroundTasks: { tools: { lookup: true } },
        backgroundTasks: { enabled: true },
        memory: new MockMemory(),
        threadId: `to-model-output-bg-${engine}`,
        resourceId: 'user-to-model-output-bg',
        streamUntilIdle: true,
        stopWhen: stepCountIs(3),
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', sequenceIndex: 0 },
            { toolCalls: [{ id: 'call_bg_lookup', name: 'lookup', arguments: { query: '' } }] },
          );
          llm.on({ endpoint: 'chat' }, { content: 'Done.' });
        },
      });
      await output.text;

      // The mapper may still see the dispatch placeholder string; it must never see the error.
      expect(mapperCalls.filter(isValidationError)).toEqual([]);
      // After the task settles, the model is re-invoked and sees the validation error.
      expect(requests.some(request => seenByModel(request).includes('Tool input validation failed'))).toBe(true);
      // The tool message answering the call carries the error itself, not a mapping of it.
      const toolMessages = requests
        .flatMap(request => ((request.body as { messages?: any[] } | undefined)?.messages ?? []) as any[])
        .filter(message => message.role === 'tool' && message.tool_call_id === 'call_bg_lookup');
      expect(toolMessages.some(message => JSON.stringify(message.content).includes('validationErrors'))).toBe(true);
    });
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
