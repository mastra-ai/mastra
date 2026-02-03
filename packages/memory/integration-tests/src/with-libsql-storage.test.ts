import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { fastembed } from '@mastra/fastembed';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import dotenv from 'dotenv';
import { describe, it, expect } from 'vitest';
import { getResuableTests, StorageType } from './shared/reusable-tests';

dotenv.config({ path: '.env.test' });

const files = ['libsql-test.db', 'libsql-test.db-shm', 'libsql-test.db-wal'];

describe('Memory with LibSQL Integration', () => {
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  const memoryOptions = {
    lastMessages: 10,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
    generateTitle: false,
  };
  const memory = new Memory({
    storage: new LibSQLStore({
      url: 'file:libsql-test.db',
      id: randomUUID(),
    }),
    vector: new LibSQLVector({
      url: 'file:libsql-test.db',
      id: randomUUID(),
    }),
    embedder: fastembed,
    options: memoryOptions,
  });

  getResuableTests(memory, {
    storageTypeForWorker: StorageType.LibSQL,
    storageConfigForWorker: { url: 'file:libsql-test.db', id: randomUUID() },
    memoryOptionsForWorker: memoryOptions,
    vectorConfigForWorker: {
      url: 'file:libsql-test.db',
      id: randomUUID(),
    },
  });

  describe('lastMessages should return newest messages, not oldest', () => {
    it('should return the LAST N messages when using lastMessages config without explicit orderBy', async () => {
      const memoryWithLimit = new Memory({
        storage: new LibSQLStore({
          url: 'file:libsql-test.db',
          id: randomUUID(),
        }),
        options: {
          lastMessages: 3,
        },
      });

      const threadId = randomUUID();
      const resourceId = randomUUID();

      await memoryWithLimit.createThread({
        threadId,
        resourceId,
      });

      const messages = [];
      const baseTime = Date.now();
      for (let i = 1; i <= 10; i++) {
        messages.push({
          id: randomUUID(),
          threadId,
          resourceId,
          content: {
            format: 2,
            parts: [{ type: 'text', text: `Message ${i}` }],
          },
          role: 'user' as const,
          createdAt: new Date(baseTime + i * 1000),
        });
      }

      await memoryWithLimit.saveMessages({ messages });

      const result = await memoryWithLimit.recall({
        threadId,
        resourceId,
      });

      expect(result.messages).toHaveLength(3);

      const contents = result.messages.map(m => {
        if (typeof m.content === 'string') return m.content;
        if (m.content?.parts?.[0]?.text) return m.content.parts[0].text;
        if (m.content?.content) return m.content.content;
        return '';
      });

      expect(contents).toContain('Message 8');
      expect(contents).toContain('Message 9');
      expect(contents).toContain('Message 10');
      expect(contents).not.toContain('Message 1');
      expect(contents).not.toContain('Message 2');
      expect(contents).not.toContain('Message 3');
      expect(contents[0]).toBe('Message 8');
      expect(contents[1]).toBe('Message 9');
      expect(contents[2]).toBe('Message 10');
    });
  });
});
