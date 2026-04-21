import { describe, it, expect } from 'vitest';

import type { AIV5Type } from '../types';
import type { MastraDBMessage } from '../state/types';
import { AIV5Adapter } from './AIV5Adapter';

describe('AIV5Adapter - tool error handling', () => {
  describe('toUIMessage - handling output-error state', () => {
    it('should convert output-error state from toolInvocations array', () => {
      const dbMsg: MastraDBMessage = {
        id: 'test-msg',
        role: 'assistant',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        content: {
          format: 2,
          toolInvocations: [
            {
              toolCallId: 'call-123',
              toolName: 'testTool',
              args: { input: 'test' },
              state: 'output-error',
              errorText: 'Tool execution failed',
            },
          ],
        },
      };

      const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

      expect(uiMsg.parts).toHaveLength(1);
      const part = uiMsg.parts[0] as AIV5Type.ToolUIPart;
      expect(part.type).toBe('tool-testTool');
      expect(part.toolCallId).toBe('call-123');
      expect(part.state).toBe('output-error');
      expect(part.errorText).toBe('Tool execution failed');
      expect(part).not.toHaveProperty('output');
    });

    it('should convert output-error state from parts array', () => {
      const dbMsg: MastraDBMessage = {
        id: 'test-msg',
        role: 'assistant',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-456',
                toolName: 'anotherTool',
                args: { param: 'value' },
                state: 'output-error',
                errorText: 'Network error occurred',
              },
            },
          ],
        },
      };

      const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

      expect(uiMsg.parts).toHaveLength(1);
      const part = uiMsg.parts[0] as AIV5Type.ToolUIPart;
      expect(part.type).toBe('tool-anotherTool');
      expect(part.toolCallId).toBe('call-456');
      expect(part.state).toBe('output-error');
      expect(part.errorText).toBe('Network error occurred');
      expect(part).not.toHaveProperty('output');
    });

    it('should handle output-error with empty errorText', () => {
      const dbMsg: MastraDBMessage = {
        id: 'test-msg',
        role: 'assistant',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-789',
                toolName: 'faultyTool',
                args: {},
                state: 'output-error',
              },
            },
          ],
        },
      };

      const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

      const part = uiMsg.parts[0] as AIV5Type.ToolUIPart;
      expect(part.state).toBe('output-error');
      expect(part.errorText).toBe('');
    });
  });

  describe('fromModelMessage - handling isError on tool-result', () => {
    it('should convert tool-result with isError=true to output-error state', () => {
      const modelMsg: AIV5Type.ModelMessage = {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-001',
            toolName: 'errorTool',
            input: { data: 'test' },
          },
          {
            type: 'tool-result',
            toolCallId: 'call-001',
            toolName: 'errorTool',
            output: 'Error: Something went wrong',
            isError: true,
          },
        ],
      };

      const dbMsg = AIV5Adapter.fromModelMessage(modelMsg);

      // Check toolInvocations array
      expect(dbMsg.content.toolInvocations).toHaveLength(1);
      const inv = dbMsg.content.toolInvocations![0];
      expect(inv.state).toBe('output-error');
      expect(inv.errorText).toBe('Error: Something went wrong');
      expect(inv).not.toHaveProperty('result');

      // Check parts array
      const toolPart = dbMsg.content.parts.find(
        p => p.type === 'tool-invocation',
      ) as Extract<MastraDBMessage['content']['parts'][number], { type: 'tool-invocation' }>;
      expect(toolPart).toBeDefined();
      expect(toolPart.toolInvocation.state).toBe('output-error');
      expect(toolPart.toolInvocation.errorText).toBe('Error: Something went wrong');
    });

    it('should convert tool-result with isError=false to result state', () => {
      const modelMsg: AIV5Type.ModelMessage = {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-002',
            toolName: 'successTool',
            input: { query: 'test' },
          },
          {
            type: 'tool-result',
            toolCallId: 'call-002',
            toolName: 'successTool',
            output: { status: 'ok', data: [1, 2, 3] },
            isError: false,
          },
        ],
      };

      const dbMsg = AIV5Adapter.fromModelMessage(modelMsg);

      const inv = dbMsg.content.toolInvocations![0];
      expect(inv.state).toBe('result');
      expect(inv.result).toEqual({ status: 'ok', data: [1, 2, 3] });
      expect(inv).not.toHaveProperty('errorText');
    });

    it('should handle tool-result without isError field (undefined)', () => {
      const modelMsg: AIV5Type.ModelMessage = {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-003',
            toolName: 'normalTool',
            input: {},
          },
          {
            type: 'tool-result',
            toolCallId: 'call-003',
            toolName: 'normalTool',
            output: 'success',
          },
        ],
      };

      const dbMsg = AIV5Adapter.fromModelMessage(modelMsg);

      const inv = dbMsg.content.toolInvocations![0];
      expect(inv.state).toBe('result');
      expect(inv.result).toBe('success');
    });
  });

  describe('Round-trip error preservation', () => {
    it('should preserve error state through save and load cycle', () => {
      // Simulate live streaming: ModelMessage with isError
      const streamedMsg: AIV5Type.ModelMessage = {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-roundtrip',
            toolName: 'flakeyTool',
            input: { retry: false },
          },
          {
            type: 'tool-result',
            toolCallId: 'call-roundtrip',
            toolName: 'flakeyTool',
            output: 'Connection timeout',
            isError: true,
          },
        ],
      };

      // Convert to DB format (as would be stored)
      const savedMsg = AIV5Adapter.fromModelMessage(streamedMsg);

      // Verify it was saved with error state
      expect(savedMsg.content.toolInvocations![0].state).toBe('output-error');
      expect(savedMsg.content.toolInvocations![0].errorText).toBe('Connection timeout');

      // Load from history (DB → UI)
      const loadedMsg = AIV5Adapter.toUIMessage(savedMsg);

      // Verify error state is preserved in UI format
      const toolPart = loadedMsg.parts[0] as AIV5Type.ToolUIPart;
      expect(toolPart.state).toBe('output-error');
      expect(toolPart.errorText).toBe('Connection timeout');
      expect(toolPart).not.toHaveProperty('output');
    });

    it('should not confuse error text with successful output', () => {
      const streamedMsg: AIV5Type.ModelMessage = {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-distinct',
            toolName: 'distinguishTool',
            input: {},
          },
          {
            type: 'tool-result',
            toolCallId: 'call-distinct',
            toolName: 'distinguishTool',
            output: 'Error: This is an error message',
            isError: true,
          },
        ],
      };

      const savedMsg = AIV5Adapter.fromModelMessage(streamedMsg);
      const loadedMsg = AIV5Adapter.toUIMessage(savedMsg);

      const toolPart = loadedMsg.parts[0] as AIV5Type.ToolUIPart;

      // Should be error state, not success with error text as output
      expect(toolPart.state).toBe('output-error');
      expect(toolPart.errorText).toBe('Error: This is an error message');

      // Should NOT have output field
      expect(toolPart).not.toHaveProperty('output');
    });
  });
});
