/** Fault-injection fixture for adapter verification, not application workflow code. */
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { PostgresStore } from '@mastra/pg';
import { Pool } from 'pg';
import { z } from 'zod';
import { init, createPostgresPersistence } from '../src/index.js';
import { getRenderTaskContext } from '../src/runtime.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
export const database = new Pool({ connectionString, max: 2 });
export const persistence = createPostgresPersistence({ connectionString, max: 3 });
export const storage = new PostgresStore({ id: 'render-native-fixture', connectionString });
let ready: Promise<unknown> | undefined;
const initialize = () =>
  (ready ??= database.query(`
  CREATE TABLE IF NOT EXISTS mastra_render_native_audit (
    id bigserial PRIMARY KEY, audit text NOT NULL, event text NOT NULL, details jsonb NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mastra_render_native_faults (
    audit text NOT NULL, fault text NOT NULL, PRIMARY KEY (audit, fault)
  )`));
export async function audit(key: string, event: string, details: Record<string, unknown> = {}) {
  await initialize();
  await database.query('INSERT INTO mastra_render_native_audit (audit,event,details) VALUES ($1,$2,$3)', [
    key,
    event,
    JSON.stringify({ ...details, pid: process.pid, native: getRenderTaskContext().metadata }),
  ]);
}
async function firstFault(key: string, fault: string) {
  await initialize();
  return (
    (
      await database.query(
        'INSERT INTO mastra_render_native_faults (audit,fault) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING audit',
        [key, fault],
      )
    ).rowCount === 1
  );
}
export const adapter = init({
  workflowSlug: process.env.RENDER_WORKFLOW_SLUG ?? 'mastra-native-local',
  buildId: process.env.APP_BUILD_ID ?? 'native-fixture-v1',
  persistence,
  requestContextKeys: ['locale'],
  pollIntervalMs: 250,
  rootTask: { timeoutSeconds: 120 },
  stepDefaults: { timeoutSeconds: 60, retry: { maxRetries: 0, waitDurationMs: 100 } },
});
const input = z.object({
  audit: z.string().uuid(),
  value: z.number(),
  mode: z.enum(['success', 'child-retry', 'nested-failure', 'cancel', 'agent', 'root-crash', 'root-timeout']),
  agentText: z.string().optional(),
});
const stateSchema = z.object({ count: z.number() });
const prepare = adapter.createStep({
  id: 'prepare',
  inputSchema: input,
  outputSchema: input,
  stateSchema,
  execute: async ({ inputData, state, setState, requestContext, runId }) => {
    if (state.count !== 0) throw new Error('Root retry did not reset state');
    await audit(inputData.audit, 'prepare', { logicalRunId: runId });
    await setState({ count: 1 });
    requestContext.set('locale', 'fr');
    return { ...inputData, value: inputData.value + 1 };
  },
});
const leaf = adapter.createStep({
  id: 'leaf',
  inputSchema: input,
  outputSchema: input,
  stateSchema,
  render: { retry: { maxRetries: 1, waitDurationMs: 100 } },
  execute: async ({ inputData, state, setState, requestContext, getInitData, mastra }) => {
    if (state.count !== 1 || requestContext.get('locale') !== 'fr' || getInitData<z.infer<typeof input>>().value !== 2)
      throw new Error('Nested state, context or initial input mismatch');
    await audit(inputData.audit, 'leaf');
    if (inputData.mode === 'child-retry' && (await firstFault(inputData.audit, 'leaf')))
      throw new Error('Injected child retry');
    if (inputData.mode === 'nested-failure') throw new Error('Injected permanent nested failure');
    if (inputData.mode === 'cancel') await new Promise(resolve => setTimeout(resolve, 60000));
    const agentText =
      inputData.mode === 'agent'
        ? (
            await mastra!
              .getAgent('proofAgent')
              .generate('Explain in one short sentence why workflow retries need idempotent side effects.')
          ).text
        : undefined;
    await setState({ count: 2 });
    return { ...inputData, value: inputData.value * 2, ...(agentText ? { agentText } : {}) };
  },
});
const nested = adapter
  .createWorkflow({ id: 'native-proof-child', inputSchema: input, outputSchema: input, stateSchema })
  .then(leaf)
  .commit();
const finish = adapter.createStep({
  id: 'finish',
  inputSchema: input,
  outputSchema: input,
  stateSchema,
  execute: async ({ inputData, state, getStepResult, getInitData }) => {
    if (state.count !== 2 || getInitData<z.infer<typeof input>>().value !== 1 || getStepResult(nested)?.value !== 4)
      throw new Error('Parent did not receive nested state/output');
    await audit(inputData.audit, 'finish');
    return { ...inputData, value: inputData.value + 1 };
  },
});
export const workflow = adapter
  .createWorkflow({ id: 'native-proof', inputSchema: input, outputSchema: input, stateSchema })
  .then(prepare)
  .then(nested)
  .then(finish)
  .commit();
export const retryWorkflow = adapter
  .createWorkflow({
    id: 'native-proof-restart',
    inputSchema: input,
    outputSchema: input,
    stateSchema,
    render: { timeoutSeconds: 30, retry: { maxRetries: 1, waitDurationMs: 1000 } },
    options: {
      onFinish: async result => {
        if (result.status !== 'success') return;
        const value = input.parse(result.getInitData());
        await audit(value.audit, 'root-finished', { logicalRunId: result.runId });
        if (value.mode === 'root-crash' && (await firstFault(value.audit, 'root-crash'))) process.exit(23);
        if (value.mode === 'root-timeout' && (await firstFault(value.audit, 'root-timeout')))
          await new Promise(() => {});
      },
    },
  })
  .then(prepare)
  .then(nested)
  .then(finish)
  .commit();
const model = process.env.NATIVE_TEST_MODEL;
export const mastra = new Mastra({
  workflows: { workflow, retryWorkflow },
  storage,
  logger: false,
  agents: model
    ? {
        proofAgent: new Agent({
          id: 'proof-agent',
          name: 'Proof agent',
          model,
          instructions: 'Give concise, accurate explanations about software reliability.',
        }),
      }
    : undefined,
});
