import { createTool } from '@mastra/core/tools';
import type { Tool, ToolExecutionContext } from '@mastra/core/tools';
import type { LaunchOptions } from 'playwright';
import { chromium, devices } from 'playwright';
import { z } from 'zod';
import type { ToolContext } from './types';

type DeviceDescriptor = (typeof devices)[keyof typeof devices];

interface BrowserArgs extends LaunchOptions {
  device?: DeviceDescriptor;
}

const outputSchema = z.object({
  message: z.string(),
});

type InputSchema = undefined;
type OutputSchema = typeof outputSchema;

export function launchBrowserTool(
  { device, ...args }: BrowserArgs = {
    headless: false,
    slowMo: 1000,
    device: devices['Desktop Chrome'],
  },
  globalContext: ToolContext,
): Tool<InputSchema, OutputSchema, ToolExecutionContext<InputSchema>> {
  return createTool({
    id: 'launch-browser',
    description: 'Launches a browser',
    outputSchema,
    execute: async ({ mastra }) => {
      try {
        if (!globalContext.browser) {
          globalContext.browser = await chromium.launch(args);
        }

        mastra?.logger?.debug('[browser] launching browser');
        const context = await globalContext.browser.newContext(device);

        globalContext.context = context;
        return { message: 'Browser is open' };
      } catch (e) {
        if (e instanceof Error) {
          return { message: `Error: ${e.message}` };
        }

        return { message: 'Error: unknown error' };
      }
    },
  });
}
