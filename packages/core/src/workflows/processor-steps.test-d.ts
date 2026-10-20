import { describe, expectTypeOf, it } from 'vitest';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import {
  ProcessorStepSchema,
  PIIDetector,
  PromptInjectionDetector,
  ModerationProcessor,
  SystemPromptScrubber,
  TokenLimiterProcessor,
  BatchPartsProcessor,
} from '../processors';
import type { Processor } from '../processors';
import type { ProcessorStepInputType, ProcessorStepOutput, SerializableOutputResult } from '../processors/step-schema';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from './evented';
import type { Step } from './step';
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

  it('type-checks the moderation workflow from the processors docs', () => {
    // Body copied from docs/src/content/en/docs/agents/processors.mdx, with the
    // __GATEWAY_OPENAI_MODEL_NANO__ docs token resolved to its model id.
    const moderationWorkflow = createWorkflow({
      id: 'moderation-pipeline',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .parallel([
        createStep(
          new PIIDetector({
            model: 'openai/gpt-5-nano',
            strategy: 'redact',
          }),
        ),
        createStep(
          new PromptInjectionDetector({
            model: 'openai/gpt-5-nano',
            strategy: 'block',
          }),
        ),
        createStep(
          new ModerationProcessor({
            model: 'openai/gpt-5-nano',
            strategy: 'block',
          }),
        ),
      ])
      .map(async ({ inputData }) => {
        return inputData['processor:pii-detector'];
      })
      .commit();

    expectTypeOf(moderationWorkflow.id).toEqualTypeOf<'moderation-pipeline'>();
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

  it('type-checks chained processor steps on the evented engine', () => {
    const workflow = createEventedWorkflow({
      id: 'evented-guardrails',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(createEventedStep(new TokenLimiterProcessor({ limit: 1000 })))
      .then(createEventedStep(new BatchPartsProcessor()))
      .commit();

    expectTypeOf(workflow.id).toEqualTypeOf<'evented-guardrails'>();
  });

  it('keeps processor step output and standalone input types unchanged', () => {
    expectTypeOf<ProcessorStepOutput['result']>().toEqualTypeOf<SerializableOutputResult | undefined>();
    expectTypeOf<ProcessorStepOutput['model']>().toEqualTypeOf<MastraLanguageModel | undefined>();

    const standalone = createStep(new BatchPartsProcessor());
    type StepInput<T> = T extends Step<any, any, infer I, any, any, any, any, any> ? I : never;
    expectTypeOf<StepInput<typeof standalone>>().toEqualTypeOf<ProcessorStepInputType>();
  });
});
