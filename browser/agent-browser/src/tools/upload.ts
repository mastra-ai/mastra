import type { UploadOutput } from '@mastra/core/browser';
import { uploadInputSchema, uploadOutputSchema, ErrorCode, BrowserToolError } from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createUploadTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_upload',
    description: 'Upload files to a file input element. Use element references from browser_snapshot.',
    inputSchema: uploadInputSchema,
    outputSchema: uploadOutputSchema,
    execute: async ({ context }): Promise<UploadOutput> => {
      const { ref, files } = context;

      try {
        const browser = await getBrowser();
        const locator = browser.getLocatorFromRef(ref);

        if (!locator) {
          return {
            success: false,
            code: ErrorCode.STALE_REF,
            message: `Element reference ${ref} not found. The page may have changed.`,
            recoveryHint: 'Take a new snapshot to get fresh element references.',
            canRetry: false,
          };
        }

        await locator.setInputFiles(files);

        return {
          success: true,
          uploaded: files,
        };
      } catch (error) {
        if (error instanceof BrowserToolError) {
          return {
            success: false,
            code: error.code,
            message: error.message,
            recoveryHint: error.recoveryHint,
            canRetry: error.canRetry,
          };
        }

        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: ErrorCode.UNKNOWN,
          message,
        };
      }
    },
  });
}
