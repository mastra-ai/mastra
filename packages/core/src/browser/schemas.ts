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
// Hover Tool Schemas
// ============================================================================

export const hoverInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
});

export const hoverOutputSchema = z.object({
  success: z.boolean().describe('Whether the hover succeeded'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if hover failed'),
  message: z.string().optional().describe('Error message if hover failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type HoverInput = z.infer<typeof hoverInputSchema>;
export type HoverOutput = z.infer<typeof hoverOutputSchema>;

// ============================================================================
// Focus Tool Schemas
// ============================================================================

export const focusInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
});

export const focusOutputSchema = z.object({
  success: z.boolean().describe('Whether the focus succeeded'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if focus failed'),
  message: z.string().optional().describe('Error message if focus failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type FocusInput = z.infer<typeof focusInputSchema>;
export type FocusOutput = z.infer<typeof focusOutputSchema>;

// ============================================================================
// Double Click Tool Schemas
// ============================================================================

export const doubleClickInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
  button: z.enum(['left', 'right', 'middle']).optional().default('left').describe('Mouse button to click with'),
});

export const doubleClickOutputSchema = z.object({
  success: z.boolean().describe('Whether the double-click succeeded'),
  url: z.string().optional().describe('Current page URL after double-click'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if double-click failed'),
  message: z.string().optional().describe('Error message if double-click failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type DoubleClickInput = z.infer<typeof doubleClickInputSchema>;
export type DoubleClickOutput = z.infer<typeof doubleClickOutputSchema>;

// ============================================================================
// Check/Uncheck Tool Schemas
// ============================================================================

export const checkInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5) - should be a checkbox element'),
  checked: z.boolean().describe('Whether to check (true) or uncheck (false) the checkbox'),
});

export const checkOutputSchema = z.object({
  success: z.boolean().describe('Whether the check/uncheck operation succeeded'),
  checked: z.boolean().optional().describe('Final checked state of the checkbox'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type CheckInput = z.infer<typeof checkInputSchema>;
export type CheckOutput = z.infer<typeof checkOutputSchema>;

// ============================================================================
// Press (Keyboard) Tool Schemas
// ============================================================================

export const pressInputSchema = z.object({
  key: z
    .string()
    .describe(
      'Key to press (e.g., "Enter", "Tab", "Escape", "ArrowDown", "Control+a", "Shift+Enter"). Supports key combinations with +.',
    ),
});

export const pressOutputSchema = z.object({
  success: z.boolean().describe('Whether the key press succeeded'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if press failed'),
  message: z.string().optional().describe('Error message if press failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type PressInput = z.infer<typeof pressInputSchema>;
export type PressOutput = z.infer<typeof pressOutputSchema>;

// ============================================================================
// Get Text Tool Schemas
// ============================================================================

export const getTextInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
});

export const getTextOutputSchema = z.object({
  success: z.boolean().describe('Whether the text extraction succeeded'),
  text: z.string().optional().describe('Text content of the element'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if extraction failed'),
  message: z.string().optional().describe('Error message if extraction failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type GetTextInput = z.infer<typeof getTextInputSchema>;
export type GetTextOutput = z.infer<typeof getTextOutputSchema>;

// ============================================================================
// Evaluate (JavaScript) Tool Schemas
// ============================================================================

export const evaluateInputSchema = z.object({
  expression: z.string().describe('JavaScript expression to evaluate in the page context'),
});

export const evaluateOutputSchema = z.object({
  success: z.boolean().describe('Whether the evaluation succeeded'),
  result: z.unknown().optional().describe('Return value from the evaluated expression (JSON-serializable)'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if evaluation failed'),
  message: z.string().optional().describe('Error message if evaluation failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type EvaluateInput = z.infer<typeof evaluateInputSchema>;
export type EvaluateOutput = z.infer<typeof evaluateOutputSchema>;

// ============================================================================
// Scroll Into View Tool Schemas
// ============================================================================

export const scrollIntoViewInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
  block: z
    .enum(['start', 'center', 'end', 'nearest'])
    .optional()
    .default('center')
    .describe('Vertical alignment of element in viewport'),
});

export const scrollIntoViewOutputSchema = z.object({
  success: z.boolean().describe('Whether the scroll succeeded'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if scroll failed'),
  message: z.string().optional().describe('Error message if scroll failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type ScrollIntoViewInput = z.infer<typeof scrollIntoViewInputSchema>;
export type ScrollIntoViewOutput = z.infer<typeof scrollIntoViewOutputSchema>;

// ============================================================================
// Set Viewport Tool Schemas
// ============================================================================

export const setViewportInputSchema = z.object({
  width: z.number().min(1).describe('Viewport width in pixels'),
  height: z.number().min(1).describe('Viewport height in pixels'),
  deviceScaleFactor: z.number().min(1).max(3).optional().default(1).describe('Device scale factor (1-3, for retina)'),
});

export const setViewportOutputSchema = z.object({
  success: z.boolean().describe('Whether the viewport was set successfully'),
  viewport: z
    .object({
      width: z.number().describe('New viewport width'),
      height: z.number().describe('New viewport height'),
      deviceScaleFactor: z.number().describe('Device scale factor'),
    })
    .optional()
    .describe('New viewport dimensions'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type SetViewportInput = z.infer<typeof setViewportInputSchema>;
export type SetViewportOutput = z.infer<typeof setViewportOutputSchema>;

// ============================================================================
// Cookies Tool Schemas
// ============================================================================

export const getCookiesInputSchema = z.object({
  urls: z.array(z.string()).optional().describe('URLs to get cookies for (defaults to current page URL)'),
});

export const getCookiesOutputSchema = z.object({
  success: z.boolean().describe('Whether cookies were retrieved successfully'),
  cookies: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        domain: z.string(),
        path: z.string(),
        expires: z.number().optional(),
        httpOnly: z.boolean(),
        secure: z.boolean(),
        sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
      }),
    )
    .optional()
    .describe('List of cookies'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type GetCookiesInput = z.infer<typeof getCookiesInputSchema>;
export type GetCookiesOutput = z.infer<typeof getCookiesOutputSchema>;

export const setCookieInputSchema = z.object({
  name: z.string().describe('Cookie name'),
  value: z.string().describe('Cookie value'),
  url: z.string().optional().describe('URL to associate cookie with (defaults to current page)'),
  domain: z.string().optional().describe('Cookie domain'),
  path: z.string().optional().default('/').describe('Cookie path'),
  expires: z.number().optional().describe('Expiration time as Unix timestamp in seconds'),
  httpOnly: z.boolean().optional().default(false).describe('Whether cookie is HTTP-only'),
  secure: z.boolean().optional().default(false).describe('Whether cookie requires HTTPS'),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional().default('Lax').describe('Cookie SameSite attribute'),
});

export const setCookieOutputSchema = z.object({
  success: z.boolean().describe('Whether the cookie was set successfully'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type SetCookieInput = z.infer<typeof setCookieInputSchema>;
export type SetCookieOutput = z.infer<typeof setCookieOutputSchema>;

export const clearCookiesInputSchema = z.object({
  urls: z.array(z.string()).optional().describe('URLs to clear cookies for (defaults to all cookies)'),
});

export const clearCookiesOutputSchema = z.object({
  success: z.boolean().describe('Whether cookies were cleared successfully'),
  clearedCount: z.number().optional().describe('Number of cookies cleared'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type ClearCookiesInput = z.infer<typeof clearCookiesInputSchema>;
export type ClearCookiesOutput = z.infer<typeof clearCookiesOutputSchema>;

// ============================================================================
// Fill Tool Schemas (clear + type combined)
// ============================================================================

export const fillInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e3)'),
  text: z.string().describe('Text to fill into the element (clears existing content first)'),
});

export const fillOutputSchema = z.object({
  success: z.boolean().describe('Whether the fill operation succeeded'),
  value: z.string().optional().describe('Current field value after filling'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if fill failed'),
  message: z.string().optional().describe('Error message if fill failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type FillInput = z.infer<typeof fillInputSchema>;
export type FillOutput = z.infer<typeof fillOutputSchema>;

// ============================================================================
// Drag Tool Schemas
// ============================================================================

export const dragInputSchema = z.object({
  sourceRef: z.string().describe('Element ref to drag from (e.g., @e5)'),
  targetRef: z.string().describe('Element ref to drop onto (e.g., @e10)'),
});

export const dragOutputSchema = z.object({
  success: z.boolean().describe('Whether the drag operation succeeded'),
  url: z.string().optional().describe('Current page URL after drag'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if drag failed'),
  message: z.string().optional().describe('Error message if drag failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type DragInput = z.infer<typeof dragInputSchema>;
export type DragOutput = z.infer<typeof dragOutputSchema>;

// ============================================================================
// Wait Tool Schemas
// ============================================================================

export const waitInputSchema = z.object({
  milliseconds: z.number().min(0).max(30000).optional().describe('Time to wait in milliseconds (max 30s)'),
  ref: z.string().optional().describe('Element ref to wait for (e.g., @e5)'),
  state: z
    .enum(['visible', 'hidden', 'attached', 'detached'])
    .optional()
    .default('visible')
    .describe('State to wait for when waiting for an element'),
});

export const waitOutputSchema = z.object({
  success: z.boolean().describe('Whether the wait completed successfully'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if wait failed'),
  message: z.string().optional().describe('Error message if wait failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type WaitInput = z.infer<typeof waitInputSchema>;
export type WaitOutput = z.infer<typeof waitOutputSchema>;

// ============================================================================
// Go Back/Forward Tool Schemas
// ============================================================================

export const goBackInputSchema = z.object({
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .default('domcontentloaded')
    .describe('When to consider navigation complete'),
});

export const goBackOutputSchema = z.object({
  success: z.boolean().describe('Whether navigation succeeded'),
  url: z.string().optional().describe('URL after navigation'),
  title: z.string().optional().describe('Page title after navigation'),
  code: z.string().optional().describe('Error code if navigation failed'),
  message: z.string().optional().describe('Error message if navigation failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type GoBackInput = z.infer<typeof goBackInputSchema>;
export type GoBackOutput = z.infer<typeof goBackOutputSchema>;

export const goForwardInputSchema = z.object({
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .default('domcontentloaded')
    .describe('When to consider navigation complete'),
});

export const goForwardOutputSchema = z.object({
  success: z.boolean().describe('Whether navigation succeeded'),
  url: z.string().optional().describe('URL after navigation'),
  title: z.string().optional().describe('Page title after navigation'),
  code: z.string().optional().describe('Error code if navigation failed'),
  message: z.string().optional().describe('Error message if navigation failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type GoForwardInput = z.infer<typeof goForwardInputSchema>;
export type GoForwardOutput = z.infer<typeof goForwardOutputSchema>;

// ============================================================================
// Reload Tool Schemas
// ============================================================================

export const reloadInputSchema = z.object({
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .default('domcontentloaded')
    .describe('When to consider reload complete'),
});

export const reloadOutputSchema = z.object({
  success: z.boolean().describe('Whether reload succeeded'),
  url: z.string().optional().describe('URL after reload'),
  title: z.string().optional().describe('Page title after reload'),
  code: z.string().optional().describe('Error code if reload failed'),
  message: z.string().optional().describe('Error message if reload failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type ReloadInput = z.infer<typeof reloadInputSchema>;
export type ReloadOutput = z.infer<typeof reloadOutputSchema>;

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
