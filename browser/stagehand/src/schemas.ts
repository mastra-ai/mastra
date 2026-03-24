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
 * stagehand_screenshot - Take a screenshot
 */
export const screenshotInputSchema = z.object({
  fullPage: z.boolean().optional().describe('Capture full scrollable page (default: false)'),
});
export type ScreenshotInput = z.output<typeof screenshotInputSchema>;

/**
 * stagehand_close - Close the browser
 */
export const closeInputSchema = z.object({});
export type CloseInput = z.output<typeof closeInputSchema>;

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
  screenshot: screenshotInputSchema,
  close: closeInputSchema,
} as const;
