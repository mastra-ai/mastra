import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const startScheduleTool = createTool({
  id: 'start_schedule',
  description: 'Start a recurring schedule for the default agent.',
  inputSchema: z.object({
    schedule: z.string().describe('Cron expression for when to run.'),
    prompt: z.string().describe('Prompt to run on the schedule.'),
  }),
  execute: async ({ schedule, prompt }, { mastra, agent }) => {
    if (!mastra) {
      throw new Error('Mastra is required to create a schedule.');
    }

    const threadContext =
      agent?.threadId && agent.resourceId ? { threadId: agent.threadId, resourceId: agent.resourceId } : {};

    return mastra.schedules.create({
      agentId: 'agent',
      cron: schedule,
      prompt,
      ...threadContext,
    });
  },
});

export const stopScheduleTool = createTool({
  id: 'stop_schedule',
  description: 'Pause a recurring schedule by ID.',
  inputSchema: z.object({
    scheduleId: z.string().describe('Schedule id returned by start_schedule.'),
  }),
  execute: async ({ scheduleId }, { mastra }) => {
    if (!mastra) {
      throw new Error('Mastra is required to pause a schedule.');
    }

    return mastra.schedules.pause(scheduleId);
  },
});
