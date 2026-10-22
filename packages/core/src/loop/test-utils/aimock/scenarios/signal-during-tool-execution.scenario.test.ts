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
import type { AgentSignalInput } from '../../../../agent/signals';
import { MockMemory } from '../../../../memory/mock';
import type { InputProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  runLoopScenario,
  useLoopScenarioAimock,
  describeForAllEngines,
  isDurableEngineVariant,
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

async function runDeployWithReminder(
  engine: EngineVariant,
  llm: ReturnType<ReturnType<typeof useLoopScenarioAimock>>,
  options: { threadId?: string; resourceId?: string; followUp?: string } = {},
) {
  const threadId = options.threadId ?? 'signal-during-tool-thread';
  const resourceId = options.resourceId ?? 'signal-during-tool-user';

  let heldSendSignal: ((signal: AgentSignalInput) => Promise<unknown>) | undefined;
  const reminderProcessor: InputProcessor = {
    id: 'background-reminder',
    processInputStep: async ({ sendSignal, stepNumber }) => {
      if (stepNumber === 0) heldSendSignal = sendSignal;
    },
  };

  let signalSent = false;
  const deploy = createTool({
    id: 'deploy',
    description: 'Deploys the service; slow',
    inputSchema: z.object({ service: z.string() }),
    execute: async ({ service }, context) => {
      // The reminder fires from background work while the deploy is in flight.
      await heldSendSignal!({ type: 'reactive', contents: REMINDER });
      signalSent = true;
      await context?.writer?.custom({ type: 'data-deploy-log', data: { service, status: 'rolled-out' } });
      return { deployed: service };
    },
  });

  const memory = new MockMemory();
  const sharedAgent = options.followUp
    ? await createSharedAgent(llm, { engine, tools: { deploy }, inputProcessors: [reminderProcessor], memory })
    : undefined;
  const { output, requests } = await runLoopScenario({
    engine,
    llm,
    prompt: 'Deploy the api service.',
    tools: { deploy },
    inputProcessors: [reminderProcessor],
    memory,
    threadId,
    resourceId,
    sharedAgent,
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
  if (options.followUp) {
    const followUp = options.followUp;
    await runLoopScenario({
      engine,
      llm,
      prompt: followUp,
      memory,
      threadId,
      resourceId,
      sharedAgent,
      stopWhen: stepCountIs(5),
      fixtures: mock => {
        mock.prependFixture({
          match: { endpoint: 'chat', userMessage: followUp },
          response: { content: 'Nothing else.' },
        });
      },
    });
  }
  const { messages } = await memory.recall({ threadId, resourceId });
  return { text, requests, messages, signalSent };
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

  // Known gap: on durable/evented engines a processor's step-level sendSignal
  // stamps the response boundary but the signal's contents are never drained
  // into the next model request (durable drains only the thread runtime queue).
  const deliversReminder = isDurableEngineVariant(engine) ? it.fails : it;
  deliversReminder('shows the reminder to the model on the next turn', async () => {
    const { requests } = await runDeployWithReminder(engine, getMock());
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requestMessages(requests[1]))).toContain(REMINDER);
  });

  // #27458: the reply written after the signal belongs to the fresh message the
  // boundary opened, not to the sealed one holding the tool call.
  deliversReminder('stores the reply after the reminder and replays it after the reminder next turn', async () => {
    const llm = getMock();
    const threadId = 'signal-during-tool-reply-thread';
    const resourceId = 'signal-during-tool-reply-user';
    const { messages } = await runDeployWithReminder(engine, llm, { threadId, resourceId, followUp: 'Anything else?' });

    const owners = toolInvocationsFor(messages, 'call_deploy');
    expect(owners).toHaveLength(1);
    expect(owners[0]!.message.content.parts.some((p: any) => p.type === 'text')).toBe(false);

    // The reply is its own row, between the sealed tool-call row and the follow-up.
    const ownerIndex = messages.indexOf(owners[0]!.message);
    const replyIndex = messages.findIndex((m: any) =>
      (m.content?.parts ?? []).some((p: any) => p.type === 'text' && p.text === 'The api service is deployed.'),
    );
    const followUpIndex = messages.findIndex(
      (m: any) => m.role === 'user' && m.content.parts[0]?.text === 'Anything else?',
    );
    expect(replyIndex).toBeGreaterThan(ownerIndex);
    expect(followUpIndex).toBeGreaterThan(replyIndex);

    // The OpenAI Responses provider replays earlier assistant output as
    // `item_reference`s, which AIMock journals with empty content, so the
    // replayed reply is checked by position: it must follow the reminder.
    const followUpRequest = requestMessages(llm.getRequests().at(-1)).filter((m: any) => m.role !== 'system');
    expect(
      followUpRequest.map((m: any) =>
        m.role === 'user' ? ['user', m.content] : [m.role, m.tool_calls ? 'tool-call' : ''],
      ),
    ).toEqual([
      ['user', 'Deploy the api service.'],
      ['assistant', 'tool-call'],
      ['tool', ''],
      ['user', `<system-reminder>${REMINDER}</system-reminder>`],
      ['assistant', ''],
      ['user', 'Anything else?'],
    ]);
  });
});
