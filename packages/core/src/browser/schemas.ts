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
// Record Tool Schemas
// ============================================================================

export const recordStartInputSchema = z.object({
  path: z.string().optional().describe('Output file path for recording (e.g., "recording.webm")'),
});

export const recordStartOutputSchema = z.object({
  success: z.boolean().describe('Whether recording started'),
  path: z.string().optional().describe('Path where recording will be saved'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type RecordStartInput = z.infer<typeof recordStartInputSchema>;
export type RecordStartOutput = z.infer<typeof recordStartOutputSchema>;

export const recordStopInputSchema = z.object({});

export const recordStopOutputSchema = z.object({
  success: z.boolean().describe('Whether recording stopped'),
  path: z.string().optional().describe('Path where recording was saved'),
  duration: z.number().optional().describe('Recording duration in seconds'),
  fileSize: z.number().optional().describe('Recording file size in bytes'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type RecordStopInput = z.infer<typeof recordStopInputSchema>;
export type RecordStopOutput = z.infer<typeof recordStopOutputSchema>;

// ============================================================================
// Profiler Tool Schemas
// ============================================================================

export const profilerStartInputSchema = z.object({
  categories: z
    .array(z.string())
    .optional()
    .describe('Trace categories to capture (e.g., ["devtools.timeline", "v8.execute"])'),
});

export const profilerStartOutputSchema = z.object({
  success: z.boolean().describe('Whether profiling started'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type ProfilerStartInput = z.infer<typeof profilerStartInputSchema>;
export type ProfilerStartOutput = z.infer<typeof profilerStartOutputSchema>;

export const profilerStopInputSchema = z.object({
  path: z.string().optional().describe('Output file path for trace (e.g., "trace.json")'),
});

export const profilerStopOutputSchema = z.object({
  success: z.boolean().describe('Whether profiling stopped'),
  path: z.string().optional().describe('Path where trace was saved'),
  fileSize: z.number().optional().describe('Trace file size in bytes'),
  code: z.string().optional().describe('Error code if operation failed'),
  message: z.string().optional().describe('Error message if operation failed'),
});

export type ProfilerStopInput = z.infer<typeof profilerStopInputSchema>;
export type ProfilerStopOutput = z.infer<typeof profilerStopOutputSchema>;

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
