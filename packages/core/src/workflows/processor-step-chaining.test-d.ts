import { describe, expectTypeOf, it } from 'vitest';

import type { Processor } from '../processors';
import { BatchPartsProcessor, ModerationProcessor, PIIDetector, TokenLimiterProcessor } from '../processors/processors';
import { ProcessorStepSchema } from '../processors/step-schema';
import type { ProcessorStepInputType, ProcessorStepOutputType } from '../processors/step-schema';
import { createWorkflow } from './create';
import { createStep } from './workflow';

describe('createStep(processor) chaining', () => {
  it('accepts the guardrails docs chain of built-in processors', () => {
    const workflow = createWorkflow({
      id: 'output-guardrails',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(createStep(new TokenLimiterProcessor({ limit: 1000 })))
      .then(createStep(new BatchPartsProcessor()))
      .parallel([
        createStep(new PIIDetector({ model: 'openai/gpt-4o-mini', strategy: 'redact' })),
        createStep(new ModerationProcessor({ model: 'openai/gpt-4o-mini', strategy: 'block' })),
      ])
      .commit();

    expectTypeOf(workflow).not.toBeNever();
  });

  it('accepts a chain of object-literal processors', () => {
    const first = {
      id: 'first',
      processInput: async ({ messages }) => messages,
    } satisfies Processor<'first'>;
    const second = {
      id: 'second',
      processOutputStream: async ({ part }) => part,
    } satisfies Processor<'second'>;
    const third = {
      id: 'third',
      processToolResult: async ({ messages }) => messages,
    } satisfies Processor<'third'>;

    const workflow = createWorkflow({
      id: 'object-literal-processors',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(createStep(first))
      .then(createStep(second))
      .then(createStep(third))
      .commit();

    expectTypeOf(workflow).not.toBeNever();
  });

  it('lets every processor step input flow into the shared step output type', () => {
    expectTypeOf<ProcessorStepInputType>().toMatchTypeOf<ProcessorStepOutputType>();
  });
});
