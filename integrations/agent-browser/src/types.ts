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
 * and the page title. On failure, returns unified BrowserToolError format.
 */
export const navigateOutputSchema = z.discriminatedUnion('success', [
  // Success case
  z.object({
    success: z.literal(true),
    url: z.string().describe('The final URL after navigation (may differ due to redirects)'),
    title: z.string().describe('The page title'),
  }),
  // Error case - matches BrowserToolError from errors.ts
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
    recoveryHint: z.string().optional().describe('Suggested recovery action'),
    canRetry: z.boolean().describe('Whether the operation can be retried'),
  }),
]);

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
 * Supports both success (tree/elementCount/truncated) and error (code/message/recoveryHint) cases.
 */
export const snapshotOutputSchema = z.object({
  success: z.boolean().optional().describe('Whether the snapshot succeeded'),
  tree: z.string().optional().describe('Formatted accessibility tree with refs'),
  elementCount: z.number().optional().describe('Number of interactive elements found'),
  truncated: z.boolean().optional().describe('Whether output was truncated due to maxElements'),
  code: z.string().optional().describe('Error code if snapshot failed'),
  message: z.string().optional().describe('Error message if snapshot failed'),
  recoveryHint: z.string().optional().describe('Recovery hint for the agent'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
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
 * Supports both success and error cases.
 */
export const clickOutputSchema = z.object({
  success: z.boolean().describe('Whether the click succeeded'),
  url: z.string().optional().describe('Current page URL after click'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if click failed'),
  message: z.string().optional().describe('Error message if click failed'),
  recoveryHint: z.string().optional().describe('Recovery hint for the agent'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
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
 * Supports both success and error cases.
 */
export const typeOutputSchema = z.object({
  success: z.boolean().describe('Whether the type operation succeeded'),
  value: z.string().optional().describe('Current field value after typing'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if type failed'),
  message: z.string().optional().describe('Error message if type failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
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
 * Supports both success and error cases.
 */
export const scrollOutputSchema = z.object({
  success: z.boolean().describe('Whether the scroll operation succeeded'),
  position: z
    .object({
      x: z.number().describe('Horizontal scroll position in pixels'),
      y: z.number().describe('Vertical scroll position in pixels'),
    })
    .optional()
    .describe('New scroll position after scrolling'),
  code: z.string().optional().describe('Error code if scroll failed'),
  message: z.string().optional().describe('Error message if scroll failed'),
  recoveryHint: z.string().optional().describe('Recovery hint for the agent'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
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
 * Screenshots are saved to disk and a path is returned to avoid context bloat.
 * Supports both success and error cases.
 */
export const screenshotOutputSchema = z.object({
  success: z.boolean().describe('Whether the screenshot was captured successfully'),
  message: z.string().describe('Description of the captured screenshot'),
  path: z.string().optional().describe('File path where the screenshot was saved'),
  publicPath: z.string().optional().describe('Public URL path for viewing the screenshot'),
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
  warning: z.string().optional().describe('Warning message if image dimensions exceed recommended limits'),
  // Error fields for failure cases
  code: z.string().optional().describe('Error code if screenshot failed'),
  recoveryHint: z.string().optional().describe('Recovery hint for the agent'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

/**
 * Input type for the screenshot tool.
 */
export type ScreenshotInput = z.infer<typeof screenshotInputSchema>;

/**
 * Output type for the screenshot tool.
 */
export type ScreenshotOutput = z.infer<typeof screenshotOutputSchema>;

