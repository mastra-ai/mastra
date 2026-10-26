/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/26997
 *
 * A subscriber that surfaced a run's suspension prompt must see exactly one
 * `abort` when that run is aborted while parked, even when the abort lands
 * while the subscriber is still holding the suspended stream, or after a
 * partial resume left another suspension pending.
 */
import { describe, expect, it } from 'vitest';

import { AGENT_THREAD_KEY_SEPARATOR, createHarness, nextTicks, setupRuntime } from './thread-stream-test-utils';

const harness = createHarness('parked-abort');
const { runId, streamId, resourceId, threadId } = harness;
const key = [resourceId, threadId].join(AGENT_THREAD_KEY_SEPARATOR);
const resumedStreamId = `${streamId}-resumed`;

const suspendedPart = (toolCallId: string) => ({
  type: 'tool-call-suspended',
  payload: { toolCallId, toolName: 'confirmAction', suspendPayload: {} },
});
const suspendedFinish = {
  type: 'finish',
  payload: { stepResult: { reason: 'suspended' }, output: { usage: {} }, metadata: {} },
};

const setup = async () => {
  const { runtime, pubsub, emit } = setupRuntime(harness);
  pubsub.owners.set(key, runId);
  const part = (stream: string, value: unknown) =>
    emit({ type: 'stream-part', runId, streamId: stream, sourceId: 'origin', part: value });
  const subscription = await runtime.subscribeToThread(harness.agent, { threadId, resourceId }, pubsub);
  const iterator = subscription.stream[Symbol.asyncIterator]();
  const collected: Array<{ type: string }> = [];
  const pull = async () => {
    const next = await iterator.next();
    if (!next.done) collected.push(next.value as { type: string });
    return next;
  };
  // Consumption starts on `resume()` so a test can hold the subscriber mid-stream.
  let consuming: Promise<void> = Promise.resolve();
  const resume = () => {
    consuming = (async () => {
      while (!(await pull()).done) {}
    })();
  };
  const close = async () => {
    subscription.unsubscribe();
    await consuming;
  };
  return { emit, part, pull, resume, close, collected };
};

const aborts = (collected: Array<{ type: string }>) => collected.filter(part => part.type === 'abort').length;

describe('thread stream: run aborted while parked', () => {
  it('yields one abort when the run is aborted while the subscriber still holds the suspended stream', async () => {
    const { emit, part, pull, resume, close, collected } = await setup();

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await part(streamId, { type: 'start', payload: {} });
    await part(streamId, suspendedPart('call-1'));
    await part(streamId, suspendedFinish);
    // Hold the subscriber right after the prompt.
    while (collected.at(-1)?.type !== 'tool-call-suspended') await pull();

    await emit({ type: 'run-suspended', runId, streamId });
    await emit({ type: 'run-registered', runId, streamId: resumedStreamId, streamSeq: 2 });
    await emit({ type: 'run-aborted', runId, streamId: resumedStreamId });
    await nextTicks();

    resume();
    await nextTicks(20);

    expect(aborts(collected)).toBe(1);
    await close();
  });

  it('yields one abort when the run is aborted after a partial resume left a suspension pending', async () => {
    const { emit, part, resume, close, collected } = await setup();
    resume();

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await part(streamId, { type: 'start', payload: {} });
    await part(streamId, suspendedPart('call-1'));
    await part(streamId, suspendedPart('call-2'));
    await part(streamId, suspendedFinish);
    await emit({ type: 'run-suspended', runId, streamId });
    await nextTicks(20);

    // call-1 is answered; the resumed segment parks again on call-2.
    await emit({ type: 'run-registered', runId, streamId: resumedStreamId, streamSeq: 2 });
    await part(resumedStreamId, { type: 'start', payload: {} });
    await part(resumedStreamId, suspendedFinish);
    await emit({ type: 'run-suspended', runId, streamId: resumedStreamId });
    await nextTicks(20);
    expect(aborts(collected)).toBe(0);

    await emit({ type: 'run-aborted', runId, streamId: resumedStreamId });
    await nextTicks(20);

    expect(aborts(collected)).toBe(1);
    await close();
  });

  it('does not add an abort when the aborted stream carried its own abort chunk', async () => {
    const { emit, part, resume, close, collected } = await setup();
    resume();

    await emit({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    await part(streamId, { type: 'start', payload: {} });
    await part(streamId, suspendedPart('call-1'));
    await part(streamId, suspendedFinish);
    await emit({ type: 'run-suspended', runId, streamId });
    await nextTicks(20);

    await emit({ type: 'run-registered', runId, streamId: resumedStreamId, streamSeq: 2 });
    await part(resumedStreamId, { type: 'start', payload: {} });
    await part(resumedStreamId, { type: 'abort', payload: {} });
    await nextTicks(20);
    await emit({ type: 'run-aborted', runId, streamId: resumedStreamId });
    await nextTicks(20);

    expect(aborts(collected)).toBe(1);
    await close();
  });
});
