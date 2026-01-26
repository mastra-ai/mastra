import { z } from 'zod';

/**
 * Configuration options for the BrowserToolset constructor.
 *
 * Controls browser launch behavior and global timeout settings.
 */
export interface BrowserToolsetConfig {
  /**
   * Whether to run the browser in headless mode (no visible UI).
   * @default true
   */
  headless?: boolean;

  /**
   * Default timeout in milliseconds for browser operations.
   * @default 10000 (10 seconds)
   */
  timeout?: number;
}

/**
 * Zod schema for the navigate tool input parameters.
 *
 * Validates URL format and waitUntil navigation condition.
 */
export const navigateInputSchema = z.object({
  url: z.string().url().describe('The URL to navigate to'),
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .default('domcontentloaded')
    .describe('When to consider navigation complete. Use domcontentloaded for faster results.'),
});

/**
 * Zod schema for the navigate tool output.
 *
 * Returns navigation success status, final URL (may differ from input due to redirects),
 * and the page title.
 */
export const navigateOutputSchema = z.object({
  success: z.boolean().describe('Whether navigation succeeded'),
  url: z.string().describe('The final URL after navigation (may differ due to redirects)'),
  title: z.string().describe('The page title'),
});

/**
 * Input type for the navigate tool, inferred from the Zod schema.
 */
export type NavigateInput = z.infer<typeof navigateInputSchema>;

/**
 * Output type for the navigate tool, inferred from the Zod schema.
 */
export type NavigateOutput = z.infer<typeof navigateOutputSchema>;

/**
 * Structured error response for browser tool failures.
 *
 * Provides LLM-friendly error information with recovery hints.
 */
export interface BrowserError {
  /** Always false for error responses */
  success: false;
  /** Human-readable error description */
  error: string;
  /** Suggested recovery action for the agent */
  hint: string;
}
