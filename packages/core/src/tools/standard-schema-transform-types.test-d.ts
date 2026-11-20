import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { AgentConfig } from '../agent/types';
import type { RequestContext } from '../request-context';
import type { InferPublicSchema, StandardSchemaWithJSON } from '../schema';
import { createStep, createWorkflow } from '../workflows';
import type { InferWorkflowRequestContext, WorkflowConfig } from '../workflows';
import { createTool } from './tool';

// Mirrors a Standard Schema adapter such as Effect's `Schema.toStandardSchemaV1`,
// whose `~standard.types` is optional per the Standard Schema spec.
type TransformingSchema<Input, Output> = Omit<StandardSchemaWithJSON<Input, Output>, '~standard'> & {
  readonly '~standard': Omit<StandardSchemaWithJSON<Input, Output>['~standard'], 'types'> & {
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
};

declare const dateFromString: TransformingSchema<{ date: string }, { date: Date }>;
declare const requiredTypesSchema: StandardSchemaWithJSON<{ date: string }, { date: Date }>;
declare const plainStandardSchema: TransformingSchema<{ name: string }, { name: string }>;

// Regression: https://github.com/mastra-ai/mastra/issues/26766
describe('transformed Standard Schema type inference', () => {
  it('infers the output type when ~standard.types is optional', () => {
    expectTypeOf<InferPublicSchema<typeof dateFromString>>().toEqualTypeOf<{ date: Date }>();
    expectTypeOf<InferPublicSchema<typeof requiredTypesSchema>>().toEqualTypeOf<{ date: Date }>();
    expectTypeOf<InferPublicSchema<typeof plainStandardSchema>>().toEqualTypeOf<{ name: string }>();
  });

  it('keeps inferring the output type of Zod transforms', () => {
    const zodSchema = z.object({ date: z.string().transform(value => new Date(value)) });
    expectTypeOf<InferPublicSchema<typeof zodSchema>>().toEqualTypeOf<{ date: Date }>();
  });

  it('types tool execute input with the transformed output', () => {
    createTool({
      id: 'transform-input',
      description: 'Uses a transforming input schema',
      inputSchema: dateFromString,
      execute: async input => {
        expectTypeOf(input).toEqualTypeOf<{ date: Date }>();
        return input.date.toISOString();
      },
    });
  });

  it('accepts a transforming requestContextSchema on tools', () => {
    createTool({
      id: 'transform-context',
      description: 'Uses a transforming request context schema',
      requestContextSchema: dateFromString,
      execute: async (_input, { requestContext }) => {
        expectTypeOf(requestContext).toEqualTypeOf<RequestContext<{ date: Date }>>();
        expectTypeOf(requestContext.get('date')).toEqualTypeOf<Date>();
        return null;
      },
    });
  });

  // Agents and workflows validate request context without decoding it, so runtime values
  // keep their input type. Transforming schemas stay rejected there until decoding is supported.
  it('rejects a transforming requestContextSchema on agents', () => {
    const config: AgentConfig<'transform-agent', Record<string, never>, undefined, { date: Date }> = {
      id: 'transform-agent',
      name: 'Transform Agent',
      model: {} as any,
      // @ts-expect-error input and output types differ
      requestContextSchema: dateFromString,
      instructions: 'You are a helpful assistant',
    };
    expectTypeOf(config.id).toEqualTypeOf<'transform-agent'>();
  });

  it('rejects a transforming requestContextSchema on workflows', () => {
    const schema = z.object({ value: z.number() });
    const config: WorkflowConfig<
      'transform-workflow',
      unknown,
      { value: number },
      { value: number },
      [],
      { date: Date }
    > = {
      id: 'transform-workflow',
      inputSchema: schema,
      outputSchema: schema,
      // @ts-expect-error input and output types differ
      requestContextSchema: dateFromString,
    };
    expectTypeOf(config.id).toEqualTypeOf<'transform-workflow'>();
  });

  it('does not type step request context as the decoded output', () => {
    const schema = z.object({ value: z.number() });
    expectTypeOf<InferWorkflowRequestContext<typeof dateFromString>>().not.toEqualTypeOf<{ date: Date }>();

    const step = createStep({
      id: 'transform-step',
      inputSchema: schema,
      outputSchema: schema,
      requestContextSchema: dateFromString,
      execute: async ({ inputData, requestContext }) => {
        expectTypeOf(requestContext.get('date')).toEqualTypeOf<string | Date>();
        expectTypeOf(requestContext.get('date')).not.toEqualTypeOf<Date>();
        // @ts-expect-error steps receive the raw request context values, not decoded ones
        requestContext.get('date').toISOString();
        return inputData;
      },
    });

    const workflow = createWorkflow({
      id: 'inferred-transform-workflow',
      inputSchema: schema,
      outputSchema: schema,
      requestContextSchema: dateFromString,
    }).then(step);
    expectTypeOf(workflow.id).toEqualTypeOf<'inferred-transform-workflow'>();
  });
});
