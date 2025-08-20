import { describe, expect, test } from 'vitest';
import { createAgentTestRun, createUIMessage, createToolInvocation } from '../../utils';
import { createToolCallAccuracyScorer } from './index';

describe('createToolCallAccuracyScorer', () => {
  test('should return 1 when the expected tool is called', async () => {
    const scorer = createToolCallAccuracyScorer({ expectedTool: 'weather-tool' });
    
    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [createUIMessage({
      content: 'Let me check the weather for you.',
      role: 'assistant',
      id: 'output-1',
      toolInvocations: [createToolInvocation({
        toolCallId: 'call-123',
        toolName: 'weather-tool',
        args: { location: 'New York' },
        result: { temperature: '20°C', condition: 'sunny' },
        state: 'result'
      })]
    })];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(true);
    expect(result.preprocessStepResult?.actualTools).toEqual(['weather-tool']);
  });

  test('should return 0 when the wrong tool is called', async () => {
    const scorer = createToolCallAccuracyScorer({ expectedTool: 'weather-tool' });
    
    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [createUIMessage({
      content: 'Let me calculate that for you.',
      role: 'assistant',
      id: 'output-1',
      toolInvocations: [createToolInvocation({
        toolCallId: 'call-123',
        toolName: 'calculator-tool',
        args: { expression: '2+2' },
        result: { result: 4 },
        state: 'result'
      })]
    })];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(false);
    expect(result.preprocessStepResult?.actualTools).toEqual(['calculator-tool']);
  });

  test('should return 0 when no tools are called', async () => {
    const scorer = createToolCallAccuracyScorer({ expectedTool: 'weather-tool' });
    
    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [createUIMessage({
      content: 'I cannot help with that.',
      role: 'assistant',
      id: 'output-1'
    })];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.hasToolCalls).toBe(false);
    expect(result.preprocessStepResult?.actualTools).toEqual([]);
  });

  test('should return 1 when expected tool is among multiple tools (non-strict mode)', async () => {
    const scorer = createToolCallAccuracyScorer({ expectedTool: 'weather-tool', strictMode: false });
    
    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [createUIMessage({
      content: 'Let me help you with that.',
      role: 'assistant',
      id: 'output-1',
      toolInvocations: [
        createToolInvocation({
          toolCallId: 'call-1',
          toolName: 'search-tool',
          args: {},
          result: {},
          state: 'result'
        }),
        createToolInvocation({
          toolCallId: 'call-2',
          toolName: 'weather-tool',
          args: { location: 'New York' },
          result: { temperature: '20°C' },
          state: 'result'
        }),
        createToolInvocation({
          toolCallId: 'call-3',
          toolName: 'calendar-tool',
          args: {},
          result: {},
          state: 'result'
        })
      ]
    })];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(true);
    expect(result.preprocessStepResult?.actualTools).toEqual(['search-tool', 'weather-tool', 'calendar-tool']);
  });

  test('should return 0 when expected tool is among multiple tools (strict mode)', async () => {
    const scorer = createToolCallAccuracyScorer({ expectedTool: 'weather-tool', strictMode: true });
    
    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [createUIMessage({
      content: 'Let me help you with that.',
      role: 'assistant',
      id: 'output-1',
      toolInvocations: [
        createToolInvocation({
          toolCallId: 'call-1',
          toolName: 'search-tool',
          args: {},
          result: {},
          state: 'result'
        }),
        createToolInvocation({
          toolCallId: 'call-2',
          toolName: 'weather-tool',
          args: { location: 'New York' },
          result: { temperature: '20°C' },
          state: 'result'
        }),
        createToolInvocation({
          toolCallId: 'call-3',
          toolName: 'calendar-tool',
          args: {},
          result: {},
          state: 'result'
        })
      ]
    })];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(true);
  });

  test('should return 1 when only the expected tool is called (strict mode)', async () => {
    const scorer = createToolCallAccuracyScorer({ expectedTool: 'weather-tool', strictMode: true });
    
    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [createUIMessage({
      content: 'Let me check the weather for you.',
      role: 'assistant',
      id: 'output-1',
      toolInvocations: [createToolInvocation({
        toolCallId: 'call-123',
        toolName: 'weather-tool',
        args: { location: 'New York' },
        result: { temperature: '20°C', condition: 'sunny' },
        state: 'result'
      })]
    })];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(true);
    expect(result.preprocessStepResult?.actualTools).toEqual(['weather-tool']);
  });

  test('should handle tool calls with "call" state', async () => {
    const scorer = createToolCallAccuracyScorer({ expectedTool: 'weather-tool' });
    
    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [createUIMessage({
      content: 'Let me check the weather for you.',
      role: 'assistant',
      id: 'output-1',
      toolInvocations: [createToolInvocation({
        toolCallId: 'call-123',
        toolName: 'weather-tool',
        args: { location: 'New York' },
        result: {},
        state: 'call'
      })]
    })];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.actualTools).toEqual(['weather-tool']);
  });

  test('should throw error for invalid input', async () => {
    const scorer = createToolCallAccuracyScorer({ expectedTool: 'weather-tool' });
    const run = createAgentTestRun({ inputMessages: [], output: [createUIMessage({ content: 'test', role: 'assistant', id: 'output-1' })] });

    await expect(scorer.run(run))
      .rejects.toThrow('Input and output messages cannot be null or empty');
  });

  test('should throw error for empty output', async () => {
    const scorer = createToolCallAccuracyScorer({ expectedTool: 'weather-tool' });
    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const run = createAgentTestRun({ inputMessages, output: [] });

    await expect(scorer.run(run))
      .rejects.toThrow('Input and output messages cannot be null or empty');
  });
});