import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import type { StorageResourceType } from '@mastra/core/storage';
import { randomUUID } from 'crypto';

let role: 'assistant' | 'user' = 'assistant';
export const getRole = () => {
  if (role === 'user') role = 'assistant';
  else role = 'user';
  return role;
};

export const resetRole = () => {
  role = 'assistant';
};

export const createSampleThread = ({
  id = `thread-${randomUUID()}`,
  resourceId = `resource-${randomUUID()}`,
  date = new Date(),
}: {
  id?: string;
  resourceId?: string;
  date?: Date;
} = {}) => ({
  id,
  resourceId,
  title: 'Test Thread',
  createdAt: date,
  updatedAt: date,
  metadata: { key: 'value' },
});

export const createSampleThreadWithParams = (
  threadId: string,
  resourceId: string,
  createdAt: Date,
  updatedAt: Date,
) => ({
  id: threadId,
  resourceId,
  title: 'Test Thread with given ThreadId and ResourceId',
  createdAt,
  updatedAt,
  metadata: { key: 'value' },
});

export const createSampleMessageV1 = ({
  threadId,
  content = 'Hello',
  resourceId = `resource-${randomUUID()}`,
  createdAt = new Date(),
}: {
  threadId: string;
  content?: string;
  resourceId?: string;
  createdAt?: Date;
}) =>
  ({
    id: `msg-${randomUUID()}`,
    role: getRole(),
    type: 'text',
    threadId,
    content,
    createdAt,
    resourceId,
  }) satisfies MastraMessageV1;

export const createSampleMessageV2 = ({
  threadId,
  resourceId,
  role = 'user',
  content,
  createdAt,
  thread,
}: {
  threadId: string;
  resourceId?: string;
  role?: 'user' | 'assistant';
  content?: Partial<MastraMessageContentV2>;
  createdAt?: Date;
  thread?: StorageThreadType;
}): MastraMessageV2 => {
  return {
    id: randomUUID(),
    threadId,
    resourceId: resourceId || thread?.resourceId || 'test-resource',
    role,
    createdAt: createdAt || new Date(),
    content: {
      format: 2,
      parts: content?.parts || [{ type: 'text', text: content?.content ?? '' }],
      content: content?.content || `Sample content ${randomUUID()}`,
      ...content,
    },
    type: 'v2',
  };
};

export const createSampleResource = ({
  id = `resource-${randomUUID()}`,
  workingMemory = 'Sample working memory content',
  metadata = { key: 'value', test: true },
  date = new Date(),
}: {
  id?: string;
  workingMemory?: string;
  metadata?: Record<string, unknown>;
  date?: Date;
} = {}): StorageResourceType => ({
  id,
  workingMemory,
  metadata,
  createdAt: date,
  updatedAt: date,
});
