import { isAgentCompatible } from '@mastra/core/agent';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAssistantMessage,
  createMockOpenCodeClient,
  messageUpdatedEvent,
  sessionErrorEvent,
  sessionIdleEvent,
  textPartDeltaEvent,
  textPartUpdatedEvent,
  toolPartUpdatedEvent,
} from './test-fixtures.mock';
import { OpenCodeSDKAgent } from './index';
import type { OpenCodeSDKAgentResumeData } from './index';

/**
 * Captures every telemetry object `createSDKAgentTelemetry` produces during a
 * test, spying on `startToolCall`/`endToolCall` while delegating to the real
 * implementation for everything else — this is what lets tests assert on
 * tool-call telemetry without the agent exposing telemetry as a constructor
 * option.
 */
const telemetryInstances = vi.hoisted(
  () => [] as Array<{ startToolCall: ReturnType<typeof vi.fn>; endToolCall: ReturnType<typeof vi.fn> }>,
);
const { createOpencodeMock, createOpencodeClientMock } = vi.hoisted(() => ({
  createOpencodeMock: vi.fn(),
  createOpencodeClientMock: vi.fn(),
}));

vi.mock('@internal/agent-sdk-base', async importOriginal => {
  const actual = await importOriginal<typeof import('@internal/agent-sdk-base')>();
  return {
    ...actual,
    createSDKAgentTelemetry: (...args: Parameters<typeof actual.createSDKAgentTelemetry>) => {
      const telemetry = actual.createSDKAgentTelemetry(...args);
      const startToolCall = vi.fn(telemetry.startToolCall);
      const endToolCall = vi.fn(telemetry.endToolCall);
      telemetryInstances.push({ startToolCall, endToolCall });
      return { ...telemetry, startToolCall, endToolCall };
    },
  };
});

vi.mock('@opencode-ai/sdk/v2', async importOriginal => {
  const actual = await importOriginal<typeof import('@opencode-ai/sdk/v2')>();
  return {
    ...actual,
    createOpencode: createOpencodeMock,
    createOpencodeClient: createOpencodeClientMock,
  };
});

describe('OpenCodeSDKAgent', () => {
  beforeEach(() => {
    telemetryInstances.length = 0;
    createOpencodeMock.mockReset();
    createOpencodeClientMock.mockReset();
  });


  it('is compatible with the Agent/SubAgent contract', () => {
    const { client } = createMockOpenCodeClient();
    const agent = new OpenCodeSDKAgent({
      id: 'opencode-agent',
      name: 'OpenCode Agent',
      description: 'Use OpenCode as a Mastra agent.',
      client,
    });

    expect(agent.id).toBe('opencode-agent');
    expect(agent.name).toBe('OpenCode Agent');
    expect(agent.getDescription()).toBe('Use OpenCode as a Mastra agent.');
    expect(agent.supportsMemory()).toBe(false);
    expect(isAgentCompatible(agent)).toBe(true);
  });

  describe('generate', () => {
    it('creates a session, prompts it, and resolves text from the accumulated part snapshot', async () => {
      const { client, events, sessionCreate, sessionPromptAsync, createdSessionIds } = createMockOpenCodeClient();
      const agent = new OpenCodeSDKAgent({
        id: 'opencode-agent',
        description: 'OpenCode',
        client,
      });

      const resultPromise = agent.generate('Generate prompt', { runId: 'mastra-run' });

      await vi.waitFor(() => expect(sessionCreate).toHaveBeenCalledTimes(1));
      const sessionId = createdSessionIds[0]!;

      events.push(
        messageUpdatedEvent(
          sessionId,
          createAssistantMessage({
            id: 'msg-1',
            sessionID: sessionId,
            tokens: { input: 10, output: 4, reasoning: 0, cache: { read: 2, write: 1 } },
            cost: 0.01,
          }),
        ),
      );
      events.push(textPartUpdatedEvent(sessionId, 'msg-1', 'part-1', 'generated text'));
      events.push(sessionIdleEvent(sessionId));

      const result = await resultPromise;

      expect(result.text).toBe('generated text');
      expect(result.runId).toBe('mastra-run');
      expect(result.usage.inputTokens).toBe(13);
      expect(result.usage.outputTokens).toBe(4);
      expect(result.providerMetadata).toMatchObject({
        opencode: {
          sessionId,
          messageId: 'msg-1',
          providerID: 'openai',
          modelID: 'gpt-5.1',
        },
      });
      expect(sessionPromptAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionID: sessionId,
          parts: [{ type: 'text', text: 'Generate prompt' }],
        }),
      );
    });

    it('records tool call telemetry from tool parts observed on the event stream', async () => {
      const { client, events, createdSessionIds } = createMockOpenCodeClient();
      const agent = new OpenCodeSDKAgent({ id: 'opencode-agent', description: 'OpenCode', client });

      const resultPromise = agent.generate('Use a tool', { runId: 'tool-run' });

      await vi.waitFor(() => expect(createdSessionIds).toHaveLength(1));
      const sessionId = createdSessionIds[0]!;

      events.push(messageUpdatedEvent(sessionId, createAssistantMessage({ id: 'msg-tool', sessionID: sessionId })));
      events.push(
        toolPartUpdatedEvent(sessionId, 'msg-tool', 'part-tool', 'call-1', 'read_file', {
          status: 'completed',
          input: { path: 'a.ts' },
          output: 'file contents',
          title: 'read_file',
          metadata: {},
          time: { start: 0, end: 1 },
        }),
      );
      events.push(textPartUpdatedEvent(sessionId, 'msg-tool', 'part-1', 'used a tool'));
      events.push(sessionIdleEvent(sessionId));

      const result = await resultPromise;

      expect(result.text).toBe('used a tool');
      expect(telemetryInstances).toHaveLength(1);
      const telemetry = telemetryInstances[0]!;
      expect(telemetry.startToolCall).toHaveBeenCalledWith(
        expect.objectContaining({ toolCallId: 'call-1', toolName: 'read_file', input: { path: 'a.ts' } }),
      );
      expect(telemetry.endToolCall).toHaveBeenCalledWith(
        expect.objectContaining({ toolCallId: 'call-1', output: 'file contents' }),
      );
    });

    it('surfaces a session.error as a rejected generate() call', async () => {
      const { client, events, createdSessionIds } = createMockOpenCodeClient();
      const agent = new OpenCodeSDKAgent({ id: 'opencode-agent', description: 'OpenCode', client });

      const resultPromise = agent.generate('Trigger an error');

      await vi.waitFor(() => expect(createdSessionIds).toHaveLength(1));
      const sessionId = createdSessionIds[0]!;

      events.push(
        sessionErrorEvent(sessionId, { name: 'UnknownError', data: { message: 'the model provider failed' } }),
      );

      await expect(resultPromise).rejects.toThrow('the model provider failed');
    });

    it('uses OpenCode native structured output and exposes the validated object', async () => {
      const { client, events, sessionPromptAsync, createdSessionIds } = createMockOpenCodeClient();
      const agent = new OpenCodeSDKAgent({ id: 'opencode-agent', description: 'OpenCode', client });

      const resultPromise = agent.generate<{ answer: string }>('Return a JSON answer', {
        structuredOutput: {
          schema: {
            type: 'object',
            properties: { answer: { type: 'string' } },
            required: ['answer'],
          },
        },
      });

      await vi.waitFor(() => expect(createdSessionIds).toHaveLength(1));
      const sessionId = createdSessionIds[0]!;

      events.push(
        messageUpdatedEvent(
          sessionId,
          createAssistantMessage({ id: 'msg-structured', sessionID: sessionId, structured: { answer: 'yes' } }),
        ),
      );
      events.push(sessionIdleEvent(sessionId));

      const result = await resultPromise;

      expect(result.object).toEqual({ answer: 'yes' });
      expect(sessionPromptAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          format: expect.objectContaining({
            type: 'json_schema',
            schema: expect.objectContaining({
              type: 'object',
              properties: expect.objectContaining({ answer: expect.objectContaining({ type: 'string' }) }),
            }),
          }),
        }),
      );
    });

    it('runs two generate() calls in parallel against separate OpenCode sessions without cross-talk', async () => {
      const { client, events, createdSessionIds } = createMockOpenCodeClient();
      const agent = new OpenCodeSDKAgent({ id: 'opencode-agent', description: 'OpenCode', client });

      const firstPromise = agent.generate('First prompt', { runId: 'run-1' });
      const secondPromise = agent.generate('Second prompt', { runId: 'run-2' });

      await vi.waitFor(() => expect(createdSessionIds).toHaveLength(2));
      const [sessionA, sessionB] = createdSessionIds;

      events.push(messageUpdatedEvent(sessionA!, createAssistantMessage({ id: 'msg-a', sessionID: sessionA! })));
      events.push(textPartUpdatedEvent(sessionA!, 'msg-a', 'part-a', 'first result'));
      events.push(messageUpdatedEvent(sessionB!, createAssistantMessage({ id: 'msg-b', sessionID: sessionB! })));
      events.push(textPartUpdatedEvent(sessionB!, 'msg-b', 'part-b', 'second result'));
      events.push(sessionIdleEvent(sessionA!));
      events.push(sessionIdleEvent(sessionB!));

      const [first, second] = await Promise.all([firstPromise, secondPromise]);

      expect(sessionA).not.toBe(sessionB);
      expect(first.text).toBe('first result');
      expect(second.text).toBe('second result');
    });
  });

  describe('stream', () => {
    it('emits Mastra chunks and resolves text from message.part.delta events', async () => {
      const { client, events, createdSessionIds } = createMockOpenCodeClient();
      const agent = new OpenCodeSDKAgent({ id: 'opencode-agent', description: 'OpenCode', client });

      const stream = await agent.stream('Stream prompt', { runId: 'stream-run' });

      await vi.waitFor(() => expect(createdSessionIds).toHaveLength(1));
      const sessionId = createdSessionIds[0]!;

      events.push(messageUpdatedEvent(sessionId, createAssistantMessage({ id: 'msg-stream', sessionID: sessionId })));
      events.push(textPartDeltaEvent(sessionId, 'msg-stream', 'part-1', 'streamed '));
      events.push(textPartDeltaEvent(sessionId, 'msg-stream', 'part-1', 'text'));
      events.push(sessionIdleEvent(sessionId));

      const chunks = [];
      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      expect(await stream.text).toBe('streamed text');
      expect(chunks.map(chunk => chunk.type)).toEqual([
        'start',
        'step-start',
        'response-metadata',
        'text-start',
        'text-delta',
        'text-delta',
        'text-end',
        'step-finish',
        'finish',
      ]);
    });
  });

  describe('resumeGenerate / resumeStream', () => {
    it('resumeGenerate reuses the given sessionId instead of creating a new session', async () => {
      const { client, events, sessionCreate, sessionPromptAsync } = createMockOpenCodeClient();
      const agent = new OpenCodeSDKAgent({ id: 'opencode-agent', description: 'OpenCode', client });

      const resultPromise = agent.resumeGenerate(
        { message: 'Continue prompt', sessionId: 'existing-session' },
        { runId: 'resume-run' },
      );

      await vi.waitFor(() => expect(sessionPromptAsync).toHaveBeenCalledTimes(1));

      events.push(
        messageUpdatedEvent(
          'existing-session',
          createAssistantMessage({ id: 'msg-resume', sessionID: 'existing-session' }),
        ),
      );
      events.push(textPartUpdatedEvent('existing-session', 'msg-resume', 'part-1', 'continued text'));
      events.push(sessionIdleEvent('existing-session'));

      const result = await resultPromise;

      expect(result.text).toBe('continued text');
      expect(result.runId).toBe('resume-run');
      expect(sessionCreate).not.toHaveBeenCalled();
      expect(sessionPromptAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sessionID: 'existing-session' }),
      );
    });

    it('resumeStream reuses the given sessionId and streams the continuation', async () => {
      const { client, events, sessionCreate } = createMockOpenCodeClient();
      const agent = new OpenCodeSDKAgent({ id: 'opencode-agent', description: 'OpenCode', client });

      const streamPromise = agent.resumeStream(
        { message: 'Continue prompt', sessionId: 'existing-session' },
        { runId: 'resume-stream-run' },
      );

      const stream = await streamPromise;
      events.push(
        messageUpdatedEvent(
          'existing-session',
          createAssistantMessage({ id: 'msg-resume-stream', sessionID: 'existing-session' }),
        ),
      );
      events.push(textPartDeltaEvent('existing-session', 'msg-resume-stream', 'part-1', 'continued '));
      events.push(textPartDeltaEvent('existing-session', 'msg-resume-stream', 'part-1', 'text'));
      events.push(sessionIdleEvent('existing-session'));

      for await (const _chunk of stream.fullStream) {
        // drain
      }

      expect(await stream.text).toBe('continued text');
      expect(sessionCreate).not.toHaveBeenCalled();
    });

    it('rejects resumeData missing a sessionId without making any OpenCode SDK calls', async () => {
      const { client, sessionCreate, sessionPromptAsync } = createMockOpenCodeClient();
      const agent = new OpenCodeSDKAgent({ id: 'opencode-agent', description: 'OpenCode', client });

      await expect(
        agent.resumeGenerate({ message: 'Continue prompt' } as unknown as OpenCodeSDKAgentResumeData),
      ).rejects.toThrow('resumeData must include a sessionId');

      expect(sessionCreate).not.toHaveBeenCalled();
      expect(sessionPromptAsync).not.toHaveBeenCalled();
    });
  });

  describe('client lifecycle', () => {
    it('resolves the client lazily and memoizes it across generate/stream calls (serverOptions variant)', async () => {
      const { client: mockClient, events, createdSessionIds } = createMockOpenCodeClient();
      createOpencodeMock.mockResolvedValue({ client: mockClient, server: { url: 'http://x', close: vi.fn() } });

      const agent = new OpenCodeSDKAgent({
        id: 'opencode-agent',
        description: 'OpenCode',
        serverOptions: {},
      });

      expect(createOpencodeMock).not.toHaveBeenCalled();

      const firstRun = agent.generate('First prompt');
      await vi.waitFor(() => expect(createdSessionIds).toHaveLength(1));
      events.push(
        messageUpdatedEvent(createdSessionIds[0]!, createAssistantMessage({ id: 'm1', sessionID: createdSessionIds[0]! })),
      );
      events.push(sessionIdleEvent(createdSessionIds[0]!));
      await firstRun;

      const secondRun = agent.generate('Second prompt');
      await vi.waitFor(() => expect(createdSessionIds).toHaveLength(2));
      events.push(
        messageUpdatedEvent(createdSessionIds[1]!, createAssistantMessage({ id: 'm2', sessionID: createdSessionIds[1]! })),
      );
      events.push(sessionIdleEvent(createdSessionIds[1]!));
      await secondRun;

      expect(createOpencodeMock).toHaveBeenCalledTimes(1);
      expect(createOpencodeClientMock).not.toHaveBeenCalled();
    });

    it('resolves the client lazily via createOpencodeClient for the config variant', async () => {
      const { client: mockClient, events, createdSessionIds } = createMockOpenCodeClient();
      createOpencodeClientMock.mockReturnValue(mockClient);

      const agent = new OpenCodeSDKAgent({ id: 'opencode-agent', description: 'OpenCode', config: {} });

      expect(createOpencodeClientMock).not.toHaveBeenCalled();

      const run = agent.generate('First prompt');
      await vi.waitFor(() => expect(createdSessionIds).toHaveLength(1));
      events.push(
        messageUpdatedEvent(createdSessionIds[0]!, createAssistantMessage({ id: 'm1', sessionID: createdSessionIds[0]! })),
      );
      events.push(sessionIdleEvent(createdSessionIds[0]!));
      await run;

      expect(createOpencodeClientMock).toHaveBeenCalledTimes(1);
      expect(createOpencodeMock).not.toHaveBeenCalled();
    });
  });
});
