import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../../memory';
import { createIterationCompleteContext, createIterationFeedbackMessage } from './iteration-context';

describe('shared iteration hook payloads', () => {
  it('projects tool calls with legacy and current field names without changing result fields', () => {
    const toolResults = [{ id: 'call-1', name: 'lookup', result: { answer: 42 } }];
    const messages: MastraDBMessage[] = [];
    const context = createIterationCompleteContext({
      iteration: 2,
      maxIterations: 5,
      text: 'done',
      toolCalls: [
        { toolCallId: 'call-1', toolName: 'lookup', args: { query: 'answer' } },
        { id: 'call-2', name: 'fallback' },
      ],
      toolResults,
      isFinal: true,
      finishReason: 'stop',
      runId: 'run-1',
      agentId: 'agent-1',
      messages,
    });

    expect(context).toEqual({
      iteration: 2,
      maxIterations: 5,
      text: 'done',
      toolCalls: [
        { id: 'call-1', name: 'lookup', args: { query: 'answer' } },
        { id: 'call-2', name: 'fallback', args: {} },
      ],
      toolResults,
      isFinal: true,
      finishReason: 'stop',
      runId: 'run-1',
      agentId: 'agent-1',
      agentName: 'agent-1',
      messages,
    });
  });

  it('marks feedback as synthetic so completion scorers skip it', () => {
    expect(createIterationFeedbackMessage('feedback-1', 'Try again')).toMatchObject({
      id: 'feedback-1',
      role: 'assistant',
      content: {
        parts: [{ type: 'text', text: 'Try again' }],
        metadata: { mode: 'stream', completionResult: { suppressFeedback: true } },
        format: 2,
      },
    });
  });
});
