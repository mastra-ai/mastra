/**
 * Zod schemas for the standard browser tool set.
 *
 * These schemas define the input/output contract for browser tools.
 * All browser providers implementing the standard tool set should use
 * these schemas to ensure consistent interfaces across providers.
 */

import { z } from 'zod';

// ============================================================================
// Navigate Tool Schemas
// ============================================================================

export const navigateInputSchema = z.object({
  url: z.string().url().describe('The URL to navigate to'),
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .default('domcontentloaded')
    .describe('When to consider navigation complete. Use domcontentloaded for faster results.'),
});

export const navigateOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    url: z.string().describe('The final URL after navigation (may differ due to redirects)'),
    title: z.string().describe('The page title'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
    recoveryHint: z.string().optional().describe('Suggested recovery action'),
    canRetry: z.boolean().describe('Whether the operation can be retried'),
  }),
]);

export type NavigateInput = z.infer<typeof navigateInputSchema>;
export type NavigateOutput = z.infer<typeof navigateOutputSchema>;

// ============================================================================
// Snapshot Tool Schemas
// ============================================================================

export const snapshotInputSchema = z.object({
  interactiveOnly: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Only show interactive elements (buttons, links, inputs). Set to false to see ALL page text content — required for reading articles, paragraphs, or any non-interactive text.',
    ),
  maxElements: z.number().optional().default(50).describe('Maximum elements to include in output'),
  offset: z
    .number()
    .optional()
    .default(0)
    .describe('Skip first N elements (for pagination). Use offset:50 to see elements 51-100.'),
});

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

export type SnapshotInput = z.infer<typeof snapshotInputSchema>;
export type SnapshotOutput = z.infer<typeof snapshotOutputSchema>;

// ============================================================================
// Click Tool Schemas
// ============================================================================

export const clickInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
  button: z.enum(['left', 'right', 'middle']).optional().default('left').describe('Mouse button to click with'),
});

export const clickOutputSchema = z.object({
  success: z.boolean().describe('Whether the click succeeded'),
  url: z.string().optional().describe('Current page URL after click'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if click failed'),
  message: z.string().optional().describe('Error message if click failed'),
  recoveryHint: z.string().optional().describe('Recovery hint for the agent'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type ClickInput = z.infer<typeof clickInputSchema>;
export type ClickOutput = z.infer<typeof clickOutputSchema>;

// ============================================================================
// Type Tool Schemas
// ============================================================================

export const typeInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e3)'),
  text: z.string().describe('Text to type'),
  clearFirst: z.boolean().optional().default(false).describe('Clear existing content before typing'),
});

export const typeOutputSchema = z.object({
  success: z.boolean().describe('Whether the type operation succeeded'),
  value: z.string().optional().describe('Current field value after typing'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if type failed'),
  message: z.string().optional().describe('Error message if type failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type TypeInput = z.infer<typeof typeInputSchema>;
export type TypeOutput = z.infer<typeof typeOutputSchema>;

// ============================================================================
// Scroll Tool Schemas
// ============================================================================

export const scrollInputSchema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
  amount: z
    .union([z.enum(['page', 'half']), z.number().describe('Pixels to scroll')])
    .optional()
    .default('page')
    .describe('Amount to scroll: "page", "half", or number of pixels'),
  ref: z.string().optional().describe('Element ref to scroll within (omit for viewport scroll)'),
});

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

export type ScrollInput = z.infer<typeof scrollInputSchema>;
export type ScrollOutput = z.infer<typeof scrollOutputSchema>;

// ============================================================================
// Screenshot Tool Schemas
// ============================================================================

export const screenshotInputSchema = z.object({
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe('Capture the entire scrollable page instead of just the viewport'),
  format: z.enum(['png', 'jpeg']).optional().default('png').describe('Image format. PNG is lossless, JPEG is smaller.'),
  quality: z.number().min(0).max(100).optional().default(80).describe('JPEG quality (0-100). Ignored for PNG.'),
  ref: z.string().optional().describe('Element ref from snapshot to capture specific element (e.g., @e5)'),
});

export const screenshotOutputSchema = z.object({
  success: z.boolean().describe('Whether the screenshot was captured successfully'),
  message: z.string().describe('Description of the captured screenshot'),
  base64: z.string().optional().describe('Base64-encoded image data (used by toModelOutput for vision models)'),
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
  code: z.string().optional().describe('Error code if screenshot failed'),
  recoveryHint: z.string().optional().describe('Recovery hint for the agent'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type ScreenshotInput = z.infer<typeof screenshotInputSchema>;
export type ScreenshotOutput = z.infer<typeof screenshotOutputSchema>;

// ============================================================================
// Select Tool Schemas
// ============================================================================

export const selectInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5) - should be a select/combobox element'),
  value: z.string().optional().describe('Option value to select'),
  label: z.string().optional().describe('Option label/text to select (use if value is unknown)'),
  index: z.number().optional().describe('Option index to select (0-based)'),
});

export const selectOutputSchema = z.object({
  success: z.boolean().describe('Whether the selection succeeded'),
  selectedValue: z.string().optional().describe('The value that was selected'),
  selectedLabel: z.string().optional().describe('The label/text of the selected option'),
  url: z.string().optional().describe('Current page URL after selection'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if selection failed'),
  message: z.string().optional().describe('Error message if selection failed'),
  recoveryHint: z.string().optional().describe('Recovery hint for the agent'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type SelectInput = z.infer<typeof selectInputSchema>;
export type SelectOutput = z.infer<typeof selectOutputSchema>;

// ============================================================================
// Close Tool Schemas
// ============================================================================

export const closeInputSchema = z.object({
  reason: z.string().optional().describe('Optional reason for closing the browser (for logging purposes)'),
});

export const closeOutputSchema = z.object({
  success: z.boolean().describe('Whether the browser was closed successfully'),
  message: z.string().describe('Status message'),
});

export type CloseInput = z.infer<typeof closeInputSchema>;
export type CloseOutput = z.infer<typeof closeOutputSchema>;

// ============================================================================
// Base Browser Config
// ============================================================================

/**
 * Base configuration shared by all browser providers.
 * Provider-specific packages extend this with additional options.
 */
export interface BaseBrowserConfig {
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
