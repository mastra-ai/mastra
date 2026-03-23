/**
 * Browser Monitoring Tool
 *
 * Monitor browser activity:
 * - start_request_tracking: Track network requests
 * - get_requests: Get tracked requests
 * - clear_requests: Clear request log
 * - start_console_tracking: Track console messages
 * - get_console_messages: Get console messages
 * - clear_console: Clear console log
 * - start_error_tracking: Track page errors
 * - get_errors: Get tracked errors
 * - clear_errors: Clear error log
 */

import { createTool } from '../../tools';
import { monitoringInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserMonitoringTool = createTool({
  id: 'browser_monitoring',
  description: `Monitor browser activity. Actions:
- start_request_tracking: Start tracking network requests
- get_requests: Get tracked network requests
- clear_requests: Clear request log
- start_console_tracking: Start tracking console messages
- get_console_messages: Get console messages
- clear_console: Clear console log
- start_error_tracking: Start tracking page errors
- get_errors: Get tracked page errors
- clear_errors: Clear error log`,
  inputSchema: monitoringInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.monitoring(input as Parameters<typeof browser.monitoring>[0]);
  },
});
