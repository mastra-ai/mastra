import { describe, it, expect } from 'vitest';
import { toUIMessage } from './toUIMessage';
import { ChunkFrom, type ChunkType } from '@mastra/core/stream';
import type { UIMessage } from '@ai-sdk/react';

describe('toUIMessage', () => {
  describe('workflow tool handling', () => {
    it('should handle server-side workflow tool-result with result property', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'myWorkflow',
              toolCallId: 'call_123',
              state: 'input-available',
              input: { ingredient: 'tomato' },
            },
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-result',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call_123',
          toolName: 'myWorkflow',
          result: {
            result: {
              status: 'success',
              steps: {
                'my-step': {
                  payload: { ingredient: 'tomato' },
                  startedAt: 1759474769330,
                  status: 'success',
                  output: { result: 'tomato' },
                  endedAt: 1759474772332,
                },
                'my-step-2': {
                  payload: { result: 'tomato' },
                  startedAt: 1759474772334,
                  status: 'success',
                  output: { result: 'suh' },
                  endedAt: 1759474775336,
                },
              },
              input: { ingredient: 'tomato' },
              result: { result: 'suh' },
              traceId: 'f9505589a3da95db1bd666c509585585',
            },
            runId: 'beca48ae-92eb-44e2-ab10-3cfd84f4ad0d',
          },
          isError: false,
        },
      };

      const result = toUIMessage({ chunk, conversation });

      expect(result).toHaveLength(1);
      expect(result[0].parts).toHaveLength(1);
      const part = result[0].parts[0];
      expect(part.type).toBe('dynamic-tool');
      if (part.type === 'dynamic-tool' && 'output' in part) {
        // Server response should have the nested result structure
        expect(part.output).toEqual({
          result: {
            status: 'success',
            steps: {
              'my-step': {
                payload: { ingredient: 'tomato' },
                startedAt: 1759474769330,
                status: 'success',
                output: { result: 'tomato' },
                endedAt: 1759474772332,
              },
              'my-step-2': {
                payload: { result: 'tomato' },
                startedAt: 1759474772334,
                status: 'success',
                output: { result: 'suh' },
                endedAt: 1759474775336,
              },
            },
            input: { ingredient: 'tomato' },
            result: { result: 'suh' },
            traceId: 'f9505589a3da95db1bd666c509585585',
          },
          runId: 'beca48ae-92eb-44e2-ab10-3cfd84f4ad0d',
        });
      }
    });

    it('should handle client-side streaming workflow tool-output chunks', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'myWorkflow',
              toolCallId: 'call_456',
              state: 'input-available',
              input: { ingredient: 'tomato' },
            },
          ],
        },
      ];

      // First chunk: workflow-start
      const chunk1: ChunkType = {
        type: 'tool-output',
        runId: 'run-1',
        from: ChunkFrom.WORKFLOW,
        payload: {
          toolCallId: 'call_456',
          output: {
            type: 'workflow-start',
            runId: 'eccd0266-b432-4ac6-9e93-877559890e96',
            payload: {},
          },
        },
      };

      let result = toUIMessage({ chunk: chunk1, conversation });
      expect(result).toHaveLength(1);
      let part = result[0].parts[0];
      expect(part.type).toBe('dynamic-tool');
      if (part.type === 'dynamic-tool' && 'output' in part) {
        // Client streaming builds WorkflowWatchResult with payload.workflowState
        expect(part.output).toHaveProperty('payload.workflowState.status', 'running');
        expect(part.output).toHaveProperty('payload.workflowState.steps', {});
      }

      // Second chunk: workflow-step-start
      const chunk2: ChunkType = {
        type: 'tool-output',
        runId: 'run-1',
        from: ChunkFrom.WORKFLOW,
        payload: {
          toolCallId: 'call_456',
          output: {
            type: 'workflow-step-start',
            runId: 'eccd0266-b432-4ac6-9e93-877559890e96',
            payload: {
              id: 'my-step',
              stepName: 'my-step',
              stepCallId: '71bc4047-0ffd-410e-9512-67fdcde2eb3b',
              payload: { ingredient: 'tomato' },
              startedAt: 1759474941811,
              status: 'running',
              currentStep: {
                stepName: 'my-step',
                id: 'my-step',
                stepCallId: '71bc4047-0ffd-410e-9512-67fdcde2eb3b',
                payload: { ingredient: 'tomato' },
                startedAt: 1759474941811,
                status: 'running',
              },
            },
          },
        },
      };

      result = toUIMessage({ chunk: chunk2, conversation: result });
      expect(result).toHaveLength(1);
      part = result[0].parts[0];
      if (part.type === 'dynamic-tool' && 'output' in part) {
        expect(part.output).toHaveProperty('payload.workflowState.status', 'running');
        expect(part.output).toHaveProperty('payload.workflowState.steps.my-step');
        const step = (part.output as any).payload.workflowState.steps['my-step'];
        expect(step).toMatchObject({
          id: 'my-step',
          stepName: 'my-step',
          payload: { ingredient: 'tomato' },
          startedAt: 1759474941811,
          status: 'running',
        });
      }

      // Third chunk: workflow-step-result
      const chunk3: ChunkType = {
        type: 'tool-output',
        runId: 'run-1',
        from: ChunkFrom.WORKFLOW,
        payload: {
          toolCallId: 'call_456',
          output: {
            type: 'workflow-step-result',
            runId: 'eccd0266-b432-4ac6-9e93-877559890e96',
            payload: {
              id: 'my-step',
              output: { result: 'tomato' },
              status: 'success',
              endedAt: 1759474945000,
            },
          },
        },
      };

      result = toUIMessage({ chunk: chunk3, conversation: result });
      part = result[0].parts[0];
      if (part.type === 'dynamic-tool' && 'output' in part) {
        const step = (part.output as any).payload.workflowState.steps['my-step'];
        expect(step).toMatchObject({
          id: 'my-step',
          output: { result: 'tomato' },
          status: 'success',
          endedAt: 1759474945000,
        });
      }

      // Fourth chunk: workflow-finish
      const chunk4: ChunkType = {
        type: 'tool-output',
        runId: 'run-1',
        from: ChunkFrom.WORKFLOW,
        payload: {
          toolCallId: 'call_456',
          output: {
            type: 'workflow-finish',
            runId: 'eccd0266-b432-4ac6-9e93-877559890e96',
            payload: {
              workflowStatus: 'success',
              result: { result: 'suh' },
              input: { ingredient: 'tomato' },
              traceId: 'trace-123',
            },
          },
        },
      };

      result = toUIMessage({ chunk: chunk4, conversation: result });
      part = result[0].parts[0];
      if (part.type === 'dynamic-tool' && 'output' in part) {
        expect(part.output).toHaveProperty('payload.workflowState.status', 'success');
        expect(part.output).toHaveProperty('payload.workflowState.result', { result: 'suh' });
        expect(part.output).toHaveProperty('payload.workflowState.input', { ingredient: 'tomato' });
        expect(part.output).toHaveProperty('payload.workflowState.traceId', 'trace-123');
      }
    });

    it('should handle regular non-workflow tools', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'calculator',
              toolCallId: 'call_789',
              state: 'input-available',
              input: { a: 2, b: 3 },
            },
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-result',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call_789',
          toolName: 'calculator',
          result: { sum: 5 },
          isError: false,
        },
      };

      const result = toUIMessage({ chunk, conversation });
      const part = result[0].parts[0];
      if (part.type === 'dynamic-tool' && 'output' in part) {
        // Regular tool should have direct output
        expect(part.output).toEqual({ sum: 5 });
      }
    });

    it('should handle tool errors', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'myWorkflow',
              toolCallId: 'call_error',
              state: 'input-available',
              input: { ingredient: 'bad' },
            },
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-result',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolCallId: 'call_error',
          toolName: 'myWorkflow',
          result: 'Workflow failed: Invalid ingredient',
          isError: true,
        },
      };

      const result = toUIMessage({ chunk, conversation });
      const part = result[0].parts[0];
      expect(part.type).toBe('dynamic-tool');
      if (part.type === 'dynamic-tool' && 'state' in part) {
        expect(part.state).toBe('output-error');
        if ('errorText' in part) {
          expect(part.errorText).toBe('Workflow failed: Invalid ingredient');
        }
      }
    });

    it('should handle workflow suspension', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'myWorkflow',
              toolCallId: 'call_suspend',
              state: 'input-available',
              input: { ingredient: 'tomato' },
            },
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        runId: 'run-1',
        from: ChunkFrom.WORKFLOW,
        payload: {
          toolCallId: 'call_suspend',
          output: {
            type: 'workflow-step-suspended',
            runId: 'run-suspend',
            payload: {
              id: 'approval-step',
              status: 'suspended',
              suspendedAt: 1759474950000,
            },
          },
        },
      };

      const result = toUIMessage({ chunk, conversation });
      const part = result[0].parts[0];
      if (part.type === 'dynamic-tool' && 'output' in part) {
        expect(part.output).toHaveProperty('payload.workflowState.status', 'suspended');
        expect(part.output).toHaveProperty('payload.workflowState.steps.approval-step');
        const step = (part.output as any).payload.workflowState.steps['approval-step'];
        expect(step).toMatchObject({
          id: 'approval-step',
          status: 'suspended',
          suspendedAt: 1759474950000,
        });
      }
    });

    it('should handle workflow cancellation', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'myWorkflow',
              toolCallId: 'call_cancel',
              state: 'input-available',
              input: { ingredient: 'tomato' },
            },
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        runId: 'run-1',
        from: ChunkFrom.WORKFLOW,
        payload: {
          toolCallId: 'call_cancel',
          output: {
            type: 'workflow-canceled',
            runId: 'run-cancel',
            payload: {},
          },
        },
      };

      const result = toUIMessage({ chunk, conversation });
      const part = result[0].parts[0];
      if (part.type === 'dynamic-tool' && 'output' in part) {
        expect(part.output).toHaveProperty('payload.workflowState.status', 'canceled');
      }
    });

    it('should handle workflow waiting status', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'myWorkflow',
              toolCallId: 'call_wait',
              state: 'input-available',
              input: { ingredient: 'tomato' },
            },
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'tool-output',
        runId: 'run-1',
        from: ChunkFrom.WORKFLOW,
        payload: {
          toolCallId: 'call_wait',
          output: {
            type: 'workflow-step-waiting',
            runId: 'run-wait',
            payload: {
              id: 'wait-step',
              status: 'waiting',
              waitingFor: 'external-api',
            },
          },
        },
      };

      const result = toUIMessage({ chunk, conversation });
      const part = result[0].parts[0];
      if (part.type === 'dynamic-tool' && 'output' in part) {
        expect(part.output).toHaveProperty('payload.workflowState.status', 'waiting');
        expect(part.output).toHaveProperty('payload.workflowState.steps.wait-step');
        const step = (part.output as any).payload.workflowState.steps['wait-step'];
        expect(step).toMatchObject({
          id: 'wait-step',
          status: 'waiting',
          waitingFor: 'external-api',
        });
      }
    });
  });

  describe('text handling', () => {
    it('should handle text-start and text-delta chunks', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [],
        },
      ];

      // text-start
      const chunk1: ChunkType = {
        type: 'text-start',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          id: 'text-1',
          providerMetadata: { model: 'gpt-4' } as any,
        },
      };

      let result = toUIMessage({ chunk: chunk1, conversation });
      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toMatchObject({
        type: 'text',
        text: '',
        state: 'streaming',
      });

      // text-delta
      const chunk2: ChunkType = {
        type: 'text-delta',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          id: 'text-1',
          text: 'Hello, world!',
          providerMetadata: { model: 'gpt-4' } as any,
        },
      };

      result = toUIMessage({ chunk: chunk2, conversation: result });
      expect(result[0].parts[0]).toMatchObject({
        type: 'text',
        text: 'Hello, world!',
        state: 'streaming',
      });
    });

    it('should handle reasoning-delta chunks', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const chunk: ChunkType = {
        type: 'reasoning-delta',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          id: 'reason-1',
          text: 'Thinking about the problem...',
          providerMetadata: { model: 'o1' } as any,
        },
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toMatchObject({
        type: 'reasoning',
        text: 'Thinking about the problem...',
        state: 'streaming',
      });
    });
  });

  describe('message lifecycle', () => {
    it('should handle start chunk', () => {
      const conversation: UIMessage[] = [];

      const chunk: ChunkType = {
        type: 'start',
        runId: 'new-run',
        from: ChunkFrom.AGENT,
        payload: {},
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'new-run',
        role: 'assistant',
        parts: [],
      });
    });

    it('should handle finish chunk', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: 'Hello',
              state: 'streaming',
            },
            {
              type: 'reasoning',
              text: 'Thinking...',
              state: 'streaming',
            },
          ],
        },
      ];

      const chunk: ChunkType = {
        type: 'finish',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          metadata: {} as any,
          messages: { all: [], user: [], nonUser: [] },
        },
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result[0].parts[0]).toMatchObject({
        type: 'text',
        text: 'Hello',
        state: 'done',
      });
      expect(result[0].parts[1]).toMatchObject({
        type: 'reasoning',
        text: 'Thinking...',
        state: 'done',
      });
    });

    it('should handle error chunk', () => {
      const conversation: UIMessage[] = [];

      const chunk: ChunkType = {
        type: 'error',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          error: 'Something went wrong',
        },
      };

      const result = toUIMessage({ chunk, conversation });
      // Error doesn't modify conversation
      expect(result).toEqual([]);
    });
  });

  describe('source and file handling', () => {
    it('should handle source-url chunks', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const chunk: ChunkType = {
        type: 'source',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          sourceType: 'url',
          id: 'source-1',
          url: 'https://example.com',
          title: 'Example',
          providerMetadata: {} as any,
        },
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toMatchObject({
        type: 'source-url',
        sourceId: 'source-1',
        url: 'https://example.com',
        title: 'Example',
      });
    });

    it('should handle source-document chunks', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const chunk: ChunkType = {
        type: 'source',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          sourceType: 'document',
          id: 'doc-1',
          mimeType: 'application/pdf',
          title: 'Document',
          filename: 'doc.pdf',
          providerMetadata: {} as any,
        },
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toMatchObject({
        type: 'source-document',
        sourceId: 'doc-1',
        mediaType: 'application/pdf',
        title: 'Document',
        filename: 'doc.pdf',
      });
    });

    it('should handle file chunks with base64 data', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const chunk: ChunkType = {
        type: 'file',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          mimeType: 'image/png',
          data: 'iVBORw0KGgo=',
          base64: 'iVBORw0KGgo=',
          providerMetadata: {} as any,
        },
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toMatchObject({
        type: 'file',
        mediaType: 'image/png',
        url: 'data:image/png;base64,iVBORw0KGgo=',
      });
    });

    it('should handle file chunks with Uint8Array data', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const chunk: ChunkType = {
        type: 'file',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          mimeType: 'text/plain',
          data: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
          providerMetadata: {} as any,
        },
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0].type).toBe('file');
      if ('url' in result[0].parts[0]) {
        expect(result[0].parts[0].url).toContain('data:text/plain;base64,');
      }
    });
  });

  describe('edge cases', () => {
    it('should return conversation unchanged for unknown chunk types', () => {
      const conversation: UIMessage[] = [
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [],
        },
      ];

      const chunk: any = {
        type: 'unknown-type',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {},
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result).toEqual(conversation);
    });

    it('should handle empty conversation', () => {
      const conversation: UIMessage[] = [];

      const chunk: ChunkType = {
        type: 'text-delta',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          id: 'text-1',
          text: 'Hello',
        },
      };

      const result = toUIMessage({ chunk, conversation });
      // Should return empty since no assistant message exists
      expect(result).toEqual([]);
    });

    it('should handle non-assistant last message', () => {
      const conversation: UIMessage[] = [
        {
          id: 'user-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
      ];

      const chunk: ChunkType = {
        type: 'text-delta',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          id: 'text-1',
          text: 'Hi',
        },
      };

      const result = toUIMessage({ chunk, conversation });
      // Should return conversation unchanged since last message isn't assistant
      expect(result).toEqual(conversation);
    });

    it('should create assistant message for reasoning-delta with no existing message', () => {
      const conversation: UIMessage[] = [];

      const chunk: ChunkType = {
        type: 'reasoning-delta',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          id: 'reason-1',
          text: 'Thinking...',
          providerMetadata: {} as any,
        },
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'run-1',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'Thinking...',
            state: 'streaming',
          },
        ],
      });
    });

    it('should create assistant message for tool-call with no existing message', () => {
      const conversation: UIMessage[] = [];

      const chunk: ChunkType = {
        type: 'tool-call',
        runId: 'run-1',
        from: ChunkFrom.AGENT,
        payload: {
          toolName: 'calculator',
          toolCallId: 'call-1',
          args: { value1: 1, value2: 2 } as any,
          providerMetadata: {} as any,
        },
      };

      const result = toUIMessage({ chunk, conversation });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'run-1',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'calculator',
            toolCallId: 'call-1',
            state: 'input-available',
            input: { value1: 1, value2: 2 },
          },
        ],
      });
    });
  });
});