import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { AgentBuilderDefaults } from '../../defaults';

// taskManager tool that only allows updates, not creation
export const restrictedTaskManager = createTool({
  id: 'task-manager',
  description:
    'View and update your pre-loaded task list. You can only mark tasks as in_progress or completed, not create new tasks.',
  inputSchema: z.object({
    action: z
      .enum(['list', 'update', 'complete'])
      .describe('List tasks, update status, or mark complete - tasks are pre-loaded'),
    tasks: z
      .array(
        z.object({
          id: z.string().describe('Task ID - must match existing task'),
          content: z.string().optional().describe('Task content (read-only)'),
          status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).describe('Task status'),
          priority: z.enum(['high', 'medium', 'low']).optional().describe('Task priority (read-only)'),
          dependencies: z.array(z.string()).optional().describe('Task dependencies (read-only)'),
          notes: z.string().optional().describe('Additional notes or progress updates'),
        }),
      )
      .optional()
      .describe('Tasks to update (status and notes only)'),
    taskId: z.string().optional().describe('Specific task ID for single task operations'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    tasks: z.array(
      z.object({
        id: z.string(),
        content: z.string(),
        status: z.string(),
        priority: z.string(),
        dependencies: z.array(z.string()).optional(),
        notes: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    ),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    // Convert to the expected format for manageTaskList
    const adaptedContext = {
      ...context,
      action: context.action,
      tasks: context.tasks?.map(task => ({
        ...task,
        priority: task.priority || ('medium' as const),
      })),
    };
    return await AgentBuilderDefaults.manageTaskList(adaptedContext);
  },
});
