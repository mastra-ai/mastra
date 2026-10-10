/** Test-only fault injection around native dispatch; never register this entrypoint in an application worker. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { task, type TaskContext, type TaskDefinition } from '@renderinc/sdk/workflows';
import { z } from 'zod';
import { assertDispatchOpen, authorizeDispatch } from '../src/authorization.js';
import { RenderSubmissionUnknownError } from '../src/errors.js';
import { executeNested } from '../src/nested.js';
import { identity, nativeIdentity } from '../src/native.js';
import { updateRun, type RunRecord } from '../src/persistence/types.js';
import { withTaskRuntime } from '../src/runtime-internal.js';
import { adapter, database, initialize, persistence } from './native-fixture.js';

const inputSchema = z.object({ mode: z.enum(['lost-response', 'late-rejected', 'before-dispatch', 'abandoned']) });

/** Register an isolated probe that uses real Render children and PostgreSQL while controlling the caller's outcome. */
export function registerSubmissionProbe(definitions: () => ReadonlyMap<string, TaskDefinition<[unknown], unknown>>) {
  return task(
    { name: 'native-submission-proof', timeoutSeconds: 120, retry: { maxRetries: 0, waitDurationMs: 100 } },
    async (context: TaskContext, raw: z.infer<typeof inputSchema>) => {
      const { mode } = inputSchema.parse(raw);
      await initialize();
      const native = nativeIdentity(context)!;
      const audit = randomUUID();
      const now = Date.now();
      const parent: RunRecord = {
        workflowId: 'submission-proof-parent',
        runId: randomUUID(),
        buildId: adapter.provider.options.buildId,
        manifest: 'test-only',
        revision: 0,
        status: 'running',
        workerClaim: randomBytes(32).toString('hex'),
        attempt: randomUUID(),
        providerId: native.taskRunId,
        rootProviderId: native.rootTaskRunId,
        dispatchClosed: false,
        dispatchExpiresAt: now + 120000,
        input: {},
        initialState: {},
        createdAt: now,
        updatedAt: now,
      };
      assert.ok(await persistence.create(parent));
      const binding = adapter.provider.workflows.get('native-proof-child')!;
      const runId = identity(parent.runId, parent.attempt, binding.workflow.id, 'proof');
      let calls = 0;
      let child: Promise<unknown> | undefined;
      let assertions = 0;
      let passed = false;
      const patchedContext: TaskContext = {
        metadata: context.metadata,
        run: async (definition, ...args) => {
          calls++;
          if (mode === 'late-rejected')
            await updateRun(persistence, parent.workflowId, parent.runId, () => ({ dispatchClosed: true }));
          child = context.run(definition, ...args);
          // The native call is real. Only delivery of its result to the adapter is faulted.
          void child.catch(() => {});
          throw new Error('Injected loss of native dispatch response');
        },
      };
      try {
        if (mode === 'abandoned') {
          await persistence.create({
            ...parent,
            workflowId: binding.workflow.id,
            runId,
            status: 'submitting',
            providerId: undefined,
            workerClaim: undefined,
            attempt: undefined,
            rootProviderId: undefined,
            parent: { workflowId: parent.workflowId, runId: parent.runId, attempt: parent.attempt! },
          });
          await updateRun(persistence, parent.workflowId, parent.runId, () => ({ dispatchClosed: true }));
        } else {
          await assert.rejects(
            withTaskRuntime(
              {
                context: patchedContext,
                tasks: definitions(),
                run: parent,
                attempt: parent.attempt,
                authorize: envelope => authorizeDispatch(envelope, parent.workerClaim!),
                assertActive: async () => {
                  if (mode === 'before-dispatch' && ++assertions === 2)
                    throw new Error('Injected rejection before native dispatch');
                  assertDispatchOpen((await persistence.get(parent.workflowId, parent.runId))!);
                },
              },
              () =>
                executeNested(binding, {
                  input: { audit, mode: 'success', value: 2 },
                  state: { count: 1 },
                  requestContext: { locale: 'fr' },
                  readOnly: false,
                  executionKey: 'proof',
                }),
            ),
            /Injected/,
          );
        }
        const initial =
          mode === 'abandoned'
            ? await adapter.provider.getRun(binding.workflow.id, runId)
            : await persistence.get(binding.workflow.id, runId);
        if (mode === 'before-dispatch') {
          assert.equal(initial?.status, 'failed');
          assert.equal(calls, 0);
        } else {
          // A very fast child may have claimed before the caller records uncertainty.
          assert.ok(initial?.status === 'submission-unknown' || (mode === 'lost-response' && initial?.providerId));
          if (initial?.status === 'submission-unknown' && mode !== 'lost-response')
            await assert.rejects(adapter.provider.wait(binding.workflow.id, runId), RenderSubmissionUnknownError);
        }
        if (mode === 'lost-response') {
          assert.equal(calls, 1);
          const outcome = (await child) as { result: { status: string; result: { value: number } } };
          assert.equal(outcome.result.status, 'success');
          assert.equal(outcome.result.result.value, 4);
          assert.ok((await persistence.get(binding.workflow.id, runId))?.providerId);
        } else if (mode === 'late-rejected') {
          assert.equal(calls, 1);
          await assert.rejects(child!);
          assert.equal((await persistence.get(binding.workflow.id, runId))?.status, 'submission-unknown');
        }
        const effects = (
          await database.query(
            'SELECT count(*)::int AS count FROM mastra_render_native_audit WHERE audit=$1 AND event=$2',
            [audit, 'leaf'],
          )
        ).rows[0].count;
        assert.equal(effects, mode === 'lost-response' ? 1 : 0);
        passed = true;
        return {
          passed: true,
          mode,
          parentRunId: parent.runId,
          childRunId: runId,
          initialStatus: initial?.status,
          childProviderId: (await persistence.get(binding.workflow.id, runId))?.providerId,
          effects,
          dispatchCalls: calls,
        };
      } finally {
        await updateRun(persistence, parent.workflowId, parent.runId, () => ({
          dispatchClosed: true,
          status: passed ? 'success' : 'failed',
        }));
      }
    },
  );
}
