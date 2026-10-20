import { describe, expectTypeOf, it } from 'vitest';
import {
  ProcessorStepSchema,
  PIIDetector,
  ModerationProcessor,
  SystemPromptScrubber,
  TokenLimiterProcessor,
  BatchPartsProcessor,
} from '../processors';
import type { Processor } from '../processors';
import { createWorkflow, createStep } from '.';

// Chaining createStep(processor) with .then() failed with TS2345 because each
// processor step's input type did not accept the previous step's output (#27577).
describe('processor step chaining', () => {
  it('type-checks the output guardrails workflow from the guardrails docs', () => {
    // Body copied from docs/src/content/en/docs/agents/guardrails.mdx, with the
    // __GATEWAY_OPENAI_MODEL_NANO__ docs token resolved to its model id.
    const outputGuardrails = createWorkflow({
      id: 'output-guardrails',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      // Sequential: limit tokens first, then batch stream chunks
      .then(createStep(new TokenLimiterProcessor({ limit: 1000 })))
      .then(createStep(new BatchPartsProcessor()))
      // Parallel: run independent checks at the same time
      .parallel([
        createStep(
          new PIIDetector({
            model: 'openai/gpt-5-nano',
            strategy: 'redact',
          }),
        ),
        createStep(
          new ModerationProcessor({
            model: 'openai/gpt-5-nano',
            strategy: 'block',
          }),
        ),
      ])
      // Map to the redact branch to keep its transformed messages
      .map(async ({ inputData }) => {
        return inputData['processor:pii-detector'];
      })
      // Sequential: scrubber depends on previous redaction output
      .then(
        createStep(
          new SystemPromptScrubber({
            model: 'openai/gpt-5-nano',
            strategy: 'redact',
            placeholderText: '[REDACTED]',
          }),
        ),
      )
      .commit();

    expectTypeOf(outputGuardrails.id).toEqualTypeOf<'output-guardrails'>();
  });

  it('type-checks chained object-literal processors', () => {
    const tagInput = {
      id: 'tag-input',
      async processInput({ messages }) {
        return messages;
      },
    } satisfies Processor<'tag-input'>;
    const tagOutput = {
      id: 'tag-output',
      async processOutputResult({ messages }) {
        return messages;
      },
    } satisfies Processor<'tag-output'>;

    const workflow = createWorkflow({
      id: 'tagging',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(createStep(tagInput))
      .then(createStep(tagOutput))
      .commit();

    expectTypeOf(workflow.id).toEqualTypeOf<'tagging'>();
  });
});
