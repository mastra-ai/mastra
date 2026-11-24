import { expect, it, vi } from 'vitest';
import type { Transaction } from '@libsql/client';
import { writeTransaction } from '../../src/mastra/persistence/transaction.ts';

it.each(['operation', 'commit'])('preserves the %s error when rollback also fails', async stage => {
  const original = new Error('STALE_REVIEW');
  const commit = stage === 'commit' ? vi.fn().mockRejectedValue(original) : vi.fn();
  const rollback = vi.fn().mockRejectedValue(new Error('STORAGE_FAILURE'));
  const transaction = { commit, rollback } as unknown as Transaction;
  const client = { transaction: vi.fn().mockResolvedValue(transaction) };
  await expect(
    writeTransaction(client, async () => {
      if (stage === 'operation') throw original;
      return 'result';
    }),
  ).rejects.toBe(original);
  expect(rollback).toHaveBeenCalledOnce();
  expect(commit).toHaveBeenCalledTimes(stage === 'commit' ? 1 : 0);
});

it('returns the committed result without rolling back', async () => {
  const commit = vi.fn(),
    rollback = vi.fn();
  const client = { transaction: vi.fn().mockResolvedValue({ commit, rollback }) };
  await expect(writeTransaction(client, async () => 'result')).resolves.toBe('result');
  expect(commit).toHaveBeenCalledOnce();
  expect(rollback).not.toHaveBeenCalled();
});
