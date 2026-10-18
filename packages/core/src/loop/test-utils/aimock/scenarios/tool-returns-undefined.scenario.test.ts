import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Scenario: a server tool whose `execute` returns nothing (#27370, PR #27392).
 *
 * Fire-and-forget tools — "send a notification", "log an event" — commonly have a void
 * `execute`. Before the fix the loop treated the `undefined` result as a pending client tool
 * call: the run stopped after the first model call with `finishReason: 'tool-calls'` and no
 * text, and the tool call was persisted in `state: 'call'` and dropped from the next prompt.
 *
 * Executed server tools that return `undefined` must be recorded as a `null` result so the
 * loop continues, the model sees the result, and history stores a completed invocation.
 */

const NOTIFY_ARGS = { message: 'Deploy finished' };

function getToolMessages(body: any) {
  return (body?.messages ?? []).filter((m: any) => m.role === 'tool');
}

function getToolInvocations(messages: any[]) {
  return messages.flatMap((m: any) =>
    (m.content?.parts ?? []).filter((p: any) => p.type === 'tool-invocation').map((p: any) => p.toolInvocation),
  );
}

describeForAllEngines('AIMock scenario: server tool returns undefined', engine => {
  const getMock = useLoopScenarioAimock();

  it('continues the loop, sends a null result to the model, and stores a completed invocation', async () => {
    let executions = 0;
    const notify = createTool({
      id: 'notify',
      description: 'Send a notification to the team',
      inputSchema: z.object({ message: z.string() }),
      execute: async () => {
        executions++;
      },
    });

    const memory = new MockMemory();
    const threadId = `void-tool-${engine}`;
    const resourceId = 'user-void-tool';

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Notify the team that the deploy finished',
      tools: { notify },
      memory,
      threadId,
      resourceId,
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-notify', name: 'notify', arguments: NOTIFY_ARGS }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Sent.' });
      },
    });

    // The loop went back to the model instead of stopping on a phantom client call.
    expect(requests).toHaveLength(2);
    expect(executions).toBe(1);
    expect(await output.text).toBe('Sent.');
    expect(await output.finishReason).toBe('stop');

    // The follow-up request carries the tool call and a null result for it.
    const secondBody = requests[1]!.body as any;
    const assistantCall = (secondBody.messages ?? []).find((m: any) =>
      m.tool_calls?.some((tc: any) => tc.id === 'call-notify'),
    );
    expect(assistantCall).toBeDefined();
    const toolMessages = getToolMessages(secondBody);
    expect(toolMessages).toHaveLength(1);
    expect(toolMessages[0].tool_call_id).toBe('call-notify');
    expect(JSON.parse(toolMessages[0].content)).toBeNull();

    // A terminal tool-result chunk is emitted for the call.
    const toolResult = (chunks ?? []).find(
      (c: any) => c.type === 'tool-result' && c.payload?.toolCallId === 'call-notify',
    ) as any;
    expect(toolResult).toBeDefined();
    expect(toolResult.payload.result).toBeNull();

    // History stores a completed invocation, so the next turn can replay it.
    const { messages } = await memory.recall({ threadId, resourceId });
    const invocations = getToolInvocations(messages).filter((inv: any) => inv.toolCallId === 'call-notify');
    expect(invocations).toHaveLength(1);
    expect(invocations[0].state).toBe('result');
    expect(invocations[0].result).toBeNull();
  });

  it('still stops at a client tool with no execute (neighboring behavior)', async () => {
    const browserTool = createTool({
      id: 'confirm-in-browser',
      description: 'Ask the user to confirm in the browser',
      inputSchema: z.object({ message: z.string() }),
    });

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Ask me to confirm',
      clientTools: { 'confirm-in-browser': browserTool },
      stopWhen: stepCountIs(5),
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call-browser', name: 'confirm-in-browser', arguments: NOTIFY_ARGS }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'should not be reached' });
      },
    });

    // The undefined→null conversion only applies to executed tools; a real pending client
    // call must still end the turn so the client can supply the result.
    expect(requests).toHaveLength(1);
    expect(await output.finishReason).toBe('tool-calls');
    expect((chunks ?? []).some((c: any) => c.type === 'tool-result' && c.payload?.toolCallId === 'call-browser')).toBe(
      false,
    );
  });
});

/**
 * Same contract for an awaited background tool (#27468): the awaited branch waits for the
 * background task and returns its result directly, so a void result must also become `null`.
 */
describeForAllEngines(
  'AIMock scenario: awaited background tool returns undefined',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('continues the loop, sends a null result to the model, and stores a completed invocation', async () => {
      let executions = 0;
      const notify = createTool({
        id: 'notify',
        description: 'Send a notification to the team',
        inputSchema: z.object({ message: z.string() }),
        background: { enabled: true, timeoutMs: 5000 },
        execute: async () => {
          executions++;
        },
      });

      const memory = new MockMemory();
      const threadId = `void-bg-tool-${engine}`;
      const resourceId = 'user-void-bg-tool';

      const { output, requests, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Notify the team that the deploy finished',
        tools: { notify },
        agentBackgroundTasks: { tools: { notify: true } },
        backgroundTasks: { enabled: true },
        memory,
        threadId,
        resourceId,
        stopWhen: stepCountIs(5),
        collectChunks: true,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                {
                  id: 'call-notify',
                  name: 'notify',
                  arguments: { ...NOTIFY_ARGS, _background: { disposition: 'awaited' } },
                },
              ],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Sent.' });
        },
      });

      expect(requests).toHaveLength(2);
      expect(executions).toBe(1);
      expect(await output.text).toBe('Sent.');
      expect(await output.finishReason).toBe('stop');

      const toolMessages = getToolMessages(requests[1]!.body as any);
      expect(toolMessages).toHaveLength(1);
      expect(toolMessages[0].tool_call_id).toBe('call-notify');
      expect(JSON.parse(toolMessages[0].content)).toBeNull();

      const toolResults = (chunks ?? []).filter(
        (c: any) => c.type === 'tool-result' && c.payload?.toolCallId === 'call-notify',
      ) as any[];
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0].payload.result).toBeNull();

      const { messages } = await memory.recall({ threadId, resourceId });
      const invocations = getToolInvocations(messages).filter((inv: any) => inv.toolCallId === 'call-notify');
      expect(invocations).toHaveLength(1);
      expect(invocations[0].state).toBe('result');
      expect(invocations[0].result).toBeNull();
    });
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
