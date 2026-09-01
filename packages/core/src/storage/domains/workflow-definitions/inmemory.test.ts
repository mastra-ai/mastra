import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryDB } from '../inmemory-db';
import { WorkflowDefinitionOwnershipConflictError } from './base';
import { InMemoryWorkflowDefinitionsStorage } from './inmemory';

const graph = [{ type: 'tool', id: 'echo-tool', toolId: 'echo-tool' }] as any;

function baseInput(id = 'wf-1') {
  return {
    id,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    graph,
  };
}

describe('InMemoryWorkflowDefinitionsStorage', () => {
  let storage: InMemoryWorkflowDefinitionsStorage;

  beforeEach(() => {
    storage = new InMemoryWorkflowDefinitionsStorage({ db: new InMemoryDB() });
  });

  describe('create validation', () => {
    it('rejects creation when a required key is missing entirely', async () => {
      const { graph: _omitted, ...withoutGraph } = baseInput();
      await expect(storage.upsert(withoutGraph as any)).rejects.toThrow(/graph/);
      expect(await storage.get('wf-1')).toBeNull();
    });

    it('rejects creation when a required key is present but explicitly undefined', async () => {
      await expect(storage.upsert({ ...baseInput(), graph: undefined } as any)).rejects.toThrow(/graph/);
      await expect(storage.upsert({ ...baseInput(), inputSchema: undefined } as any)).rejects.toThrow(/inputSchema/);
      await expect(storage.upsert({ ...baseInput(), outputSchema: undefined } as any)).rejects.toThrow(/outputSchema/);
      expect(await storage.get('wf-1')).toBeNull();
    });
  });

  describe('update', () => {
    it('keeps authorId immutable on an existing definition', async () => {
      await storage.upsert({ ...baseInput(), authorId: 'author-1' });
      await expect(storage.upsert({ id: 'wf-1', authorId: 'author-2' })).rejects.toBeInstanceOf(
        WorkflowDefinitionOwnershipConflictError,
      );
      const fetched = await storage.get('wf-1');
      expect(fetched?.authorId).toBe('author-1');
      // Unspecified columns survive the partial upsert.
      expect(fetched?.graph).toEqual(graph);
    });

    it('does not disclose the existing author in ownership conflicts', async () => {
      await storage.upsert({ ...baseInput(), authorId: 'private-owner' });

      const error = await storage.upsert({ id: 'wf-1', authorId: 'other-owner' }).catch(cause => cause);

      expect(error).toBeInstanceOf(WorkflowDefinitionOwnershipConflictError);
      expect(error.message).not.toContain('private-owner');
    });
  });
});
