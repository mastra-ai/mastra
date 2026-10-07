import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { EventEmitterPubSub } from '../events/event-emitter';
import { RequestContext } from '../request-context';
import { Agent } from './agent';

function createTextStreamModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'ok' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function contextWithMarker(marker: string) {
  const requestContext = new RequestContext();
  requestContext.set('marker', marker);
  return requestContext;
}

async function markerSeenByWokenRun(
  options: { requestContext?: RequestContext; ifIdleRequestContext?: RequestContext },
  threadId: string,
) {
  const seen: unknown[] = [];
  const agent = new Agent({
    id: `ctx-agent-${threadId}`,
    name: 'Context Agent',
    instructions: ({ requestContext }) => {
      seen.push(requestContext.get('marker'));
      return 'Test';
    },
    model: createTextStreamModel(),
    pubsub: new EventEmitterPubSub(),
  });

  const result = agent.sendSignal(
    { type: 'user-message', contents: 'hello' },
    {
      resourceId: 'user-1',
      threadId,
      requestContext: options.requestContext,
      ifIdle: options.ifIdleRequestContext ? { streamOptions: { requestContext: options.ifIdleRequestContext } } : {},
    },
  );
  const accepted = await result.accepted;
  expect(accepted.action).toBe('wake');
  if (accepted.action === 'wake') await accepted.output.text;
  return seen;
}

describe('SendAgentSignalOptions.requestContext', () => {
  it('uses the top-level requestContext for the run an idle signal starts', async () => {
    const seen = await markerSeenByWokenRun({ requestContext: contextWithMarker('top') }, 'thread-top');
    expect(seen).toContain('top');
  });

  it('falls back to ifIdle.streamOptions.requestContext when no top-level context is set', async () => {
    const seen = await markerSeenByWokenRun({ ifIdleRequestContext: contextWithMarker('nested') }, 'thread-nested');
    expect(seen).toContain('nested');
  });

  it('prefers the top-level requestContext over ifIdle.streamOptions.requestContext', async () => {
    const seen = await markerSeenByWokenRun(
      { requestContext: contextWithMarker('top'), ifIdleRequestContext: contextWithMarker('nested') },
      'thread-both',
    );
    expect(seen).toContain('top');
    expect(seen).not.toContain('nested');
  });
});
