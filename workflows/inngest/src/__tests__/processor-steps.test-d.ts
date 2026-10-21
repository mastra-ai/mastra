/**
 * Type-level regression test for github.com/mastra-ai/mastra/issues/27577:
 * processor steps from `init().createStep(processor)` must chain with `.then()`.
 */
import { BatchPartsProcessor, ProcessorStepSchema, TokenLimiterProcessor } from '@mastra/core/processors';
import { Inngest } from 'inngest';
import { describe, it } from 'vitest';

import { init } from '../index';

const inngest = new Inngest({ id: 'processor-type-tests', isDev: true });
const { createWorkflow, createStep } = init(inngest);

describe('inngest processor steps', () => {
  it('chains processor steps with .then()', () => {
    createWorkflow({
      id: 'output-guardrails',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(createStep(new TokenLimiterProcessor({ limit: 1000 })))
      .then(createStep(new BatchPartsProcessor()))
      .then(createStep(new TokenLimiterProcessor({ limit: 500 })))
      .commit();
  });
});
