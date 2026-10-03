import { describe, expect, it, vi } from 'vitest';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { bindModelAttempt, getModelAttempt, ModelAttempt } from './model-attempt';

function createAttempt(runSignal?: AbortSignal) {
  let notify!: () => void;
  const unsubscribe = vi.fn();
  const attempt = new ModelAttempt(runSignal, listener => {
    notify = listener;
    return unsubscribe;
  });
  return { attempt, notify, unsubscribe };
}

describe('private model attempt cancellation', () => {
  it('subscribes before arming without wasting an attempt on already queued input', () => {
    const { attempt, notify, unsubscribe } = createAttempt();
    notify();
    expect(attempt.discarded).toBe(false);
    expect(attempt.controller.signal.aborted).toBe(false);
    attempt.arm();
    notify();
    expect(attempt.discarded).toBe(true);
    expect(attempt.controller.signal.aborted).toBe(true);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    notify();
    attempt.dispose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it.each(['reasoning-start', 'reasoning-delta', 'reasoning-end', 'response-metadata', 'raw', 'step-start', 'finish'])(
    'remains preemptible after %s, including completed reasoning',
    type => {
      const run = new AbortController();
      const { attempt, notify } = createAttempt(run.signal);
      attempt.arm();
      expect(attempt.observe({ type })).toBe(true);
      notify();
      expect(attempt.discarded).toBe(true);
      expect(run.signal.aborted).toBe(false);
      attempt.dispose();
    },
  );

  it.each([
    'text-start',
    'text-delta',
    'text-end',
    'tool-call-input-streaming-start',
    'tool-call-input-streaming-end',
    'tool-call-delta',
    'tool-call',
    'tool-result',
    'tool-error',
    'object',
    'object-result',
    'file',
    'source',
  ])('protects %s before any downstream processor runs', type => {
    const { attempt, notify, unsubscribe } = createAttempt();
    attempt.arm();
    expect(attempt.observe({ type })).toBe(true);
    notify();
    expect(attempt.discarded).toBe(false);
    expect(attempt.controller.signal.aborted).toBe(false);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    attempt.dispose();
  });

  it('rejects buffered provider output, writer output and acceptance after discard', () => {
    const { attempt, notify } = createAttempt();
    attempt.arm();
    notify();
    expect(attempt.observe({ type: 'text-start' })).toBe(false);
    expect(attempt.observeWriter({ type: 'data-custom' })).toBe(false);
    attempt.accept();
    expect(attempt.discarded).toBe(true);
    attempt.dispose();
  });

  it('protects processor-written data without treating raw data diagnostics as acceptance', () => {
    const { attempt, notify } = createAttempt();
    attempt.arm();
    expect(attempt.observe({ type: 'data-custom' })).toBe(true);
    expect(attempt.observeWriter({ type: 'data-custom' })).toBe(true);
    notify();
    expect(attempt.discarded).toBe(false);
    attempt.dispose();
  });

  it.each(['data-signal', 'data-user-message', 'data-custom'])(
    'does not let input echoes or transient %s diagnostics protect a model call',
    type => {
      const { attempt, notify } = createAttempt();
      attempt.arm();
      expect(attempt.observeWriter({ type, transient: true })).toBe(true);
      notify();
      expect(attempt.discarded).toBe(true);
      attempt.dispose();
    },
  );

  it.each([
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, reasoningTokens: 0 },
    { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
    { inputTokens: 5, outputTokens: undefined, totalTokens: undefined, reasoningTokens: 2 },
  ])('preserves reported usage without normalizing omitted measurements: %j', usage => {
    const { attempt, notify } = createAttempt();
    attempt.arm();
    attempt.observeRaw({
      type: 'finish',
      runId: 'run',
      from: ChunkFrom.AGENT,
      payload: {
        stepResult: { reason: 'stop' },
        output: { usage },
        metadata: {},
        messages: { all: [], user: [], nonUser: [] },
      },
    });
    notify();
    expect(attempt.discarded).toBe(true);
    expect(attempt.usage).toEqual(usage);
    attempt.dispose();
  });

  it('clears a failed model measurement before a fallback can be preempted', () => {
    const { attempt, notify } = createAttempt();
    attempt.arm();
    attempt.startModel('primary', 0);
    attempt.observeRaw({
      type: 'step-start',
      runId: 'run',
      from: ChunkFrom.AGENT,
      payload: {
        request: { body: 'primary-request' },
        warnings: [{ type: 'other', message: 'primary-warning' }],
        messageId: 'response',
      },
    });
    attempt.observeRaw({
      type: 'finish',
      runId: 'run',
      from: ChunkFrom.AGENT,
      payload: {
        stepResult: { reason: 'error' },
        output: { usage: { inputTokens: 11, outputTokens: 12, totalTokens: 23 } },
        metadata: {},
        messages: { all: [], user: [], nonUser: [] },
      },
    });
    attempt.startModel('fallback', 1);
    notify();
    expect(attempt.discarded).toBe(true);
    expect(attempt.modelId).toBe('fallback');
    expect(attempt.fallbackModelIndex).toBe(1);
    expect(attempt.usage).toEqual({ inputTokens: undefined, outputTokens: undefined, totalTokens: undefined });
    expect(attempt.request).toBeUndefined();
    expect(attempt.warnings).toEqual([]);
    attempt.dispose();
  });

  it('accepts natural reasoning-only completion before response hooks', () => {
    const { attempt, notify, unsubscribe } = createAttempt();
    attempt.arm();
    attempt.accept();
    notify();
    expect(attempt.discarded).toBe(false);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    attempt.dispose();
  });

  it('propagates genuine run cancellation to the child without misclassifying it', () => {
    const run = new AbortController();
    const { attempt, notify, unsubscribe } = createAttempt(run.signal);
    attempt.arm();
    const reason = new Error('user cancelled');
    run.abort(reason);
    notify();
    expect(attempt.discarded).toBe(false);
    expect(attempt.controller.signal.reason).toBe(reason);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    attempt.dispose();
  });

  it('never resurrects discarded output when run cancellation arrives later', () => {
    const run = new AbortController();
    const { attempt, notify } = createAttempt(run.signal);
    attempt.arm();
    notify();
    run.abort(new Error('total timeout'));
    expect(attempt.discarded).toBe(true);
    expect(attempt.observe({ type: 'reasoning-delta' })).toBe(false);
    attempt.dispose();
  });

  it('detaches parent cancellation on disposal', () => {
    const run = new AbortController();
    const { attempt, unsubscribe } = createAttempt(run.signal);
    attempt.dispose();
    run.abort();
    expect(attempt.controller.signal.aborted).toBe(false);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('closes only emitted open reasoning blocks without provider signatures or duplicate endings', () => {
    const { attempt, notify } = createAttempt();
    const start = (id: string): ChunkType => ({
      type: 'reasoning-start',
      runId: 'run',
      from: ChunkFrom.AGENT,
      payload: { id, providerMetadata: { anthropic: { signature: 'synthetic-signature' } } },
    });
    attempt.arm();
    attempt.recordEmitted(start('closed'));
    attempt.recordEmitted({ type: 'reasoning-end', runId: 'run', from: ChunkFrom.AGENT, payload: { id: 'closed' } });
    attempt.recordEmitted(start('open'));
    notify();
    const emit = vi.fn();
    attempt.closeReasoning(emit);
    attempt.closeReasoning(emit);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({
      type: 'reasoning-end',
      runId: 'run',
      from: ChunkFrom.AGENT,
      payload: { id: 'open' },
    });
    attempt.dispose();
  });

  it.each(['discarded', 'accepted'])(
    'releases %s attempt ownership from reusable processor buffers before lifecycle chunks',
    async outcome => {
      const { attempt, notify } = createAttempt();
      const parts = ['prior accepted'];
      attempt.arm();
      attempt.trackParts(parts);
      parts.push('attempt output');
      expect(getModelAttempt(parts)).toBe(attempt);
      if (outcome === 'discarded') {
        notify();
        await attempt.discardOutput();
        expect(parts).toEqual(['prior accepted']);
        expect(getModelAttempt(parts)).toBeUndefined();
      } else {
        attempt.accept();
      }
      attempt.dispose();
      expect(getModelAttempt(parts)).toBeUndefined();
      const replacement = createAttempt();
      replacement.attempt.trackParts(parts);
      expect(getModelAttempt(parts)).toBe(replacement.attempt);
      replacement.attempt.dispose();
    },
  );

  it('keeps the original attempt identity attached to its stream after replacement', () => {
    const { attempt, notify } = createAttempt();
    const stream = new ReadableStream();
    bindModelAttempt(stream, attempt);
    attempt.arm();
    notify();
    const replacement = createAttempt().attempt;
    const replacementStream = new ReadableStream();
    bindModelAttempt(replacementStream, replacement);
    expect(getModelAttempt(stream)).toBe(attempt);
    expect(getModelAttempt(stream)?.discarded).toBe(true);
    expect(getModelAttempt(replacementStream)).toBe(replacement);
    expect(getModelAttempt({})).toBeUndefined();
    attempt.dispose();
    replacement.dispose();
  });
});
