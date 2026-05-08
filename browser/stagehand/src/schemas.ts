/**
 * Stagehand Tool Schemas
 *
 * AI-powered browser tools using natural language instructions.
 * These are fundamentally different from the deterministic AgentBrowser tools.
 */

import { z } from 'zod';

// =============================================================================
// Core AI Tools
// =============================================================================

/**
 * stagehand_act - Perform an action using natural language
 */
export const actInputSchema = z.object({
  instruction: z.string().describe('Natural language instruction for the action (e.g., "click the login button")'),
  variables: z
    .record(z.string(), z.string())
    .optional()
    .describe('Variables to substitute in the instruction using %variableName% syntax'),
  useVision: z.boolean().optional().describe('Whether to use vision capabilities (default: true)'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
});
export type ActInput = z.output<typeof actInputSchema>;

/**
 * stagehand_extract - Extract structured data from a page
 */
export const extractInputSchema = z.object({
  instruction: z.string().describe('Natural language instruction for what data to extract'),
  schema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('JSON schema defining the expected data structure (optional, will return unstructured if omitted)'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
});
export type ExtractInput = z.output<typeof extractInputSchema>;

/**
 * stagehand_observe - Discover actionable elements on a page
 */
export const observeInputSchema = z.object({
  instruction: z
    .string()
    .optional()
    .describe(
      'Natural language instruction for what to find (e.g., "find all buttons"). If omitted, finds all interactive elements.',
    ),
  onlyVisible: z.boolean().optional().describe('Only return visible elements (default: true)'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
});
export type ObserveInput = z.output<typeof observeInputSchema>;

// =============================================================================
// Navigation & State Tools
// =============================================================================

/**
 * stagehand_navigate - Navigate to a URL
 */
export const navigateInputSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .describe('When to consider navigation complete (default: domcontentloaded)'),
});
export type NavigateInput = z.output<typeof navigateInputSchema>;

/**
 * stagehand_close - Close the browser
 */
export const closeInputSchema = z.object({});
export type CloseInput = z.output<typeof closeInputSchema>;

/**
 * stagehand_tabs - Manage browser tabs
 */
export const tabsInputSchema = z
  .object({
    action: z
      .enum(['list', 'new', 'switch', 'close'])
      .describe('Action to perform: list all tabs, open new tab, switch to tab, or close tab'),
    index: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Tab index for switch/close actions (0-based). Required for switch, optional for close (defaults to current).',
      ),
    url: z.string().optional().describe('URL to navigate to after opening new tab (optional, for "new" action only)'),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'switch' && value.index === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['index'],
        message: 'index is required when action is "switch"',
      });
    }
  });
export type TabsInput = z.output<typeof tabsInputSchema>;

// =============================================================================
// All Schemas
// =============================================================================

export const stagehandSchemas = {
  // Core AI
  act: actInputSchema,
  extract: extractInputSchema,
  observe: observeInputSchema,
  // Navigation & State
  navigate: navigateInputSchema,
  tabs: tabsInputSchema,
  close: closeInputSchema,
} as const;
