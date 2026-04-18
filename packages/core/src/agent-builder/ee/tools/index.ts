/**
 * Built-in project tools for supervisor (Project) stored agents.
 *
 * These tools are registered by the server when `mastra.agentBuilder` is
 * configured. They read/write the project record in the `agents` storage
 * domain (tasks live under `metadata.project.tasks`).
 *
 * Tool ids (stable, used in supervisor agent `tools` config):
 *   - project_add_task
 *   - project_update_task
 *   - project_list_tasks
 *   - project_search_marketplace
 *   - project_propose_agent
 *
 * @license Mastra Enterprise License — see `ee/LICENSE`.
 */

import { z } from 'zod/v4';
import { createTool } from '../../../tools';
import {
  getProjectMetadata,
  newTask,
  requireAgentsStore,
  requireProject,
  requireStorage,
  resolveProjectId,
  writeProjectMetadata,
} from './shared';

const taskStatusSchema = z.enum(['open', 'in_progress', 'done', 'blocked']);

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  assigneeAgentId: z.string().optional(),
  status: taskStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const PROJECT_ADD_TASK = 'project_add_task';
const PROJECT_UPDATE_TASK = 'project_update_task';
const PROJECT_LIST_TASKS = 'project_list_tasks';
const PROJECT_SEARCH_MARKETPLACE = 'project_search_marketplace';
const PROJECT_PROPOSE_AGENT = 'project_propose_agent';

/**
 * Stable tool IDs. Supervisor agents list these in their `tools` config so
 * chat UIs and the tool-execute route can resolve them.
 */
export const PROJECT_TOOL_IDS = {
  ADD_TASK: PROJECT_ADD_TASK,
  UPDATE_TASK: PROJECT_UPDATE_TASK,
  LIST_TASKS: PROJECT_LIST_TASKS,
  SEARCH_MARKETPLACE: PROJECT_SEARCH_MARKETPLACE,
  PROPOSE_AGENT: PROJECT_PROPOSE_AGENT,
} as const;

export const addTaskTool = createTool({
  id: PROJECT_ADD_TASK,
  description: 'Add a task to the current project. Use when the user asks you to track or plan work.',
  inputSchema: z.object({
    title: z.string(),
    description: z.string().optional(),
    assigneeAgentId: z.string().optional().describe('Optional stored agent id to assign the task to'),
    projectId: z.string().optional().describe('Override the project id (defaults to requestContext.projectId)'),
  }),
  outputSchema: taskSchema,
  execute: async (input, context) => {
    const projectId = resolveProjectId(context?.requestContext, input.projectId);
    const record = await requireProject(context?.mastra, projectId);
    const meta = getProjectMetadata(record);
    const task = newTask({
      title: input.title,
      description: input.description,
      assigneeAgentId: input.assigneeAgentId,
    });
    const next = { ...meta, tasks: [...meta.tasks, task] };
    const agents = await requireAgentsStore(context?.mastra);
    await agents.update({ id: projectId, metadata: writeProjectMetadata(record, next) });
    return task;
  },
});

export const updateTaskTool = createTool({
  id: PROJECT_UPDATE_TASK,
  description: 'Update a project task (status, title, description, or assignee).',
  inputSchema: z.object({
    taskId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: taskStatusSchema.optional(),
    assigneeAgentId: z.string().optional(),
    projectId: z.string().optional(),
  }),
  outputSchema: taskSchema,
  execute: async (input, context) => {
    const projectId = resolveProjectId(context?.requestContext, input.projectId);
    const record = await requireProject(context?.mastra, projectId);
    const meta = getProjectMetadata(record);
    const idx = meta.tasks.findIndex(t => t.id === input.taskId);
    if (idx < 0) throw new Error(`Task not found: ${input.taskId}`);
    const existing = meta.tasks[idx]!;
    const updated = {
      ...existing,
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.assigneeAgentId !== undefined && { assigneeAgentId: input.assigneeAgentId }),
      updatedAt: new Date().toISOString(),
    };
    const tasks = [...meta.tasks];
    tasks[idx] = updated;
    const agents = await requireAgentsStore(context?.mastra);
    await agents.update({ id: projectId, metadata: writeProjectMetadata(record, { ...meta, tasks }) });
    return updated;
  },
});

export const listTasksTool = createTool({
  id: PROJECT_LIST_TASKS,
  description: 'List all tasks for the current project.',
  inputSchema: z.object({
    projectId: z.string().optional(),
  }),
  outputSchema: z.object({ tasks: z.array(taskSchema) }),
  execute: async (input, context) => {
    const projectId = resolveProjectId(context?.requestContext, input.projectId);
    const record = await requireProject(context?.mastra, projectId);
    const meta = getProjectMetadata(record);
    return { tasks: meta.tasks };
  },
});

const marketplaceHitSchema = z.object({
  kind: z.enum(['agent', 'skill']),
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  authorId: z.string().optional(),
});

export const searchMarketplaceTool = createTool({
  id: PROJECT_SEARCH_MARKETPLACE,
  description:
    'Search the Agent Studio marketplace for public agents and skills. Use when the user asks for help finding a tool or specialist.',
  inputSchema: z.object({
    query: z.string().describe('Free-text search applied to name and description.'),
    kind: z.enum(['agent', 'skill', 'both']).optional().default('both'),
    limit: z.number().int().min(1).max(25).optional().default(10),
  }),
  outputSchema: z.object({ hits: z.array(marketplaceHitSchema) }),
  execute: async (input, context) => {
    const storage = requireStorage(context?.mastra);
    const query = input.query.toLowerCase();
    const hits: Array<z.infer<typeof marketplaceHitSchema>> = [];

    if (input.kind !== 'skill') {
      const agentsStore = await storage.getStore('agents');
      if (agentsStore) {
        const res = await agentsStore.listResolved({
          status: 'published',
          metadata: { visibility: 'public' },
          perPage: 100,
        });
        for (const a of res.agents) {
          const name = (a.name ?? a.id).toString();
          const description = (a as any).description as string | undefined;
          if (name.toLowerCase().includes(query) || (description && description.toLowerCase().includes(query))) {
            hits.push({ kind: 'agent', id: a.id, name, description, authorId: a.authorId });
          }
        }
      }
    }

    if (input.kind !== 'agent') {
      const skillsStore = await storage.getStore('skills');
      if (skillsStore) {
        const res = await skillsStore.listResolved({
          metadata: { visibility: 'public' },
          perPage: 100,
        });
        for (const s of res.skills) {
          const name = (s.name ?? s.id).toString();
          const description = (s as any).description as string | undefined;
          if (name.toLowerCase().includes(query) || (description && description.toLowerCase().includes(query))) {
            hits.push({ kind: 'skill', id: s.id, name, description, authorId: s.authorId });
          }
        }
      }
    }

    return { hits: hits.slice(0, input.limit) };
  },
});

export const proposeAgentTool = createTool({
  id: PROJECT_PROPOSE_AGENT,
  description:
    'Propose adding a marketplace agent to the project. The user will be shown an approval card; on accept, the agent joins the project and is starred.',
  inputSchema: z.object({
    agentId: z.string(),
    reason: z.string().describe('Why this agent is a good addition (shown to the user).'),
    projectId: z.string().optional(),
  }),
  outputSchema: z.object({
    kind: z.literal('proposal'),
    agentId: z.string(),
    reason: z.string(),
    projectId: z.string(),
  }),
  execute: async (input, context) => {
    const projectId = resolveProjectId(context?.requestContext, input.projectId);
    // Verify the project and candidate exist. The actual invite+star happens
    // when the user approves the card via the /projects/:id/invite-agent route.
    await requireProject(context?.mastra, projectId);
    const agents = await requireAgentsStore(context?.mastra);
    const candidate = await agents.getById(input.agentId);
    if (!candidate) {
      throw new Error(`Candidate agent not found: ${input.agentId}`);
    }
    return { kind: 'proposal' as const, agentId: input.agentId, reason: input.reason, projectId };
  },
});

/**
 * Return the full set of built-in project tools as a `{ [id]: tool }` map,
 * suitable for merging into `registeredTools`.
 */
export function getProjectTools() {
  return {
    [PROJECT_ADD_TASK]: addTaskTool,
    [PROJECT_UPDATE_TASK]: updateTaskTool,
    [PROJECT_LIST_TASKS]: listTasksTool,
    [PROJECT_SEARCH_MARKETPLACE]: searchMarketplaceTool,
    [PROJECT_PROPOSE_AGENT]: proposeAgentTool,
  };
}
