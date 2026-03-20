import { describe, it, expect } from 'vitest';
import { fetchJson } from '../utils.js';

describe('memory — messages', () => {
  async function createThread(title: string): Promise<string> {
    const threadId = crypto.randomUUID();
    await fetchJson('/api/memory/threads?agentId=test-agent', {
      method: 'POST',
      body: JSON.stringify({ threadId, resourceId: 'test-user', title }),
    });
    return threadId;
  }

  describe('save and list', () => {
    it('should save messages and return them with content structure', async () => {
      const threadId = await createThread('Save Messages Test');
      const msgId = crypto.randomUUID();

      const { status, data } = await fetchJson<any>('/api/memory/save-messages?agentId=test-agent', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              id: msgId,
              role: 'user',
              content: 'Hello, agent!',
              threadId,
              resourceId: 'test-user',
            },
          ],
        }),
      });

      expect(status).toBe(200);
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].id).toBe(msgId);
      expect(data.messages[0].role).toBe('user');
      expect(data.messages[0].threadId).toBe(threadId);
      expect(data.messages[0].resourceId).toBe('test-user');
      // Content is stored in structured format with parts
      expect(data.messages[0].content.content).toBe('Hello, agent!');
      expect(data.messages[0].content.parts[0]).toEqual({ type: 'text', text: 'Hello, agent!' });
    });

    it('should list messages with pagination metadata', async () => {
      const threadId = await createThread('List Messages Test');
      const msgId = crypto.randomUUID();

      await fetchJson('/api/memory/save-messages?agentId=test-agent', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { id: msgId, role: 'user', content: 'Test message', threadId, resourceId: 'test-user' },
          ],
        }),
      });

      const { status, data } = await fetchJson<any>(
        `/api/memory/threads/${threadId}/messages?agentId=test-agent`,
      );

      expect(status).toBe(200);
      expect(data.messages).toHaveLength(1);
      expect(data.messages[0].id).toBe(msgId);
      expect(data.total).toBe(1);
      expect(data.page).toBe(0);
      expect(data.perPage).toBe(40);
      expect(data.hasMore).toBe(false);
    });

    it('should preserve message content and roles across save/list', async () => {
      const threadId = await createThread('Content Test');
      const userMsgId = crypto.randomUUID();
      const assistantMsgId = crypto.randomUUID();

      await fetchJson('/api/memory/save-messages?agentId=test-agent', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { id: userMsgId, role: 'user', content: 'What is 2+2?', threadId, resourceId: 'test-user' },
            { id: assistantMsgId, role: 'assistant', content: 'The answer is 4.', threadId, resourceId: 'test-user' },
          ],
        }),
      });

      const { data } = await fetchJson<any>(
        `/api/memory/threads/${threadId}/messages?agentId=test-agent`,
      );

      expect(data.messages).toHaveLength(2);

      const userMsg = data.messages.find((m: any) => m.id === userMsgId);
      expect(userMsg.role).toBe('user');
      expect(userMsg.content.content).toBe('What is 2+2?');

      const assistantMsg = data.messages.find((m: any) => m.id === assistantMsgId);
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.content.content).toBe('The answer is 4.');
    });
  });

  describe('delete', () => {
    it('should delete specific messages', async () => {
      const threadId = await createThread('Delete Messages Test');
      const msgToKeep = crypto.randomUUID();
      const msgToDelete = crypto.randomUUID();

      await fetchJson('/api/memory/save-messages?agentId=test-agent', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { id: msgToKeep, role: 'user', content: 'Keep this', threadId, resourceId: 'test-user' },
            { id: msgToDelete, role: 'user', content: 'Delete this', threadId, resourceId: 'test-user' },
          ],
        }),
      });

      const { status } = await fetchJson<any>(
        '/api/memory/messages/delete?agentId=test-agent',
        {
          method: 'POST',
          body: JSON.stringify({ messageIds: [msgToDelete] }),
        },
      );

      expect(status).toBe(200);

      // Verify the deleted message is gone and the kept one remains
      const { data: listData } = await fetchJson<any>(
        `/api/memory/threads/${threadId}/messages?agentId=test-agent`,
      );
      expect(listData.messages).toHaveLength(1);
      expect(listData.messages[0].id).toBe(msgToKeep);
    });
  });
});
