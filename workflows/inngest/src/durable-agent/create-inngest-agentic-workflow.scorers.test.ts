import { createDurableAgenticWorkflow } from '@mastra/core/agent/durable';
import { Inngest } from 'inngest';
import { describe, expect, it } from 'vitest';

import { createInngestDurableAgenticWorkflow } from './create-inngest-agentic-workflow';

/**
 * Regression coverage for #19843: an agent's scorers never ran on the Inngest
 * durable engine.
 *
 * The cause was drift, not logic — core's workflow gained an `execute-scorers`
 * step after the Inngest builder was copied from it, and nothing flagged the
 * gap. So this asserts the two builders agree on their steps rather than only
 * asserting the one step that happened to go missing; the next step core adds
 * fails here instead of silently going missing on Inngest.
 */
function stepIds(steps: any[]): string[] {
  return (steps ?? [])
    .flatMap((entry: any) => [entry.step?.id ?? entry.id, ...(entry.steps ? stepIds(entry.steps) : [])])
    .filter(Boolean);
}

describe('createInngestDurableAgenticWorkflow scorers', () => {
  const inngest = new Inngest({ id: 'inngest-agentic-workflow-scorer-tests' });
  const inngestStepIds = stepIds((createInngestDurableAgenticWorkflow({ inngest }) as any).executionGraph.steps);

  describe('when the workflow is built', () => {
    it('runs scorers after the run completes', () => {
      expect(inngestStepIds).toContain('execute-scorers');
    });

    it('runs them after the final output is mapped, so they score the finished run', () => {
      expect(inngestStepIds.indexOf('execute-scorers')).toBeGreaterThan(inngestStepIds.indexOf('map-final-output'));
    });
  });

  describe('when compared against the core durable engine', () => {
    it('does not lag core on the steps that run outside the agentic loop', () => {
      const coreStepIds = stepIds((createDurableAgenticWorkflow() as any).executionGraph.steps);

      expect(inngestStepIds).toEqual(coreStepIds);
    });
  });
});
