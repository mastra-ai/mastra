import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';
import { init, createPostgresPersistence } from '../src/index.js';
import { task } from '@renderinc/sdk/workflows';
import { getRenderTaskContext } from '../src/runtime.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required for the subprocess fixture');
export const persistence = createPostgresPersistence({ connectionString, max: 3 });
export const storage = new PostgresStore({ id: 'render-local-fixture', connectionString });
export const adapter = init({
  workflowSlug: 'mastra-local',
  buildId: 'local-fixture-v1',
  persistence,
  requestContextKeys: ['locale'],
  client: { useLocalDev: true, localDevUrl: process.env.RENDER_LOCAL_DEV_URL ?? 'http://127.0.0.1:8138' },
  rootTask: { timeoutSeconds: 120 },
  stepDefaults: { timeoutSeconds: 30, retry: { maxRetries: 0, waitDurationMs: 10 } },
  pollIntervalMs: 50,
});
const inputSchema = z.object({
  value: z.number(),
  audit: z.string().regex(/^[a-z0-9-]+$/),
  fail: z.enum(['none', 'once', 'always']).default('none'),
  delayMs: z.number().int().min(0).max(60000).default(100),
});
const stateSchema = z.object({ prepared: z.boolean() });
const childOutput = z.object({ value: z.number(), pid: z.number(), start: z.number(), end: z.number() });
const directory = resolve('.scratch/audit');
function audit(key: string, event: string) {
  mkdirSync(directory, { recursive: true });
  appendFileSync(resolve(directory, `${key}.jsonl`), `${JSON.stringify({ event, pid: process.pid })}\n`);
}
function firstAttempt(key: string) {
  try {
    writeFileSync(resolve(directory, `${key}.once`), '1', { flag: 'wx' });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}
const prepare = adapter.createStep({
  id: 'prepare',
  inputSchema,
  outputSchema: inputSchema,
  stateSchema,
  execute: async ({ inputData, setState, requestContext }) => {
    audit(inputData.audit, 'prepare');
    await setState({ prepared: true });
    requestContext.set('locale', 'fr');
    return { ...inputData, value: inputData.value + 1 };
  },
});
function operation<const Id extends string>(id: Id, factor: number) {
  return adapter.createStep({
    id,
    inputSchema,
    outputSchema: childOutput,
    render: { retry: { maxRetries: id === 'double' ? 1 : 0, waitDurationMs: 10, backoffScaling: 1 } },
    execute: async ({ inputData }) => {
      audit(inputData.audit, id);
      if (
        id === 'double' &&
        (inputData.fail === 'always' || (inputData.fail === 'once' && firstAttempt(inputData.audit)))
      )
        throw new Error('Injected child failure');
      const start = Date.now();
      await new Promise(resolve => setTimeout(resolve, inputData.delayMs));
      return { value: inputData.value * factor, pid: process.pid, start, end: Date.now() };
    },
  });
}
const double = operation('double', 2);
const triple = operation('triple', 3);
export const nativeProof = task(
  { name: 'native-proof', retry: { maxRetries: 0, waitDurationMs: 10 } },
  async (_context, value: number, key: string) => {
    audit(key, 'native');
    return { value, pid: process.pid };
  },
);
const outputSchema = z.object({
  value: z.number(),
  prepared: z.boolean(),
  locale: z.string(),
  prior: z.number(),
  original: z.number(),
  pids: z.array(z.number()),
  overlap: z.boolean(),
});
const finish = adapter.createStep({
  id: 'finish',
  inputSchema: z.object({ double: childOutput, triple: childOutput }),
  outputSchema,
  stateSchema,
  execute: async ({ inputData, state, requestContext, getInitData, getStepResult }) => {
    const original = getInitData<z.infer<typeof inputSchema>>();
    audit(original.audit, 'finish');
    const native = await getRenderTaskContext().run(
      nativeProof,
      inputData.double.value + inputData.triple.value,
      original.audit,
    );
    return {
      value: native.value,
      prepared: state.prepared,
      locale: String(requestContext.get('locale')),
      prior: getStepResult(prepare).value,
      original: getInitData<z.infer<typeof inputSchema>>().value,
      pids: [inputData.double.pid, inputData.triple.pid, process.pid, native.pid],
      overlap:
        Math.max(inputData.double.start, inputData.triple.start) < Math.min(inputData.double.end, inputData.triple.end),
    };
  },
});
export const workflow = adapter
  .createWorkflow({
    id: 'distributed-proof',
    inputSchema,
    outputSchema,
    stateSchema,
    options: {
      onStart: info => {
        audit((info.getInitData() as z.infer<typeof inputSchema>).audit, 'root');
      },
    },
  })
  .then(prepare)
  .parallel([double, triple])
  .map(async ({ inputData }) => inputData)
  .then(finish)
  .commit();
export const mastra = new Mastra({ workflows: { workflow }, storage, logger: false });
