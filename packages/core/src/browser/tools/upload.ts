/**
 * browser_upload - Upload file(s) to a file input
 */

import { createTool } from '../../tools';
import { uploadInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { requireBrowser } from './helpers';

export const browserUploadTool = createTool({
  id: BROWSER_TOOLS.UPLOAD,
  description: 'Upload file(s) to a file input element.',
  inputSchema: uploadInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    try {
      return await browser.upload(input);
    } catch (error) {
      return handleBrowserError(error, 'Upload');
    }
  },
});
