import { expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { beginExecution, endExecution, runCancellable } from '../../src/mastra/runtime/cancellation.ts';
import { draftingFixture, controlledProvider } from '../support/drafting.ts';
import { attachDraftWorkflow } from '../support/workflow.ts';
import { fixturePolicy } from '../support/policy.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';

it('aborts an in-flight provider call and cancels the native workflow without further model calls', async () => {
  const root = await temporaryDirectory();
  try {
    const fixture = await draftingFixture(root);
    const provider = controlledProvider(fixture);
    let providerSignal: AbortSignal | undefined;
    const calls: string[] = [];
    const attached = await attachDraftWorkflow(fixture.url, fixture.runtimeRoot, (phase, id) => {
      const base = provider.factory(phase, id);
      const call: typeof base.doStream = async options => {
        calls.push(phase);
        providerSignal = options.abortSignal;
        return new Promise((_, reject) => {
          const abort = () => reject(new Error('provider aborted'));
          if (options.abortSignal?.aborted) abort();
          else options.abortSignal?.addEventListener('abort', abort, { once: true });
        });
      };
      return { doStream: call, doGenerate: call };
    });
    const controller = beginExecution(fixture.runId);
    try {
      const run = await attached.target.createRun();
      const pending = runCancellable(fixture.runId, run, () =>
        run.start({
          inputData: {
            runId: fixture.runId,
            evidenceRoot: resolve(root, 'evidence'),
            manifestPath: fixture.manifestPath,
            policy: fixturePolicy,
          },
        }),
      );
      const rejected = expect(pending).rejects.toThrow('OPERATOR_CANCELLED');
      await vi.waitFor(() => expect(providerSignal).toBeDefined());
      controller.abort(new Error('OPERATOR_CANCELLED'));
      await rejected;
      expect(providerSignal!.aborted).toBe(true);
      expect(calls).toHaveLength(1);
      expect((await attached.target.getWorkflowRunById(run.runId))?.status).toBe('canceled');
    } finally {
      endExecution(fixture.runId);
      await attached.close();
    }
  } finally {
    await cleanupDirectory(root);
  }
}, 15000);
