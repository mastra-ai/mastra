import { describe, expect, it } from 'vitest';

import { API_COMMANDS } from './commands.js';
import { normalizeData } from './normalizers.js';

describe('normalizeData', () => {
  it('keeps agent run output to stable fields without duplicating the raw response', () => {
    expect(
      normalizeData(API_COMMANDS.agentRun, {
        text: 'hello',
        result: 'duplicate text',
        object: { answer: 42 },
        usage: { totalTokens: 10 },
        toolCalls: [{ toolName: 'weather' }],
        toolResults: [{ result: 'sunny' }],
        finishReason: 'stop',
        runId: 'run-1',
        traceId: 'trace-1',
        spanId: 'span-1',
        rawProviderPayload: { huge: true },
      }),
    ).toEqual({
      text: 'hello',
      structuredOutput: { answer: 42 },
      usage: { totalTokens: 10 },
      toolCalls: [{ toolName: 'weather' }],
      toolResults: [{ result: 'sunny' }],
      finishReason: 'stop',
      runId: 'run-1',
      traceId: 'trace-1',
      spanId: 'span-1',
    });
  });

  it('normalizes workflow run status aliases inside run responses', () => {
    expect(
      normalizeData(API_COMMANDS.workflowRunGet, {
        status: 'completed',
        steps: [{ status: 'waiting' }, { status: 'error' }],
      }),
    ).toEqual({
      status: 'success',
      steps: [{ status: 'suspended' }, { status: 'failed' }],
    });
  });

  it('adds a stable tool inputSchema when the server returns parameters', () => {
    const schema = { type: 'object' };

    expect(normalizeData(API_COMMANDS.toolGet, { id: 'weather', parameters: schema })).toEqual({
      id: 'weather',
      inputSchema: schema,
      parameters: schema,
    });
  });
});
