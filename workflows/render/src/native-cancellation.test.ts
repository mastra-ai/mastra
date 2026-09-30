import { expect, it, vi } from 'vitest';
import { waitForCanceledTree } from '../scripts/native-cancellation.js';

/** Model the real fixture topology without mocking away native status transitions. */
function tree() {
  return [
    { id: 'root', parentTaskRunId: '', rootTaskRunId: 'root', status: 'canceled' },
    { id: 'prepare', parentTaskRunId: 'root', rootTaskRunId: 'root', status: 'completed' },
    { id: 'nested', parentTaskRunId: 'root', rootTaskRunId: 'root', status: 'canceled' },
    { id: 'leaf', parentTaskRunId: 'nested', rootTaskRunId: 'root', status: 'canceled' },
  ];
}

it('waits beyond root cancellation until both active descendants are canceled', async () => {
  const pending = tree();
  pending[2]!.status = 'paused';
  pending[3]!.status = 'running';
  const read = vi.fn().mockResolvedValueOnce(pending).mockResolvedValue(tree());
  expect(await waitForCanceledTree('root', read, 100, 1)).toEqual(tree());
  expect(read).toHaveBeenCalledTimes(2);
});
it.each(['nested', 'leaf'])('rejects a failed %s rather than treating a canceled root as success', async id => {
  const failed = tree();
  failed.find(run => run.id === id)!.status = 'failed';
  await expect(waitForCanceledTree('root', async () => failed, 100, 1)).rejects.toThrow('failed native descendant');
});
it.each(['canceled', 'running'])('does not accept preparation in state %s', async status => {
  const invalid = tree();
  invalid[1]!.status = status;
  await expect(waitForCanceledTree('root', async () => invalid, 5, 1)).rejects.toThrow();
});
it('times out on a missing or active descendant rather than passing incomplete evidence', async () => {
  await expect(waitForCanceledTree('root', async () => tree().slice(0, 3), 5, 1)).rejects.toThrow('did not settle');
});
it('ignores unrelated roots but rejects a disconnected leaf', async () => {
  expect(
    await waitForCanceledTree('root', async () => [
      ...tree(),
      { id: 'other', parentTaskRunId: '', rootTaskRunId: 'other', status: 'failed' },
    ]),
  ).toHaveLength(4);
  const invalid = tree();
  invalid[3]!.parentTaskRunId = 'missing';
  await expect(waitForCanceledTree('root', async () => invalid, 100, 1)).rejects.toThrow('Nested coordinator');
});

it('accepts the SDK succeeded alias for completed preparation', async () => {
  const succeeded = tree();
  succeeded[1]!.status = 'succeeded';
  expect(await waitForCanceledTree('root', async () => succeeded)).toEqual(succeeded);
});
