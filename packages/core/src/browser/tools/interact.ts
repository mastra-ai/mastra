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
import { createError } from '../errors';
import { interactInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserInteractTool = createTool({
  id: 'browser_interact',
  description: `Interact with browser elements. Actions:
- click: Click on an element (by ref)
- double_click: Double-click on an element
- hover: Hover over an element
- focus: Focus on an element  
- drag: Drag from source to target
- tap: Tap on an element (touch event)`,
  inputSchema: interactInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);

    try {
      return await browser.interact(input as Parameters<typeof browser.interact>[0]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Stale ref - element no longer exists
      if (msg.includes('STALE_REF:')) {
        const ref = msg.split('STALE_REF:')[1];
        return createError(
          'stale_ref',
          `Ref ${ref} not found. The page has changed.`,
          'IMPORTANT: Take a new snapshot NOW to see the current page state and get fresh refs.',
        );
      }

      // Element blocked by overlay/modal
      if (msg.includes('intercepts pointer events')) {
        return createError(
          'element_blocked',
          'Element is blocked by another element (modal/overlay).',
          'Take a new snapshot to see what is blocking. Dismiss any modals or scroll the element into view.',
        );
      }

      // Timeout
      if (msg.includes('Timeout') || msg.includes('timeout')) {
        return createError(
          'timeout',
          'Interaction timed out.',
          'Take a new snapshot - the element may have moved or the page may have changed.',
        );
      }

      // Generic error
      return createError(
        'browser_error',
        `Interaction failed: ${msg}`,
        'Take a new snapshot to see the current page state.',
      );
    }
  },
});
