import type { StorageCreateAgentInput, StorageCreateSkillInput } from '@mastra/core/storage';
import { randomUUID } from 'node:crypto';

export const createSampleAgent = ({
  id = `agent-${randomUUID()}`,
  authorId = 'owner',
  visibility = 'public',
  name = 'Test Agent',
  instructions = 'You are a helpful assistant',
  model = { provider: 'openai', name: 'gpt-4' },
}: Partial<StorageCreateAgentInput> = {}): StorageCreateAgentInput => ({
  id,
  authorId,
  visibility,
  name,
  instructions,
  model,
});

export const createSampleSkill = ({
  id = `skill-${randomUUID()}`,
  authorId = 'owner',
  visibility = 'public',
  name = 'Test Skill',
  description = 'A skill for tests',
  instructions = 'Do the thing',
}: Partial<StorageCreateSkillInput> = {}): StorageCreateSkillInput => ({
  id,
  authorId,
  visibility,
  name,
  description,
  instructions,
});
