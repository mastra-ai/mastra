/**
 * Project handlers.
 *
 * Projects are stored agents with `role: 'supervisor'`. They hold a team of
 * invited sub-agents (in the snapshot's `agents` field) and a task list
 * under `metadata.project.tasks`. The built-in `project_*` tools (registered
 * by `packages/server/src/server/server-adapter/project-tools.ts`) let the
 * supervisor read/write this data during chat.
 */

import { PROJECT_TOOL_IDS } from '@mastra/core/agent-builder/ee';
import type { ProjectMetadata, ProjectTask, StorageAgentType, StorageResolvedAgentType } from '@mastra/core/storage';

import { HTTPException } from '../http-exception';
import {
  projectIdPathParams,
  projectAgentPathParams,
  projectTaskPathParams,
  createProjectBodySchema,
  updateProjectBodySchema,
  inviteAgentBodySchema,
  addProjectTaskBodySchema,
  updateProjectTaskBodySchema,
  listProjectsResponseSchema,
  projectResponseSchema,
  deleteProjectResponseSchema,
  projectTaskResponseSchema,
} from '../schemas/projects';
import { createRoute } from '../server-adapter/routes/route-builder';
import { toSlug } from '../utils';
import { handleError } from './error';
import type { VersionedStoreInterface } from './version-helpers';
import { handleAutoVersioning } from './version-helpers';

const PROJECT_CONFIG_FIELDS = ['name', 'description', 'instructions', 'model', 'tools', 'agents'] as const;

function getAgentsStore(mastra: any) {
  const storage = mastra.getStorage?.();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not configured' });
  }
  return storage.getStore('agents').then((agentsStore: any) => {
    if (!agentsStore) {
      throw new HTTPException(500, { message: 'Agents storage domain is not available' });
    }
    return agentsStore;
  });
}

function defaultProjectMetadata(): ProjectMetadata {
  return { isProject: true, tasks: [], invitedAgentIds: [], invitedSkillIds: [] };
}

function readProjectMetadata(record: StorageAgentType): ProjectMetadata {
  const raw = (record.metadata ?? {}) as Record<string, unknown>;
  const project = raw.project as Partial<ProjectMetadata> | undefined;
  return {
    isProject: true,
    tasks: project?.tasks ?? [],
    invitedAgentIds: project?.invitedAgentIds ?? [],
    invitedSkillIds: project?.invitedSkillIds ?? [],
  };
}

function toProjectResponse(resolved: StorageResolvedAgentType) {
  const meta = readProjectMetadata(resolved);
  return {
    id: resolved.id,
    name: (resolved as any).name,
    description: (resolved as any).description,
    instructions: typeof (resolved as any).instructions === 'string' ? (resolved as any).instructions : undefined,
    model: (resolved as any).model,
    authorId: resolved.authorId,
    status: resolved.status,
    project: meta,
    createdAt: resolved.createdAt,
    updatedAt: resolved.updatedAt,
  };
}

async function requireProject(mastra: any, projectId: string) {
  const agents = await getAgentsStore(mastra);
  const record = await agents.getById(projectId);
  if (!record) {
    throw new HTTPException(404, { message: `Project ${projectId} not found` });
  }
  if (!isProjectRecord(record)) {
    throw new HTTPException(404, { message: `Agent ${projectId} is not a project` });
  }
  return { agents, record } as { agents: any; record: StorageAgentType };
}

function isProjectRecord(record: StorageAgentType | null | undefined): boolean {
  if (!record) return false;
  if (record.role === 'supervisor') return true;
  const project = (record.metadata as Record<string, unknown> | undefined)?.project as
    | { isProject?: boolean }
    | undefined;
  return project?.isProject === true;
}

async function writeProjectMetadata(agents: any, record: StorageAgentType, project: ProjectMetadata) {
  await agents.update({
    id: record.id,
    metadata: { ...(record.metadata ?? {}), project },
  });
}

/**
 * GET /projects — list all projects (supervisor stored agents).
 */
export const LIST_PROJECTS_ROUTE = createRoute({
  method: 'GET',
  path: '/projects',
  responseType: 'json',
  responseSchema: listProjectsResponseSchema,
  summary: 'List projects',
  description: 'Lists all projects (stored agents with role=supervisor).',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:read',
  handler: async ({ mastra }) => {
    try {
      const agents = await getAgentsStore(mastra);
      const result = await agents.listResolved({ status: 'published', perPage: 100 });
      const projectRecords = (result.agents as StorageResolvedAgentType[]).filter(a => {
        const project = (a.metadata as Record<string, unknown> | undefined)?.project as
          | { isProject?: boolean }
          | undefined;
        return a.role === 'supervisor' || project?.isProject === true;
      });
      return {
        projects: projectRecords.map(a => toProjectResponse(a)),
        total: projectRecords.length,
        page: result.page,
        perPage: result.perPage,
        hasMore: result.hasMore,
      };
    } catch (error) {
      return handleError(error, 'Error listing projects');
    }
  },
});

/**
 * GET /projects/:projectId — get a single project.
 */
export const GET_PROJECT_ROUTE = createRoute({
  method: 'GET',
  path: '/projects/:projectId',
  responseType: 'json',
  pathParamSchema: projectIdPathParams,
  responseSchema: projectResponseSchema,
  summary: 'Get project by ID',
  description: 'Returns a single project (supervisor stored agent) by id, including its task list and invited agents.',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:read',
  handler: async ({ mastra, projectId }) => {
    try {
      const agents = await getAgentsStore(mastra);
      const record = await agents.getById(projectId);
      if (!record || !isProjectRecord(record)) {
        throw new HTTPException(404, { message: `Project ${projectId} not found` });
      }
      const resolved = await agents.getByIdResolved(projectId, { status: record.status ?? 'published' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve project' });
      }
      return toProjectResponse(resolved);
    } catch (error) {
      return handleError(error, 'Error getting project');
    }
  },
});

/**
 * POST /projects — create a new project (supervisor stored agent).
 */
export const CREATE_PROJECT_ROUTE = createRoute({
  method: 'POST',
  path: '/projects',
  responseType: 'json',
  bodySchema: createProjectBodySchema,
  responseSchema: projectResponseSchema,
  summary: 'Create project',
  description:
    'Creates a supervisor stored agent that acts as a project. Seeds the built-in project_* tools and initializes an empty task list.',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:write',
  handler: async ({ mastra, id: providedId, name, description, instructions, model, invitedAgentIds }) => {
    try {
      const agents = await getAgentsStore(mastra);
      const id = providedId || toSlug(name);
      if (!id) {
        throw new HTTPException(400, { message: 'Could not derive project id from name' });
      }
      const existing = await agents.getById(id);
      if (existing) {
        throw new HTTPException(409, { message: `Project with id ${id} already exists` });
      }

      const supervisorInstructions = [
        instructions?.trim() || description?.trim() || 'Coordinate the team to accomplish the project goals.',
        '',
        'You are the supervisor for this project. You may delegate to any invited sub-agent using the tools available to you. When the user @mentions a specific agent, route the request to only that agent. Use project_add_task/project_update_task to keep the task list accurate, project_search_marketplace to discover new capabilities, and project_propose_agent to suggest additions. Never paraphrase a sub-agent answer — surface it directly when the user addressed that agent.',
      ].join('\n');

      // Seed an empty subagents map from invitedAgentIds
      const agentsMap: Record<string, any> = {};
      for (const subId of invitedAgentIds ?? []) {
        agentsMap[subId] = { agentId: subId };
      }

      // Seed the project_* tools in the snapshot's tools config
      const toolsMap: Record<string, any> = {};
      for (const toolId of Object.values(PROJECT_TOOL_IDS)) {
        toolsMap[toolId] = { toolId };
      }

      const meta: ProjectMetadata = {
        isProject: true,
        tasks: [],
        invitedAgentIds: invitedAgentIds ?? [],
        invitedSkillIds: [],
      };

      const defaultMemory = mastra.getAgentBuilder?.()?.getDefaultMemoryConfig?.() ?? null;

      await agents.create({
        agent: {
          id,
          role: 'supervisor',
          metadata: { project: meta },
          name,
          description,
          instructions: supervisorInstructions,
          model,
          tools: toolsMap,
          agents: agentsMap,
          ...(defaultMemory ? { memory: defaultMemory } : {}),
        } as any,
      });

      // Publish v1 immediately so the project is usable.
      const latest = await agents.getLatestVersion(id);
      if (latest) {
        await agents.update({ id, activeVersionId: latest.id, status: 'published' });
      }

      const resolved = await agents.getByIdResolved(id, { status: 'published' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created project' });
      }
      return toProjectResponse(resolved);
    } catch (error) {
      return handleError(error, 'Error creating project');
    }
  },
});

/**
 * PATCH /projects/:projectId — update name/description/instructions/model.
 */
export const UPDATE_PROJECT_ROUTE = createRoute({
  method: 'PATCH',
  path: '/projects/:projectId',
  responseType: 'json',
  pathParamSchema: projectIdPathParams,
  bodySchema: updateProjectBodySchema,
  responseSchema: projectResponseSchema,
  summary: 'Update project',
  description: 'Updates the name, description, instructions, or model for a project.',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:write',
  handler: async ({ mastra, projectId, name, description, instructions, model }) => {
    try {
      const { agents, record } = await requireProject(mastra, projectId);
      const updatedRecord = await agents.update({
        id: record.id,
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(instructions !== undefined && { instructions }),
        ...(model !== undefined && { model }),
      } as any);
      const provided = Object.fromEntries(
        Object.entries({ name, description, instructions, model }).filter(([, v]) => v !== undefined),
      );
      await handleAutoVersioning(
        agents as unknown as VersionedStoreInterface,
        projectId,
        'agentId',
        PROJECT_CONFIG_FIELDS,
        record,
        updatedRecord ?? record,
        provided,
      );
      // Projects always run on the latest version — auto-activate it.
      const latest = await (agents as any).getLatestVersion(projectId);
      if (latest) {
        await agents.update({ id: projectId, activeVersionId: latest.id, status: 'published' } as any);
      }
      const resolved = await agents.getByIdResolved(projectId, { status: 'published' });
      if (!resolved) throw new HTTPException(500, { message: 'Failed to resolve updated project' });
      return toProjectResponse(resolved);
    } catch (error) {
      return handleError(error, 'Error updating project');
    }
  },
});

/**
 * DELETE /projects/:projectId — remove a project.
 */
export const DELETE_PROJECT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/projects/:projectId',
  responseType: 'json',
  pathParamSchema: projectIdPathParams,
  responseSchema: deleteProjectResponseSchema,
  summary: 'Delete project',
  description: 'Deletes a project by id. The underlying stored agent is removed.',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:delete',
  handler: async ({ mastra, projectId }) => {
    try {
      const { agents } = await requireProject(mastra, projectId);
      await agents.delete(projectId);
      return { id: projectId, deleted: true as const };
    } catch (error) {
      return handleError(error, 'Error deleting project');
    }
  },
});

/**
 * POST /projects/:projectId/invite-agent — add a sub-agent to the project.
 */
export const INVITE_PROJECT_AGENT_ROUTE = createRoute({
  method: 'POST',
  path: '/projects/:projectId/invite-agent',
  responseType: 'json',
  pathParamSchema: projectIdPathParams,
  bodySchema: inviteAgentBodySchema,
  responseSchema: projectResponseSchema,
  summary: 'Invite an agent to a project',
  description: 'Adds a stored agent to the project team so the supervisor can delegate to it.',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:write',
  handler: async ({ mastra, projectId, agentId }) => {
    try {
      const { agents, record } = await requireProject(mastra, projectId);
      const meta = readProjectMetadata(record);
      if (!meta.invitedAgentIds.includes(agentId)) {
        meta.invitedAgentIds = [...meta.invitedAgentIds, agentId];
      }
      // Update the snapshot's `agents` map too so the supervisor can delegate.
      const resolved = (await agents.getByIdResolved(projectId, { status: 'published' })) as any;
      const existingMap = (resolved?.agents ?? {}) as Record<string, any>;
      const agentsMap = { ...existingMap, [agentId]: { agentId } };
      await agents.update({ id: projectId, agents: agentsMap } as any);
      await writeProjectMetadata(agents, record, meta);
      const after = await agents.getByIdResolved(projectId, { status: 'published' });
      if (!after) throw new HTTPException(500, { message: 'Failed to resolve project' });
      return toProjectResponse(after);
    } catch (error) {
      return handleError(error, 'Error inviting agent');
    }
  },
});

/**
 * DELETE /projects/:projectId/invite-agent/:agentId — remove a sub-agent.
 */
export const REMOVE_PROJECT_AGENT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/projects/:projectId/invite-agent/:agentId',
  responseType: 'json',
  pathParamSchema: projectAgentPathParams,
  responseSchema: projectResponseSchema,
  summary: 'Remove an agent from a project',
  description: 'Removes a previously invited stored agent from the project team.',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:write',
  handler: async ({ mastra, projectId, agentId }) => {
    try {
      const { agents, record } = await requireProject(mastra, projectId);
      const meta = readProjectMetadata(record);
      meta.invitedAgentIds = meta.invitedAgentIds.filter(id => id !== agentId);
      const resolved = (await agents.getByIdResolved(projectId, { status: 'published' })) as any;
      const existingMap = { ...((resolved?.agents ?? {}) as Record<string, any>) };
      delete existingMap[agentId];
      await agents.update({ id: projectId, agents: existingMap } as any);
      await writeProjectMetadata(agents, record, meta);
      const after = await agents.getByIdResolved(projectId, { status: 'published' });
      if (!after) throw new HTTPException(500, { message: 'Failed to resolve project' });
      return toProjectResponse(after);
    } catch (error) {
      return handleError(error, 'Error removing agent');
    }
  },
});

/**
 * POST /projects/:projectId/tasks — add a task.
 */
export const CREATE_PROJECT_TASK_ROUTE = createRoute({
  method: 'POST',
  path: '/projects/:projectId/tasks',
  responseType: 'json',
  pathParamSchema: projectIdPathParams,
  bodySchema: addProjectTaskBodySchema,
  responseSchema: projectTaskResponseSchema,
  summary: 'Add a project task',
  description: 'Appends a task to the project task list stored under metadata.project.tasks.',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:write',
  handler: async ({ mastra, projectId, title, description, assigneeAgentId }) => {
    try {
      const { agents, record } = await requireProject(mastra, projectId);
      const meta = readProjectMetadata(record);
      const now = new Date().toISOString();
      const task: ProjectTask = {
        id: crypto.randomUUID(),
        title,
        description,
        assigneeAgentId,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      };
      await writeProjectMetadata(agents, record, { ...meta, tasks: [...meta.tasks, task] });
      return task;
    } catch (error) {
      return handleError(error, 'Error creating task');
    }
  },
});

/**
 * PATCH /projects/:projectId/tasks/:taskId — update a task.
 */
export const UPDATE_PROJECT_TASK_ROUTE = createRoute({
  method: 'PATCH',
  path: '/projects/:projectId/tasks/:taskId',
  responseType: 'json',
  pathParamSchema: projectTaskPathParams,
  bodySchema: updateProjectTaskBodySchema,
  responseSchema: projectTaskResponseSchema,
  summary: 'Update a project task',
  description: 'Updates title, description, status, or assignee for a project task.',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:write',
  handler: async ({ mastra, projectId, taskId, title, description, status, assigneeAgentId }) => {
    try {
      const { agents, record } = await requireProject(mastra, projectId);
      const meta = readProjectMetadata(record);
      const idx = meta.tasks.findIndex(t => t.id === taskId);
      if (idx < 0) throw new HTTPException(404, { message: `Task ${taskId} not found` });
      const existing = meta.tasks[idx]!;
      const updated: ProjectTask = {
        ...existing,
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(assigneeAgentId !== undefined && { assigneeAgentId }),
        updatedAt: new Date().toISOString(),
      };
      const tasks = [...meta.tasks];
      tasks[idx] = updated;
      await writeProjectMetadata(agents, record, { ...meta, tasks });
      return updated;
    } catch (error) {
      return handleError(error, 'Error updating task');
    }
  },
});

/**
 * DELETE /projects/:projectId/tasks/:taskId — delete a task.
 */
export const DELETE_PROJECT_TASK_ROUTE = createRoute({
  method: 'DELETE',
  path: '/projects/:projectId/tasks/:taskId',
  responseType: 'json',
  pathParamSchema: projectTaskPathParams,
  responseSchema: deleteProjectResponseSchema,
  summary: 'Delete a project task',
  description: 'Removes a task from the project task list.',
  tags: ['Projects'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:write',
  handler: async ({ mastra, projectId, taskId }) => {
    try {
      const { agents, record } = await requireProject(mastra, projectId);
      const meta = readProjectMetadata(record);
      const tasks = meta.tasks.filter(t => t.id !== taskId);
      await writeProjectMetadata(agents, record, { ...meta, tasks });
      return { id: taskId, deleted: true as const };
    } catch (error) {
      return handleError(error, 'Error deleting task');
    }
  },
});

// Helper used by default metadata seed if ever reused
export { defaultProjectMetadata };
