import { describe, expect, it } from 'vitest';

import { getWorkflowConversationThreadId, rememberWorkflowConversationThread } from './workflow-conversation-thread';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('workflow conversation thread', () => {
  describe('when a workflow has no remembered authoring thread', () => {
    it('derives a deterministic thread from the workflow identity', () => {
      expect(getWorkflowConversationThreadId('saved-workflow', createStorage())).toBe(
        'workflow-builder-studio-saved-workflow',
      );
    });
  });

  describe('when a generated draft is saved under a new workflow identity', () => {
    it('restores the original authoring thread for the saved workflow', () => {
      const storage = createStorage();
      const threadId = getWorkflowConversationThreadId('generated-draft-id', storage);

      rememberWorkflowConversationThread('saved-workflow', threadId, storage);

      expect(getWorkflowConversationThreadId('saved-workflow', storage)).toBe(threadId);
    });
  });
});
