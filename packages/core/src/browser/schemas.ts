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
  includeCursorElements: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Include cursor-interactive elements (divs with onclick, cursor:pointer) in addition to standard interactive elements.',
    ),
  compact: z.boolean().optional().default(false).describe('Remove empty structural elements for cleaner output.'),
  maxDepth: z.number().optional().describe('Limit accessibility tree depth to N levels.'),
  selector: z.string().optional().describe('CSS selector to scope snapshot to a specific element subtree.'),
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
  newTab: z.boolean().optional().default(false).describe('Open link in new tab instead of current tab'),
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
  annotate: z
    .boolean()
    .optional()
    .default(false)
    .describe('Overlay numbered labels on interactive elements. Each label [N] corresponds to ref @eN.'),
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
// Keyboard Type Tool Schemas (type at current focus, no selector)
// ============================================================================

export const keyboardTypeInputSchema = z.object({
  text: z.string().describe('Text to type at current focus position'),
});

export const keyboardTypeOutputSchema = z.object({
  success: z.boolean().describe('Whether the keyboard type succeeded'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type KeyboardTypeInput = z.infer<typeof keyboardTypeInputSchema>;
export type KeyboardTypeOutput = z.infer<typeof keyboardTypeOutputSchema>;

// ============================================================================
// Keyboard Insert Text Tool Schemas (insert without key events)
// ============================================================================

export const keyboardInsertTextInputSchema = z.object({
  text: z.string().describe('Text to insert at current focus position (without key events)'),
});

export const keyboardInsertTextOutputSchema = z.object({
  success: z.boolean().describe('Whether the text insert succeeded'),
  url: z.string().optional().describe('Current page URL'),
  hint: z.string().optional().describe('Hint for next action'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type KeyboardInsertTextInput = z.infer<typeof keyboardInsertTextInputSchema>;
export type KeyboardInsertTextOutput = z.infer<typeof keyboardInsertTextOutputSchema>;

// ============================================================================
// Key Down/Up Tool Schemas
// ============================================================================

export const keyDownInputSchema = z.object({
  key: z.string().describe('Key to hold down (e.g., "Shift", "Control", "Alt")'),
});

export const keyDownOutputSchema = z.object({
  success: z.boolean().describe('Whether the key down succeeded'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type KeyDownInput = z.infer<typeof keyDownInputSchema>;
export type KeyDownOutput = z.infer<typeof keyDownOutputSchema>;

export const keyUpInputSchema = z.object({
  key: z.string().describe('Key to release (e.g., "Shift", "Control", "Alt")'),
});

export const keyUpOutputSchema = z.object({
  success: z.boolean().describe('Whether the key up succeeded'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type KeyUpInput = z.infer<typeof keyUpInputSchema>;
export type KeyUpOutput = z.infer<typeof keyUpOutputSchema>;

// ============================================================================
// Get HTML Tool Schemas
// ============================================================================

export const getHtmlInputSchema = z.object({
  ref: z.string().optional().describe('Element ref from snapshot (e.g., @e5). Omit to get full page HTML.'),
  outer: z.boolean().optional().default(true).describe('Get outer HTML (includes element tag) vs inner HTML'),
});

export const getHtmlOutputSchema = z.object({
  success: z.boolean().describe('Whether the HTML extraction succeeded'),
  html: z.string().optional().describe('HTML content'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if extraction failed'),
  message: z.string().optional().describe('Error message if extraction failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type GetHtmlInput = z.infer<typeof getHtmlInputSchema>;
export type GetHtmlOutput = z.infer<typeof getHtmlOutputSchema>;

// ============================================================================
// Get Value Tool Schemas (for input fields)
// ============================================================================

export const getValueInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5) - should be an input/textarea/select'),
});

export const getValueOutputSchema = z.object({
  success: z.boolean().describe('Whether the value extraction succeeded'),
  value: z.string().optional().describe('Current value of the input field'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if extraction failed'),
  message: z.string().optional().describe('Error message if extraction failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type GetValueInput = z.infer<typeof getValueInputSchema>;
export type GetValueOutput = z.infer<typeof getValueOutputSchema>;

// ============================================================================
// Get Attribute Tool Schemas
// ============================================================================

export const getAttributeInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
  name: z.string().describe('Attribute name to get (e.g., "href", "src", "data-id")'),
});

export const getAttributeOutputSchema = z.object({
  success: z.boolean().describe('Whether the attribute extraction succeeded'),
  value: z.string().nullable().optional().describe('Attribute value (null if not present)'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if extraction failed'),
  message: z.string().optional().describe('Error message if extraction failed'),
  canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
});

export type GetAttributeInput = z.infer<typeof getAttributeInputSchema>;
export type GetAttributeOutput = z.infer<typeof getAttributeOutputSchema>;

// ============================================================================
// Tab Management Tool Schemas
// ============================================================================

export const getTabsInputSchema = z.object({});

export const getTabsOutputSchema = z.object({
  success: z.boolean().describe('Whether the tab list was retrieved'),
  tabs: z
    .array(
      z.object({
        id: z.string().describe('Tab identifier'),
        url: z.string().describe('Tab URL'),
        title: z.string().describe('Tab title'),
        active: z.boolean().describe('Whether this is the active tab'),
      }),
    )
    .optional()
    .describe('List of open tabs'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type GetTabsInput = z.infer<typeof getTabsInputSchema>;
export type GetTabsOutput = z.infer<typeof getTabsOutputSchema>;

export const switchTabInputSchema = z.object({
  tabId: z.string().optional().describe('Tab ID to switch to'),
  index: z.number().optional().describe('Tab index to switch to (0-based)'),
});

export const switchTabOutputSchema = z.object({
  success: z.boolean().describe('Whether the tab switch succeeded'),
  url: z.string().optional().describe('URL of the new active tab'),
  title: z.string().optional().describe('Title of the new active tab'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type SwitchTabInput = z.infer<typeof switchTabInputSchema>;
export type SwitchTabOutput = z.infer<typeof switchTabOutputSchema>;

export const newTabInputSchema = z.object({
  url: z.string().url().optional().describe('URL to open in new tab (optional, opens blank tab if omitted)'),
});

export const newTabOutputSchema = z.object({
  success: z.boolean().describe('Whether the new tab was created'),
  tabId: z.string().optional().describe('ID of the new tab'),
  url: z.string().optional().describe('URL of the new tab'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type NewTabInput = z.infer<typeof newTabInputSchema>;
export type NewTabOutput = z.infer<typeof newTabOutputSchema>;

export const closeTabInputSchema = z.object({
  tabId: z.string().optional().describe('Tab ID to close (closes current tab if omitted)'),
});

export const closeTabOutputSchema = z.object({
  success: z.boolean().describe('Whether the tab was closed'),
  remainingTabs: z.number().optional().describe('Number of remaining tabs'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type CloseTabInput = z.infer<typeof closeTabInputSchema>;
export type CloseTabOutput = z.infer<typeof closeTabOutputSchema>;

// ============================================================================
// Device Emulation Tool Schemas
// ============================================================================

export const setDeviceInputSchema = z.object({
  device: z
    .string()
    .describe(
      'Device name to emulate (e.g., "iPhone 14", "iPad Pro", "Pixel 7"). Sets viewport, user agent, and device scale.',
    ),
});

export const setDeviceOutputSchema = z.object({
  success: z.boolean().describe('Whether the device emulation was set'),
  device: z.string().optional().describe('Device name that was set'),
  viewport: z
    .object({
      width: z.number(),
      height: z.number(),
      deviceScaleFactor: z.number(),
    })
    .optional()
    .describe('Viewport dimensions for the device'),
  userAgent: z.string().optional().describe('User agent string for the device'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type SetDeviceInput = z.infer<typeof setDeviceInputSchema>;
export type SetDeviceOutput = z.infer<typeof setDeviceOutputSchema>;

export const setMediaInputSchema = z.object({
  colorScheme: z.enum(['light', 'dark', 'no-preference']).optional().describe('Preferred color scheme'),
  reducedMotion: z.enum(['reduce', 'no-preference']).optional().describe('Reduced motion preference'),
  forcedColors: z.enum(['active', 'none']).optional().describe('Forced colors mode'),
});

export const setMediaOutputSchema = z.object({
  success: z.boolean().describe('Whether the media settings were applied'),
  settings: z
    .object({
      colorScheme: z.string().optional(),
      reducedMotion: z.string().optional(),
      forcedColors: z.string().optional(),
    })
    .optional()
    .describe('Applied media settings'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type SetMediaInput = z.infer<typeof setMediaInputSchema>;
export type SetMediaOutput = z.infer<typeof setMediaOutputSchema>;

// ============================================================================
// Highlight Tool Schemas
// ============================================================================

export const highlightInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
  color: z.string().optional().default('red').describe('Highlight color (CSS color value)'),
  duration: z.number().optional().default(2000).describe('Duration to show highlight in milliseconds'),
});

export const highlightOutputSchema = z.object({
  success: z.boolean().describe('Whether the highlight was applied'),
  url: z.string().optional().describe('Current page URL'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type HighlightInput = z.infer<typeof highlightInputSchema>;
export type HighlightOutput = z.infer<typeof highlightOutputSchema>;

// ============================================================================
// Inspect Tool Schemas (open DevTools)
// ============================================================================

export const inspectInputSchema = z.object({
  ref: z.string().optional().describe('Element ref to inspect (opens Elements panel focused on element)'),
});

export const inspectOutputSchema = z.object({
  success: z.boolean().describe('Whether DevTools was opened'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type InspectInput = z.infer<typeof inspectInputSchema>;
export type InspectOutput = z.infer<typeof inspectOutputSchema>;

// ============================================================================
// Batch Command Tool Schemas
// ============================================================================

export const batchInputSchema = z.object({
  commands: z
    .array(
      z.object({
        tool: z.string().describe('Tool name to execute'),
        input: z.record(z.string(), z.unknown()).describe('Tool input parameters'),
      }),
    )
    .describe('Array of commands to execute sequentially'),
  stopOnError: z.boolean().optional().default(true).describe('Stop execution on first error'),
});

export const batchOutputSchema = z.object({
  success: z.boolean().describe('Whether all commands succeeded'),
  results: z
    .array(
      z.object({
        tool: z.string(),
        success: z.boolean(),
        output: z.unknown().optional(),
        error: z.string().optional(),
      }),
    )
    .describe('Results from each command'),
  executedCount: z.number().describe('Number of commands executed'),
  totalCount: z.number().describe('Total number of commands'),
});

export type BatchInput = z.infer<typeof batchInputSchema>;
export type BatchOutput = z.infer<typeof batchOutputSchema>;

// ============================================================================
// Uncheck Tool Schemas
// ============================================================================

export const uncheckInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., "@e5")'),
});

export const uncheckOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    url: z.string().describe('Current page URL'),
    hint: z.string().optional().describe('Contextual hint for next action'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
    recoveryHint: z.string().optional().describe('Suggested recovery action'),
    canRetry: z.boolean().describe('Whether the operation can be retried'),
  }),
]);

export type UncheckInput = z.infer<typeof uncheckInputSchema>;
export type UncheckOutput = z.infer<typeof uncheckOutputSchema>;

// ============================================================================
// Get Title Tool Schemas
// ============================================================================

export const getTitleInputSchema = z.object({});

export const getTitleOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    title: z.string().describe('The page title'),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type GetTitleInput = z.infer<typeof getTitleInputSchema>;
export type GetTitleOutput = z.infer<typeof getTitleOutputSchema>;

// ============================================================================
// Get URL Tool Schemas
// ============================================================================

export const getUrlInputSchema = z.object({});

export const getUrlOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    url: z.string().describe('Current page URL'),
    title: z.string().describe('The page title'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type GetUrlInput = z.infer<typeof getUrlInputSchema>;
export type GetUrlOutput = z.infer<typeof getUrlOutputSchema>;

// ============================================================================
// Get Count Tool Schemas
// ============================================================================

export const getCountInputSchema = z.object({
  ref: z.string().describe('Element reference or CSS selector'),
});

export const getCountOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    count: z.number().describe('Number of matching elements'),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type GetCountInput = z.infer<typeof getCountInputSchema>;
export type GetCountOutput = z.infer<typeof getCountOutputSchema>;

// ============================================================================
// Get Bounding Box Tool Schemas
// ============================================================================

export const getBoundingBoxInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., "@e5")'),
});

export const getBoundingBoxOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    box: z
      .object({
        x: z.number().describe('X coordinate'),
        y: z.number().describe('Y coordinate'),
        width: z.number().describe('Element width'),
        height: z.number().describe('Element height'),
      })
      .nullable()
      .describe('Bounding box, or null if element is not visible'),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type GetBoundingBoxInput = z.infer<typeof getBoundingBoxInputSchema>;
export type GetBoundingBoxOutput = z.infer<typeof getBoundingBoxOutputSchema>;

// ============================================================================
// Is Visible Tool Schemas
// ============================================================================

export const isVisibleInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., "@e5")'),
});

export const isVisibleOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    visible: z.boolean().describe('Whether the element is visible'),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type IsVisibleInput = z.infer<typeof isVisibleInputSchema>;
export type IsVisibleOutput = z.infer<typeof isVisibleOutputSchema>;

// ============================================================================
// Is Enabled Tool Schemas
// ============================================================================

export const isEnabledInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., "@e5")'),
});

export const isEnabledOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    enabled: z.boolean().describe('Whether the element is enabled'),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type IsEnabledInput = z.infer<typeof isEnabledInputSchema>;
export type IsEnabledOutput = z.infer<typeof isEnabledOutputSchema>;

// ============================================================================
// Is Checked Tool Schemas
// ============================================================================

export const isCheckedInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., "@e5")'),
});

export const isCheckedOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    checked: z.boolean().describe('Whether the checkbox/radio is checked'),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type IsCheckedInput = z.infer<typeof isCheckedInputSchema>;
export type IsCheckedOutput = z.infer<typeof isCheckedOutputSchema>;

// ============================================================================
// Frame Switch Tool Schemas
// ============================================================================

export const frameSwitchInputSchema = z.object({
  selector: z.string().optional().describe('CSS selector for iframe element'),
  name: z.string().optional().describe('Frame name attribute'),
  url: z.string().optional().describe('Frame URL (partial match)'),
});

export const frameSwitchOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    url: z.string().describe('Current page URL'),
    frameUrl: z.string().optional().describe('Frame URL if available'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type FrameSwitchInput = z.infer<typeof frameSwitchInputSchema>;
export type FrameSwitchOutput = z.infer<typeof frameSwitchOutputSchema>;

// ============================================================================
// Frame Main Tool Schemas
// ============================================================================

export const frameMainInputSchema = z.object({});

export const frameMainOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type FrameMainInput = z.infer<typeof frameMainInputSchema>;
export type FrameMainOutput = z.infer<typeof frameMainOutputSchema>;

// ============================================================================
// Dialog Tool Schemas
// ============================================================================

export const dialogHandleInputSchema = z.object({
  action: z.enum(['accept', 'dismiss']).describe('How to handle dialogs'),
  promptText: z.string().optional().describe('Text to enter for prompt dialogs'),
});

export const dialogHandleOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type DialogHandleInput = z.infer<typeof dialogHandleInputSchema>;
export type DialogHandleOutput = z.infer<typeof dialogHandleOutputSchema>;

export const dialogClearInputSchema = z.object({});

export const dialogClearOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type DialogClearInput = z.infer<typeof dialogClearInputSchema>;
export type DialogClearOutput = z.infer<typeof dialogClearOutputSchema>;

// ============================================================================
// Set Geolocation Tool Schemas
// ============================================================================

export const setGeolocationInputSchema = z.object({
  latitude: z.number().min(-90).max(90).describe('Latitude coordinate'),
  longitude: z.number().min(-180).max(180).describe('Longitude coordinate'),
  accuracy: z.number().positive().optional().describe('Accuracy in meters'),
});

export const setGeolocationOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    latitude: z.number().describe('Set latitude'),
    longitude: z.number().describe('Set longitude'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type SetGeolocationInput = z.infer<typeof setGeolocationInputSchema>;
export type SetGeolocationOutput = z.infer<typeof setGeolocationOutputSchema>;

// ============================================================================
// Set Offline Tool Schemas
// ============================================================================

export const setOfflineInputSchema = z.object({
  offline: z.boolean().describe('Whether to enable offline mode'),
});

export const setOfflineOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    offline: z.boolean().describe('Current offline state'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type SetOfflineInput = z.infer<typeof setOfflineInputSchema>;
export type SetOfflineOutput = z.infer<typeof setOfflineOutputSchema>;

// ============================================================================
// Set Headers Tool Schemas
// ============================================================================

export const setHeadersInputSchema = z.object({
  headers: z.record(z.string(), z.string()).describe('HTTP headers to set'),
  origin: z.string().optional().describe('Only apply headers to requests matching this origin'),
});

export const setHeadersOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    headerCount: z.number().describe('Number of headers set'),
    scoped: z.boolean().describe('Whether headers are scoped to an origin'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type SetHeadersInput = z.infer<typeof setHeadersInputSchema>;
export type SetHeadersOutput = z.infer<typeof setHeadersOutputSchema>;

// ============================================================================
// LocalStorage Tool Schemas
// ============================================================================

export const storageGetInputSchema = z.object({
  key: z.string().optional().describe('Specific key to get, or omit for all'),
});

export const storageGetOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.record(z.string(), z.string()).describe('LocalStorage data'),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type StorageGetInput = z.infer<typeof storageGetInputSchema>;
export type StorageGetOutput = z.infer<typeof storageGetOutputSchema>;

export const storageSetInputSchema = z.object({
  key: z.string().describe('Storage key'),
  value: z.string().describe('Storage value'),
});

export const storageSetOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type StorageSetInput = z.infer<typeof storageSetInputSchema>;
export type StorageSetOutput = z.infer<typeof storageSetOutputSchema>;

export const storageClearInputSchema = z.object({});

export const storageClearOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type StorageClearInput = z.infer<typeof storageClearInputSchema>;
export type StorageClearOutput = z.infer<typeof storageClearOutputSchema>;

// ============================================================================
// Tab Tool Schemas
// ============================================================================

export const tabsListInputSchema = z.object({});

export const tabsListOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    tabs: z.array(
      z.object({
        index: z.number().describe('Tab index'),
        url: z.string().describe('Tab URL'),
        title: z.string().describe('Tab title'),
        active: z.boolean().describe('Whether this tab is active'),
      }),
    ),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type TabsListInput = z.infer<typeof tabsListInputSchema>;
export type TabsListOutput = z.infer<typeof tabsListOutputSchema>;

export const tabNewInputSchema = z.object({
  url: z.string().optional().describe('URL to open in new tab'),
});

export const tabNewOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    index: z.number().describe('Index of the new tab'),
    total: z.number().describe('Total number of tabs'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type TabNewInput = z.infer<typeof tabNewInputSchema>;
export type TabNewOutput = z.infer<typeof tabNewOutputSchema>;

export const tabSwitchInputSchema = z.object({
  index: z.number().describe('Tab index to switch to'),
});

export const tabSwitchOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    index: z.number().describe('Current tab index'),
    url: z.string().describe('Tab URL'),
    title: z.string().describe('Tab title'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type TabSwitchInput = z.infer<typeof tabSwitchInputSchema>;
export type TabSwitchOutput = z.infer<typeof tabSwitchOutputSchema>;

export const tabCloseInputSchema = z.object({
  index: z.number().optional().describe('Tab index to close (defaults to current)'),
});

export const tabCloseOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    closed: z.number().describe('Index of closed tab'),
    remaining: z.number().describe('Number of remaining tabs'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type TabCloseInput = z.infer<typeof tabCloseInputSchema>;
export type TabCloseOutput = z.infer<typeof tabCloseOutputSchema>;

// ============================================================================
// Recording Tool Schemas
// ============================================================================

export const recordStartInputSchema = z.object({
  path: z.string().describe('Output path for the video file (.webm)'),
  url: z.string().optional().describe('URL to navigate to (defaults to current page)'),
});

export const recordStartOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    path: z.string().describe('Recording output path'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type RecordStartInput = z.infer<typeof recordStartInputSchema>;
export type RecordStartOutput = z.infer<typeof recordStartOutputSchema>;

export const recordStopInputSchema = z.object({});

export const recordStopOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    path: z.string().describe('Saved video file path'),
    frames: z.number().optional().describe('Number of frames recorded'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type RecordStopInput = z.infer<typeof recordStopInputSchema>;
export type RecordStopOutput = z.infer<typeof recordStopOutputSchema>;

// ============================================================================
// Tracing Tool Schemas
// ============================================================================

export const traceStartInputSchema = z.object({
  screenshots: z.boolean().optional().default(true).describe('Capture screenshots'),
  snapshots: z.boolean().optional().default(true).describe('Capture DOM snapshots'),
});

export const traceStartOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type TraceStartInput = z.infer<typeof traceStartInputSchema>;
export type TraceStartOutput = z.infer<typeof traceStartOutputSchema>;

export const traceStopInputSchema = z.object({
  path: z.string().describe('Output path for the trace file (.zip)'),
});

export const traceStopOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    path: z.string().describe('Saved trace file path'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type TraceStopInput = z.infer<typeof traceStopInputSchema>;
export type TraceStopOutput = z.infer<typeof traceStopOutputSchema>;

// ============================================================================
// Network Tracking Tool Schemas
// ============================================================================

export const networkStartInputSchema = z.object({});

export const networkStartOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type NetworkStartInput = z.infer<typeof networkStartInputSchema>;
export type NetworkStartOutput = z.infer<typeof networkStartOutputSchema>;

export const networkGetInputSchema = z.object({
  filter: z.string().optional().describe('Filter requests by URL pattern'),
});

export const networkGetOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    requests: z.array(
      z.object({
        url: z.string().describe('Request URL'),
        method: z.string().describe('HTTP method'),
        resourceType: z.string().describe('Resource type'),
        timestamp: z.number().describe('Request timestamp'),
      }),
    ),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type NetworkGetInput = z.infer<typeof networkGetInputSchema>;
export type NetworkGetOutput = z.infer<typeof networkGetOutputSchema>;

export const networkClearInputSchema = z.object({});

export const networkClearOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type NetworkClearInput = z.infer<typeof networkClearInputSchema>;
export type NetworkClearOutput = z.infer<typeof networkClearOutputSchema>;

// ============================================================================
// Console Tracking Tool Schemas
// ============================================================================

export const consoleStartInputSchema = z.object({});

export const consoleStartOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type ConsoleStartInput = z.infer<typeof consoleStartInputSchema>;
export type ConsoleStartOutput = z.infer<typeof consoleStartOutputSchema>;

export const consoleGetInputSchema = z.object({});

export const consoleGetOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    messages: z.array(
      z.object({
        type: z.string().describe('Message type (log, warn, error, etc.)'),
        text: z.string().describe('Message text'),
        timestamp: z.number().describe('Message timestamp'),
      }),
    ),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type ConsoleGetInput = z.infer<typeof consoleGetInputSchema>;
export type ConsoleGetOutput = z.infer<typeof consoleGetOutputSchema>;

export const consoleClearInputSchema = z.object({});

export const consoleClearOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type ConsoleClearInput = z.infer<typeof consoleClearInputSchema>;
export type ConsoleClearOutput = z.infer<typeof consoleClearOutputSchema>;

// ============================================================================
// Error Tracking Tool Schemas
// ============================================================================

export const errorsStartInputSchema = z.object({});

export const errorsStartOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type ErrorsStartInput = z.infer<typeof errorsStartInputSchema>;
export type ErrorsStartOutput = z.infer<typeof errorsStartOutputSchema>;

export const errorsGetInputSchema = z.object({});

export const errorsGetOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    errors: z.array(
      z.object({
        message: z.string().describe('Error message'),
        timestamp: z.number().describe('Error timestamp'),
      }),
    ),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type ErrorsGetInput = z.infer<typeof errorsGetInputSchema>;
export type ErrorsGetOutput = z.infer<typeof errorsGetOutputSchema>;

export const errorsClearInputSchema = z.object({});

export const errorsClearOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error code'),
    message: z.string().describe('Error message'),
  }),
]);

export type ErrorsClearInput = z.infer<typeof errorsClearInputSchema>;
export type ErrorsClearOutput = z.infer<typeof errorsClearOutputSchema>;

// ============================================================================
// Upload Tool Schemas
// ============================================================================

export const uploadInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., @e5) for the file input'),
  files: z.array(z.string()).describe('Array of file paths to upload'),
});

export const uploadOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    uploaded: z.array(z.string()).describe('List of uploaded file paths'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
    recoveryHint: z.string().optional().describe('Suggested recovery action'),
    canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
  }),
]);

export type UploadInput = z.infer<typeof uploadInputSchema>;
export type UploadOutput = z.infer<typeof uploadOutputSchema>;

// ============================================================================
// Set Credentials Tool Schemas (HTTP Basic Auth)
// ============================================================================

export const setCredentialsInputSchema = z.object({
  username: z.string().describe('Username for HTTP basic authentication'),
  password: z.string().describe('Password for HTTP basic authentication'),
});

export const setCredentialsOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
  }),
]);

export type SetCredentialsInput = z.infer<typeof setCredentialsInputSchema>;
export type SetCredentialsOutput = z.infer<typeof setCredentialsOutputSchema>;

// ============================================================================
// Get Styles Tool Schemas
// ============================================================================

export const getStylesInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., @e5)'),
  properties: z
    .array(z.string())
    .optional()
    .describe('Specific CSS properties to retrieve. If omitted, returns all computed styles.'),
});

export const getStylesOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    styles: z.record(z.string(), z.string()).describe('Map of CSS property names to computed values'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
    recoveryHint: z.string().optional().describe('Suggested recovery action'),
    canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
  }),
]);

export type GetStylesInput = z.infer<typeof getStylesInputSchema>;
export type GetStylesOutput = z.infer<typeof getStylesOutputSchema>;

// ============================================================================
// Session Storage Tool Schemas
// ============================================================================

export const sessionStorageGetInputSchema = z.object({
  key: z.string().optional().describe('Specific key to retrieve. If omitted, returns all sessionStorage data.'),
});

export const sessionStorageGetOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.record(z.string(), z.string()).describe('SessionStorage data'),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
  }),
]);

export const sessionStorageSetInputSchema = z.object({
  key: z.string().describe('The key to set'),
  value: z.string().describe('The value to store'),
});

export const sessionStorageSetOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
  }),
]);

export const sessionStorageClearInputSchema = z.object({});

export const sessionStorageClearOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    url: z.string().describe('Current page URL'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
  }),
]);

export type SessionStorageGetInput = z.infer<typeof sessionStorageGetInputSchema>;
export type SessionStorageGetOutput = z.infer<typeof sessionStorageGetOutputSchema>;
export type SessionStorageSetInput = z.infer<typeof sessionStorageSetInputSchema>;
export type SessionStorageSetOutput = z.infer<typeof sessionStorageSetOutputSchema>;
export type SessionStorageClearInput = z.infer<typeof sessionStorageClearInputSchema>;
export type SessionStorageClearOutput = z.infer<typeof sessionStorageClearOutputSchema>;

// ============================================================================
// Clipboard Tool Schemas
// ============================================================================

export const clipboardCopyInputSchema = z.object({});

export const clipboardCopyOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
  }),
]);

export const clipboardPasteInputSchema = z.object({});

export const clipboardPasteOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
  }),
]);

export const clipboardReadInputSchema = z.object({});

export const clipboardReadOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    text: z.string().describe('Clipboard text content'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
  }),
]);

export const clipboardWriteInputSchema = z.object({
  text: z.string().describe('Text to write to clipboard'),
});

export const clipboardWriteOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
  }),
]);

export type ClipboardCopyInput = z.infer<typeof clipboardCopyInputSchema>;
export type ClipboardCopyOutput = z.infer<typeof clipboardCopyOutputSchema>;
export type ClipboardPasteInput = z.infer<typeof clipboardPasteInputSchema>;
export type ClipboardPasteOutput = z.infer<typeof clipboardPasteOutputSchema>;
export type ClipboardReadInput = z.infer<typeof clipboardReadInputSchema>;
export type ClipboardReadOutput = z.infer<typeof clipboardReadOutputSchema>;
export type ClipboardWriteInput = z.infer<typeof clipboardWriteInputSchema>;
export type ClipboardWriteOutput = z.infer<typeof clipboardWriteOutputSchema>;

// ============================================================================
// Clear Input Tool Schema
// ============================================================================

export const clearInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., @e5) for the input to clear'),
});

export const clearOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
    recoveryHint: z.string().optional().describe('Suggested recovery action'),
    canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
  }),
]);

export type ClearInput = z.infer<typeof clearInputSchema>;
export type ClearOutput = z.infer<typeof clearOutputSchema>;

// ============================================================================
// Select All Text Tool Schema
// ============================================================================

export const selectAllInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., @e5) to select all text in'),
});

export const selectAllOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
    recoveryHint: z.string().optional().describe('Suggested recovery action'),
    canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
  }),
]);

export type SelectAllInput = z.infer<typeof selectAllInputSchema>;
export type SelectAllOutput = z.infer<typeof selectAllOutputSchema>;

// ============================================================================
// Tap Tool Schema (touch event)
// ============================================================================

export const tapInputSchema = z.object({
  ref: z.string().describe('Element reference from snapshot (e.g., @e5) to tap'),
});

export const tapOutputSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    message: z.string().describe('Confirmation message'),
  }),
  z.object({
    success: z.literal(false),
    code: z.string().describe('Error classification code'),
    message: z.string().describe('LLM-friendly error description'),
    recoveryHint: z.string().optional().describe('Suggested recovery action'),
    canRetry: z.boolean().optional().describe('Whether the operation can be retried'),
  }),
]);

export type TapInput = z.infer<typeof tapInputSchema>;
export type TapOutput = z.infer<typeof tapOutputSchema>;

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

  /**
   * Allow access to file:// URLs
   * @default false
   */
  allowFileAccess?: boolean;

  /**
   * CDP URL to connect to an existing browser instance
   * e.g., "ws://localhost:9222/devtools/browser/..."
   */
  cdpUrl?: string;

  /**
   * Auto-connect to a running Chrome instance with remote debugging enabled
   * @default false
   */
  autoConnect?: boolean;
}
