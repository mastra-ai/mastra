import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v6';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../../../request-context';
import { createTool } from '../../../../tools';
import { recordDelegationFailure, takeDelegationFailure } from '../../../shared/delegation-outcome';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Scenario: the model's tool-call arguments are cut off mid-JSON, and the response says why.
 *
 * A response that ends on the output limit (`length`) or a content filter (`content-filter`) is
 * terminal: asking again repeats the same cut-off or refusal. A valid tool call in such a response
 * runs and the run ends there. When the cut-off arguments cannot be parsed, the tool must not run
 * and the parse failure is recorded, but recording it must not send another request to the model or
 * replace the finish reason (#29518).
 *
 * A malformed call that ends with `tool_calls` or `stop` (some models report `stop` alongside tool
 * calls) is not terminal: the model gets the parse error back and can correct the call.
 */

const TRUNCATED_ARGS = '{"query": "unfinished';
const PARSE_ERROR = 'received invalid arguments';

// Chat-completions wire, so the scripted `finish_reason` reaches the loop as-is.
function chatModel(llm: { url: string }) {
  return createOpenAICompatible({
    name: 'openai-compatible',
    apiKey: 'aimock-test-key',
    baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
  }).chatModel(SCENARIO_MODEL_ID);
}

function toolMessages(body: unknown): Array<{ role: string; content: unknown }> {
  const messages = (body as { messages?: Array<{ role: string; content: unknown }> } | undefined)?.messages ?? [];
  return messages.filter(message => message.role === 'tool');
}

describeForAllEngines('AIMock scenario: cut-off tool-call arguments in a terminal response', engine => {
  const getMock = useLoopScenarioAimock();

  async function sendCutOffToolCall({
    finishReason,
    args,
    toolThrows = false,
  }: {
    finishReason: string;
    args: string;
    toolThrows?: boolean;
  }) {
    const executions: unknown[] = [];
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up',
      inputSchema: z.object({ query: z.string().optional() }),
      execute: async input => {
        executions.push(input);
        if (toolThrows) throw new Error('lookup service unavailable');
        return { ok: true };
      },
    });

    const result = await runLoopScenario({
      engine,
      llm: getMock(),
      model: chatModel(getMock()),
      prompt: 'Look it up',
      tools: { lookup },
      collectChunks: true,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-lookup', name: 'lookup', arguments: args }], finishReason },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I could not look it up.' });
      },
    });
    return { ...result, executions };
  }

  it.each([
    { finishReason: 'length', expected: 'length' },
    { finishReason: 'content_filter', expected: 'content-filter' },
  ])(
    'ends the run at a "$expected" finish without running the tool or asking the model again (#29518)',
    async ({ finishReason, expected }) => {
      const { output, requests, chunks, executions } = await sendCutOffToolCall({
        finishReason,
        args: TRUNCATED_ARGS,
      });

      expect(executions).toEqual([]);
      expect(requests).toHaveLength(1);
      expect(await output.finishReason).toBe(expected);
      // The parse failure is still reported on the stream for the call that could not run.
      const toolError = chunks?.find(chunk => chunk.type === 'tool-error');
      expect(toolError?.payload).toEqual(
        expect.objectContaining({
          toolCallId: 'call-lookup',
          error: expect.objectContaining({ message: expect.stringContaining(PARSE_ERROR) }),
        }),
      );
      // The call keeps its error result in the response, so a later turn never replays a call
      // without a result (providers reject that).
      const { messages = [] } = await output.response;
      expect(JSON.stringify(messages.filter(message => message.role === 'tool'))).toContain(PARSE_ERROR);
    },
  );

  it('still runs a valid empty-object call at a "length" finish and ends the run (#29518)', async () => {
    const { output, requests, executions } = await sendCutOffToolCall({ finishReason: 'length', args: '{}' });

    expect(executions).toEqual([{}]);
    expect(requests).toHaveLength(1);
    expect(await output.finishReason).toBe('length');
  });

  // The same rule holds for any failed call in a terminal response, not only unparseable arguments.
  it('ends the run at a "length" finish when a valid call throws (#29518)', async () => {
    const { output, requests, executions } = await sendCutOffToolCall({
      finishReason: 'length',
      args: '{"query": "weather"}',
      toolThrows: true,
    });

    expect(executions).toEqual([{ query: 'weather' }]);
    expect(requests).toHaveLength(1);
    expect(await output.finishReason).toBe('length');
    const { messages = [] } = await output.response;
    expect(JSON.stringify(messages.filter(message => message.role === 'tool'))).toContain('lookup service unavailable');
  });

  // A delegation hook that bails on a failed sub-agent leaves a flag and its failure on the
  // RequestContext. A terminal finish must consume both, or a caller that reuses the context
  // would stop its next run's first tool turn early with a stale failure (#29518).
  it('consumes a delegation bail left by a failed call at a "length" finish (#29518)', async () => {
    const requestContext = new RequestContext();
    const delegate = createTool({
      id: 'delegate',
      description: 'Ask a sub-agent',
      inputSchema: z.object({ query: z.string().optional() }),
      execute: async (_input, context) => {
        const ctx = context?.requestContext ?? requestContext;
        ctx.set('__mastra_delegationBailed', true);
        recordDelegationFailure(ctx, { outcome: 'error', stopReason: null });
        throw new Error('sub-agent failed');
      },
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      model: chatModel(getMock()),
      prompt: 'Ask the sub-agent',
      tools: { delegate },
      requestContext,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ id: 'call-delegate', name: 'delegate', arguments: '{"query": "x"}' }],
            finishReason: 'length',
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'unexpected second request' });
      },
    });

    expect(await output.finishReason).toBe('length');
    expect(requests).toHaveLength(1);
    expect(requestContext.get('__mastra_delegationBailed')).toBeFalsy();
    expect(takeDelegationFailure(requestContext)).toBeUndefined();
  });

  it.each(['tool_calls', 'stop'])(
    'returns the parse error to the model so it can correct the call at a "%s" finish (#29518)',
    async finishReason => {
      const { output, requests, executions } = await sendCutOffToolCall({ finishReason, args: TRUNCATED_ARGS });

      expect(executions).toEqual([]);
      expect(requests).toHaveLength(2);
      expect(JSON.stringify(toolMessages(requests[1]!.body))).toContain(PARSE_ERROR);
      expect(await output.text).toBe('I could not look it up.');
    },
  );
});
