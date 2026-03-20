/**
 * Browser Extract Tool
 *
 * Handles data extraction from pages:
 * - snapshot: Get accessibility tree
 * - screenshot: Capture screenshot
 * - get_html: Get page or element HTML
 * - get_text: Get page or element text content
 * - get_attribute: Get element attribute
 * - get_styles: Get computed styles
 * - get_bounding_box: Get element position/size
 * - get_count: Count matching elements
 * - get_url: Get current URL
 * - get_title: Get page title
 * - get_cdp_url: Get CDP WebSocket URL
 * - inspect: Inspect element details
 */

import { createTool } from '../../tools';
import { extractInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserExtractTool = createTool({
  id: 'browser_extract',
  description: `Extract data from the page. Actions:
- snapshot: Get accessibility tree for understanding page structure
- screenshot: Capture page or element screenshot
- get_html: Get HTML content
- get_text: Get text content
- get_attribute: Get specific attribute
- get_styles: Get computed CSS styles
- get_bounding_box: Get element position and size
- get_count: Count matching elements
- get_url: Get current page URL
- get_title: Get page title
- get_cdp_url: Get CDP WebSocket URL
- inspect: Get detailed element info`,
  inputSchema: extractInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.extract(input as Parameters<typeof browser.extract>[0]);
  },
});
