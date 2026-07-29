import { ReadableStream } from 'node:stream/web';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../../agent/message-list';
import type { ChunkType } from '../types';
import { MastraModelOutput } from './output';
import { compactStreamStateRequestBodies, expandStreamStateRequestBodies } from './serialized-state';

function makeSteps(bodies: unknown[]) {
  return bodies.map((body, index) => ({
    text: `step-${index}`,
    request: { body, headers: { 'x-step': String(index) } },
  }));
}

describe('serialized model-output state', () => {
  it('deduplicates only repeated request bodies and round-trips without mutation', () => {
    const repeatedBody = { tools: [{ description: 'x'.repeat(100_000) }], system: 'instructions' };
    const uniqueBody = { messages: ['unique'] };
    const state = {
      status: 'suspended',
      bufferedSteps: makeSteps([repeatedBody, repeatedBody, uniqueBody, repeatedBody]),
    };
    const before = structuredClone(state);

    const compacted = compactStreamStateRequestBodies(state);

    expect(state).toEqual(before);
    expect(JSON.stringify(compacted).length).toBeLessThan(JSON.stringify(state).length * 0.4);
    expect((compacted as any).bufferedSteps[2].request.body).toEqual(uniqueBody);
    expect(expandStreamStateRequestBodies(compacted)).toEqual(state);
  });

  it('leaves states without duplicate JSON request bodies unchanged', () => {
    const state = {
      status: 'suspended',
      bufferedSteps: makeSteps([{ value: 1 }, { value: 2 }]),
    };

    expect(compactStreamStateRequestBodies(state)).toBe(state);
    expect(expandStreamStateRequestBodies(state)).toBe(state);
  });

  it('expands compacted request bodies before MastraModelOutput resumes', () => {
    const messageList = new MessageList({ threadId: 'request-body-resume' });
    const stream = new ReadableStream<ChunkType>({
      start(controller) {
        controller.close();
      },
    });
    const baseOutput = new MastraModelOutput({
      model: { modelId: 'test-model', provider: 'test', version: 'v3' },
      stream,
      messageList,
      messageId: 'message-id',
      options: { runId: 'request-body-resume' },
    });
    const repeatedBody = { tools: [{ description: 'large schema' }], system: 'instructions' };
    const initialState = {
      ...baseOutput.serializeState(),
      status: 'suspended',
      bufferedSteps: makeSteps([repeatedBody, repeatedBody]),
    };
    const compacted = compactStreamStateRequestBodies(initialState);

    const resumedOutput = new MastraModelOutput({
      model: { modelId: 'test-model', provider: 'test', version: 'v3' },
      stream: new ReadableStream<ChunkType>({
        start(controller) {
          controller.close();
        },
      }),
      messageList: new MessageList({ threadId: 'request-body-resume' }),
      messageId: 'message-id',
      options: { runId: 'request-body-resume' },
      initialState: compacted,
    });

    expect(resumedOutput.serializeState().bufferedSteps).toEqual(initialState.bufferedSteps);
  });
});
