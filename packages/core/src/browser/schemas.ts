/**
 * Browser Tool Schemas
 *
 * These schemas define the input for browser tools.
 * Each tool uses a discriminated union based on an "action" field.
 */

import { z } from 'zod';

// ============================================================================
// 1. Navigate (5 actions: goto, back, forward, reload, close)
// ============================================================================

export const navigateInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('goto'),
    url: z.string().url().describe('The URL to navigate to'),
    waitUntil: z
      .enum(['load', 'domcontentloaded', 'networkidle'])
      .optional()
      .default('domcontentloaded')
      .describe('When to consider navigation complete'),
  }),
  z.object({
    action: z.literal('back'),
  }),
  z.object({
    action: z.literal('forward'),
  }),
  z.object({
    action: z.literal('reload'),
    waitUntil: z
      .enum(['load', 'domcontentloaded', 'networkidle'])
      .optional()
      .default('domcontentloaded')
      .describe('When to consider reload complete'),
  }),
  z.object({
    action: z.literal('close'),
  }),
]);

export type NavigateInput = z.infer<typeof navigateInputSchema>;

// ============================================================================
// 2. Interact (6 actions: click, double_click, hover, focus, drag, tap)
// ============================================================================

export const interactInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('click'),
    ref: z.string().describe('Element ref from snapshot (e.g., @e5)'),
    button: z.enum(['left', 'right', 'middle']).optional().default('left').describe('Mouse button'),
    newTab: z.boolean().optional().default(false).describe('Open link in new tab'),
  }),
  z.object({
    action: z.literal('double_click'),
    ref: z.string().describe('Element ref from snapshot'),
  }),
  z.object({
    action: z.literal('hover'),
    ref: z.string().describe('Element ref from snapshot'),
  }),
  z.object({
    action: z.literal('focus'),
    ref: z.string().describe('Element ref from snapshot'),
  }),
  z.object({
    action: z.literal('drag'),
    sourceRef: z.string().describe('Element ref to drag from'),
    targetRef: z.string().describe('Element ref to drag to'),
  }),
  z.object({
    action: z.literal('tap'),
    ref: z.string().describe('Element ref from snapshot'),
  }),
]);

export type InteractInput = z.infer<typeof interactInputSchema>;

// ============================================================================
// 3. Input (5 actions: fill, type, press, clear, select_all)
// ============================================================================

export const inputInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('fill'),
    ref: z.string().describe('Element ref from snapshot'),
    value: z.string().describe('Text to fill'),
  }),
  z.object({
    action: z.literal('type'),
    ref: z.string().describe('Element ref from snapshot'),
    text: z.string().describe('Text to type character by character'),
    delay: z.number().optional().describe('Delay between keystrokes in ms'),
  }),
  z.object({
    action: z.literal('press'),
    ref: z.string().describe('Element ref from snapshot'),
    key: z.string().describe('Key to press (e.g., Enter, Tab, Escape)'),
  }),
  z.object({
    action: z.literal('clear'),
    ref: z.string().describe('Element ref from snapshot'),
  }),
  z.object({
    action: z.literal('select_all'),
    ref: z.string().describe('Element ref from snapshot'),
  }),
]);

export type InputInput = z.infer<typeof inputInputSchema>;

// ============================================================================
// 4. Keyboard (4 actions: type, insert_text, key_down, key_up)
// ============================================================================

export const keyboardInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('type'),
    text: z.string().describe('Text to type'),
    delay: z.number().optional().describe('Delay between keystrokes in ms'),
  }),
  z.object({
    action: z.literal('insert_text'),
    text: z.string().describe('Text to insert directly'),
  }),
  z.object({
    action: z.literal('key_down'),
    key: z.string().describe('Key to press down'),
  }),
  z.object({
    action: z.literal('key_up'),
    key: z.string().describe('Key to release'),
  }),
]);

export type KeyboardInput = z.infer<typeof keyboardInputSchema>;

// ============================================================================
// 5. Form (4 actions: select, check, uncheck, upload)
// ============================================================================

export const formInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('select'),
    ref: z.string().describe('Select element ref'),
    value: z.string().optional().describe('Option value to select'),
    label: z.string().optional().describe('Option label to select'),
    index: z.number().optional().describe('Option index to select'),
  }),
  z.object({
    action: z.literal('check'),
    ref: z.string().describe('Checkbox element ref'),
  }),
  z.object({
    action: z.literal('uncheck'),
    ref: z.string().describe('Checkbox element ref'),
  }),
  z.object({
    action: z.literal('upload'),
    ref: z.string().describe('File input element ref'),
    files: z.array(z.string()).describe('File paths to upload'),
  }),
]);

export type FormInput = z.infer<typeof formInputSchema>;

// ============================================================================
// 6. Scroll (2 actions: scroll, into_view)
// ============================================================================

export const scrollInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('scroll'),
    direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
    amount: z.number().optional().describe('Pixels to scroll'),
    ref: z.string().optional().describe('Element ref to scroll within'),
  }),
  z.object({
    action: z.literal('into_view'),
    ref: z.string().describe('Element ref to scroll into view'),
  }),
]);

export type ScrollInput = z.infer<typeof scrollInputSchema>;

// ============================================================================
// 7. Extract (12 actions: snapshot, screenshot, text, html, value,
//    attribute, title, url, count, bounding_box, styles, evaluate)
// ============================================================================

export const extractInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('snapshot'),
    interactiveOnly: z.boolean().optional().default(true).describe('Only show interactive elements'),
    includeCursorElements: z.boolean().optional().default(false).describe('Include cursor-interactive elements'),
    compact: z.boolean().optional().default(false).describe('Remove empty structural elements'),
    maxDepth: z.number().optional().describe('Limit tree depth'),
    selector: z.string().optional().describe('CSS selector to scope snapshot'),
    maxElements: z.number().optional().default(50).describe('Maximum elements to include'),
    offset: z.number().optional().default(0).describe('Skip first N elements'),
  }),
  z.object({
    action: z.literal('screenshot'),
    fullPage: z.boolean().optional().default(false).describe('Capture full page'),
    ref: z.string().optional().describe('Element ref to screenshot'),
    quality: z.number().optional().describe('JPEG quality (0-100)'),
  }),
  z.object({
    action: z.literal('text'),
    ref: z.string().describe('Element ref to get text from'),
  }),
  z.object({
    action: z.literal('html'),
    ref: z.string().describe('Element ref to get HTML from'),
    outer: z.boolean().optional().default(false).describe('Include outer HTML'),
  }),
  z.object({
    action: z.literal('value'),
    ref: z.string().describe('Input element ref to get value from'),
  }),
  z.object({
    action: z.literal('attribute'),
    ref: z.string().describe('Element ref'),
    name: z.string().describe('Attribute name to get'),
  }),
  z.object({
    action: z.literal('title'),
  }),
  z.object({
    action: z.literal('url'),
  }),
  z.object({
    action: z.literal('count'),
    ref: z.string().describe('Element ref or selector to count'),
  }),
  z.object({
    action: z.literal('bounding_box'),
    ref: z.string().describe('Element ref to get bounding box'),
  }),
  z.object({
    action: z.literal('styles'),
    ref: z.string().describe('Element ref'),
    properties: z.array(z.string()).optional().describe('Specific CSS properties to get'),
  }),
  z.object({
    action: z.literal('evaluate'),
    script: z.string().describe('JavaScript to evaluate in page context'),
  }),
]);

export type ExtractInput = z.infer<typeof extractInputSchema>;

// ============================================================================
// 8. Element State (3 actions: is_visible, is_enabled, is_checked)
// ============================================================================

export const elementStateInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('is_visible'),
    ref: z.string().describe('Element ref to check'),
  }),
  z.object({
    action: z.literal('is_enabled'),
    ref: z.string().describe('Element ref to check'),
  }),
  z.object({
    action: z.literal('is_checked'),
    ref: z.string().describe('Checkbox/radio element ref to check'),
  }),
]);

export type ElementStateInput = z.infer<typeof elementStateInputSchema>;

// ============================================================================
// 9. Browser State (5 actions: set_viewport, set_credentials,
//    get_cookies, set_cookie, clear_cookies)
// ============================================================================

export const browserStateInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set_viewport'),
    width: z.number().describe('Viewport width in pixels'),
    height: z.number().describe('Viewport height in pixels'),
    deviceScaleFactor: z.number().optional().describe('Device scale factor'),
    isMobile: z.boolean().optional().describe('Emulate mobile viewport'),
  }),
  z.object({
    action: z.literal('set_credentials'),
    username: z.string().describe('HTTP auth username'),
    password: z.string().describe('HTTP auth password'),
  }),
  z.object({
    action: z.literal('get_cookies'),
    urls: z.array(z.string()).optional().describe('URLs to get cookies for'),
  }),
  z.object({
    action: z.literal('set_cookie'),
    name: z.string().describe('Cookie name'),
    value: z.string().describe('Cookie value'),
    domain: z.string().optional().describe('Cookie domain'),
    path: z.string().optional().describe('Cookie path'),
    expires: z.number().optional().describe('Expiration timestamp'),
    httpOnly: z.boolean().optional().describe('HTTP only flag'),
    secure: z.boolean().optional().describe('Secure flag'),
    sameSite: z.enum(['Strict', 'Lax', 'None']).optional().describe('SameSite attribute'),
  }),
  z.object({
    action: z.literal('clear_cookies'),
  }),
]);

export type BrowserStateInput = z.infer<typeof browserStateInputSchema>;

// ============================================================================
// 10. Storage (6 actions via type + action combo)
// ============================================================================

export const storageInputSchema = z.object({
  type: z.enum(['local', 'session']).describe('Storage type'),
  action: z.enum(['get', 'set', 'clear']).describe('Storage action'),
  key: z.string().optional().describe('Storage key'),
  value: z.string().optional().describe('Value to set'),
});

export type StorageInput = z.infer<typeof storageInputSchema>;

// ============================================================================
// 11. Emulation (5 actions: device, media, geolocation, offline, headers)
// ============================================================================

export const emulationInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('device'),
    device: z.string().describe('Device name to emulate'),
  }),
  z.object({
    action: z.literal('media'),
    colorScheme: z.enum(['light', 'dark', 'no-preference']).optional().describe('Color scheme'),
    reducedMotion: z.enum(['reduce', 'no-preference']).optional().describe('Reduced motion'),
  }),
  z.object({
    action: z.literal('geolocation'),
    latitude: z.number().describe('Latitude'),
    longitude: z.number().describe('Longitude'),
    accuracy: z.number().optional().describe('Accuracy in meters'),
  }),
  z.object({
    action: z.literal('offline'),
    offline: z.boolean().describe('Enable offline mode'),
  }),
  z.object({
    action: z.literal('headers'),
    headers: z.record(z.string(), z.string()).describe('HTTP headers to set'),
  }),
]);

export type EmulationInput = z.infer<typeof emulationInputSchema>;

// ============================================================================
// 12. Frames (2 actions: switch, main)
// ============================================================================

export const framesInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('switch'),
    selector: z.string().optional().describe('Frame selector'),
    name: z.string().optional().describe('Frame name'),
    url: z.string().optional().describe('Frame URL pattern'),
  }),
  z.object({
    action: z.literal('main'),
  }),
]);

export type FramesInput = z.infer<typeof framesInputSchema>;

// ============================================================================
// 13. Dialogs (2 actions: handle, clear)
// ============================================================================

export const dialogsInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('handle'),
    accept: z.boolean().describe('Whether to accept or dismiss'),
    promptText: z.string().optional().describe('Text to enter for prompt dialogs'),
  }),
  z.object({
    action: z.literal('clear'),
  }),
]);

export type DialogsInput = z.infer<typeof dialogsInputSchema>;

// ============================================================================
// 14. Tabs (4 actions: list, new, switch, close)
// ============================================================================

export const tabsInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
  }),
  z.object({
    action: z.literal('new'),
    url: z.string().optional().describe('URL to open in new tab'),
  }),
  z.object({
    action: z.literal('switch'),
    index: z.number().describe('Tab index to switch to'),
  }),
  z.object({
    action: z.literal('close'),
    index: z.number().optional().describe('Tab index to close (current if omitted)'),
  }),
]);

export type TabsInput = z.infer<typeof tabsInputSchema>;

// ============================================================================
// 15. Recording (4 actions: record_start, record_stop, trace_start, trace_stop)
// ============================================================================

export const recordingInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('record_start'),
    path: z.string().describe('Path to save recording'),
  }),
  z.object({
    action: z.literal('record_stop'),
  }),
  z.object({
    action: z.literal('trace_start'),
    screenshots: z.boolean().optional().default(true).describe('Include screenshots'),
    snapshots: z.boolean().optional().default(true).describe('Include DOM snapshots'),
  }),
  z.object({
    action: z.literal('trace_stop'),
    path: z.string().describe('Path to save trace'),
  }),
]);

export type RecordingInput = z.infer<typeof recordingInputSchema>;

// ============================================================================
// 16. Monitoring (9 actions via type + action combo)
// ============================================================================

export const monitoringInputSchema = z.object({
  type: z.enum(['network', 'console', 'errors']).describe('What to monitor'),
  action: z.enum(['start', 'get', 'clear']).describe('Monitoring action'),
});

export type MonitoringInput = z.infer<typeof monitoringInputSchema>;

// ============================================================================
// 17. Clipboard (4 actions: copy, paste, read, write)
// ============================================================================

export const clipboardInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('copy'),
    ref: z.string().describe('Element ref to copy text from'),
  }),
  z.object({
    action: z.literal('paste'),
    ref: z.string().describe('Element ref to paste into'),
  }),
  z.object({
    action: z.literal('read'),
  }),
  z.object({
    action: z.literal('write'),
    text: z.string().describe('Text to write to clipboard'),
  }),
]);

export type ClipboardInput = z.infer<typeof clipboardInputSchema>;

// ============================================================================
// 18. Debug (2 actions: inspect, highlight)
// ============================================================================

export const debugInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('inspect'),
    ref: z.string().describe('Element ref to inspect'),
  }),
  z.object({
    action: z.literal('highlight'),
    ref: z.string().describe('Element ref to highlight'),
    duration: z.number().optional().default(2000).describe('Highlight duration in ms'),
  }),
]);

export type DebugInput = z.infer<typeof debugInputSchema>;

// ============================================================================
// 19. Wait
// ============================================================================

export const waitInputSchema = z.object({
  ref: z.string().optional().describe('Element ref to wait for'),
  state: z
    .enum(['visible', 'hidden', 'attached', 'detached'])
    .optional()
    .default('visible')
    .describe('State to wait for'),
  timeout: z.number().optional().describe('Timeout in ms'),
});

export type WaitInput = z.infer<typeof waitInputSchema>;
