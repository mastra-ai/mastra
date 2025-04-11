import type { z } from 'zod';
import type { BrowserTool, RealtimeConnection } from './types';

export function createBrowserTool<T extends z.ZodSchema>(config: {
  id: string;
  inputSchema: T;
  description: string;
  execute: (input: z.infer<T>, options: { connection: RealtimeConnection }) => Promise<any>;
}): BrowserTool<T> {
  return config as BrowserTool<T>;
}
