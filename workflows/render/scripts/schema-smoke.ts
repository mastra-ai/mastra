import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Render } from '@renderinc/sdk';
import { z } from 'zod';
import {
  adapter,
  database,
  persistence,
  storage,
  initialize,
  stepSchemaWorkflow,
  rootSchemaWorkflow,
  invalidSchemaWorkflow,
} from './native-fixture.js';

const client = new Render();
const output = process.env.SCHEMA_RESULTS_FILE ?? '.scratch/schema-observations.json';
const observations: unknown[] = [];
const plainInput = z.object({ audit: z.string().uuid(), value: z.number() });
const incrementedInput = plainInput.extend({ value: z.number().transform(value => value + 1) });
const invalidInput = plainInput.extend({
  value: z
    .number()
    .positive()
    .transform(value => value + 1),
});
const cases = [
  { name: 'step-input', workflow: stepSchemaWorkflow, root: plainInput, step: incrementedInput, value: 1 },
  { name: 'invalid-step-input', workflow: invalidSchemaWorkflow, root: plainInput, step: invalidInput, value: -1 },
  { name: 'known-root-input-bug', workflow: rootSchemaWorkflow, root: incrementedInput, step: plainInput, value: 1 },
];
mkdirSync('.scratch', { recursive: true });
try {
  await initialize();
  for (const scenario of cases) {
    const inputData = { audit: randomUUID(), value: scenario.value };
    const ordinary = createWorkflow({
      id: `ordinary-${scenario.name}`,
      inputSchema: scenario.root,
      outputSchema: plainInput,
    })
      .then(
        createStep({
          id: 'echo',
          inputSchema: scenario.step,
          outputSchema: plainInput,
          execute: async ({ inputData }) => inputData,
        }),
      )
      .commit();
    new Mastra({ workflows: { ordinary }, logger: false });
    const expected = await (await ordinary.createRun()).start({ inputData });
    const run = await scenario.workflow.createRun({ resourceId: 'schema-proof-user' });
    console.log(JSON.stringify({ scenario: scenario.name, runId: run.runId, phase: 'submitting' }));
    await run.startAsync({ inputData });
    const record = await adapter.provider.wait(scenario.workflow.id, run.runId, AbortSignal.timeout(180000));
    const root = await client.workflows.getTaskRun(record.providerId!);
    const chain = (await client.workflows.listTaskRuns({ rootTaskRunId: [record.providerId!], limit: 100 }))
      .map(item => item.taskRun)
      .filter(task => task.rootTaskRunId === record.providerId);
    const effects = (
      await database.query<{
        details: { value: number; native?: { taskRunId?: string; parentTaskRunId?: string; rootTaskRunId?: string } };
      }>('SELECT details FROM mastra_render_native_audit WHERE audit=$1 ORDER BY id', [inputData.audit])
    ).rows;
    assert.equal(record.status, expected.status, JSON.stringify(record.error));
    let expectedValue: number | undefined;
    let actualValue: number | undefined;
    const knownFailure = scenario.name === 'known-root-input-bug';
    if (expected.status === 'success') {
      expectedValue = expected.result.value;
      actualValue = (record.result as { result: { value: number } }).result.value;
      assert.equal(expectedValue, 2);
      assert.equal(actualValue, knownFailure ? 3 : expectedValue);
      assert.equal(effects.length, 1);
      assert.equal(effects[0]!.details.value, actualValue);
      assert.equal(chain.length, 2, 'Expected one coordinator and one native business step');
      if (!process.env.RENDER_USE_LOCAL_DEV) {
        const native = effects[0]!.details.native;
        assert.equal(native?.parentTaskRunId, record.providerId);
        assert.equal(native?.rootTaskRunId, record.providerId);
        assert.ok(chain.some(task => task.id === native?.taskRunId));
      }
    } else {
      assert.equal(expected.status, 'failed');
      assert.equal(effects.length, 0, 'Invalid input must not execute business code');
      assert.equal(chain.length, 1, 'Invalid input must not dispatch a business task');
    }
    const observation = {
      scenario: scenario.name,
      knownFailure,
      matchesMastra: !knownFailure,
      expectedValue,
      actualValue,
      status: record.status,
      runId: run.runId,
      rootId: record.providerId,
      root,
      chain,
      effects,
    };
    observations.push(observation);
    writeFileSync(output, JSON.stringify(observations, null, 2));
    console.log(
      JSON.stringify({
        scenario: scenario.name,
        knownFailure,
        matchesMastra: !knownFailure,
        expectedValue,
        actualValue,
        rootId: record.providerId,
      }),
    );
  }
} finally {
  await Promise.all([database.end(), persistence.close(), storage.close()]);
}
