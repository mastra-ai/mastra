import { AgentSideConnection, ClientSideConnection, PROTOCOL_VERSION, ndJsonStream } from '@agentclientprotocol/sdk';
import type { RequestPermissionResponse, SessionNotification } from '@agentclientprotocol/sdk';
import type { AgentController, AgentControllerEvent, Session } from '@mastra/core/agent-controller';
import { createSignal } from '@mastra/core/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraCodeAcpAgent } from './agent.js';
import type { AcpSessionRuntime } from './agent.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(cleanup => cleanup()));
});

async function connect(getSkills?: AcpSessionRuntime['getSkills']) {
  let toAgent!: ReadableStreamDefaultController<Uint8Array>;
  let toClient!: ReadableStreamDefaultController<Uint8Array>;
  const agentInput = new ReadableStream<Uint8Array>({
    start: controller => {
      toAgent = controller;
    },
  });
  const clientInput = new ReadableStream<Uint8Array>({
    start: controller => {
      toClient = controller;
    },
  });
  const agentOutput = new WritableStream<Uint8Array>({ write: chunk => toClient.enqueue(chunk) });
  const clientOutput = new WritableStream<Uint8Array>({ write: chunk => toAgent.enqueue(chunk) });
  let emit: (event: AgentControllerEvent) => void = () => {};
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  const resume = vi.fn().mockResolvedValue(undefined);
  const abort = vi.fn(() => emit({ type: 'agent_end', reason: 'aborted' }));
  const deny = vi.fn(async () => {
    emit({ type: 'agent_start' });
  });
  const session = {
    subscribe: (listener: typeof emit) => {
      emit = listener;
      return () => {};
    },
    thread: { create: async () => ({ id: 'thread-1' }), switch: async () => {} },
    mode: { get: () => 'build' },
    model: { get: () => 'test-model' },
    sendMessage,
    respondToToolSuspension: resume,
    resumeToolCall: deny,
    abort,
  } as unknown as Session;
  let agent!: MastraCodeAcpAgent;
  const server = new AgentSideConnection(
    connection => {
      agent = new MastraCodeAcpAgent(connection, async () => ({
        controller: { listAvailableModels: async () => [] } as unknown as AgentController,
        session,
        modes: [],
        getSkills,
      }));
      return agent;
    },
    ndJsonStream(agentOutput, agentInput),
  );
  const updates: SessionNotification[] = [];
  const dropped: SessionNotification[] = [];
  let knownSessionId: string | undefined;
  const permission = vi
    .fn<() => Promise<RequestPermissionResponse>>()
    .mockResolvedValue({ outcome: { outcome: 'selected', optionId: 'approve' } });
  const client = new ClientSideConnection(
    () => ({
      sessionUpdate: async notification => {
        (notification.sessionId === knownSessionId ? updates : dropped).push(notification);
      },
      requestPermission: permission,
    }),
    ndJsonStream(clientOutput, clientInput),
  );
  cleanups.push(async () => {
    await agent.dispose();
    toAgent.close();
    toClient.close();
    await Promise.all([client.closed, server.closed]);
  });
  await client.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} });
  const { sessionId } = await client.newSession({ cwd: '/tmp', mcpServers: [] });
  knownSessionId = sessionId;
  return {
    client,
    sessionId,
    emit: (event: AgentControllerEvent) => emit(event),
    sendMessage,
    resume,
    deny,
    abort,
    permission,
    updates,
    dropped,
  };
}

function assistant(text: string): AgentControllerEvent[] {
  return [
    {
      type: 'message_start',
      message: {
        id: 'answer',
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [] },
      },
    },
    { type: 'message_update', id: 'answer', event: { type: 'text-delta', delta: text } },
  ];
}

describe('ACP JSON-RPC conversation', () => {
  it('advertises skills after the client registers the new session, before any prompt', async () => {
    const getSkills = async () =>
      ({
        maybeRefresh: async () => {},
        list: async () => [{ name: 'review', description: 'Review changes', path: '/skills/review' }],
        get: async () => null,
      }) as unknown as Awaited<ReturnType<NonNullable<AcpSessionRuntime['getSkills']>>>;
    const { client, sessionId, updates, dropped, sendMessage, emit } = await connect(getSkills);
    expect(dropped).toEqual([]);
    await vi.waitFor(() =>
      expect(updates).toContainEqual({
        sessionId,
        update: {
          sessionUpdate: 'available_commands_update',
          availableCommands: [
            { name: 'skill/review', description: 'Review changes', input: { hint: 'Additional instructions' } },
          ],
        },
      }),
    );
    sendMessage.mockImplementationOnce(async () => emit({ type: 'agent_end', reason: 'complete' }));
    await client.prompt({ sessionId, prompt: [] });
    expect(updates.filter(item => item.update.sessionUpdate === 'available_commands_update')).toHaveLength(1);
  });

  it('delivers only assistant text to the client', async () => {
    const { client, sessionId, emit, sendMessage, updates } = await connect();
    sendMessage.mockImplementationOnce(async () => {
      emit({
        type: 'message_start',
        message: createSignal({ type: 'user', tagName: 'user', contents: 'Input, not output' }).toDBMessage(),
      });
      emit({
        type: 'message_start',
        message: createSignal({
          type: 'system-reminder',
          tagName: 'system-reminder',
          contents: 'Internal instructions',
        }).toDBMessage(),
      });
      assistant('Hello').forEach(emit);
      emit({ type: 'message_update', id: 'answer', event: { type: 'text-delta', delta: ' there' } });
      emit({ type: 'agent_end', reason: 'complete' });
    });
    await expect(
      client.prompt({ sessionId, prompt: [{ type: 'text', text: 'Input, not output' }] }),
    ).resolves.toMatchObject({ stopReason: 'end_turn' });
    expect(updates.map(notification => notification.update)).toEqual([
      { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello' } },
      { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: ' there' } },
    ]);
  });

  it('returns a JSON-RPC error with the failed turn details', async () => {
    const { client, sessionId, emit, sendMessage } = await connect();
    sendMessage.mockImplementationOnce(async () => {
      emit({ type: 'error', error: new Error('Provider rejected the request') });
      emit({ type: 'agent_end', reason: 'error' });
    });
    await expect(client.prompt({ sessionId, prompt: [] })).rejects.toMatchObject({
      code: -32603,
      message: expect.stringContaining('Provider rejected the request'),
    });
  });

  it('keeps the prompt open through plan approval and delivers the resumed answer', async () => {
    const { client, sessionId, emit, sendMessage, resume, permission, updates } = await connect();
    const decision = Promise.withResolvers<RequestPermissionResponse>();
    permission.mockReturnValueOnce(decision.promise);
    sendMessage.mockImplementationOnce(async () => {
      emit({ type: 'tool_suspended', toolCallId: 'plan-1', toolName: 'submit_plan', args: {}, suspendPayload: {} });
      emit({ type: 'agent_end', reason: 'suspended' });
    });
    resume.mockImplementationOnce(async () => {
      assistant('Plan approved; continuing.').forEach(emit);
      emit({ type: 'agent_end', reason: 'complete' });
    });
    let finished = false;
    const prompt = client.prompt({ sessionId, prompt: [] }).then(result => {
      finished = true;
      return result;
    });
    await vi.waitFor(() => expect(permission).toHaveBeenCalledTimes(1));
    expect(finished).toBe(false);
    decision.resolve({ outcome: { outcome: 'selected', optionId: 'approve' } });
    await expect(prompt).resolves.toMatchObject({ stopReason: 'end_turn' });
    expect(updates.at(-1)?.update).toEqual({
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: 'Plan approved; continuing.' },
    });
  });

  it('cancels a suspended turn without resuming it on a late approval', async () => {
    const { client, sessionId, emit, sendMessage, resume, permission, deny, abort } = await connect();
    const decision = Promise.withResolvers<RequestPermissionResponse>();
    permission.mockReturnValueOnce(decision.promise);
    sendMessage.mockImplementationOnce(async () => {
      emit({
        type: 'tool_suspended',
        toolCallId: 'access-1',
        toolName: 'request_access',
        args: {},
        suspendPayload: {},
      });
      emit({ type: 'agent_end', reason: 'suspended' });
    });
    const denial = Promise.withResolvers<void>();
    deny.mockImplementationOnce(async () => {
      emit({ type: 'agent_start' });
      await denial.promise;
    });
    const prompt = client.prompt({ sessionId, prompt: [] });
    await vi.waitFor(() => expect(permission).toHaveBeenCalledTimes(1));
    await client.cancel({ sessionId });
    await vi.waitFor(() => expect(deny).toHaveBeenCalledTimes(1));
    await client.cancel({ sessionId });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(deny).toHaveBeenCalledTimes(1);
    expect(abort).not.toHaveBeenCalled();
    denial.resolve();
    await expect(prompt).resolves.toMatchObject({ stopReason: 'cancelled' });
    decision.resolve({ outcome: { outcome: 'selected', optionId: 'approve' } });
    await decision.promise;
    await Promise.resolve();
    expect(deny).toHaveBeenCalledExactlyOnceWith({
      toolCallId: 'access-1',
      resumeData: 'No',
      resolveOnToolEnd: true,
    });
    expect(resume).not.toHaveBeenCalled();
    sendMessage.mockImplementationOnce(async () => {
      assistant('Next turn works.').forEach(emit);
      emit({ type: 'agent_end', reason: 'complete' });
    });
    await expect(client.prompt({ sessionId, prompt: [] })).resolves.toMatchObject({ stopReason: 'end_turn' });
  });
});

describe('ACP non-success model completion', () => {
  it.each([
    ['length', 'max_tokens'],
    ['content-filter', 'refusal'],
  ] as const)('maps %s to %s while preserving partial output', async (finishReason, stopReason) => {
    const { client, sessionId, emit, sendMessage, updates } = await connect();
    sendMessage.mockImplementationOnce(async () => {
      assistant('Partial response').forEach(emit);
      emit({ type: 'error', error: new Error('Provider ended the response'), finishReason });
      emit({ type: 'agent_end', reason: 'error' });
    });
    await expect(client.prompt({ sessionId, prompt: [] })).resolves.toMatchObject({ stopReason });
    expect(updates[0]?.update).toMatchObject({ content: { text: 'Partial response' } });
  });
});
