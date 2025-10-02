import { describe, expect, test } from 'vitest';
import { createAgentTestRun, createUIMessage, createToolInvocation } from '../../utils';
import { createToolCallAccuracyScorerCode } from './index';

describe('createToolCallAccuracyScorerCode', () => {
  test('should return 1 when the expected tool is called', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool' });

    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me check the weather for you.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-123',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C', condition: 'sunny' },
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(true);
    expect(result.preprocessStepResult?.actualTools).toEqual(['weather-tool']);
  });

  test('should return 0 when the wrong tool is called', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool' });

    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me calculate that for you.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-123',
            toolName: 'calculator-tool',
            args: { expression: '2+2' },
            result: { result: 4 },
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(false);
    expect(result.preprocessStepResult?.actualTools).toEqual(['calculator-tool']);
  });

  test('should return 0 when no tools are called', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool' });

    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'I cannot help with that.',
        role: 'assistant',
        id: 'output-1',
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.hasToolCalls).toBe(false);
    expect(result.preprocessStepResult?.actualTools).toEqual([]);
  });

  test('should return 1 when expected tool is among multiple tools (non-strict mode)', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool', strictMode: false });

    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me help you with that.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-1',
            toolName: 'search-tool',
            args: {},
            result: {},
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-2',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C' },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-3',
            toolName: 'calendar-tool',
            args: {},
            result: {},
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(true);
    expect(result.preprocessStepResult?.actualTools).toEqual(['search-tool', 'weather-tool', 'calendar-tool']);
  });

  test('should return 0 when expected tool is among multiple tools (strict mode)', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool', strictMode: true });

    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me help you with that.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-1',
            toolName: 'search-tool',
            args: {},
            result: {},
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-2',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C' },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-3',
            toolName: 'calendar-tool',
            args: {},
            result: {},
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(false);
  });

  test('should return 1 when only the expected tool is called (strict mode)', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool', strictMode: true });

    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me check the weather for you.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-123',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C', condition: 'sunny' },
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(true);
    expect(result.preprocessStepResult?.actualTools).toEqual(['weather-tool']);
  });

  test('should handle tool calls with "call" state', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool' });

    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me check the weather for you.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-123',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: {},
            state: 'call',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.actualTools).toEqual(['weather-tool']);
  });

  test('should throw error for invalid input', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool' });
    const run = createAgentTestRun({
      inputMessages: [],
      output: [createUIMessage({ content: 'test', role: 'assistant', id: 'output-1' })],
    });

    await expect(scorer.run(run)).rejects.toThrow('Input and output messages cannot be null or empty');
  });

  test('should throw error for empty output', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool' });
    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const run = createAgentTestRun({ inputMessages, output: [] });

    await expect(scorer.run(run)).rejects.toThrow('Input and output messages cannot be null or empty');
  });

  // Order checking tests
  test('should return 1 when tools are called in correct order (strict mode)', async () => {
    const scorer = createToolCallAccuracyScorerCode({
      expectedTool: 'search-tool', // This will be ignored when expectedToolOrder is provided
      expectedToolOrder: ['search-tool', 'weather-tool'],
      strictMode: true, // Exact order - no extra tools allowed
    });

    const inputMessages = [
      createUIMessage({ content: 'Search for weather info then get current weather', role: 'user', id: 'input-1' }),
    ];
    const output = [
      createUIMessage({
        content: 'Let me search and then check the weather.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-1',
            toolName: 'search-tool',
            args: { query: 'weather' },
            result: { results: ['weather info'] },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-2',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C' },
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.correctOrderCalled).toBe(true);
    expect(result.preprocessStepResult?.actualTools).toEqual(['search-tool', 'weather-tool']);
  });

  test('should return 0 when tools are called in wrong order (strict mode)', async () => {
    const scorer = createToolCallAccuracyScorerCode({
      expectedTool: 'search-tool',
      expectedToolOrder: ['search-tool', 'weather-tool'],
      strictMode: true, // Exact order required
    });

    const inputMessages = [
      createUIMessage({ content: 'Search for weather info then get current weather', role: 'user', id: 'input-1' }),
    ];
    const output = [
      createUIMessage({
        content: 'Let me check weather first then search.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-1',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C' },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-2',
            toolName: 'search-tool',
            args: { query: 'weather' },
            result: { results: ['weather info'] },
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.correctOrderCalled).toBe(false);
    expect(result.preprocessStepResult?.actualTools).toEqual(['weather-tool', 'search-tool']);
  });

  test('should return 1 when expected tools appear in correct order with extra tools (non-strict mode)', async () => {
    const scorer = createToolCallAccuracyScorerCode({
      expectedTool: 'search-tool',
      expectedToolOrder: ['search-tool', 'weather-tool'],
      strictMode: false, // Flexible order - allows extra tools
    });

    const inputMessages = [createUIMessage({ content: 'Do a comprehensive check', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me do a comprehensive check.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-1',
            toolName: 'search-tool',
            args: { query: 'info' },
            result: { results: ['info'] },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-2',
            toolName: 'calendar-tool',
            args: { action: 'check' },
            result: { events: [] },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-3',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C' },
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.correctOrderCalled).toBe(true);
    expect(result.preprocessStepResult?.actualTools).toEqual(['search-tool', 'calendar-tool', 'weather-tool']);
  });

  test('should return 0 when expected tools appear in wrong relative order (non-strict mode)', async () => {
    const scorer = createToolCallAccuracyScorerCode({
      expectedTool: 'search-tool',
      expectedToolOrder: ['search-tool', 'weather-tool'],
      strictMode: false, // Even in flexible mode, order must be correct
    });

    const inputMessages = [createUIMessage({ content: 'Do a comprehensive check', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me do a comprehensive check.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-1',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C' },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-2',
            toolName: 'calendar-tool',
            args: { action: 'check' },
            result: { events: [] },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-3',
            toolName: 'search-tool',
            args: { query: 'info' },
            result: { results: ['info'] },
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.correctOrderCalled).toBe(false);
    expect(result.preprocessStepResult?.actualTools).toEqual(['weather-tool', 'calendar-tool', 'search-tool']);
  });

  test('should return 0 when not all expected tools are called in order checking', async () => {
    const scorer = createToolCallAccuracyScorerCode({
      expectedTool: 'search-tool',
      expectedToolOrder: ['search-tool', 'weather-tool', 'calendar-tool'],
      strictMode: false, // Flexible mode but still requires all expected tools
    });

    const inputMessages = [createUIMessage({ content: 'Search and check weather', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me search and check weather.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-1',
            toolName: 'search-tool',
            args: { query: 'info' },
            result: { results: ['info'] },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-2',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C' },
            state: 'result',
          }),
          // Missing calendar-tool
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0);
    expect(result.preprocessStepResult?.correctOrderCalled).toBe(false);
    expect(result.preprocessStepResult?.actualTools).toEqual(['search-tool', 'weather-tool']);
  });

  test('should return 0 when extra tools are called in strict order mode', async () => {
    const scorer = createToolCallAccuracyScorerCode({
      expectedTool: 'search-tool',
      expectedToolOrder: ['search-tool', 'weather-tool'],
      strictMode: true, // Strict mode - no extra tools allowed
    });

    const inputMessages = [createUIMessage({ content: 'Search, log, then get weather', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me search, log, and check weather.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-1',
            toolName: 'search-tool',
            args: { query: 'info' },
            result: { results: ['info'] },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-2',
            toolName: 'log-tool', // Extra tool - should fail in strict mode
            args: { message: 'Searching' },
            result: { logged: true },
            state: 'result',
          }),
          createToolInvocation({
            toolCallId: 'call-3',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C' },
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(0); // Fails because of extra tool in strict mode
    expect(result.preprocessStepResult?.correctOrderCalled).toBe(false);
    expect(result.preprocessStepResult?.actualTools).toEqual(['search-tool', 'log-tool', 'weather-tool']);
  });

  test('should fall back to original logic when expectedToolOrder is not provided', async () => {
    const scorer = createToolCallAccuracyScorerCode({ expectedTool: 'weather-tool' });

    const inputMessages = [createUIMessage({ content: 'What is the weather?', role: 'user', id: 'input-1' })];
    const output = [
      createUIMessage({
        content: 'Let me check the weather for you.',
        role: 'assistant',
        id: 'output-1',
        toolInvocations: [
          createToolInvocation({
            toolCallId: 'call-123',
            toolName: 'weather-tool',
            args: { location: 'New York' },
            result: { temperature: '20°C', condition: 'sunny' },
            state: 'result',
          }),
        ],
      }),
    ];

    const run = createAgentTestRun({ inputMessages, output });
    const result = await scorer.run(run);

    expect(result.score).toBe(1);
    expect(result.preprocessStepResult?.correctToolCalled).toBe(true);
    expect(result.preprocessStepResult?.correctOrderCalled).toBe(null); // No order checking
  });
});
