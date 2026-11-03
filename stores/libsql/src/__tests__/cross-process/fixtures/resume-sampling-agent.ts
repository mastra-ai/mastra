import { appendFileSync } from 'node:fs';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import type { ScoringHookInput } from '@mastra/core/evals';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import type { ScoreEvent, TracingEvent } from '@mastra/core/observability';
import { BaseExporter, MastraStorageExporter, Observability } from '@mastra/observability';
import { createStepAgent } from '../step-agent';

class Events extends BaseExporter {
  name = 'resume-sampling-events';
  constructor(
    private file: string,
    private role: string,
  ) {
    super({});
  }
  protected async _exportTracingEvent(event: TracingEvent) {
    appendFileSync(
      this.file,
      JSON.stringify({
        role: this.role,
        signal: 'span',
        event: event.type,
        type: event.exportedSpan.type,
        id: event.exportedSpan.id,
        outcome: event.exportedSpan.outcome,
        error: event.exportedSpan.errorInfo?.message,
      }) + '\n',
    );
  }
  async onScoreEvent(event: ScoreEvent) {
    appendFileSync(this.file, JSON.stringify({ role: this.role, signal: 'score', score: event.score }) + '\n');
  }
}
export const makeScorer = () =>
  createScorer({
    id: 'resume-sampling-scorer',
    name: 'resume-sampling-scorer',
    description: 'Score a real process run',
  }).generateScore(async () => {
    await new Promise(resolve => setTimeout(resolve, 250));
    return 1;
  });
export async function scoredAgent(id: string) {
  const { agent } = createStepAgent({ id, steps: 1, perRun: true });
  const scorer = makeScorer();
  return {
    agent: new Agent({
      id,
      name: id,
      instructions: 'Perform the numbered step, then answer.',
      model: await agent.getModel(),
      tools: await agent.listTools(),
      scorers: { s: { scorer } },
    }),
    scorer,
  };
}
export function allSignals(file: string, role: string, never = false) {
  if (role === 'worker')
    registerHook(AvailableHooks.ON_SCORER_RUN, (payload: ScoringHookInput) => {
      if (payload.scorer?.id === 'resume-sampling-scorer')
        appendFileSync(
          file,
          JSON.stringify({
            signal: 'hook',
            type: 'scorer_hook',
            role,
            currentSpanId: payload.tracing?.currentSpan?.id ?? null,
            isValid: payload.tracing?.currentSpan?.isValid ?? null,
          }) + '\n',
        );
    });
  return new Observability({
    configs: {
      default: {
        serviceName: 'xproc-resume-sampling',
        exporters: [new MastraStorageExporter({ strategy: 'insert-only', maxBatchWaitMs: 25 }), new Events(file, role)],
        ...(never ? { sampling: { type: 'custom' as const, sampler: () => false } } : {}),
      },
    },
  });
}
