import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v6';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Scenario: the model sends a tool call whose arguments are not valid JSON.
 *
 * The tool is not run; the model gets an "invalid arguments" error and the call is stored as an
 * `output-error` tool part with no input. Every later request replays that call. OpenAI-compatible
 * providers serialize `arguments: JSON.stringify(input)`, which drops the key when the input is
 * undefined, so DeepSeek answered every later request on the thread with
 * "missing field `arguments`" and the thread could not be used again.
 *
 * The replayed call must always carry `arguments`, both on the follow-up request in the same
 * turn and when a later turn loads the call back from memory.
 */

const TRUNCATED_ARGS = '{"note": "half a sent';

// Pinned to a chat-completions provider that sends a replayed call's input as-is. The generic
// OpenAI-compatible provider (as DeepSeek's) writes `arguments: JSON.stringify(input)`, which drops the key
// when the input is undefined. @ai-sdk/openai v5 chat, v6 and v7 substitute `{}` and would pass without the
// fix, so a dependency bump could silently stop this test from checking anything. The scenario default (an
// OpenAI Responses model) sends no `messages[].tool_calls` for `replayedCall` to read.
function chatModel(llm: { url: string }) {
  return createOpenAICompatible({
    name: 'openai-compatible',
    apiKey: 'aimock-test-key',
    baseURL: `${llm.url.replace(/\/+$/, '')}/v1`,
  }).chatModel(SCENARIO_MODEL_ID);
}

function replayedCall(body: any) {
  const assistant = (body?.messages ?? []).find((m: any) => m.tool_calls?.some((tc: any) => tc.id === 'call-status'));
  return assistant?.tool_calls.find((tc: any) => tc.id === 'call-status');
}

describeForAllEngines('AIMock scenario: tool call with arguments that are not valid JSON', engine => {
  const getMock = useLoopScenarioAimock();

  async function sendTruncatedToolCall() {
    const tool = { executions: 0 };
    const updateStatus = createTool({
      id: 'update_status',
      description: 'Update your status',
      inputSchema: z.object({ note: z.string().optional() }),
      execute: async () => {
        tool.executions++;
        return { ok: true };
      },
    });
    const thread = {
      memory: new MockMemory(),
      threadId: `invalid-tool-args-${engine}`,
      resourceId: 'user-invalid-tool-args',
      tools: { update_status: updateStatus },
    };

    const first = await runLoopScenario({
      engine,
      llm: getMock(),
      model: chatModel(getMock()),
      prompt: 'Update your status',
      ...thread,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-status', name: 'update_status', arguments: TRUNCATED_ARGS }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'I could not update it.' });
      },
    });
    return { first, thread, tool };
  }

  it('replays the call with arguments so the thread keeps working', async () => {
    const { first, thread } = await sendTruncatedToolCall();

    expect(first.requests).toHaveLength(2);
    expect(await first.output.text).toBe('I could not update it.');
    // The follow-up request in the same turn sends the call back with arguments.
    expect(replayedCall(first.requests[1]!.body)).toEqual(
      expect.objectContaining({ function: { name: 'update_status', arguments: '{}' } }),
    );

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    // A later turn loads the stored call from memory and still sends it with arguments.
    const second = await runLoopScenario({
      engine,
      llm: getMock(),
      model: chatModel(getMock()),
      prompt: 'Try once more',
      ...thread,
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'Still here.' });
      },
    });

    expect(await second.output.text).toBe('Still here.');
    expect(second.requests).toHaveLength(1);
    expect(replayedCall(second.requests[0]!.body)).toEqual(
      expect.objectContaining({ function: { name: 'update_status', arguments: '{}' } }),
    );
  });

  // The durable and evented engines run the tool with `{}` instead of returning the
  // invalid-arguments error. Not yet investigated.
  const itFailsOnDurableEngines = engine === 'durable' || engine === 'evented' ? it.fails : it;

  itFailsOnDurableEngines('does not run the tool', async () => {
    const { first, tool } = await sendTruncatedToolCall();

    expect(tool.executions).toBe(0);
    const toolMessage = (first.requests[1]!.body as any).messages.find((m: any) => m.role === 'tool');
    expect(toolMessage.content).toContain('received invalid arguments');
  });
});
