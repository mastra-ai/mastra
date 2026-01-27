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

// ============================================================================
// Snapshot Tool Schemas
// ============================================================================

/**
 * Zod schema for the snapshot tool input parameters.
 *
 * Controls which elements to include in the accessibility snapshot.
 */
export const snapshotInputSchema = z.object({
  interactiveOnly: z
    .boolean()
    .optional()
    .default(true)
    .describe('Only show interactive elements (buttons, links, inputs)'),
  maxElements: z.number().optional().default(50).describe('Maximum elements to return'),
});

/**
 * Zod schema for the snapshot tool output.
 *
 * Returns a formatted accessibility tree with element refs.
 */
export const snapshotOutputSchema = z.object({
  tree: z.string().describe('Formatted accessibility tree with refs'),
  elementCount: z.number().describe('Number of interactive elements found'),
  truncated: z.boolean().describe('Whether output was truncated due to maxElements'),
});

/**
 * Input type for the snapshot tool.
 */
export type SnapshotInput = z.infer<typeof snapshotInputSchema>;

/**
 * Output type for the snapshot tool.
 */
export type SnapshotOutput = z.infer<typeof snapshotOutputSchema>;

// ============================================================================
// Click Tool Schemas
// ============================================================================

/**
 * Zod schema for the click tool input parameters.
 *
 * Specifies which element to click and with which mouse button.
 */
export const clickInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
  button: z
    .enum(['left', 'right', 'middle'])
    .optional()
    .default('left')
    .describe('Mouse button to click with'),
});

/**
 * Zod schema for the click tool output.
 */
export const clickOutputSchema = z.object({
  success: z.boolean().describe('Whether the click succeeded'),
});

/**
 * Input type for the click tool.
 */
export type ClickInput = z.infer<typeof clickInputSchema>;

/**
 * Output type for the click tool.
 */
export type ClickOutput = z.infer<typeof clickOutputSchema>;

// ============================================================================
// Type Tool Schemas
// ============================================================================

/**
 * Zod schema for the type tool input parameters.
 *
 * Specifies which element to type into and what text to enter.
 */
export const typeInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e3)'),
  text: z.string().describe('Text to type'),
  clearFirst: z
    .boolean()
    .optional()
    .default(false)
    .describe('Clear existing content before typing'),
});

/**
 * Zod schema for the type tool output.
 *
 * Returns success status and the current field value after typing.
 */
export const typeOutputSchema = z.object({
  success: z.boolean().describe('Whether the type operation succeeded'),
  value: z.string().optional().describe('Current field value after typing'),
});

/**
 * Input type for the type tool.
 */
export type TypeInput = z.infer<typeof typeInputSchema>;

/**
 * Output type for the type tool.
 */
export type TypeOutput = z.infer<typeof typeOutputSchema>;

// ============================================================================
// Scroll Tool Schemas
// ============================================================================

/**
 * Zod schema for the scroll tool input parameters.
 *
 * Specifies scroll direction, amount, and optionally a target element.
 */
export const scrollInputSchema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
  amount: z
    .union([z.enum(['page', 'half']), z.number().describe('Pixels to scroll')])
    .optional()
    .default('page')
    .describe('Amount to scroll: "page", "half", or number of pixels'),
  ref: z.string().optional().describe('Element ref to scroll within (omit for viewport)'),
});

/**
 * Zod schema for the scroll tool output.
 *
 * Returns success status and the new scroll position.
 */
export const scrollOutputSchema = z.object({
  success: z.boolean().describe('Whether the scroll operation succeeded'),
  position: z
    .object({
      x: z.number().describe('Horizontal scroll position in pixels'),
      y: z.number().describe('Vertical scroll position in pixels'),
    })
    .describe('New scroll position after scrolling'),
});

/**
 * Input type for the scroll tool.
 */
export type ScrollInput = z.infer<typeof scrollInputSchema>;

/**
 * Output type for the scroll tool.
 */
export type ScrollOutput = z.infer<typeof scrollOutputSchema>;

// ============================================================================
// Screenshot Tool Schemas
// ============================================================================

/**
 * Zod schema for the screenshot tool input parameters.
 *
 * Supports viewport, full-page, and element capture modes.
 */
export const screenshotInputSchema = z.object({
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe('Capture the entire scrollable page instead of just the viewport'),
  format: z
    .enum(['png', 'jpeg'])
    .optional()
    .default('png')
    .describe('Image format. PNG is lossless, JPEG is smaller.'),
  quality: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(80)
    .describe('JPEG quality (0-100). Ignored for PNG.'),
  ref: z
    .string()
    .optional()
    .describe('Element ref from snapshot to capture specific element (e.g., @e5)'),
});

/**
 * Zod schema for the screenshot tool output.
 *
 * Returns base64 image data with metadata for multimodal consumption.
 */
export const screenshotOutputSchema = z.object({
  base64: z.string().describe('Base64-encoded image data'),
  mimeType: z.enum(['image/png', 'image/jpeg']).describe('Image MIME type'),
  dimensions: z
    .object({
      width: z.number().describe('Image width in pixels'),
      height: z.number().describe('Image height in pixels'),
    })
    .describe('Image dimensions'),
  fileSize: z.number().describe('Image file size in bytes'),
  timestamp: z.string().describe('ISO timestamp when screenshot was captured'),
  url: z.string().describe('Page URL at capture time'),
  title: z.string().describe('Page title at capture time'),
  warning: z
    .string()
    .optional()
    .describe('Warning message if image dimensions exceed recommended limits'),
});

/**
 * Input type for the screenshot tool.
 */
export type ScreenshotInput = z.infer<typeof screenshotInputSchema>;

/**
 * Output type for the screenshot tool.
 */
export type ScreenshotOutput = z.infer<typeof screenshotOutputSchema>;

// ============================================================================
// Legacy/General Types
// ============================================================================

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
