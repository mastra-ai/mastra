import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { AgentConfig } from '../agent/types';
import type { RequestContext } from '../request-context';
import type { InferPublicSchema, StandardSchemaWithJSON } from '../schema';
import { createStep, createWorkflow } from '../workflows';
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

  it('accepts a transforming requestContextSchema on agents', () => {
    const config: AgentConfig<'transform-agent', Record<string, never>, undefined, { date: Date }> = {
      id: 'transform-agent',
      name: 'Transform Agent',
      model: {} as any,
      requestContextSchema: dateFromString,
      instructions: ({ requestContext }) => {
        expectTypeOf(requestContext.get('date')).toEqualTypeOf<Date>();
        return 'You are a helpful assistant';
      },
    };
    expectTypeOf(config.id).toEqualTypeOf<'transform-agent'>();
  });

  it('accepts a transforming requestContextSchema on workflows', () => {
    const schema = z.object({ value: z.number() });
    const step = createStep({
      id: 'transform-step',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData, requestContext }) => {
        expectTypeOf(requestContext.get('date')).toEqualTypeOf<Date>();
        return inputData;
      },
      requestContextSchema: dateFromString,
    });

    const workflow = createWorkflow({
      id: 'transform-workflow',
      inputSchema: schema,
      outputSchema: schema,
      requestContextSchema: dateFromString,
    }).then(step);
    expectTypeOf(workflow).not.toBeNever();
  });
});
