import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v6';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { MockMemory } from '../../../../memory';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Scenario: a thread already holds a tool call that was stored without any input.
 *
 * Real case: the model sent unparseable tool arguments, the call was stored as a `tool-invocation`
 * part in state `output-error` with no `args`, and every later request on the thread replayed it
 * without `function.arguments`. Providers reject that (Anthropic: `tool_use.input` required;
 * OpenAI-compatible: "function.arguments must be defined"), so the thread could not be used again.
 *
 * Whatever shape the missing input takes in storage (absent or null), the outbound call must carry `{}` and keep its
 * error result. The stored row is never rewritten.
 */

const ERROR_TEXT =
  'Tool "team_status" received invalid arguments — the provided JSON could not be parsed. Please provide valid JSON arguments.';

// The generic OpenAI-compatible provider writes `arguments: JSON.stringify(input)`, which drops the key
// for an undefined input, so it shows the failure that the real providers report.
function chatModel(llm: { url: string }) {
  return createOpenAICompatible({
    name: 'openai-compatible',
    apiKey: 'aimock-test-key',
    baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
  }).chatModel(SCENARIO_MODEL_ID);
}

function replayedCall(body: any) {
  const assistant = (body?.messages ?? []).find((m: any) => m.tool_calls?.some((tc: any) => tc.id === 'call-stored'));
  return assistant?.tool_calls.find((tc: any) => tc.id === 'call-stored');
}

// `undefined` is the stored row's shape (no `args` key at all).
const MISSING_INPUTS: [string, Record<string, unknown>][] = [
  ['no args key', {}],
  ['null args', { args: null }],
];

describeForAllEngines('AIMock scenario: stored tool call without input', engine => {
  const getMock = useLoopScenarioAimock();

  it.each(MISSING_INPUTS)('replays a stored tool-invocation with %s as an empty object', async (_label, args) => {
    const memory = new MockMemory();
    const threadId = `stored-no-input-${engine}`;
    const resourceId = 'user-stored-no-input';
    await memory.saveThread({
      thread: { id: threadId, resourceId, title: 't', createdAt: new Date(1_000), updatedAt: new Date(1_000) },
    });
    await memory.saveMessages({
      messages: [
        {
          id: 'm-user',
          threadId,
          resourceId,
          role: 'user',
          createdAt: new Date(1_000),
          content: { format: 2, parts: [{ type: 'text', text: 'Update your status' }] },
        },
        {
          id: 'm-assistant',
          threadId,
          resourceId,
          role: 'assistant',
          createdAt: new Date(2_000),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'output-error',
                  errorText: ERROR_TEXT,
                  toolCallId: 'call-stored',
                  toolName: 'team_status',
                  ...args,
                },
              },
            ],
          },
        },
      ] as any,
    });

    const run = await runLoopScenario({
      engine,
      llm: getMock(),
      model: chatModel(getMock()),
      prompt: 'Try once more',
      memory,
      threadId,
      resourceId,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Still here.' });
      },
    });

    expect(await run.output.text).toBe('Still here.');
    expect(run.requests).toHaveLength(1);
    const body = run.requests[0]!.body as any;
    expect(replayedCall(body)).toEqual(expect.objectContaining({ function: { name: 'team_status', arguments: '{}' } }));
    // The error result stays paired with the call.
    const result = body.messages.find((m: any) => m.role === 'tool' && m.tool_call_id === 'call-stored');
    expect(result.content).toContain('received invalid arguments');

    // The stored row is untouched.
    const stored = await memory.recall({ threadId, resourceId });
    const part = (stored.messages.find(m => m.id === 'm-assistant')!.content as any).parts[0];
    expect(part.toolInvocation.args).toBe((args as any).args);
  });
});
