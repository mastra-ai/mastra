/**
 * AgentBrowser Tool Schemas
 *
 * Flat schemas for browser tools. Each tool has a single-purpose schema
 * without discriminated unions, making them easier for LLMs to understand.
 *
 * Tools:
 * - Core: goto, snapshot, click, type, press, select, scroll, close
 * - Extended: hover, back, dialog, wait, tabs, drag
 * - Escape Hatch: evaluate
 */

import { z } from 'zod';

// =============================================================================
// Core Tools (9)
// =============================================================================

/**
 * browser_goto - Navigate to a URL
 */
export const gotoInputSchema = z.object({
  url: z.string().describe('The URL to navigate to'),
  waitUntil: z
    .enum(['load', 'domcontentloaded', 'networkidle'])
    .optional()
    .describe('When to consider navigation complete (default: domcontentloaded)'),
  timeout: z.number().optional().describe('Navigation timeout in milliseconds'),
});
export type GotoInput = z.output<typeof gotoInputSchema>;

/**
 * browser_snapshot - Get accessibility tree snapshot
 */
export const snapshotInputSchema = z.object({
  interactiveOnly: z.boolean().optional().describe('Only include interactive elements (default: true)'),
  maxDepth: z.number().optional().describe('Maximum depth of the tree to return'),
});
export type SnapshotInput = z.output<typeof snapshotInputSchema>;

/**
 * browser_click - Click an element
 */
export const clickInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
  button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button (default: left)'),
  clickCount: z.number().optional().describe('Number of clicks (default: 1, use 2 for double-click)'),
  modifiers: z
    .array(z.enum(['Alt', 'Control', 'Meta', 'Shift']))
    .optional()
    .describe('Modifier keys to hold'),
});
export type ClickInput = z.output<typeof clickInputSchema>;

/**
 * browser_type - Type text into an element
 */
export const typeInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot'),
  text: z.string().describe('Text to type'),
  clear: z.boolean().optional().describe('Clear existing content before typing (default: false)'),
  delay: z.number().optional().describe('Delay between keystrokes in ms'),
});
export type TypeInput = z.output<typeof typeInputSchema>;

/**
 * browser_press - Press a keyboard key
 */
export const pressInputSchema = z.object({
  key: z.string().describe('Key to press (e.g., Enter, Tab, Escape, Control+a)'),
  modifiers: z
    .array(z.enum(['Alt', 'Control', 'Meta', 'Shift']))
    .optional()
    .describe('Modifier keys to hold'),
});
export type PressInput = z.output<typeof pressInputSchema>;

/**
 * browser_select - Select option from dropdown
 */
export const selectInputSchema = z
  .object({
    ref: z.string().describe('Select element ref from snapshot'),
    value: z.string().optional().describe('Option value to select'),
    label: z.string().optional().describe('Option label to select'),
    index: z.number().int().min(0).optional().describe('Option index to select (0-based)'),
  })
  .superRefine((data, ctx) => {
    if (data.value === undefined && data.label === undefined && data.index === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of value, label, or index is required',
      });
    }
  });
export type SelectInput = z.output<typeof selectInputSchema>;

/**
 * browser_scroll - Scroll the page or element
 */
export const scrollInputSchema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
  amount: z.number().optional().describe('Scroll amount in pixels (default: 300)'),
  ref: z.string().optional().describe('Element ref to scroll (scrolls page if omitted)'),
});
export type ScrollInput = z.output<typeof scrollInputSchema>;

/**
 * browser_close - Close the browser
 */
export const closeInputSchema = z.object({});
export type CloseInput = z.output<typeof closeInputSchema>;

// =============================================================================
// Extended Tools (7)
// =============================================================================

/**
 * browser_hover - Hover over an element
 */
export const hoverInputSchema = z.object({
  ref: z.string().describe('Element ref from snapshot'),
});
export type HoverInput = z.output<typeof hoverInputSchema>;

/**
 * browser_back - Go back in browser history
 */
export const backInputSchema = z.object({});
export type BackInput = z.output<typeof backInputSchema>;

/**
 * browser_dialog - Click an element that triggers a dialog and handle it
 */
export const dialogInputSchema = z.object({
  triggerRef: z.string().describe('Element ref that triggers the dialog (e.g., @e5)'),
  action: z.enum(['accept', 'dismiss']).describe('Accept or dismiss the dialog'),
  text: z.string().optional().describe('Text to enter for prompt dialogs'),
});
export type DialogInput = z.output<typeof dialogInputSchema>;

/**
 * browser_wait - Wait for an element or condition
 */
export const waitInputSchema = z.object({
  ref: z.string().optional().describe('Element ref to wait for'),
  state: z
    .enum(['visible', 'hidden', 'attached', 'detached'])
    .optional()
    .describe('State to wait for (default: visible)'),
  timeout: z.number().optional().describe('Maximum wait time in ms (default: 30000)'),
});
export type WaitInput = z.output<typeof waitInputSchema>;

/**
 * browser_tabs - Manage browser tabs
 */
export const tabsInputSchema = z
  .object({
    action: z.enum(['list', 'new', 'switch', 'close']).describe('Tab action'),
    index: z.number().int().min(0).optional().describe('Tab index for switch/close'),
    url: z.string().optional().describe('URL to open in new tab'),
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

/**
 * browser_drag - Drag an element to another element
 */
export const dragInputSchema = z
  .object({
    sourceRef: z.string().optional().describe('Element ref to drag from (e.g., @e5)'),
    targetRef: z.string().optional().describe('Element ref to drag to (e.g., @e7)'),
    sourceSelector: z.string().optional().describe('CSS selector for source element (use if ref not available)'),
    targetSelector: z.string().optional().describe('CSS selector for target element (use if ref not available)'),
  })
  .superRefine((data, ctx) => {
    if (!data.sourceRef && !data.sourceSelector) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceRef'],
        message: 'Either sourceRef or sourceSelector is required',
      });
    }
    if (!data.targetRef && !data.targetSelector) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetRef'],
        message: 'Either targetRef or targetSelector is required',
      });
    }
  });
export type DragInput = z.output<typeof dragInputSchema>;

// =============================================================================
// Escape Hatch (1)
// =============================================================================

/**
 * browser_evaluate - Execute JavaScript in the browser
 */
export const evaluateInputSchema = z.object({
  script: z.string().describe('JavaScript code to execute'),
  arg: z.unknown().optional().describe('Argument to pass to the script (JSON-serializable)'),
});
export type EvaluateInput = z.output<typeof evaluateInputSchema>;

// =============================================================================
// All Schemas
// =============================================================================

export const browserSchemas = {
  // Core
  goto: gotoInputSchema,
  snapshot: snapshotInputSchema,
  click: clickInputSchema,
  type: typeInputSchema,
  press: pressInputSchema,
  select: selectInputSchema,
  scroll: scrollInputSchema,
  close: closeInputSchema,
  // Extended
  hover: hoverInputSchema,
  back: backInputSchema,
  dialog: dialogInputSchema,
  wait: waitInputSchema,
  tabs: tabsInputSchema,
  drag: dragInputSchema,
  // Escape hatch
  evaluate: evaluateInputSchema,
} as const;
