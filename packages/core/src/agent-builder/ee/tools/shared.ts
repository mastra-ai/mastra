/**
 * Shared helpers for built-in `project_*` tools.
 *
 * Project data lives on a stored agent with `role: 'supervisor'`. Tasks,
 * invited agents and skills are all persisted under `metadata.project`.
 *
 * @license Mastra Enterprise License — see `ee/LICENSE`.
 */

import type { MastraUnion } from '../../../action';
import type { ProjectMetadata, ProjectTask, StorageAgentType } from '../../../storage/types';

export function requireStorage(mastra: MastraUnion | undefined) {
  const storage = mastra?.getStorage?.();
  if (!storage) {
    throw new Error('Storage is not configured on Mastra — project tools require storage.');
  }
  return storage;
}

export async function requireAgentsStore(mastra: MastraUnion | undefined) {
  const storage = requireStorage(mastra);
  const store = await storage.getStore('agents');
  if (!store) {
    throw new Error('Agents storage domain is not available.');
  }
  return store;
}

export async function requireProject(mastra: MastraUnion | undefined, projectId: string) {
  const agents = await requireAgentsStore(mastra);
  const record = await agents.getById(projectId);
  if (!record) {
    throw new Error(`Project not found: ${projectId}`);
  }
  if ((record.role ?? 'agent') !== 'supervisor') {
    throw new Error(`Agent ${projectId} is not a project (role=supervisor).`);
  }
  return record;
}

export function getProjectMetadata(record: StorageAgentType): ProjectMetadata {
  const meta = (record.metadata ?? {}) as Record<string, unknown>;
  const existing = meta.project as Partial<ProjectMetadata> | undefined;
  return {
    isProject: true,
    tasks: existing?.tasks ?? [],
    invitedAgentIds: existing?.invitedAgentIds ?? [],
    invitedSkillIds: existing?.invitedSkillIds ?? [],
  };
}

export function writeProjectMetadata(record: StorageAgentType, next: ProjectMetadata): Record<string, unknown> {
  return { ...(record.metadata ?? {}), project: next };
}

export function newTask(input: { title: string; description?: string; assigneeAgentId?: string }): ProjectTask {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    assigneeAgentId: input.assigneeAgentId,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Resolve the projectId for a project tool call.
 * Priority: requestContext.projectId → first positional arg.
 */
export function resolveProjectId(requestContext: any, fallback?: string): string {
  const fromContext = requestContext?.get?.('projectId') ?? requestContext?.projectId;
  const id = fromContext ?? fallback;
  if (typeof id !== 'string' || !id) {
    throw new Error('projectId is required. Pass it via requestContext.projectId.');
  }
  return id;
}
