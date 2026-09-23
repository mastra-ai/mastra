import { Inngest } from 'inngest';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { init } from './index';

const { createStep, createWorkflow } = init(new Inngest({ id: 'schema-types' }));

const OutSchema = z.object({ ok: z.boolean() });

describe('inngest createWorkflow + createStep schema parity', () => {
  it('accepts a first step sharing an input schema with an .optional().default() field', () => {
    const InputSchema = z.object({
      id: z.string().optional().nullable(),
      dryrun: z.boolean().optional().default(false),
    });

    const firstStep = createStep({
      id: 'first',
      inputSchema: InputSchema,
      outputSchema: OutSchema,
      execute: async ({ inputData }) => {
        expectTypeOf(inputData.dryrun).toEqualTypeOf<boolean>();
        return { ok: true };
      },
    });

    const workflow = createWorkflow({ id: 'optional-default', inputSchema: InputSchema, outputSchema: OutSchema })
      .then(firstStep)
      .commit();
    expectTypeOf(workflow).not.toBeNever();
  });

  it('accepts a first step sharing an input schema with a .default() field', () => {
    const InputSchema = z.object({ debug: z.boolean().default(false) });

    const firstStep = createStep({
      id: 'first',
      inputSchema: InputSchema,
      outputSchema: OutSchema,
      execute: async () => ({ ok: true }),
    });

    const workflow = createWorkflow({ id: 'default', inputSchema: InputSchema, outputSchema: OutSchema })
      .then(firstStep)
      .commit();
    expectTypeOf(workflow).not.toBeNever();
  });

  it('still rejects a first step whose input does not match the workflow input', () => {
    const firstStep = createStep({
      id: 'first',
      inputSchema: z.object({ other: z.string() }),
      outputSchema: OutSchema,
      execute: async () => ({ ok: true }),
    });

    createWorkflow({ id: 'mismatch', inputSchema: z.object({ debug: z.boolean() }), outputSchema: OutSchema })
      // @ts-expect-error step input must match workflow input
      .then(firstStep);
  });
});
