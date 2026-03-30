/**
 * browser_use_run - Run an AI agent task in the cloud
 *
 * This is the main high-level tool that delegates a task to Browser Use's cloud AI agent.
 * The agent will autonomously navigate, click, type, and extract data to complete the task.
 */

import { createTool } from '@mastra/core/tools';
import type { BrowserUseBrowser } from '../browser-use-browser';
import { runInputSchema, runOutputSchema } from '../schemas';
import { BROWSER_USE_TOOLS } from './constants';

export function createRunTool(browser: BrowserUseBrowser) {
  return createTool({
    id: BROWSER_USE_TOOLS.RUN,
    description:
      'Run an AI agent task that autonomously controls the browser to complete the task. ' +
      'The agent can navigate, click, type, scroll, and extract data. ' +
      'Example: "Go to google.com and search for AI news, then extract the top 3 headlines"',
    inputSchema: runInputSchema,
    outputSchema: runOutputSchema,
    execute: async (input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);

      // Get the SDK client from the browser
      const client = browser.getClient();
      if (!client) {
        throw new Error('Browser Use SDK client not available. Ensure browser is initialized.');
      }

      // Run the AI agent task via the SDK
      const taskRun = client.run(input.task, {
        startUrl: input.startUrl,
        maxSteps: input.maxSteps,
        llm: input.llm,
      });

      // Wait for the task to complete and get the result
      const result = await taskRun;

      return {
        output: result.output ?? null,
        status: result.status ?? 'unknown',
        taskId: taskRun.taskId ?? 'unknown',
        steps: result.steps?.length ?? 0,
      };
    },
  });
}
