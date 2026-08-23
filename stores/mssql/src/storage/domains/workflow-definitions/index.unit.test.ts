import type { CreateWorkflowDefinitionInput, WorkflowDefinition } from '@mastra/core/storage';
import type sql from 'mssql';
import { describe, expect, it, vi } from 'vitest';

import { WorkflowDefinitionsMSSQL } from './index';

const input = {
  id: 'workflow',
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  graph: [],
} satisfies CreateWorkflowDefinitionInput;

describe('WorkflowDefinitionsMSSQL deadlock retry', () => {
  it('retries a nested SQL Server deadlock error', async () => {
    const store = new WorkflowDefinitionsMSSQL({ pool: {} as sql.ConnectionPool });
    const target = store as unknown as {
      upsertManyTransaction(inputs: readonly CreateWorkflowDefinitionInput[]): Promise<WorkflowDefinition[]>;
    };
    const deadlock = { cause: { number: 1205 } };
    const upsertManyTransaction = vi
      .spyOn(target, 'upsertManyTransaction')
      .mockRejectedValueOnce(deadlock)
      .mockResolvedValueOnce([{ id: input.id } as WorkflowDefinition]);

    await expect(store.upsertMany([input])).resolves.toEqual([{ id: input.id }]);
    expect(upsertManyTransaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry an unrelated EREQUEST whose message mentions 1205', async () => {
    const store = new WorkflowDefinitionsMSSQL({ pool: {} as sql.ConnectionPool });
    const target = store as unknown as {
      upsertManyTransaction(inputs: readonly CreateWorkflowDefinitionInput[]): Promise<WorkflowDefinition[]>;
    };
    const unrelated = { code: 'EREQUEST', message: 'Unrelated identifier 1205 failed.' };
    const upsertManyTransaction = vi.spyOn(target, 'upsertManyTransaction').mockRejectedValue(unrelated);

    await expect(store.upsertMany([input])).rejects.toBe(unrelated);
    expect(upsertManyTransaction).toHaveBeenCalledTimes(1);
  });
});
