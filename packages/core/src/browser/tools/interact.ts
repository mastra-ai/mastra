/**
 * Browser Interact Tool
 *
 * Handles element interactions:
 * - click: Click on an element
 * - double_click: Double-click on an element
 * - hover: Hover over an element
 * - focus: Focus on an element
 * - drag: Drag element to target
 * - tap: Tap on an element (touch)
 */

import { createTool } from '../../tools';
import { interactInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserInteractTool = createTool({
  id: 'browser_interact',
  description: `Interact with browser elements. Actions:
- click: Click on an element (by ref or coordinates)
- double_click: Double-click on an element
- hover: Hover over an element
- focus: Focus on an element  
- drag: Drag from source to target
- tap: Tap on an element (touch event)`,
  inputSchema: interactInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.interact(input as Parameters<typeof browser.interact>[0]);
  },
});
