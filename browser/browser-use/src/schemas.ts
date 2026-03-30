/**
 * Browser Use Tool Schemas
 *
 * Tools for browser automation using Browser Use cloud service.
 * The primary tool is `browser_use_run` which delegates tasks to Browser Use's AI agent.
 */

import { z } from 'zod';

// =============================================================================
// Core AI Tools
// =============================================================================

/**
 * browser_use_run - Run an AI agent task in the cloud
 *
 * This is the main high-level tool that delegates a task to Browser Use's cloud AI agent.
 * The agent will autonomously navigate, click, type, and extract data to complete the task.
 */
export const runInputSchema = z.object({
  task: z
    .string()
    .describe('Natural language description of the task to perform (e.g., "Go to google.com and search for AI news")'),
  startUrl: z.string().optional().describe('URL to start the task from'),
  maxSteps: z.number().optional().describe('Maximum steps the agent can take (default: 100)'),
  llm: z
    .enum([
      'browser-use-llm',
      'browser-use-2.0',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'o4-mini',
      'o3',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3-pro-preview',
      'gemini-3-flash-preview',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
      'claude-sonnet-4-20250514',
      'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-6',
      'claude-opus-4-5-20251101',
      'llama-4-maverick-17b-128e-instruct',
      'claude-3-7-sonnet-20250219',
    ])
    .optional()
    .describe('LLM model to use for the agent (default: browser-use-2.0)'),
});
export type RunInput = z.output<typeof runInputSchema>;

export const runOutputSchema = z.object({
  output: z.string().nullable().describe('The result/output of the task'),
  status: z.string().describe('Task status: completed, failed, etc.'),
  taskId: z.string().describe('The task ID for reference'),
  steps: z.number().describe('Number of steps taken to complete the task'),
});
export type RunOutput = z.output<typeof runOutputSchema>;

// =============================================================================
// Navigation & State Tools
// =============================================================================

/**
 * browser_use_navigate - Navigate to a URL
 */
export const navigateInputSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
});
export type NavigateInput = z.output<typeof navigateInputSchema>;

export const navigateOutputSchema = z.object({
  url: z.string(),
  title: z.string().nullable(),
});

/**
 * browser_use_screenshot - Take a screenshot
 */
export const screenshotInputSchema = z.object({
  quality: z.number().min(0).max(100).optional().describe('JPEG quality (0-100, default: 80)'),
});
export type ScreenshotInput = z.output<typeof screenshotInputSchema>;

export const screenshotOutputSchema = z.object({
  data: z.string().describe('Base64-encoded image data'),
  url: z.string().nullable(),
});

/**
 * browser_use_get_url - Get current URL and title
 */
export const getUrlInputSchema = z.object({});
export type GetUrlInput = z.output<typeof getUrlInputSchema>;

export const getUrlOutputSchema = z.object({
  url: z.string().nullable(),
  title: z.string().nullable(),
});

/**
 * browser_use_session_info - Get cloud session information
 */
export const sessionInfoInputSchema = z.object({});
export type SessionInfoInput = z.output<typeof sessionInfoInputSchema>;

export const sessionInfoOutputSchema = z.object({
  id: z.string().nullable(),
  liveUrl: z.string().nullable().describe('URL to view the browser live'),
  status: z.string().nullable(),
});

/**
 * browser_use_close - Close the browser session
 */
export const closeInputSchema = z.object({});
export type CloseInput = z.output<typeof closeInputSchema>;

export const closeOutputSchema = z.object({
  success: z.boolean(),
});

/**
 * browser_use_tabs - Manage browser tabs
 */
export const tabsInputSchema = z.object({
  action: z.enum(['list', 'new', 'switch', 'close']).describe('Tab action to perform'),
  index: z.number().optional().describe('Tab index for switch/close actions (0-based)'),
  url: z.string().optional().describe('URL to open in new tab'),
});
export type TabsInput = z.output<typeof tabsInputSchema>;

export const tabsOutputSchema = z.object({
  tabs: z
    .array(
      z.object({
        index: z.number(),
        url: z.string(),
        title: z.string(),
        active: z.boolean(),
      }),
    )
    .optional()
    .describe('List of tabs (for list action)'),
  activeTab: z.number().optional().describe('Index of the active tab'),
  success: z.boolean().optional(),
  hint: z.string().optional(),
});
export type TabsOutput = z.output<typeof tabsOutputSchema>;

// =============================================================================
// All Schemas
// =============================================================================

export const browserUseSchemas = {
  // Core AI
  run: runInputSchema,
  // Navigation & State
  navigate: navigateInputSchema,
  screenshot: screenshotInputSchema,
  getUrl: getUrlInputSchema,
  sessionInfo: sessionInfoInputSchema,
  close: closeInputSchema,
  tabs: tabsInputSchema,
} as const;
