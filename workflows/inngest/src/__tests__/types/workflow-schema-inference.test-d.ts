import { RequestContext } from '@mastra/core/di';
import { Inngest } from 'inngest';
import { expectTypeOf } from 'vitest';
import z3 from 'zod/v3';
import { z } from 'zod/v4';

import { init } from '@mastra/inngest';

const { createStep, createWorkflow, cloneWorkflow } = init(new Inngest({ id: 'schema-inference' }));
const inputSchema = z.object({
  id: z.string().optional().nullable(),
  dryrun: z.boolean().optional().default(false),
});
const outputSchema = z.object({ ok: z.boolean() });
const firstStep = createStep({
  id: 'first',
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    expectTypeOf(inputData).toEqualTypeOf<{ dryrun: boolean; id?: string | null }>();
    return { ok: !inputData.dryrun };
  },
});

// Issue #24409: the very same schema must connect after its defaults are applied.
const workflow = createWorkflow({
  id: 'defaults',
  inputSchema,
  outputSchema,
  cron: '0 * * * *',
  inputData: {},
  concurrency: { limit: 1 },
})
  .then(firstStep)
  .commit();

async function checkRunInput() {
  const run = await workflow.createRun();
  expectTypeOf<Parameters<typeof run.start>[0]['inputData']>().toEqualTypeOf<z.input<typeof inputSchema> | undefined>();
  const result = await run.start({ inputData: {} });
  if (result.status === 'success') {
    expectTypeOf(result.result).toEqualTypeOf<{ ok: boolean }>();
  }
  void run.start({ inputData: { id: null, dryrun: true } });
  // @ts-expect-error - defaults do not allow an invalid field type
  void run.start({ inputData: { dryrun: 'false' } });

  const clonedRun = await cloneWorkflow(workflow, { id: 'cloned' }).createRun();
  void clonedRun.start({ inputData: {} });
}
void checkRunInput;

createWorkflow({ id: 'nested', inputSchema, outputSchema }).then(workflow).commit();
// @ts-expect-error - later steps must still accept the previous step's output
workflow.then(firstStep);

const incompatibleStep = createStep({
  id: 'incompatible',
  inputSchema: z.object({ dryrun: z.string() }),
  outputSchema,
  execute: async () => ({ ok: true }),
});
// @ts-expect-error - inferring defaults must not allow incompatible step inputs
createWorkflow({ id: 'invalid-step', inputSchema, outputSchema }).then(incompatibleStep);

const v3InputSchema = z3.object({ dryrun: z3.boolean().default(false) });
const v3OutputSchema = z3.object({ ok: z3.boolean() });
const v3Step = createStep({
  id: 'v3-first',
  inputSchema: v3InputSchema,
  outputSchema: v3OutputSchema,
  execute: async ({ inputData }) => {
    expectTypeOf(inputData).toEqualTypeOf<{ dryrun: boolean }>();
    return { ok: true };
  },
});
const v3Workflow = createWorkflow({ id: 'v3', inputSchema: v3InputSchema, outputSchema: v3OutputSchema })
  .then(v3Step)
  .commit();
async function checkV3Input() {
  const run = await v3Workflow.createRun();
  expectTypeOf<Parameters<typeof run.start>[0]['inputData']>().toEqualTypeOf<
    z3.input<typeof v3InputSchema> | undefined
  >();
  void run.start({ inputData: {} });
}
void checkV3Input;

const plainInput = z.object({ name: z.string() });
const plainStep = createStep({
  id: 'plain',
  inputSchema: plainInput,
  outputSchema,
  execute: async ({ inputData }) => {
    expectTypeOf(inputData).toEqualTypeOf<{ name: string }>();
    return { ok: true };
  },
});
createWorkflow({ id: 'plain-inferred', inputSchema: plainInput, outputSchema }).then(plainStep).commit();
createWorkflow<'explicit', { attempts: number }, { name: string }, { ok: boolean }>({
  id: 'explicit',
  stateSchema: z.object({ attempts: z.number() }),
  inputSchema: plainInput,
  outputSchema,
  initialState: { attempts: 0 },
})
  .then(plainStep)
  .commit();
createWorkflow<'partial'>({ id: 'partial', inputSchema: plainInput, outputSchema }).then(plainStep).commit();

type Context = { userId: string };
const withContext = init<Context>(new Inngest({ id: 'typed-context' }));
const contextWorkflow = withContext.createWorkflow({
  id: 'context',
  inputSchema: plainInput,
  outputSchema,
  stateSchema: z.object({ attempts: z.number() }),
  requestContextSchema: z.object({ userId: z.string() }),
  initialState: { attempts: 0 },
});
async function checkContext() {
  const run = await contextWorkflow.createRun();
  expectTypeOf<Parameters<typeof run.start>[0]['initialState']>().toEqualTypeOf<{ attempts: number } | undefined>();
  expectTypeOf<Parameters<typeof run.start>[0]['requestContext']>().toEqualTypeOf<
    RequestContext<Context> | undefined
  >();
  void run.start({ inputData: { name: 'Ada' }, requestContext: new RequestContext<Context>() });
  // @ts-expect-error - existing workflow inputs remain constrained
  void run.start({ inputData: { name: 42 } });
}
void checkContext;
