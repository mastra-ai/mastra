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
import type { InputProcessor, OutputProcessor } from '../../../../processors';
import { ProcessorStepInputSchema, ProcessorStepOutputSchema } from '../../../../processors';
import { createStep, createWorkflow } from '../../../../workflows';
import { InMemoryStore } from '../../../../storage';
import { InMemoryDB } from '../../../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../../../storage/domains/memory/inmemory';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
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

// Real in-memory storage with a controllable read boundary. The callback runs
// after the LLM step serialized its transcript, while dehydration awaits I/O.
class SignalDuringMemoryRead extends InMemoryMemory {
  beforeRead?: () => Promise<void>;

  override async listMessagesById(args: Parameters<InMemoryMemory['listMessagesById']>[0]) {
    const beforeRead = this.beforeRead;
    this.beforeRead = undefined;
    await beforeRead?.();
    return super.listMessagesById(args);
  }
}

async function runDeployWithReminder(
  engine: EngineVariant,
  llm: ReturnType<ReturnType<typeof useLoopScenarioAimock>>,
  duringInput = false,
  processorKind: 'direct' | 'workflow' = 'direct',
  duringStorage = false,
  withoutThread = false,
) {
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

  const workflowOptions = {
    id: 'reminder-workflow',
    inputSchema: ProcessorStepInputSchema,
    outputSchema: ProcessorStepOutputSchema,
  };
  const passThroughProcessor: InputProcessor = { id: 'before-reminder', processInputStep: async () => {} };
  const processor =
    processorKind === 'direct'
      ? reminderProcessor
      : createWorkflow(workflowOptions)
          .then(createStep(passThroughProcessor))
          .then(createStep(reminderProcessor))
          .commit();

  let signalSent = false;
  const deploy = createTool({
    id: 'deploy',
    description: 'Deploys the service; slow',
    inputSchema: z.object({ service: z.string() }),
    execute: async ({ service }, context) => {
      // The reminder fires from background work while the deploy is in flight.
      if (!duringInput && !duringStorage) {
        if (!heldSendSignal) throw new Error('Input processor did not provide sendSignal');
        sentSignal = await heldSendSignal({ type: 'reactive', contents: REMINDER });
      }
      signalSent = true;
      await context?.writer?.custom({ type: 'data-deploy-log', data: { service, status: 'rolled-out' } });
      return { deployed: service };
    },
  });

  const storage = new InMemoryStore();
  const memoryStore = new SignalDuringMemoryRead({ db: new InMemoryDB() });
  storage.stores.memory = memoryStore;
  const memory = new MockMemory({ storage });
  const snapshotProcessor: OutputProcessor = {
    id: 'recall-before-snapshot',
    processOutputStep: async ({ messageList, stepNumber }) => {
      if (stepNumber !== 0) return;
      // A processor can add recalled context. The first dehydration must read
      // this saved row to verify that it can replace it with a memory ref.
      const recalled: MastraDBMessage = {
        id: 'snapshot-context',
        role: 'user',
        createdAt: new Date(),
        threadId,
        resourceId,
        content: { format: 2, parts: [{ type: 'text', text: 'Deployment context from memory.' }] },
      };
      await memory.saveMessages({ messages: [recalled] });
      messageList.add([recalled], 'memory');
      memoryStore.beforeRead = async () => {
        if (!heldSendSignal) throw new Error('Input processor did not provide sendSignal');
        sentSignal = await heldSendSignal({ type: 'reactive', contents: REMINDER });
      };
    },
  };
  const { output, requests, chunks } = await runLoopScenario({
    engine,
    llm,
    prompt: 'Deploy the api service.',
    tools: { deploy },
    inputProcessors: [processor],
    ...(duringStorage ? { outputProcessors: [snapshotProcessor] } : {}),
    ...(withoutThread ? {} : { memory, threadId, resourceId }),
    collectChunks: true,
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
  const { messages } = withoutThread
    ? { messages: [] }
    : await memory.recall({ threadId, resourceId, hideSignals: false });
  return { text, requests, messages, signalSent, chunks, sentSignal, heldSendSignal };
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

  it.each(['direct', 'workflow'] as const)(
    'delivers a retained processor reminder without a memory thread (%s) (#27457)',
    async processorKind => {
      const { text, requests, chunks, sentSignal, heldSendSignal } = await runDeployWithReminder(
        engine,
        getMock(),
        false,
        processorKind,
        false,
        true,
      );
      expect(text).toContain('The api service is deployed.');
      expect(requests).toHaveLength(2);
      expect(JSON.stringify(requestMessages(requests[1])).split(REMINDER)).toHaveLength(2);
      const result = requestMessages(requests[1]).find(m => m.role === 'tool' && m.tool_call_id === 'call_deploy');
      expect(JSON.parse(result.content)).toEqual({ deployed: 'api' });
      expect(chunks?.filter(chunk => chunk.type === 'data-signal')).toEqual([
        expect.objectContaining({ data: expect.objectContaining({ id: sentSignal?.id, contents: REMINDER }) }),
      ]);
      if (engine === 'durable' || engine === 'evented' || engine === 'inngest') {
        await expect(heldSendSignal?.({ type: 'reactive', contents: 'Too late' })).rejects.toThrow();
      }
    },
  );

  // This boundary is native workflow-state dehydration; Inngest stores the
  // transcript in step payloads and does not perform this verification read.
  if (engine === 'durable' || engine === 'evented') {
    it('delivers a signal while the serialized transcript awaits storage (#27457)', async () => {
      const { requests, messages, chunks, sentSignal } = await runDeployWithReminder(
        engine,
        getMock(),
        false,
        'direct',
        true,
      );
      expect(sentSignal).toBeDefined();
      expect(JSON.stringify(requestMessages(requests[1])).split(REMINDER)).toHaveLength(2);
      expect(toolInvocationsFor(messages, 'call_deploy')[0]?.invocation.result).toEqual({ deployed: 'api' });
      expect(messages.filter(message => JSON.stringify(message.content.parts).includes(REMINDER))).toHaveLength(1);
      expect(chunks?.filter(chunk => chunk.type === 'data-signal')).toEqual([
        expect.objectContaining({ data: expect.objectContaining({ id: sentSignal?.id, contents: REMINDER }) }),
      ]);
    });
  }

  it.each([
    { duringInput: false, processorKind: 'direct' },
    { duringInput: true, processorKind: 'direct' },
    { duringInput: false, processorKind: 'workflow' },
    { duringInput: true, processorKind: 'workflow' },
  ] as const)(
    'delivers the reminder exactly once ($processorKind, during input: $duringInput) (#27457)',
    async ({ duringInput, processorKind }) => {
      const { requests, messages, chunks, sentSignal } = await runDeployWithReminder(
        engine,
        getMock(),
        duringInput,
        processorKind,
      );
      expect(requests).toHaveLength(2);
      expect(JSON.stringify(requestMessages(requests[1])).split(REMINDER)).toHaveLength(2);
      expect(JSON.stringify(requestMessages(requests[1]))).toContain('call_deploy');
      expect(JSON.stringify(requestMessages(requests[1]))).toContain('deployed');
      if (duringInput) expect(JSON.stringify(requestMessages(requests[0]))).toContain(REMINDER);

      const reminders = messages.filter(message => JSON.stringify(message.content.parts).includes(REMINDER));
      expect(reminders).toHaveLength(1);
      expect(reminders[0]?.id).toBe(sentSignal?.id);
      const echoes = chunks?.filter(chunk => chunk.type === 'data-signal');
      expect(echoes).toHaveLength(1);
      expect(echoes?.[0]).toMatchObject({ data: { id: sentSignal?.id, contents: REMINDER } });
    },
  );
});
