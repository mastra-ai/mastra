import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { TaskmarketClient, type TaskmarketApiOptions } from './api.js';
import { createTask } from './cli.js';

const taskIdSchema = z.object({
  taskId: z
    .string()
    .min(1)
    .describe('Taskmarket task ID (0x-prefixed 32-byte hex string).'),
});

const listTasksInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum number of open tasks to return.'),
  minRewardUsdc: z
    .number()
    .min(0)
    .optional()
    .describe('Only return tasks with a reward of at least this many USDC.'),
  maxRewardUsdc: z
    .number()
    .min(0)
    .optional()
    .describe('Only return tasks with a reward of at most this many USDC.'),
  mode: z
    .enum(['bounty', 'claim', 'pitch', 'benchmark', 'auction'])
    .optional()
    .describe('Only return tasks of this mode.'),
});

const createTaskInputSchema = z.object({
  description: z
    .string()
    .min(1)
    .describe('Exact task description the requester wants done.'),
  rewardUsdc: z
    .number()
    .positive()
    .describe('Reward in USDC, paid from the wallet managed by the taskmarket CLI.'),
  durationHours: z
    .number()
    .positive()
    .describe('Task duration in hours before it expires.'),
  maxSpendUsdc: z
    .number()
    .positive()
    .optional()
    .describe(
      'Hard cap on the reward for this call. Cannot exceed the TASKMARKET_MAX_SPEND_USDC environment variable (default 10 USDC); the configured ceiling always wins.',
    ),
  confirmation: z
    .boolean()
    .default(false)
    .describe(
      'Must be true to create the task. Creating a task spends real USDC from the requester wallet, so this requires fresh explicit user authorization.',
    ),
});

const taskOutputSchema = z.object({
  id: z.string(),
  description: z.string(),
  rewardUsdc: z.number(),
  mode: z.string(),
  status: z.string(),
  submissionCount: z.number(),
  expiryTime: z.string().optional(),
  tags: z.array(z.string()),
  requester: z.string().optional(),
  requesterAgentId: z.string().optional(),
  pendingActions: z.unknown().optional(),
});

const submissionOutputSchema = z.object({
  id: z.string(),
  workerAddress: z.string().optional(),
  submittedAt: z.string().optional(),
  deliverableUrl: z.string().optional(),
  deliverableHash: z.string().optional(),
});

const listTasksOutputSchema = z.object({
  network: z.string(),
  count: z.number(),
  tasks: z.array(taskOutputSchema),
});

export function createTaskmarketListTasksTool(config?: TaskmarketApiOptions) {
  let client: TaskmarketClient | null = null;
  const getClient = () => {
    if (!client) client = new TaskmarketClient(config);
    return client;
  };
  return createTool({
    id: 'taskmarket-list-open-tasks',
    description:
      'List open tasks on Taskmarket (Base network, USDC rewards). Optionally filter by minimum or maximum reward and by task mode.',
    inputSchema: listTasksInputSchema,
    outputSchema: listTasksOutputSchema,
    execute: async input => getClient().listTasks(input),
  });
}

export function createTaskmarketGetTaskTool(config?: TaskmarketApiOptions) {
  let client: TaskmarketClient | null = null;
  const getClient = () => {
    if (!client) client = new TaskmarketClient(config);
    return client;
  };
  return createTool({
    id: 'taskmarket-get-task',
    description:
      'Fetch the full details of a single Taskmarket task on Base by its task ID.',
    inputSchema: taskIdSchema,
    outputSchema: z.object({
      network: z.string(),
      task: taskOutputSchema,
    }),
    execute: async input => getClient().getTask(input.taskId),
  });
}

export function createTaskmarketTrackTaskTool(config?: TaskmarketApiOptions) {
  let client: TaskmarketClient | null = null;
  const getClient = () => {
    if (!client) client = new TaskmarketClient(config);
    return client;
  };
  return createTool({
    id: 'taskmarket-track-task',
    description:
      'Re-fetch a Taskmarket task by ID and return its live status, reward, expiry, and submission count. Use this to check a task you created.',
    inputSchema: taskIdSchema,
    outputSchema: z.object({
      taskId: z.string(),
      status: z.string(),
      rewardUsdc: z.number(),
      expiryTime: z.string().optional(),
      submissionCount: z.number(),
      mode: z.string(),
      requester: z.string().optional(),
      requesterAgentId: z.string().optional(),
      pendingActions: z.unknown().optional(),
    }),
    execute: async input => {
      const { task } = await getClient().getTask(input.taskId);
      return {
        taskId: task.id,
        status: task.status,
        rewardUsdc: task.rewardUsdc,
        expiryTime: task.expiryTime,
        submissionCount: task.submissionCount,
        mode: task.mode,
        requester: task.requester,
        requesterAgentId: task.requesterAgentId,
        pendingActions: task.pendingActions,
      };
    },
  });
}

export function createTaskmarketListSubmissionsTool(config?: TaskmarketApiOptions) {
  let client: TaskmarketClient | null = null;
  const getClient = () => {
    if (!client) client = new TaskmarketClient(config);
    return client;
  };
  return createTool({
    id: 'taskmarket-list-submissions',
    description:
      'List the submissions on a Taskmarket task and present them for human review. Never accepts or rejects work automatically; a human requester decides.',
    inputSchema: taskIdSchema,
    outputSchema: z.object({
      taskId: z.string(),
      count: z.number(),
      submissions: z.array(submissionOutputSchema),
      reviewNote: z.string(),
    }),
    execute: async input => getClient().listSubmissions(input.taskId),
  });
}

export function createTaskmarketCreateTaskTool() {
  return createTool({
    id: 'taskmarket-create-task',
    description:
      'Create a funded task on Taskmarket (Base, USDC) as a requester through the first-party taskmarket CLI. Requires explicit confirmation, shows the exact plan, and enforces the TASKMARKET_MAX_SPEND_USDC spending limit (default 10 USDC; the configured ceiling always wins). Never retries a payment whose settlement status is unknown.',
    inputSchema: createTaskInputSchema,
    outputSchema: z.object({
      status: z.string(),
      taskId: z.string().optional(),
      plan: z.record(z.string(), z.unknown()).optional(),
      message: z.string().optional(),
    }),
    execute: async input =>
      createTask({
        description: input.description,
        rewardUsdc: input.rewardUsdc,
        durationHours: input.durationHours,
        maxSpendUsdc: input.maxSpendUsdc,
        confirmation: input.confirmation,
      }),
  });
}

export function createTaskmarketTools(config?: TaskmarketApiOptions) {
  return {
    taskmarketListOpenTasks: createTaskmarketListTasksTool(config),
    taskmarketGetTask: createTaskmarketGetTaskTool(config),
    taskmarketTrackTask: createTaskmarketTrackTaskTool(config),
    taskmarketCreateTask: createTaskmarketCreateTaskTool(),
    taskmarketListSubmissions: createTaskmarketListSubmissionsTool(config),
  };
}
