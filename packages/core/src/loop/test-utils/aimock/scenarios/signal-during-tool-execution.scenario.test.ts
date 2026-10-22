/**
 * AIMock Scenario: a signal arrives while a tool is still running (#26963)
 *
 * A processor keeps the step's `sendSignal` and fires it from background work
 * (the way asynchronous reminders are delivered) while a tool is executing.
 * The signal seals the in-flight assistant message so the next response lands
 * in a fresh one. The tool keeps running under the original message id and
 * later writes a data part and its result. Those late writes must merge into
 * the sealed message instead of replacing it, otherwise the tool call vanishes
 * from history and the model never sees its own side effect.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { AgentSignalInput, CreatedAgentSignal } from '../../../../agent/signals';
import { MockMemory } from '../../../../memory/mock';
import type { InputProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import {
  runLoopScenario,
  useLoopScenarioAimock,
  describeForAllEngines,
} from '../aimock-scenario';
import type { EngineVariant } from '../types';

const REMINDER = 'Reminder: the deploy window closes in 5 minutes';

function requestMessages(request: any): any[] {
  return request?.body?.messages ?? [];
}

function toolInvocationsFor(messages: any[], toolCallId: string) {
  return messages.flatMap(message =>
    (message.content?.parts ?? [])
      .filter((part: any) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId)
      .map((part: any) => ({ message, invocation: part.toolInvocation })),
  );
}

async function runDeployWithReminder(engine: EngineVariant, llm: ReturnType<ReturnType<typeof useLoopScenarioAimock>>, duringInput = false) {
  const threadId = 'signal-during-tool-thread';
  const resourceId = 'signal-during-tool-user';

  let heldSendSignal: ((signal: AgentSignalInput) => Promise<CreatedAgentSignal>) | undefined;
  let sentSignal: CreatedAgentSignal | undefined;
  const reminderProcessor: InputProcessor = {
    id: 'background-reminder',
    processInputStep: async ({ sendSignal, stepNumber }) => {
      if (stepNumber === 0) {
        heldSendSignal = sendSignal;
        if (duringInput) sentSignal = await sendSignal({ type: 'reactive', contents: REMINDER });
      }
    },
  };

  let signalSent = false;
  const deploy = createTool({
    id: 'deploy',
    description: 'Deploys the service; slow',
    inputSchema: z.object({ service: z.string() }),
    execute: async ({ service }, context) => {
      // The reminder fires from background work while the deploy is in flight.
      if (!duringInput) {
        if (!heldSendSignal) throw new Error('Input processor did not provide sendSignal');
        sentSignal = await heldSendSignal({ type: 'reactive', contents: REMINDER });
      }
      signalSent = true;
      await context?.writer?.custom({ type: 'data-deploy-log', data: { service, status: 'rolled-out' } });
      return { deployed: service };
    },
  });

  const memory = new MockMemory();
  const { output, requests, chunks } = await runLoopScenario({
    engine,
    llm,
    prompt: 'Deploy the api service.',
    tools: { deploy },
    inputProcessors: [reminderProcessor],
    memory,
    collectChunks: true,
    threadId,
    resourceId,
    stopWhen: stepCountIs(5),
    fixtures: mock => {
      mock.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_deploy', name: 'deploy', arguments: { service: 'api' } }] },
      );
      mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The api service is deployed.' });
    },
  });
  const text = await output.text;
  const { messages } = await memory.recall({ threadId, resourceId, hideSignals: false });
  return { text, requests, messages, signalSent, chunks, sentSignal };
}

describeForAllEngines('AIMock scenario: signal arrives while a tool is running', engine => {
  const getMock = useLoopScenarioAimock();

  it('keeps the running tool call, its data part, and its result in history and in the next prompt', async () => {
    const { text, requests, messages, signalSent } = await runDeployWithReminder(engine, getMock());

    expect(signalSent).toBe(true);
    expect(text).toContain('The api service is deployed.');
    expect(requests).toHaveLength(2);

    // The model's second turn still carries its own tool call followed by the tool's result.
    const second = requestMessages(requests[1]);
    const callIndex = second.findIndex(
      (m: any) => m.role === 'assistant' && m.tool_calls?.some((c: any) => c.id === 'call_deploy'),
    );
    const resultIndex = second.findIndex((m: any) => m.role === 'tool' && m.tool_call_id === 'call_deploy');
    expect(callIndex).toBeGreaterThan(-1);
    expect(resultIndex).toBeGreaterThan(callIndex);
    expect(JSON.parse(second[resultIndex].content)).toEqual({ deployed: 'api' });

    // History keeps exactly one completed invocation, alongside the data part the tool wrote after the signal.
    const owners = toolInvocationsFor(messages, 'call_deploy');
    expect(owners).toHaveLength(1);
    expect(owners[0]!.invocation).toMatchObject({
      toolName: 'deploy',
      state: 'result',
      result: { deployed: 'api' },
    });
    expect(owners[0]!.message.content.parts).toContainEqual(
      expect.objectContaining({ type: 'data-deploy-log', data: { service: 'api', status: 'rolled-out' } }),
    );
    expect(
      messages.some((m: any) =>
        (m.content?.parts ?? []).some((p: any) => p.type === 'text' && p.text.includes('The api service is deployed.')),
      ),
    ).toBe(true);
  });

  it.each([false, true])('delivers the reminder exactly once (during input: %s) (#27457)', async duringInput => {
    const { requests, messages, chunks, sentSignal } = await runDeployWithReminder(engine, getMock(), duringInput);
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requestMessages(requests[1])).split(REMINDER)).toHaveLength(2);
    expect(JSON.stringify(requestMessages(requests[1]))).toContain('call_deploy');
    expect(JSON.stringify(requestMessages(requests[1]))).toContain('deployed');
    if (duringInput) expect(JSON.stringify(requestMessages(requests[0]))).toContain(REMINDER);

    const reminders = messages.filter(message => message.id === sentSignal?.id);
    expect(reminders).toHaveLength(1);
    expect(JSON.stringify(reminders[0])).toContain(REMINDER);
    const echoes = chunks?.filter(chunk => chunk.type === 'data-signal');
    expect(echoes).toHaveLength(1);
    expect(echoes?.[0]).toMatchObject({ data: { id: sentSignal?.id, contents: REMINDER } });
  });
});
