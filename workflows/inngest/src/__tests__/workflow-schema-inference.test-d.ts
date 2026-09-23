/**
 * Type-level regression tests for github.com/mastra-ai/mastra/issues/24409.
 *
 * A Zod schema with `.default()` (or `.coerce`) has two type faces:
 * callers provide the schema's INPUT type (defaulted fields optional),
 * while the first step receives the parsed OUTPUT type (defaults applied)
 * because `Run._validateInput` replaces the input with the parser's return
 * value. `init().createWorkflow` must keep both faces: `.then(step)` and the
 * initial `TPrevSchema` use the parsed type; `run.start` / cron / configured
 * `inputData` keep the raw caller-input type.
 */
import type { RequestContext } from '@mastra/core/request-context';
import { Inngest } from 'inngest';
import { describe, it, expectTypeOf } from 'vitest';
import { z } from 'zod';
import * as z3 from 'zod/v3';

import { init } from '../index';

const inngest = new Inngest({ id: 'type-tests', isDev: true });
const { createWorkflow, createStep, cloneWorkflow } = init(inngest);

const inputSchema = z.object({
  id: z.string().optional().nullable(),
  dryrun: z.boolean().optional().default(false),
});
const outputSchema = z.object({ ok: z.boolean() });

describe('workflow input schemas with defaults (zod v4)', () => {
  const firstStep = createStep({
    id: 'first',
    inputSchema,
    outputSchema,
    execute: async ({ inputData }) => {
      // Step input is the parsed face: defaults applied, `dryrun` required.
      expectTypeOf(inputData).toEqualTypeOf<{ dryrun: boolean; id?: string | null | undefined }>();
      return { ok: !inputData.dryrun };
    },
  });

  it('accepts a first step built from the same schema', () => {
    const workflow = createWorkflow({ id: 'defaults', inputSchema, outputSchema }).then(firstStep);
    workflow.commit();

    // run.start keeps the raw caller face: defaulted fields may be omitted.
    type Run = Awaited<ReturnType<typeof workflow.createRun>>;
    type StartInput = Parameters<Run['start']>[0]['inputData'];
    expectTypeOf<StartInput>().toEqualTypeOf<z.input<typeof inputSchema> | undefined>();
  });

  it('rejects wrongly typed run input while allowing defaulted fields to be omitted', () => {
    const workflow = createWorkflow({ id: 'start-input', inputSchema, outputSchema }).then(firstStep).commit();

    type Run = Awaited<ReturnType<typeof workflow.createRun>>;
    const run = {} as Run;

    // Defaulted fields may be omitted entirely on the raw caller face.
    void run.start({ inputData: {} });
    // @ts-expect-error - dryrun must be a boolean, not a string
    void run.start({ inputData: { dryrun: 'yes' } });
    // @ts-expect-error - unknown fields are rejected
    void run.start({ inputData: { bogus: true } });
  });

  it('accepts cron and flow-control config alongside the schema', () => {
    // Configured cron inputData uses the raw caller face: defaulted fields may be omitted.
    createWorkflow({
      id: 'cron-wf',
      inputSchema,
      outputSchema,
      cron: '0 * * * *',
      inputData: {},
      concurrency: { limit: 1 },
    })
      .then(firstStep)
      .commit();

    createWorkflow({
      id: 'cron-wf-bad',
      inputSchema,
      outputSchema,
      cron: '0 * * * *',
      // @ts-expect-error - cron inputData must match the workflow input schema
      inputData: { dryrun: 'yes' },
    });
  });

  it('still rejects a genuinely incompatible step', () => {
    const incompatibleStep = createStep({
      id: 'incompatible',
      inputSchema: z.object({ dryrun: z.string() }),
      outputSchema,
      execute: async () => ({ ok: true }),
    });

    // @ts-expect-error - step input type does not match the workflow input schema
    createWorkflow({ id: 'incompatible-wf', inputSchema, outputSchema }).then(incompatibleStep);
  });

  it('supports cloned and nested workflows', () => {
    // A fresh clone keeps the parsed initial TPrevSchema, so extending it works too.
    const fresh = createWorkflow({ id: 'to-clone', inputSchema, outputSchema });
    const cloned = cloneWorkflow(fresh, { id: 'cloned' });
    cloned.then(firstStep).commit();

    // A committed workflow exposes its raw input face as a step, so nesting works.
    const workflow = createWorkflow({ id: 'inner', inputSchema, outputSchema }).then(firstStep).commit();
    createWorkflow({ id: 'nested', inputSchema, outputSchema }).then(workflow).commit();
  });
});

describe('workflow input schemas with coercion (zod v4)', () => {
  it('accepts a first step built from the same coercing schema', () => {
    const coerceSchema = z.object({ when: z.coerce.date() });
    const coerceStep = createStep({
      id: 'coerce',
      inputSchema: coerceSchema,
      outputSchema,
      execute: async ({ inputData }) => {
        expectTypeOf(inputData.when).toEqualTypeOf<Date>();
        return { ok: true };
      },
    });

    createWorkflow({ id: 'coerce-wf', inputSchema: coerceSchema, outputSchema }).then(coerceStep).commit();
  });
});

describe('workflow input schemas with defaults (zod v3)', () => {
  const v3Input = z3.object({
    id: z3.string().optional().nullable(),
    dryrun: z3.boolean().optional().default(false),
  });
  const v3Output = z3.object({ ok: z3.boolean() });

  it('accepts a first step built from the same schema', () => {
    const v3Step = createStep({
      id: 'v3-first',
      inputSchema: v3Input,
      outputSchema: v3Output,
      execute: async ({ inputData }) => {
        expectTypeOf(inputData.dryrun).toEqualTypeOf<boolean>();
        return { ok: true };
      },
    });

    const workflow = createWorkflow({ id: 'v3', inputSchema: v3Input, outputSchema: v3Output }).then(v3Step);
    workflow.commit();

    type Run = Awaited<ReturnType<typeof workflow.createRun>>;
    type StartInput = Parameters<Run['start']>[0]['inputData'];
    expectTypeOf<StartInput>().toEqualTypeOf<z3.input<typeof v3Input> | undefined>();
  });
});

describe('backwards compatibility', () => {
  it('keeps explicit generic arguments working', () => {
    const explicitStep = createStep({
      id: 'explicit-step',
      inputSchema: z.object({ name: z.string() }),
      outputSchema,
      execute: async () => ({ ok: true }),
    });

    createWorkflow<'explicit', any, { name: string }, { ok: boolean }>({
      id: 'explicit',
      inputSchema: z.object({ name: z.string() }),
      outputSchema,
    })
      .then(explicitStep)
      .commit();
  });

  it('keeps identical input/output schemas inferring as before', () => {
    const plainSchema = z.object({ name: z.string() });
    const plainStep = createStep({
      id: 'plain-step',
      inputSchema: plainSchema,
      outputSchema,
      execute: async ({ inputData }) => {
        expectTypeOf(inputData).toEqualTypeOf<{ name: string }>();
        return { ok: true };
      },
    });

    const workflow = createWorkflow({ id: 'plain', inputSchema: plainSchema, outputSchema }).then(plainStep).commit();

    type Run = Awaited<ReturnType<typeof workflow.createRun>>;
    type StartInput = Parameters<Run['start']>[0]['inputData'];
    expectTypeOf<StartInput>().toEqualTypeOf<{ name: string } | undefined>();
  });

  it('keeps request context typing intact', () => {
    type Context = { tenantId: string };
    const scoped = init<Context>(inngest);
    const ctxStep = scoped.createStep({
      id: 'ctx-step',
      inputSchema,
      outputSchema,
      execute: async () => ({ ok: true }),
    });

    const workflow = scoped
      .createWorkflow({
        id: 'ctx',
        inputSchema,
        outputSchema,
        requestContextSchema: z.object({ tenantId: z.string() }),
      })
      .then(ctxStep)
      .commit();

    type Run = Awaited<ReturnType<typeof workflow.createRun>>;
    type StartArgs = Parameters<Run['start']>[0];
    expectTypeOf<StartArgs['requestContext']>().toEqualTypeOf<RequestContext<Context> | undefined>();
  });
});
