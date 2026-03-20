import type { SessionStorageGetOutput, SessionStorageSetOutput, SessionStorageClearOutput } from '@mastra/core/browser';
import {
  sessionStorageGetInputSchema,
  sessionStorageGetOutputSchema,
  sessionStorageSetInputSchema,
  sessionStorageSetOutputSchema,
  sessionStorageClearInputSchema,
  sessionStorageClearOutputSchema,
  ErrorCode,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createSessionStorageGetTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_session_storage_get',
    description: 'Get sessionStorage data. Optionally get a specific key.',
    inputSchema: sessionStorageGetInputSchema,
    outputSchema: sessionStorageGetOutputSchema,
    execute: async ({ context }): Promise<SessionStorageGetOutput> => {
      const { key } = context;

      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        const data = await page.evaluate((keyArg?: string) => {
          if (keyArg) {
            const value = sessionStorage.getItem(keyArg);
            return value !== null ? { [keyArg]: value } : {};
          }
          const result: Record<string, string> = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k) {
              result[k] = sessionStorage.getItem(k) || '';
            }
          }
          return result;
        }, key);

        return {
          success: true,
          data: data as Record<string, string>,
          url: page.url(),
        };
      } catch (error) {
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

export function createSessionStorageSetTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_session_storage_set',
    description: 'Set a sessionStorage key-value pair.',
    inputSchema: sessionStorageSetInputSchema,
    outputSchema: sessionStorageSetOutputSchema,
    execute: async ({ context }): Promise<SessionStorageSetOutput> => {
      const { key, value } = context;

      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.evaluate(
          (args: { k: string; v: string }) => {
            sessionStorage.setItem(args.k, args.v);
          },
          { k: key, v: value },
        );

        return {
          success: true,
          url: page.url(),
        };
      } catch (error) {
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

export function createSessionStorageClearTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_session_storage_clear',
    description: 'Clear all sessionStorage data.',
    inputSchema: sessionStorageClearInputSchema,
    outputSchema: sessionStorageClearOutputSchema,
    execute: async (): Promise<SessionStorageClearOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.evaluate(() => {
          sessionStorage.clear();
        });

        return {
          success: true,
          url: page.url(),
        };
      } catch (error) {
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
