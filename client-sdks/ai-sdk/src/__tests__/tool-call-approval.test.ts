import { ReadableStream } from 'node:stream/web';
import { readUIMessageStream } from '@internal/ai-v6';
import { ChunkFrom } from '@mastra/core/stream';
import type { MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, it, vi } from 'vitest';
import { handleChatStream, extractV6NativeApproval } from '../chat-route';
import { toAISdkStream, toAISdkV5Stream } from '../convert-streams';
import { convertMastraChunkToAISDKv5, convertMastraChunkToAISDKv6, APPROVAL_ID_SEPARATOR } from '../helpers';

async function collectChunks(stream: ReadableStream) {
  const chunks: any[] = [];

  for await (const chunk of stream as any) {
    chunks.push(chunk);
  }

  return chunks;
}

function createApprovalStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({
        type: 'start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: { id: 'msg-1' },
      });

      controller.enqueue({
        type: 'step-start',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: { messageId: 'msg-1' },
      });

      controller.enqueue({
        type: 'tool-call',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'tooluse_abc123',
          toolName: 'myTool',
          args: { param: 'value' },
        },
      });

      controller.enqueue({
        type: 'tool-call-approval',
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'tooluse_abc123',
          toolName: 'myTool',
          args: { param: 'value' },
          resumeSchema: '{"type":"object","properties":{"approved":{"type":"boolean"}}}',
        },
      });

      controller.close();
    },
  });
}

describe('tool-call-approval chunk conversion (issue #12878)', () => {
  describe('convertMastraChunkToAISDKv5', () => {
    it('should include a state field in the data-tool-call-approval chunk', () => {
      const chunk = {
        type: 'tool-call-approval' as const,
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'tooluse_abc123',
          toolName: 'myTool',
          args: { param: 'value' },
          resumeSchema: '{"type":"object","properties":{"approved":{"type":"boolean"}}}',
        },
      };

      const result = convertMastraChunkToAISDKv5({ chunk, mode: 'stream' }) as any;

      expect(result).toBeDefined();
      expect(result.type).toBe('data-tool-call-approval');
      expect(result.id).toBe('tooluse_abc123');

      // Issue #12878: The data-tool-call-approval chunk should include a state
      // field so the frontend can identify the part's state consistently
      // with other tool UI parts (which have states like 'input-available',
      // 'output-available', etc.)
      expect(result.data).toHaveProperty('state', 'data-tool-call-approval');
    });

    it('should include a state field in the data-tool-call-suspended chunk', () => {
      const chunk = {
        type: 'tool-call-suspended' as const,
        runId: 'run-123',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'tooluse_abc123',
          toolName: 'myTool',
          suspendPayload: { reason: 'Needs user input' },
          resumeSchema: '{"type":"object"}',
        },
      };

      const result = convertMastraChunkToAISDKv5({ chunk, mode: 'stream' }) as any;

      expect(result).toBeDefined();
      expect(result.type).toBe('data-tool-call-suspended');
      expect(result.id).toBe('tooluse_abc123');

      // Issue #12878: Consistent with tool-call-approval, the suspended chunk
      // should also include a state field
      expect(result.data).toHaveProperty('state', 'data-tool-call-suspended');
    });
  });

  describe('end-to-end: tool-call-approval through agent stream', () => {
    it('should emit data-tool-call-approval with state field when tool requires approval', async () => {
      const aiSdkStream = toAISdkV5Stream(createApprovalStream() as unknown as MastraModelOutput, { from: 'agent' });
      const chunks = await collectChunks(aiSdkStream);

      // Should have the tool-input-available chunk for the tool call
      const toolInputChunk = chunks.find(chunk => chunk.type === 'tool-input-available');
      expect(toolInputChunk).toBeDefined();
      expect(toolInputChunk.toolCallId).toBe('tooluse_abc123');

      // Should have the data-tool-call-approval chunk
      const approvalChunk = chunks.find(chunk => chunk.type === 'data-tool-call-approval');
      expect(approvalChunk).toBeDefined();
      expect(approvalChunk.type).toBe('data-tool-call-approval');
      expect(approvalChunk.id).toBe('tooluse_abc123');

      // Issue #12878: The data field should include a state property
      expect(approvalChunk.data.state).toBe('data-tool-call-approval');

      // The rest of the data should still be present
      expect(approvalChunk.data.runId).toBe('run-123');
      expect(approvalChunk.data.toolCallId).toBe('tooluse_abc123');
      expect(approvalChunk.data.toolName).toBe('myTool');
      expect(approvalChunk.data.args).toEqual({ param: 'value' });
      expect(approvalChunk.data.resumeSchema).toBe('{"type":"object","properties":{"approved":{"type":"boolean"}}}');
    });
  });
});

describe('extractV6NativeApproval', () => {
  it('returns runId and approved:true from an approval-responded part', () => {
    const approvalId = `run-123${APPROVAL_ID_SEPARATOR}tooluse_abc123`;
    const messages = [
      {
        role: 'assistant' as const,
        id: 'msg-1',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'tooluse_abc123',
            state: 'approval-responded' as const,
            input: { param: 'value' },
            approval: { id: approvalId, approved: true },
          },
        ],
      },
    ];

    const result = extractV6NativeApproval(messages as any);

    expect(result).toEqual({ resumeData: { approved: true }, runId: 'run-123' });
  });

  it('includes reason when the user denied with a reason', () => {
    const approvalId = `run-456${APPROVAL_ID_SEPARATOR}tooluse_xyz`;
    const messages = [
      {
        role: 'assistant' as const,
        id: 'msg-1',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'tooluse_xyz',
            state: 'approval-responded' as const,
            input: {},
            approval: { id: approvalId, approved: false, reason: 'Not safe' },
          },
        ],
      },
    ];

    const result = extractV6NativeApproval(messages as any);

    expect(result).toEqual({ resumeData: { approved: false, reason: 'Not safe' }, runId: 'run-456' });
  });

  it('omits reason when not provided', () => {
    const approvalId = `run-789${APPROVAL_ID_SEPARATOR}tooluse_abc`;
    const messages = [
      {
        role: 'assistant' as const,
        id: 'msg-1',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'tooluse_abc',
            state: 'approval-responded' as const,
            input: {},
            approval: { id: approvalId, approved: true },
          },
        ],
      },
    ];

    const result = extractV6NativeApproval(messages as any);

    expect(result?.resumeData).not.toHaveProperty('reason');
  });

  it('returns null when no approval-responded part exists', () => {
    const messages = [
      { role: 'user' as const, id: 'msg-1', parts: [{ type: 'text', text: 'hello' }] },
      {
        role: 'assistant' as const,
        id: 'msg-2',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'tooluse_abc123',
            state: 'approval-requested' as const,
            input: {},
            approval: { id: 'run-123::tooluse_abc123' },
          },
        ],
      },
    ];

    expect(extractV6NativeApproval(messages as any)).toBeNull();
  });

  it('returns null when the approval id has no separator', () => {
    const messages = [
      {
        role: 'assistant' as const,
        id: 'msg-1',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'tooluse_abc123',
            state: 'approval-responded' as const,
            input: {},
            approval: { id: 'no-separator-here', approved: true },
          },
        ],
      },
    ];

    expect(extractV6NativeApproval(messages as any)).toBeNull();
  });

  it('scans from the end and picks the most recent approval-responded part', () => {
    const messages = [
      {
        role: 'assistant' as const,
        id: 'msg-1',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'old-call',
            state: 'approval-responded' as const,
            input: {},
            approval: { id: `old-run${APPROVAL_ID_SEPARATOR}old-call`, approved: true },
          },
        ],
      },
      {
        role: 'assistant' as const,
        id: 'msg-2',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'new-call',
            state: 'approval-responded' as const,
            input: {},
            approval: { id: `new-run${APPROVAL_ID_SEPARATOR}new-call`, approved: false },
          },
        ],
      },
    ];

    const result = extractV6NativeApproval(messages as any);

    expect(result?.runId).toBe('new-run');
    expect(result?.resumeData.approved).toBe(false);
  });

  it('ignores earlier approval responses once a later user follow-up exists', () => {
    const messages = [
      {
        role: 'assistant' as const,
        id: 'msg-1',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'old-call',
            state: 'approval-responded' as const,
            input: {},
            approval: { id: `old-run${APPROVAL_ID_SEPARATOR}old-call`, approved: true },
          },
        ],
      },
      {
        role: 'user' as const,
        id: 'msg-2',
        parts: [{ type: 'text', text: 'What happened?' }],
      },
    ];

    expect(extractV6NativeApproval(messages as any)).toBeNull();
  });
});

describe('handleChatStream v6 native approve() resume flow', () => {
  const emptyStream = {
    fullStream: new ReadableStream({
      start(c) {
        c.close();
      },
    }),
  };

  const mockAgent = {
    stream: vi.fn().mockResolvedValue(emptyStream),
    resumeStream: vi.fn().mockResolvedValue(emptyStream),
  };

  const mockMastra = {
    getAgentById: vi.fn().mockReturnValue(mockAgent),
  };

  it('calls resumeStream with correct runId and resumeData when messages contain approval-responded', async () => {
    vi.clearAllMocks();

    const messages = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'tooluse_abc123',
            state: 'approval-responded',
            input: { param: 'value' },
            approval: { id: `run-123${APPROVAL_ID_SEPARATOR}tooluse_abc123`, approved: true },
          },
        ],
      },
    ];

    await handleChatStream({
      mastra: mockMastra as any,
      agentId: 'test-agent',
      version: 'v6',
      params: { messages } as any,
    });

    expect(mockAgent.resumeStream).toHaveBeenCalledTimes(1);
    expect(mockAgent.resumeStream).toHaveBeenCalledWith(
      { approved: true },
      expect.objectContaining({ runId: 'run-123' }),
    );
    expect(mockAgent.stream).not.toHaveBeenCalled();
  });

  it('calls stream() for a normal (non-approval) message', async () => {
    vi.clearAllMocks();

    const messages = [{ id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }];

    await handleChatStream({
      mastra: mockMastra as any,
      agentId: 'test-agent',
      version: 'v6',
      params: { messages } as any,
    });

    expect(mockAgent.stream).toHaveBeenCalledTimes(1);
    expect(mockAgent.resumeStream).not.toHaveBeenCalled();
  });

  it('explicit resumeData/runId takes precedence over message scanning', async () => {
    vi.clearAllMocks();

    const messages = [
      {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-myTool',
            toolCallId: 'tooluse_abc123',
            state: 'approval-responded',
            input: {},
            approval: { id: `run-from-msg${APPROVAL_ID_SEPARATOR}tooluse_abc123`, approved: true },
          },
        ],
      },
    ];

    await handleChatStream({
      mastra: mockMastra as any,
      agentId: 'test-agent',
      version: 'v6',
      params: { messages, resumeData: { approved: true }, runId: 'explicit-run' } as any,
    });

    expect(mockAgent.resumeStream).toHaveBeenCalledWith(
      { approved: true },
      expect.objectContaining({ runId: 'explicit-run' }),
    );
  });
});

describe('tool-call-approval conversion', () => {
  it('keeps the v5 data-tool-call-approval shape', () => {
    const chunk = {
      type: 'tool-call-approval' as const,
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tooluse_abc123',
        toolName: 'myTool',
        args: { param: 'value' },
        resumeSchema: '{"type":"object","properties":{"approved":{"type":"boolean"}}}',
      },
    };

    const result = convertMastraChunkToAISDKv5({ chunk, mode: 'stream' }) as any;

    expect(result.type).toBe('data-tool-call-approval');
    expect(result.data.runId).toBe('run-123');
  });

  it('maps v6 approvals to both tool-approval-request and data-tool-call-approval', () => {
    const chunk = {
      type: 'tool-call-approval' as const,
      runId: 'run-123',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'tooluse_abc123',
        toolName: 'myTool',
        args: { param: 'value' },
        resumeSchema: '{"type":"object","properties":{"approved":{"type":"boolean"}}}',
      },
    };

    const result = convertMastraChunkToAISDKv6({ chunk, mode: 'stream' }) as any[];

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toEqual({
      type: 'tool-approval-request',
      approvalId: 'run-123::tooluse_abc123',
      toolCallId: 'tooluse_abc123',
    });
    expect(result[1]).toMatchObject({
      type: 'data-tool-call-approval',
      id: 'tooluse_abc123',
      data: expect.objectContaining({
        state: 'data-tool-call-approval',
        runId: 'run-123',
        toolCallId: 'tooluse_abc123',
      }),
    });
  });

  it('keeps v5 streaming behavior unchanged', async () => {
    const aiSdkStream = toAISdkV5Stream(createApprovalStream() as unknown as MastraModelOutput, { from: 'agent' });
    const chunks = await collectChunks(aiSdkStream);

    expect(chunks.find(chunk => chunk.type === 'data-tool-call-approval')).toBeDefined();
    expect(chunks.find(chunk => chunk.type === 'tool-approval-request')).toBeUndefined();
  });

  it('emits both tool-approval-request and data-tool-call-approval on the v6 stream', async () => {
    const aiSdkStream = toAISdkStream(createApprovalStream() as unknown as MastraModelOutput, {
      from: 'agent',
      version: 'v6',
    });
    const chunks = await collectChunks(aiSdkStream);

    expect(chunks.find(chunk => chunk.type === 'tool-input-available')).toBeDefined();
    expect(chunks.find(chunk => chunk.type === 'tool-approval-request')).toBeDefined();
    expect(chunks.find(chunk => chunk.type === 'data-tool-call-approval')).toBeDefined();
  });

  it('is interpreted by the v6 UI message reader as approval-requested', async () => {
    const aiSdkStream = toAISdkStream(createApprovalStream() as unknown as MastraModelOutput, {
      from: 'agent',
      version: 'v6',
    });

    const messages = [] as any[];
    for await (const message of readUIMessageStream({ stream: aiSdkStream as any })) {
      messages.push(message);
    }

    const lastMessage = messages.at(-1);
    expect(lastMessage?.role).toBe('assistant');

    const approvalPart = lastMessage?.parts.find(
      (part: any) => part.type === 'tool-myTool' && part.state === 'approval-requested',
    );

    expect(approvalPart).toMatchObject({
      type: 'tool-myTool',
      toolCallId: 'tooluse_abc123',
      state: 'approval-requested',
      approval: { id: 'run-123::tooluse_abc123' },
    });
  });
});
