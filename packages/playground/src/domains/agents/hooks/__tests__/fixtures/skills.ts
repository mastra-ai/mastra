import type { StoredSkillResponse, WorkspaceFsWriteResponse } from '@mastra/client-js';

/** Stored-skill record returned by `POST /stored/skills`. */
export const createdSkill: StoredSkillResponse = {
  id: 'created',
  name: 'My Skill',
  description: 'desc',
  instructions: '# Title\nDo X',
  status: 'active',
  createdAt: '2026-06-16T00:00:00.000Z',
  updatedAt: '2026-06-16T00:00:00.000Z',
};

/** Success response from `POST /workspaces/:workspaceId/fs/write`. */
export const workspaceWriteOk: WorkspaceFsWriteResponse = {
  success: true,
  path: 'skills/SKILL.md',
};
