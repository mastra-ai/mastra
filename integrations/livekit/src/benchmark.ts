import { z } from 'zod';

const duration = z.number().finite().nonnegative();
export const voiceBenchmarkScenarioSchema = z.object({
  id: z.string().min(1),
  utterances: z.array(z.string().min(1)).min(1),
  expectedText: z.string().min(1).optional(),
  expectedTools: z.array(z.string().min(1)).default([]),
  expectedOutcome: z.enum(['completed', 'interrupted', 'failed']).default('completed'),
  toolDelayMs: duration.default(0),
  interruptAfterMs: duration.optional(),
  injectFailure: z.boolean().default(false),
});
export type VoiceBenchmarkScenario = z.infer<typeof voiceBenchmarkScenarioSchema>;

/** Fixtures for adapters using a deterministic lookup tool whose answer is "42". */
export const voiceBenchmarkScenarios: readonly VoiceBenchmarkScenario[] = [
  { id: 'simple-answer', utterances: ['Say hello.'], expectedText: 'hello' },
  { id: 'tool-lookup', utterances: ['Look up the answer.'], expectedTools: ['lookup'], expectedText: '42' },
  {
    id: 'slow-tool',
    utterances: ['Look up the answer.'],
    expectedTools: ['lookup'],
    expectedText: '42',
    toolDelayMs: 1000,
  },
  {
    id: 'interruption',
    utterances: ['Explain the result in detail.', 'Stop.'],
    interruptAfterMs: 250,
    expectedOutcome: 'interrupted',
  },
  { id: 'failure', utterances: ['Answer the question.'], injectFailure: true, expectedOutcome: 'failed' },
  {
    id: 'grounded-follow-up',
    utterances: ['Look up the answer.', 'Repeat the answer you found.'],
    expectedTools: ['lookup'],
    expectedText: '42',
  },
].map(scenario => Object.freeze(voiceBenchmarkScenarioSchema.parse(scenario)));

export const voiceBenchmarkObservationSchema = z
  .object({
    outcome: z.enum(['completed', 'interrupted', 'cancelled', 'failed']),
    measurement: z.enum(['simulation', 'server-playout', 'client-playout']),
    playedText: z.string().optional(),
    generatedText: z.string().optional(),
    tools: z.array(z.string()).default([]),
    /** Each latency is measured from caller speech end, in the same clock domain. */
    firstAudioMs: duration.optional(),
    firstUsefulAnswerMs: duration.optional(),
    completionMs: duration.optional(),
    traceId: z.string().optional(),
    cost: z.object({ amount: duration, currency: z.string().min(1), pricingVersion: z.string().min(1) }).optional(),
  })
  .superRefine((value, context) => {
    if (
      value.firstUsefulAnswerMs !== undefined &&
      value.firstAudioMs !== undefined &&
      value.firstUsefulAnswerMs < value.firstAudioMs
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Useful speech cannot precede first audio',
        path: ['firstUsefulAnswerMs'],
      });
    }
    if (value.completionMs !== undefined && value.outcome !== 'completed') {
      context.addIssue({
        code: 'custom',
        message: 'Only completed speech has completion latency',
        path: ['completionMs'],
      });
    }
    const first = value.firstUsefulAnswerMs ?? value.firstAudioMs;
    if (first !== undefined && value.completionMs !== undefined && value.completionMs < first) {
      context.addIssue({ code: 'custom', message: 'Completion cannot precede first speech', path: ['completionMs'] });
    }
  });
export type VoiceBenchmarkObservation = z.infer<typeof voiceBenchmarkObservationSchema>;

const runSchema = z
  .object({
    scenarios: z.array(voiceBenchmarkScenarioSchema).min(1),
    iterations: z.number().int().min(1).max(10000).default(1),
    timeoutMs: z.number().int().min(1).max(3600000).default(30000),
    mode: z.enum(['ci', 'audio']),
    measurement: z.enum(['simulation', 'server-playout', 'client-playout']),
    startup: z.enum(['cold', 'warm']),
    /** Include package, model, speech-provider, and scenario/adapter versions. */
    versions: z
      .record(z.string(), z.string().min(1))
      .refine(value => Object.keys(value).length > 0, 'Record at least one version'),
  })
  .refine(
    value => value.mode !== 'audio' || value.measurement !== 'simulation',
    'Audio mode requires audio measurements',
  )
  .refine(
    value => new Set(value.scenarios.map(scenario => scenario.id)).size === value.scenarios.length,
    'Scenario IDs must be unique',
  );

export interface VoiceBenchmarkResult {
  scenarioId: string;
  attempt: number;
  mode: 'ci' | 'audio';
  measurement: VoiceBenchmarkObservation['measurement'];
  startup: 'cold' | 'warm';
  versions: Record<string, string>;
  startedAt: Date;
  completedAt: Date;
  outcome: VoiceBenchmarkObservation['outcome'] | 'timed_out';
  success: boolean;
  observation?: VoiceBenchmarkObservation;
  error?: { message: string };
}

export interface RunVoiceBenchmarksOptions extends z.input<typeof runSchema> {
  /** Owns fake or real audio I/O. Must honor signal and release rooms/provider resources on abort. */
  run: (
    scenario: VoiceBenchmarkScenario,
    context: { signal: AbortSignal; attempt: number },
  ) => Promise<z.input<typeof voiceBenchmarkObservationSchema>>;
}

/** Sequential, opt-in runner. Its watchdog limits a trial, not production tool execution. */
export async function runVoiceBenchmarks(options: RunVoiceBenchmarksOptions): Promise<VoiceBenchmarkResult[]> {
  const config = runSchema.parse(options);
  const results: VoiceBenchmarkResult[] = [];
  for (const scenario of config.scenarios) {
    for (let attempt = 0; attempt < config.iterations; attempt++) {
      const controller = new AbortController();
      const startedAt = new Date();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result: VoiceBenchmarkResult = {
        scenarioId: scenario.id,
        attempt,
        mode: config.mode,
        measurement: config.measurement,
        startup: config.startup,
        versions: { ...config.versions },
        startedAt,
        completedAt: startedAt,
        outcome: 'failed',
        success: false,
      };
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            result.outcome = 'timed_out';
            controller.abort();
            reject(new Error('Voice benchmark timed out'));
          }, config.timeoutMs);
        });
        const observation = voiceBenchmarkObservationSchema.parse(
          await Promise.race([
            Promise.resolve().then(() => options.run(scenario, { signal: controller.signal, attempt })),
            timeout,
          ]),
        );
        if (observation.measurement !== config.measurement)
          throw new Error('Observation measurement must match the run configuration');
        result.observation = observation;
        result.outcome = observation.outcome;
        result.success =
          observation.outcome === scenario.expectedOutcome &&
          (!scenario.expectedText ||
            Boolean(observation.playedText?.toLowerCase().includes(scenario.expectedText.toLowerCase()))) &&
          scenario.expectedTools.every(tool => observation.tools.includes(tool));
      } catch (error) {
        result.error = { message: error instanceof Error ? error.message : String(error) };
      } finally {
        clearTimeout(timer);
        controller.abort();
        result.completedAt = new Date();
      }
      results.push(result);
    }
  }
  return results;
}

function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => (sorted.length ? sorted[Math.ceil(p * sorted.length) - 1] : undefined);
  return { samples: sorted.length, p50: percentile(0.5), p95: percentile(0.95) };
}

/** Never combine cold/warm, simulated/real, scenarios, or differently versioned runs. */
export function summarizeVoiceBenchmarks(results: readonly VoiceBenchmarkResult[]) {
  const groups = new Map<string, VoiceBenchmarkResult[]>();
  for (const result of results) {
    const key = JSON.stringify([
      result.scenarioId,
      result.mode,
      result.startup,
      result.measurement,
      Object.entries(result.versions).sort(([a], [b]) => a.localeCompare(b)),
    ]);
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    const first = group[0]!;
    const completed = group.filter(result => result.outcome === 'completed');
    const latencies = (key: 'firstAudioMs' | 'firstUsefulAnswerMs' | 'completionMs') =>
      distribution(
        completed
          .map(result => result.observation?.[key])
          .filter((n): n is number => n !== undefined && Number.isFinite(n) && n >= 0),
      );
    return {
      scenarioId: first.scenarioId,
      mode: first.mode,
      startup: first.startup,
      versions: first.versions,
      measurement: first.measurement,
      samples: group.length,
      completed: completed.length,
      successRate: group.filter(result => result.success).length / group.length,
      failures: group.filter(result => result.outcome === 'failed').length,
      timeouts: group.filter(result => result.outcome === 'timed_out').length,
      firstAudioMs: latencies('firstAudioMs'),
      firstUsefulAnswerMs: latencies('firstUsefulAnswerMs'),
      completionMs: latencies('completionMs'),
    };
  });
}

/** Pass the result to dataset.submitExperimentResult (Mastra core >=1.61). No dataset dependency is loaded. */
export function voiceBenchmarkToExperimentResult(
  result: VoiceBenchmarkResult,
  ids: { experimentId: string; itemId: string },
) {
  return {
    ...ids,
    attempt: result.attempt,
    output: result,
    traceId: result.observation?.traceId,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    error: result.error,
    scores: [{ scorerId: 'voice-benchmark-success', score: result.success ? 1 : 0 }],
  };
}
