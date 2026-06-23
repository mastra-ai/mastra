import { describe, expect, test } from 'vitest';
import { createAgentTestRun, createTestMessage, createToolInvocation } from '../../utils';
import {
  checks,
  includes,
  excludes,
  equals,
  matches,
  similarity,
  calledTool,
  didNotCall,
  toolOrder,
  maxToolCalls,
  usedNoTools,
  noToolErrors,
} from './index';

// ─── includes ─────────────────────────────────────────────────────────────────

describe('checks.includes', () => {
  test('should score 1 when output contains the expected text (case-insensitive)', async () => {
    const scorer = checks.includes('sunny');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'What is the weather?', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'It is Sunny and warm today.', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when output does not contain the expected text', async () => {
    const scorer = checks.includes('rainy');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'What is the weather?', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'It is sunny and warm.', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('should respect ignoreCase: false', async () => {
    const scorer = checks.includes('Sunny', { ignoreCase: false });
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Weather?', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'It is sunny and warm.', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('named export matches namespace', () => {
    expect(includes).toBe(checks.includes);
  });
});

// ─── excludes ─────────────────────────────────────────────────────────────────

describe('checks.excludes', () => {
  test('should score 1 when output does not contain the unwanted text', async () => {
    const scorer = checks.excludes('error');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Hello', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'Hi there! How can I help?', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when output contains the unwanted text', async () => {
    const scorer = checks.excludes('error');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Hello', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'An error occurred while processing.', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('named export matches namespace', () => {
    expect(excludes).toBe(checks.excludes);
  });
});

// ─── equals ───────────────────────────────────────────────────────────────────

describe('checks.equals', () => {
  test('should score 1 when output exactly matches (case-insensitive)', async () => {
    const scorer = checks.equals('Hello, world!');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Greet me', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'hello, world!', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when output does not exactly match', async () => {
    const scorer = checks.equals('Hello, world!');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Greet me', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'Hello, world! How are you?', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('should respect ignoreCase: false', async () => {
    const scorer = checks.equals('Hello', { ignoreCase: false });
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Greet', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'hello', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('named export matches namespace', () => {
    expect(equals).toBe(checks.equals);
  });
});

// ─── matches ──────────────────────────────────────────────────────────────────

describe('checks.matches', () => {
  test('should score 1 when output matches the regex pattern', async () => {
    const scorer = checks.matches(/\d+°[FC]/);
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Temp?', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'The temperature is 72°F today.', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when output does not match the regex', async () => {
    const scorer = checks.matches(/\d+°[FC]/);
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Temp?', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'It is warm outside.', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('exact mode anchors the pattern', async () => {
    const scorer = checks.matches(/hello/, { exact: true });
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Greet', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'say hello world', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('named export matches namespace', () => {
    expect(matches).toBe(checks.matches);
  });
});

// ─── similarity ───────────────────────────────────────────────────────────────

describe('checks.similarity', () => {
  test('should return a score between 0 and 1', async () => {
    const scorer = checks.similarity('Sunny, 72°F');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Weather?', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'Sunny, 73°F', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBeGreaterThan(0.5);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  test('should return 1 for identical strings', async () => {
    const scorer = checks.similarity('hello world');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Say hi', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'hello world', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should return close to 0 for completely different strings', async () => {
    const scorer = checks.similarity('abcdefgh');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Test', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'xyz12345', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBeLessThan(0.3);
  });

  test('named export matches namespace', () => {
    expect(similarity).toBe(checks.similarity);
  });
});

// ─── calledTool ───────────────────────────────────────────────────────────────

describe('checks.calledTool', () => {
  test('should score 1 when the specified tool was called', async () => {
    const scorer = checks.calledTool('get_weather');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Weather?', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Checking weather...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'c1',
              toolName: 'get_weather',
              args: { city: 'NYC' },
              result: { temp: 72 },
              state: 'result',
            }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when the specified tool was not called', async () => {
    const scorer = checks.calledTool('get_weather');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Weather?', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Let me search...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'c1',
              toolName: 'search',
              args: {},
              result: {},
              state: 'result',
            }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('should respect times option', async () => {
    const scorer = checks.calledTool('search', { times: 2 });
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Search', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Searching...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({ toolCallId: 'c1', toolName: 'search', args: {}, result: {}, state: 'result' }),
            createToolInvocation({ toolCallId: 'c2', toolName: 'search', args: {}, result: {}, state: 'result' }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when tool called fewer than required times', async () => {
    const scorer = checks.calledTool('search', { times: 3 });
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Search', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Searching...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({ toolCallId: 'c1', toolName: 'search', args: {}, result: {}, state: 'result' }),
            createToolInvocation({ toolCallId: 'c2', toolName: 'search', args: {}, result: {}, state: 'result' }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('named export matches namespace', () => {
    expect(calledTool).toBe(checks.calledTool);
  });
});

// ─── didNotCall ───────────────────────────────────────────────────────────────

describe('checks.didNotCall', () => {
  test('should score 1 when the tool was not called', async () => {
    const scorer = checks.didNotCall('delete_user');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Hello', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'Hi there!', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when the tool was called', async () => {
    const scorer = checks.didNotCall('delete_user');
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Delete my account', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Deleting...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'c1',
              toolName: 'delete_user',
              args: {},
              result: {},
              state: 'result',
            }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('named export matches namespace', () => {
    expect(didNotCall).toBe(checks.didNotCall);
  });
});

// ─── toolOrder ────────────────────────────────────────────────────────────────

describe('checks.toolOrder', () => {
  test('should score 1 when tools are called in expected order', async () => {
    const scorer = checks.toolOrder(['search', 'summarize']);
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Research this', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Working on it...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({ toolCallId: 'c1', toolName: 'search', args: {}, result: {}, state: 'result' }),
            createToolInvocation({ toolCallId: 'c2', toolName: 'summarize', args: {}, result: {}, state: 'result' }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 1 with extra tools in between (relaxed)', async () => {
    const scorer = checks.toolOrder(['search', 'summarize']);
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Research', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Working...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({ toolCallId: 'c1', toolName: 'search', args: {}, result: {}, state: 'result' }),
            createToolInvocation({ toolCallId: 'c2', toolName: 'validate', args: {}, result: {}, state: 'result' }),
            createToolInvocation({ toolCallId: 'c3', toolName: 'summarize', args: {}, result: {}, state: 'result' }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when tools are called in wrong order', async () => {
    const scorer = checks.toolOrder(['search', 'summarize']);
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Research', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Working...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({ toolCallId: 'c1', toolName: 'summarize', args: {}, result: {}, state: 'result' }),
            createToolInvocation({ toolCallId: 'c2', toolName: 'search', args: {}, result: {}, state: 'result' }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('should score 0 when a required tool is missing', async () => {
    const scorer = checks.toolOrder(['search', 'summarize']);
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Research', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Working...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({ toolCallId: 'c1', toolName: 'search', args: {}, result: {}, state: 'result' }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('named export matches namespace', () => {
    expect(toolOrder).toBe(checks.toolOrder);
  });
});

// ─── maxToolCalls ─────────────────────────────────────────────────────────────

describe('checks.maxToolCalls', () => {
  test('should score 1 when tool calls are within limit', async () => {
    const scorer = checks.maxToolCalls(3);
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Do something', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Done.',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({ toolCallId: 'c1', toolName: 'a', args: {}, result: {}, state: 'result' }),
            createToolInvocation({ toolCallId: 'c2', toolName: 'b', args: {}, result: {}, state: 'result' }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when tool calls exceed limit', async () => {
    const scorer = checks.maxToolCalls(1);
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Do something', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Done.',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({ toolCallId: 'c1', toolName: 'a', args: {}, result: {}, state: 'result' }),
            createToolInvocation({ toolCallId: 'c2', toolName: 'b', args: {}, result: {}, state: 'result' }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('named export matches namespace', () => {
    expect(maxToolCalls).toBe(checks.maxToolCalls);
  });
});

// ─── usedNoTools ──────────────────────────────────────────────────────────────

describe('checks.usedNoTools', () => {
  test('should score 1 when no tools were used', async () => {
    const scorer = checks.usedNoTools();
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Hello', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'Hi! How can I help?', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when tools were used', async () => {
    const scorer = checks.usedNoTools();
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Hello', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Checking...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({ toolCallId: 'c1', toolName: 'check', args: {}, result: {}, state: 'result' }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('named export matches namespace', () => {
    expect(usedNoTools).toBe(checks.usedNoTools);
  });
});

// ─── noToolErrors ─────────────────────────────────────────────────────────────

describe('checks.noToolErrors', () => {
  test('should score 1 when all tool calls succeeded', async () => {
    const scorer = checks.noToolErrors();
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Do stuff', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Done!',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'c1',
              toolName: 'search',
              args: {},
              result: { data: 'found' },
              state: 'result',
            }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('should score 0 when a tool call has an error result', async () => {
    const scorer = checks.noToolErrors();
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Do stuff', role: 'user', id: 'i1' })],
      output: [
        createTestMessage({
          content: 'Trying...',
          role: 'assistant',
          id: 'o1',
          toolInvocations: [
            createToolInvocation({
              toolCallId: 'c1',
              toolName: 'search',
              args: {},
              result: { error: 'Network timeout' },
              state: 'result',
            }),
          ],
        }),
      ],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(0);
  });

  test('should score 1 when no tools were called at all', async () => {
    const scorer = checks.noToolErrors();
    const run = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Hello', role: 'user', id: 'i1' })],
      output: [createTestMessage({ content: 'Hi!', role: 'assistant', id: 'o1' })],
    });

    const result = await scorer.run(run);
    expect(result.score).toBe(1);
  });

  test('named export matches namespace', () => {
    expect(noToolErrors).toBe(checks.noToolErrors);
  });
});
