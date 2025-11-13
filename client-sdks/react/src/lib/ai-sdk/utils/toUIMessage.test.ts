import { describe, it, expect } from 'vitest';
import { toUIMessage, mapWorkflowStreamChunkToWatchResult } from './toUIMessage';
import { MastraUIMessage, MastraUIMessageMetadata } from '../types';
import { ChunkType, ChunkFrom } from '@mastra/core/stream';
import { WorkflowStreamResult } from '@mastra/core/workflows';

describe('toUIMessage', () => {
  describe('mapWorkflowStreamChunkToWatchResult', () => {
    it('should handle workflow-start chunk', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        input: { test: 'data' },
        status: 'pending',
        steps: {
          step1: {
            status: 'success',
            output: 'result1',
            payload: {},
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
        },
      };

      const chunk = {
        type: 'workflow-start',
        payload: {},
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        input: { test: 'data' },
        status: 'running',
        steps: {
          step1: {
            status: 'success',
            output: 'result1',
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        },
      });
    });

    it('should handle workflow-start with no previous state', () => {
      const prev = undefined as any;
      const chunk = {
        type: 'workflow-start',
        payload: {},
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        input: undefined,
        status: 'running',
        steps: {},
      });
    });

    it('should handle workflow-canceled chunk', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {},
      };

      const chunk = {
        type: 'workflow-canceled',
        payload: {},
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        status: 'canceled',
        input: {},
        steps: {},
      });
    });

    it('should handle workflow-finish with success status and successful last step', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {
          step1: {
            status: 'success',
            output: 'result1',
            payload: {},
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          step2: {
            status: 'success',
            output: 'final-result',
            payload: {},
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
        },
      };

      const chunk = {
        type: 'workflow-finish',
        payload: { workflowStatus: 'success' },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        status: 'success',
        input: {},
        steps: {
          step1: {
            status: 'success',
            output: 'result1',
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'success',
            output: 'final-result',
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        },
        result: 'final-result',
      });
    });

    it('should handle workflow-finish with failed status and failed last step', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {
          step1: {
            status: 'success',
            output: 'result1',
            payload: {},
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
          step2: {
            status: 'failed',
            error: 'error-message',
            payload: {},
            startedAt: Date.now(),
            endedAt: Date.now(),
          },
        },
      };

      const chunk = {
        type: 'workflow-finish',
        payload: { workflowStatus: 'failed' },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        status: 'failed',
        input: {},
        steps: {
          step1: {
            status: 'success',
            output: 'result1',
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
          step2: {
            status: 'failed',
            error: 'error-message',
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        },
        error: 'error-message',
      });
    });

    it('should handle workflow-finish with no steps', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {},
      };

      const chunk = {
        type: 'workflow-finish',
        payload: { workflowStatus: 'success' },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        status: 'success',
        input: {},
        steps: {},
      });
    });

    it('should handle workflow-step-start chunk', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {},
      };

      const chunk = {
        type: 'workflow-step-start',
        payload: {
          id: 'step1',
          status: 'running',
          input: { test: 'input' },
          payload: {},
          startedAt: Date.now(),
        },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        status: 'running',
        input: {},
        steps: {
          step1: {
            id: 'step1',
            status: 'running',
            input: { test: 'input' },
            payload: {},
            startedAt: expect.any(Number),
          },
        },
      });
    });

    it('should handle workflow-step-suspended chunk', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {
          step1: {
            status: 'running',
            payload: {},
            startedAt: Date.now(),
          },
        },
      };

      const chunk = {
        type: 'workflow-step-suspended',
        payload: {
          id: 'step1',
          status: 'suspended',
          suspendPayload: { reason: 'waiting-for-input' },
          payload: {},
          startedAt: Date.now(),
          suspendedAt: Date.now(),
        },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        status: 'suspended',
        input: {},
        steps: {
          step1: {
            id: 'step1',
            status: 'suspended',
            suspendPayload: { reason: 'waiting-for-input' },
            payload: {},
            startedAt: expect.any(Number),
            suspendedAt: expect.any(Number),
          },
        },
        suspendPayload: { reason: 'waiting-for-input' },
        suspended: [['step1']],
      });
    });

    it('should handle nested suspended steps', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {
          step1: {
            status: 'running',
            payload: {},
            startedAt: Date.now(),
          },
        },
      };

      const chunk = {
        type: 'workflow-step-suspended',
        payload: {
          id: 'step1',
          status: 'suspended',
          suspendPayload: {
            __workflow_meta: { path: ['nested1', 'nested2'] },
          },
          payload: {},
          startedAt: Date.now(),
          suspendedAt: Date.now(),
        },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result.suspended).toEqual([['step1', 'nested1', 'nested2']]);
    });

    it('should handle workflow-step-waiting chunk', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {},
      };

      const chunk = {
        type: 'workflow-step-waiting',
        payload: {
          id: 'step1',
          status: 'waiting',
          payload: {},
          startedAt: Date.now(),
        },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        status: 'waiting',
        input: {},
        steps: {
          step1: {
            id: 'step1',
            status: 'waiting',
            payload: {},
            startedAt: expect.any(Number),
          },
        },
      });
    });

    it('should handle workflow-step-result chunk', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {},
      };

      const chunk = {
        type: 'workflow-step-result',
        payload: {
          id: 'step1',
          status: 'success',
          output: 'step-output',
          payload: {},
          startedAt: Date.now(),
          endedAt: Date.now(),
        },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toEqual({
        status: 'running',
        input: {},
        steps: {
          step1: {
            id: 'step1',
            status: 'success',
            output: 'step-output',
            payload: {},
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
          },
        },
      });
    });

    it('should handle unknown chunk type', () => {
      const prev: WorkflowStreamResult<any, any, any, any> = {
        status: 'running',
        input: {},
        steps: {},
      };

      const chunk = {
        type: 'unknown-type',
        payload: { data: 'test' },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW as const,
      };

      const result = mapWorkflowStreamChunkToWatchResult(prev, chunk);

      expect(result).toBe(prev);
    });
  });

  describe('toUIMessage - tripwire chunk', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'generate',
    };

    it('should create a new assistant message for tripwire chunk', () => {
      const chunk: ChunkType = {
        type: 'tripwire',
        payload: { tripwireReason: 'Security warning detected' },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];
      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Security warning detected',
          },
        ],
        metadata: {
          ...baseMetadata,
          status: 'warning',
        },
      });
      expect(result[0].id).toMatch(/^tripwire-run-123/);
    });
  });

  describe('toUIMessage - start chunk', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'generate',
    };

    it('should create a new assistant message with empty parts', () => {
      const chunk: ChunkType = {
        type: 'start',
        payload: {},
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];
      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'assistant',
        parts: [],
        metadata: baseMetadata,
      });
      expect(result[0].id).toMatch(/^start-run-123/);
    });
  });

  describe('toUIMessage - text chunks', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should handle text-start chunk by adding new text part', () => {
      const chunk: ChunkType = {
        type: 'text-start',
        payload: {
          id: 'text-1',
          providerMetadata: { model: 'gpt-4' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toEqual({
        type: 'text',
        text: '',
        state: 'streaming',
        providerMetadata: { model: 'gpt-4' },
      });
    });

    it('should not add text part if one already exists for text-start', () => {
      const chunk: ChunkType = {
        type: 'text-start',
        payload: {
          id: 'text-1',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'existing',
              state: 'streaming',
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toMatchObject({
        type: 'text',
        text: 'existing',
      });
    });

    it('should append text for text-delta chunk', () => {
      const chunk: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'text-1',
          text: ' world',
          providerMetadata: { model: 'gpt-4' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Hello',
              state: 'streaming',
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toEqual({
        type: 'text',
        text: 'Hello world',
        state: 'streaming',
      });
    });

    it('should create text part if missing for text-delta', () => {
      const chunk: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'text-1',
          text: 'Hello',
          providerMetadata: { model: 'gpt-4' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toEqual({
        type: 'text',
        text: 'Hello',
        state: 'streaming',
        providerMetadata: { model: 'gpt-4' },
      });
    });

    it('should return unchanged if no assistant message for text chunks', () => {
      const chunk: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'text-1',
          text: 'Hello',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual(conversation);
    });

    it('should return unchanged for empty conversation', () => {
      const chunk: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'text-1',
          text: 'Hello',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });
  });

  describe('toUIMessage - reasoning chunks', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should handle reasoning-delta chunk with existing assistant message', () => {
      const chunk: ChunkType = {
        type: 'reasoning-delta',
        payload: {
          id: 'reasoning-1',
          text: ' this problem',
          providerMetadata: { model: 'o1' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              text: 'Let me think about',
              state: 'streaming',
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toEqual({
        type: 'reasoning',
        text: 'Let me think about this problem',
        state: 'streaming',
      });
    });

    it('should create new reasoning part if not exists', () => {
      const chunk: ChunkType = {
        type: 'reasoning-delta',
        payload: {
          id: 'reasoning-1',
          text: 'Analyzing...',
          providerMetadata: { model: 'o1' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toEqual({
        type: 'reasoning',
        text: 'Analyzing...',
        state: 'streaming',
        providerMetadata: { model: 'o1' },
      });
    });

    it('should create new message if no assistant message exists', () => {
      const chunk: ChunkType = {
        type: 'reasoning-delta',
        payload: {
          id: 'reasoning-1',
          text: 'Thinking...',
          providerMetadata: { model: 'o1' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];
      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'Thinking...',
            state: 'streaming',
            providerMetadata: { model: 'o1' },
          },
        ],
        metadata: baseMetadata,
      });
      expect(result[0].id).toMatch(/^reasoning-run-123/);
    });
  });

  describe('toUIMessage - tool-call chunk', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should add tool call to existing assistant message', () => {
      const chunk: ChunkType = {
        type: 'tool-call',
        payload: {
          toolCallId: 'call-1',
          toolName: 'search',
          args: { query: 'weather' },
          providerMetadata: { latency: 100 },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toEqual({
        type: 'dynamic-tool',
        toolName: 'search',
        toolCallId: 'call-1',
        state: 'input-available',
        input: { query: 'weather' },
        callProviderMetadata: { latency: 100 },
      });
    });

    it('should create new message if no assistant message exists', () => {
      const chunk: ChunkType = {
        type: 'tool-call',
        payload: {
          toolCallId: 'call-1',
          toolName: 'calculator',
          args: { a: 1, b: 2 },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];
      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'calculator',
            toolCallId: 'call-1',
            state: 'input-available',
            input: { a: 1, b: 2 },
          },
        ],
        metadata: baseMetadata,
      });
      expect(result[0].id).toMatch(/^tool-call-run-123/);
    });
  });

  describe('toUIMessage - tool-result and tool-error chunks', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should update tool call with successful result', () => {
      const chunk: ChunkType = {
        type: 'tool-result',
        payload: {
          toolCallId: 'call-1',
          toolName: 'calculator',
          result: 42,
          isError: false,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'calculator',
              toolCallId: 'call-1',
              state: 'input-available',
              input: { a: 20, b: 22 },
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toEqual({
        type: 'dynamic-tool',
        toolName: 'calculator',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { a: 20, b: 22 },
        output: 42,
        callProviderMetadata: undefined,
      });
    });

    it('should handle workflow tool result', () => {
      const chunk: ChunkType = {
        type: 'tool-result',
        payload: {
          toolCallId: 'call-1',
          toolName: 'workflow',
          result: {
            result: {
              steps: {
                step1: { status: 'success' },
              },
            },
          },
        },
        runId: 'run-123',
        from: ChunkFrom.WORKFLOW,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'workflow',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        state: 'output-available',
        output: {
          steps: {
            step1: { status: 'success' },
          },
        },
      });
    });

    it('should handle tool-error chunk', () => {
      const chunk: ChunkType = {
        type: 'tool-error',
        payload: {
          toolCallId: 'call-1',
          toolName: 'database',
          error: 'Connection timeout',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'database',
              toolCallId: 'call-1',
              state: 'input-available',
              input: { query: 'SELECT *' },
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toEqual({
        type: 'dynamic-tool',
        toolName: 'database',
        toolCallId: 'call-1',
        state: 'output-error',
        input: { query: 'SELECT *' },
        errorText: 'Connection timeout',
        callProviderMetadata: undefined,
      });
    });

    it('should handle tool-result with isError flag', () => {
      const chunk: ChunkType = {
        type: 'tool-result',
        payload: {
          toolCallId: 'call-1',
          toolName: 'api',
          result: 'API rate limit exceeded',
          isError: true,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'api',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toEqual({
        type: 'dynamic-tool',
        toolName: 'api',
        toolCallId: 'call-1',
        state: 'output-error',
        input: {},
        errorText: 'API rate limit exceeded',
        callProviderMetadata: undefined,
      });
    });

    it('should return unchanged if tool call not found', () => {
      const chunk: ChunkType = {
        type: 'tool-result',
        payload: {
          toolCallId: 'call-999',
          toolName: 'unknown',
          result: 'result',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'calculator',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      // Should return same conversation structure
      expect(result[0].parts[0]).toMatchObject({
        toolCallId: 'call-1',
        state: 'input-available',
      });
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: ChunkType = {
        type: 'tool-result',
        payload: {
          toolCallId: 'call-1',
          toolName: 'tool',
          result: 'result',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });
  });

  describe('toUIMessage - tool-output chunk', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should handle workflow tool-output chunk', () => {
      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: {
            type: 'workflow-start',
            payload: {},
            runId: 'wf-run-1',
            from: ChunkFrom.WORKFLOW,
          },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'workflow',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
              output: undefined,
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      expect(toolPart.output).toEqual({
        input: undefined,
        status: 'running',
        steps: {},
      });
    });

    it('should accumulate workflow states', () => {
      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: {
            type: 'workflow-step-result',
            payload: {
              id: 'step1',
              status: 'success',
              output: 'step-result',
            },
            runId: 'wf-run-1',
            from: ChunkFrom.WORKFLOW,
          },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'workflow',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
              output: {
                status: 'running',
                steps: {},
              } as any,
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      expect(toolPart.output).toEqual({
        status: 'running',
        steps: {
          step1: {
            id: 'step1',
            status: 'success',
            output: 'step-result',
          },
        },
      });
    });

    it('should handle agent tool-output chunk', () => {
      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: {
            from: ChunkFrom.AGENT,
            type: 'text-delta',
            payload: { text: 'Agent response' },
          },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      // This should delegate to toUIMessageFromAgent
      expect(result).toHaveLength(1);
    });

    it('should handle regular tool output as array', () => {
      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: { data: 'new-output' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'tool',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
              output: [{ data: 'existing-output' }] as any,
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      expect(toolPart.output).toEqual([{ data: 'existing-output' }, { data: 'new-output' }]);
    });

    it('should initialize output array if not exists', () => {
      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: { data: 'first-output' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'tool',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      expect(toolPart.output).toEqual([{ data: 'first-output' }]);
    });
  });

  describe('toUIMessage - source chunk', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should add URL source part', () => {
      const chunk: ChunkType = {
        type: 'source',
        payload: {
          id: 'source-1',
          sourceType: 'url',
          title: 'Example Article',
          url: 'https://example.com/article',
          providerMetadata: { source: 'web' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toEqual({
        type: 'source-url',
        sourceId: 'source-1',
        url: 'https://example.com/article',
        title: 'Example Article',
        providerMetadata: { source: 'web' },
      });
    });

    it('should add document source part', () => {
      const chunk: ChunkType = {
        type: 'source',
        payload: {
          id: 'source-2',
          sourceType: 'document',
          title: 'Research Paper',
          mimeType: 'application/pdf',
          filename: 'paper.pdf',
          providerMetadata: { source: 'upload' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toEqual({
        type: 'source-document',
        sourceId: 'source-2',
        mediaType: 'application/pdf',
        title: 'Research Paper',
        filename: 'paper.pdf',
        providerMetadata: { source: 'upload' },
      });
    });

    it('should handle document with no mimeType', () => {
      const chunk: ChunkType = {
        type: 'source',
        payload: {
          id: 'source-3',
          sourceType: 'document',
          title: 'Unknown Document',
          filename: 'file.bin',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        type: 'source-document',
        mediaType: 'application/octet-stream',
      });
    });

    it('should handle missing URL gracefully', () => {
      const chunk: ChunkType = {
        type: 'source',
        payload: {
          id: 'source-4',
          sourceType: 'url',
          title: 'No URL',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        type: 'source-url',
        url: '',
      });
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: ChunkType = {
        type: 'source',
        payload: {
          id: 'source-1',
          sourceType: 'url',
          title: 'Test',
          url: 'https://example.com',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });
  });

  describe('toUIMessage - file chunk', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should handle string data with base64 encoding', () => {
      const chunk: ChunkType = {
        type: 'file',
        payload: {
          data: 'SGVsbG8gV29ybGQ=',
          base64: true,
          mimeType: 'text/plain',
          providerMetadata: { source: 'upload' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toEqual({
        type: 'file',
        mediaType: 'text/plain',
        url: 'data:text/plain;base64,SGVsbG8gV29ybGQ=',
        providerMetadata: { source: 'upload' },
      });
    });

    it('should handle string data without base64 encoding', () => {
      const chunk: ChunkType = {
        type: 'file',
        payload: {
          data: 'Hello World',
          base64: false,
          mimeType: 'text/plain',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        type: 'file',
        url: 'data:text/plain,Hello%20World',
      });
    });

    it('should handle Uint8Array data', () => {
      const chunk: ChunkType = {
        type: 'file',
        payload: {
          data: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
          mimeType: 'application/octet-stream',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        type: 'file',
        mediaType: 'application/octet-stream',
        url: expect.stringContaining('data:application/octet-stream;base64,'),
      });
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: ChunkType = {
        type: 'file',
        payload: {
          data: 'test',
          mimeType: 'text/plain',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });
  });

  describe('toUIMessage - tool-call-approval chunk', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should add tool approval metadata', () => {
      const chunk: ChunkType = {
        type: 'tool-call-approval',
        payload: {
          toolCallId: 'call-1',
          toolName: 'dangerous-tool',
          args: { action: 'delete', target: 'database' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].metadata).toEqual({
        mode: 'stream',
        requireApprovalMetadata: {
          'call-1': {
            toolCallId: 'call-1',
            toolName: 'dangerous-tool',
            args: { action: 'delete', target: 'database' },
          },
        },
      });
    });

    it('should merge with existing approval metadata', () => {
      const chunk: ChunkType = {
        type: 'tool-call-approval',
        payload: {
          toolCallId: 'call-2',
          toolName: 'another-tool',
          args: { param: 'value' },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
          metadata: {
            mode: 'stream',
            requireApprovalMetadata: {
              'call-1': {
                toolCallId: 'call-1',
                toolName: 'first-tool',
                args: {},
              },
            },
          },
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].metadata?.mode).toBe('stream');
      expect((result[0].metadata as any)?.requireApprovalMetadata).toHaveProperty('call-1');
      expect((result[0].metadata as any)?.requireApprovalMetadata).toHaveProperty('call-2');
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: ChunkType = {
        type: 'tool-call-approval',
        payload: {
          toolCallId: 'call-1',
          toolName: 'tool',
          args: {},
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });
  });

  describe('toUIMessage - finish chunk', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should mark streaming text parts as done', () => {
      const chunk: ChunkType = {
        type: 'finish',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: {} },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Final text',
              state: 'streaming',
            },
            {
              type: 'text',
              text: 'Already done',
              state: 'done',
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        type: 'text',
        state: 'done',
      });
      expect(result[0].parts[1]).toMatchObject({
        type: 'text',
        state: 'done',
      });
    });

    it('should mark streaming reasoning parts as done', () => {
      const chunk: ChunkType = {
        type: 'finish',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: {} },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              text: 'Thinking complete',
              state: 'streaming',
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        type: 'reasoning',
        state: 'done',
      });
    });

    it('should not modify non-streaming parts', () => {
      const chunk: ChunkType = {
        type: 'finish',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: {} },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'tool',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
            },
            {
              type: 'source-url',
              sourceId: 'source-1',
              url: 'https://example.com',
              title: 'Example',
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      // Tool and source parts should remain unchanged
      expect(result[0].parts).toEqual(conversation[0].parts);
    });

    it('should return unchanged if no assistant message', () => {
      const chunk: ChunkType = {
        type: 'finish',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: {} },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });
  });

  describe('toUIMessage - error chunk', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should create error message with string error', () => {
      const chunk: ChunkType = {
        type: 'error',
        payload: {
          error: 'Something went wrong',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];
      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Something went wrong',
          },
        ],
        metadata: {
          ...baseMetadata,
          status: 'error',
        },
      });
      expect(result[0].id).toMatch(/^error-run-123/);
    });

    it('should create error message with object error', () => {
      const chunk: ChunkType = {
        type: 'error',
        payload: {
          error: { message: 'API Error', code: 500 },
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];
      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0].parts[0]).toMatchObject({
        type: 'text',
        text: JSON.stringify({ message: 'API Error', code: 500 }),
      });
    });
  });

  describe('toUIMessage - unknown chunk types', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should return conversation unchanged for unknown chunk type', () => {
      const chunk: any = {
        type: 'unknown-type',
        payload: { data: 'test' },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Existing message',
            },
          ],
        },
      ];

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual(conversation);
    });
  });

  describe('toUIMessageFromAgent', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'network',
      from: ChunkFrom.AGENT,
    };

    it('should handle agent text-delta chunk', () => {
      const agentChunk: any = {
        type: 'text-delta',
        payload: { text: ' world' },
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [{ type: 'text', content: 'Hello' }],
              },
            } as any,
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: agentChunk,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      expect(toolPart.output.childMessages).toEqual([{ type: 'text', content: 'Hello world' }]);
    });

    it('should create new text message if last is not text', () => {
      const agentChunk: any = {
        type: 'text-delta',
        payload: { text: 'New text' },
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [{ type: 'tool', toolCallId: 'tool-1' }],
              },
            } as any,
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: agentChunk,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      expect(toolPart.output.childMessages).toHaveLength(2);
      expect(toolPart.output.childMessages[1]).toEqual({
        type: 'text',
        content: 'New text',
      });
    });

    it('should handle agent tool-call chunk', () => {
      const agentChunk: any = {
        type: 'tool-call',
        payload: {
          toolCallId: 'nested-call-1',
          toolName: 'nested-tool',
          args: { param: 'value' },
        },
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [],
              },
            } as any,
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: agentChunk,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      expect(toolPart.output.childMessages).toEqual([
        {
          type: 'tool',
          toolCallId: 'nested-call-1',
          toolName: 'nested-tool',
          args: { param: 'value' },
        },
      ]);
    });

    it('should handle workflow tool-output within agent', () => {
      const agentChunk: any = {
        type: 'tool-output',
        payload: {
          output: {
            type: 'workflow-start',
            payload: {},
            runId: 'wf-run-1',
          },
        },
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [
                  {
                    type: 'tool',
                    toolCallId: 'wf-call-1',
                    toolName: 'workflow',
                  },
                ],
              },
            } as any,
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: agentChunk,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      const lastMessage = toolPart.output.childMessages[0];
      expect(lastMessage.toolOutput).toMatchObject({
        status: 'running',
        steps: {},
        runId: 'wf-run-1',
      });
    });

    it('should handle agent tool-result chunk', () => {
      const agentChunk: any = {
        type: 'tool-result',
        payload: {
          toolCallId: 'nested-call-1',
          toolName: 'calculator',
          result: 42,
        },
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [
                  {
                    type: 'tool',
                    toolCallId: 'nested-call-1',
                    toolName: 'calculator',
                    args: { a: 20, b: 22 },
                  },
                ],
              },
            } as any,
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: agentChunk,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      expect(toolPart.output.childMessages[0]).toMatchObject({
        type: 'tool',
        toolCallId: 'nested-call-1',
        toolOutput: 42,
      });
    });

    it('should handle workflow tool-result within agent', () => {
      const agentChunk: any = {
        type: 'tool-result',
        payload: {
          toolCallId: 'wf-call-1',
          toolName: 'workflow-test',
          result: {
            result: {
              steps: { step1: { status: 'success' } },
            },
            runId: 'wf-run-1',
          },
        },
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'agent',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {},
              output: {
                childMessages: [
                  {
                    type: 'tool',
                    toolCallId: 'wf-call-1',
                    toolName: 'workflow-test',
                  },
                ],
              },
            } as any,
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: agentChunk,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      const toolPart = result[0].parts[0] as any;
      expect(toolPart.output.childMessages[0]).toMatchObject({
        type: 'tool',
        toolCallId: 'wf-call-1',
        toolOutput: {
          steps: { step1: { status: 'success' } },
          runId: 'wf-run-1',
        },
      });
    });

    it('should return unchanged if no tool part found', () => {
      const agentChunk: any = {
        type: 'text-delta',
        payload: { text: 'text' },
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: agentChunk,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual(conversation);
    });

    it('should return unchanged if no assistant message', () => {
      const agentChunk: any = {
        type: 'text-delta',
        payload: { text: 'text' },
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];

      const chunk: ChunkType = {
        type: 'tool-output',
        payload: {
          toolCallId: 'call-1',
          output: agentChunk,
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).toEqual([]);
    });
  });

  describe('toUIMessage - immutability and new references', () => {
    const baseMetadata: MastraUIMessageMetadata = {
      mode: 'stream',
    };

    it('should always return a new array reference', () => {
      const chunk: ChunkType = {
        type: 'unknown-type' as any,
        payload: {},
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];
      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result).not.toBe(conversation);
      expect(result).toEqual(conversation);
    });

    it('should not mutate the original conversation array', () => {
      const chunk: ChunkType = {
        type: 'start',
        payload: {},
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const conversation: MastraUIMessage[] = [];
      const originalLength = conversation.length;

      toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(conversation).toHaveLength(originalLength);
    });

    it('should create new message objects when modifying', () => {
      const chunk: ChunkType = {
        type: 'text-delta',
        payload: {
          id: 'text-1',
          text: ' added',
        },
        runId: 'run-123',
        from: ChunkFrom.AGENT,
      };

      const originalMessage: MastraUIMessage = {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Original',
            state: 'streaming',
          },
        ],
      };

      const conversation: MastraUIMessage[] = [originalMessage];
      const result = toUIMessage({ chunk, conversation, metadata: baseMetadata });

      expect(result[0]).not.toBe(originalMessage);
      expect(result[0].parts).not.toBe(originalMessage.parts);
      expect(originalMessage.parts[0]).toMatchObject({
        text: 'Original',
      });
    });
  });
});
