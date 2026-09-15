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
    if (!agent?.threadId || !agent.resourceId) {
      throw new Error('A threadId and resourceId are required to create a schedule.');
    }

    return mastra!.schedules.create({
      agentId: 'agent',
      cron: schedule,
      prompt,
      threadId: agent.threadId,
      resourceId: agent.resourceId,
    });
  },
});

export const stopScheduleTool = createTool({
  id: 'stop_schedule',
  description: 'Stop a schedule by pausing it.',
  inputSchema: z.object({
    scheduleId: z.string().describe('Schedule id returned by start_schedule.'),
  }),
  execute: async ({ scheduleId }, { mastra }) => mastra!.schedules.pause(scheduleId),
});
