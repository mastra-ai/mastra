import { ReadableStream } from 'node:stream/web';
import { ChunkFrom } from '@mastra/core/stream';
import type { MastraModelOutput } from '@mastra/core/stream';
import { describe, expect, it } from 'vitest';
import { toAISdkV5Stream } from '../convert-streams';
import { convertMastraChunkToAISDKv5 } from '../helpers';

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
      const mockStream = new ReadableStream({
        async start(controller) {
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

      const aiSdkStream = toAISdkV5Stream(mockStream as unknown as MastraModelOutput, { from: 'agent' });

      const chunks: any[] = [];
      for await (const chunk of aiSdkStream) {
        chunks.push(chunk);
      }

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
