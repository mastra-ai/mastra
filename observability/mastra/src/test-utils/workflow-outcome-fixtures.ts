import { TripWire } from '@mastra/core/agent';
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod/v4';

export const controlFlowResumeKinds = ['parallel', 'conditional', 'until', 'while', 'foreach'] as const;
export type ControlFlowResumeKind = (typeof controlFlowResumeKinds)[number];

export function createResumeSeed() {
  return createStep({
    id: 'resume-seed',
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({})),
    execute: async () => [{}],
  });
}

export const resumeActions = ['success', 'error', 'tripwire', 'suspend'] as const;
export type ResumeAction = (typeof resumeActions)[number];

export function createResumeOutcomeStep() {
  return createStep({
    id: 'decision-suspend',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    suspendSchema: z.object({}),
    resumeSchema: z.object({ action: z.enum(resumeActions) }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData || resumeData.action === 'suspend') return suspend({});
      if (resumeData.action === 'error') throw new Error('Resumed execution failed');
      if (resumeData.action === 'tripwire') throw new TripWire('Policy rejected', {}, 'policy');
      return {};
    },
  });
}

export function expectedResumeOutcomes(action: ResumeAction) {
  return action === 'suspend'
    ? (['suspend', 'suspend', 'success'] as const)
    : (['suspend', action === 'tripwire' ? 'blocked' : action] as const);
}

export const workflowOutcomeModes = ['success', 'error', 'retry', 'bail', 'tripwire', 'suspend'] as const;
export type WorkflowOutcomeMode = (typeof workflowOutcomeModes)[number];

/** Shared real step behavior for local, evented and remote workflow engines. */
export function createOutcomeStep(mode: WorkflowOutcomeMode, id = `decision-${mode}`, succeedFirst = false) {
  let attempts = 0;
  const step = createStep({
    id,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    resumeSchema: z.object({}),
    suspendSchema: z.object({}),
    execute: async ({ bail, suspend, resumeData }) => {
      attempts++;
      if (succeedFirst && attempts === 1) return {};
      if (mode === 'suspend' && !resumeData) return suspend({});
      if (mode === 'tripwire') throw new TripWire('Policy rejected', {}, 'policy');
      if (mode === 'bail') return bail({});
      if (mode === 'error' || (mode === 'retry' && attempts === 1)) throw new Error('Execution failed');
      return {};
    },
  });
  return { step, attempts: () => attempts };
}
