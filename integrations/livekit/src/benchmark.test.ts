import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  runVoiceBenchmarks,
  summarizeVoiceBenchmarks,
  voiceBenchmarkObservationSchema,
  voiceBenchmarkToExperimentResult,
} from './benchmark';
import type { RunVoiceBenchmarksOptions } from './benchmark';

afterEach(() => vi.useRealTimers());

const base = {
  scenarios: [{ id: 'lookup', utterances: ['Find the answer.'], expectedText: '42', expectedTools: ['lookup'] }],
  mode: 'ci',
  measurement: 'simulation',
  startup: 'warm',
  versions: { livekit: '1.9.0', fixture: '1' },
} as const;
const config = () => ({
  ...base,
  scenarios: base.scenarios.map(scenario => ({
    ...scenario,
    utterances: [...scenario.utterances],
    expectedTools: [...scenario.expectedTools],
  })),
});

describe('voice benchmarks', () => {
  it('scores played answers separately from fast filler and generated text', async () => {
    const results = await runVoiceBenchmarks({
      ...config(),
      iterations: 2,
      run: async (_, { attempt }) => ({
        outcome: 'completed',
        measurement: 'simulation',
        tools: ['lookup'],
        generatedText: 'The answer is 42.',
        playedText: attempt ? 'The answer is 42.' : 'One moment.',
        firstAudioMs: 50,
        firstUsefulAnswerMs: attempt ? 1200 : undefined,
        completionMs: attempt ? 1600 : 100,
      }),
    });
    expect(results.map(result => result.success)).toEqual([false, true]);
    expect(summarizeVoiceBenchmarks(results)[0]).toMatchObject({
      samples: 2,
      successRate: 0.5,
      firstAudioMs: { samples: 2, p50: 50, p95: 50 },
      firstUsefulAnswerMs: { samples: 1, p50: 1200 },
    });
  });

  it('aborts stalled trials, counts failures in the denominator, and starts a fresh attempt', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const task = runVoiceBenchmarks({
      ...config(),
      iterations: 2,
      timeoutMs: 100,
      run: async (_, { attempt, signal }) => {
        signals.push(signal);
        if (attempt === 0) return new Promise(() => {});
        return {
          outcome: 'completed',
          measurement: 'simulation',
          playedText: '42',
          tools: ['lookup'],
          firstAudioMs: 20,
        };
      },
    });
    await vi.advanceTimersByTimeAsync(100);
    const results = await task;
    expect(signals[0]!.aborted).toBe(true);
    expect(results.map(result => result.outcome)).toEqual(['timed_out', 'completed']);
    expect(summarizeVoiceBenchmarks(results)[0]).toMatchObject({
      samples: 2,
      timeouts: 1,
      successRate: 0.5,
      firstAudioMs: { samples: 1 },
    });
  });

  it('keeps cold/warm runs and versions separate and supplies dataset attempt IDs', async () => {
    const run: RunVoiceBenchmarksOptions['run'] = async () => ({
      outcome: 'completed',
      measurement: 'simulation',
      playedText: '42',
      tools: ['lookup'],
      traceId: 'trace-1',
    });
    const a = await runVoiceBenchmarks({ ...config(), run, iterations: 2 });
    const b = await runVoiceBenchmarks({ ...config(), run, startup: 'cold' });
    const c = await runVoiceBenchmarks({ ...config(), run, versions: { livekit: 'other' } });
    expect(summarizeVoiceBenchmarks([...a, ...b, ...c])).toHaveLength(3);
    expect(voiceBenchmarkToExperimentResult(a[1]!, { experimentId: 'e', itemId: 'i' })).toMatchObject({
      attempt: 1,
      traceId: 'trace-1',
      scores: [{ scorerId: 'voice-benchmark-success', score: 1 }],
    });
  });

  it('validates impossible timelines and prevents simulated output from passing as real audio', async () => {
    expect(
      voiceBenchmarkObservationSchema.safeParse({
        outcome: 'completed',
        measurement: 'simulation',
        firstAudioMs: 100,
        firstUsefulAnswerMs: 20,
      }).success,
    ).toBe(false);
    expect(
      voiceBenchmarkObservationSchema.safeParse({
        outcome: 'interrupted',
        measurement: 'simulation',
        completionMs: 100,
      }).success,
    ).toBe(false);
    const results = await runVoiceBenchmarks({
      ...config(),
      mode: 'audio',
      measurement: 'server-playout',
      run: async () => ({ outcome: 'completed', measurement: 'simulation' }),
    });
    expect(results[0]).toMatchObject({ outcome: 'failed', success: false });
    expect(results[0]!.error?.message).toContain('measurement');
  });
});
