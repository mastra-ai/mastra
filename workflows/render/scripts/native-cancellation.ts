import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

interface NativeRun {
  id: string;
  parentTaskRunId: string;
  rootTaskRunId: string;
  status: string;
}

/** Wait for the fixture's whole canceled tree, preserving its already-completed preparation task. */
export async function waitForCanceledTree<T extends NativeRun>(
  rootId: string,
  read: () => Promise<T[]>,
  timeoutMs = 60000,
  pollIntervalMs = 1000,
): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const chain = (await read()).filter(run => run.rootTaskRunId === rootId);
    assert.ok(!chain.some(run => run.status === 'failed'), 'Cancellation produced a failed native descendant');
    if (chain.length === 4 && chain.every(run => ['completed', 'succeeded', 'canceled'].includes(run.status))) {
      const root = chain.find(run => run.id === rootId);
      const nested = chain.find(
        run => run.parentTaskRunId === rootId && chain.some(child => child.parentTaskRunId === run.id),
      );
      const leaf = nested && chain.find(run => run.parentTaskRunId === nested.id);
      const prepare = chain.find(run => run.parentTaskRunId === rootId && run.id !== nested?.id);
      assert.equal(new Set(chain.map(run => run.id)).size, 4, 'Expected four distinct native runs');
      assert.equal(root?.status, 'canceled', 'Root must be canceled');
      assert.equal(nested?.status, 'canceled', 'Nested coordinator must be canceled');
      assert.equal(leaf?.status, 'canceled', 'Active leaf must be canceled');
      assert.ok(
        prepare && ['completed', 'succeeded'].includes(prepare.status),
        'Completed preparation must remain completed',
      );
      return chain;
    }
    assert.ok(
      Date.now() < deadline,
      `Native cancellation did not settle: ${JSON.stringify(chain.map(({ id, status }) => ({ id, status })))}`,
    );
    await delay(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
  }
}
