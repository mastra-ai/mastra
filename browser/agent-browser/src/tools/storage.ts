import type { StorageGetOutput, StorageSetOutput, StorageClearOutput } from '@mastra/core/browser';
import {
  storageGetInputSchema,
  storageGetOutputSchema,
  storageSetInputSchema,
  storageSetOutputSchema,
  storageClearInputSchema,
  storageClearOutputSchema,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createStorageGetTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_storage_get',
    description: 'Get localStorage data. Optionally get a specific key.',
    inputSchema: storageGetInputSchema,
    outputSchema: storageGetOutputSchema,
    execute: async ({ context }): Promise<StorageGetOutput> => {
      const { key } = context;

      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        const data = await page.evaluate((keyArg?: string) => {
          if (keyArg) {
            const value = localStorage.getItem(keyArg);
            return value !== null ? { [keyArg]: value } : {};
          }
          const result: Record<string, string> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) {
              result[k] = localStorage.getItem(k) || '';
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
          code: 'unknown',
          message,
        };
      }
    },
  });
}

export function createStorageSetTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_storage_set',
    description: 'Set a localStorage key-value pair.',
    inputSchema: storageSetInputSchema,
    outputSchema: storageSetOutputSchema,
    execute: async ({ context }): Promise<StorageSetOutput> => {
      const { key, value } = context;

      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.evaluate(
          (args: { k: string; v: string }) => {
            localStorage.setItem(args.k, args.v);
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
          code: 'unknown',
          message,
        };
      }
    },
  });
}

export function createStorageClearTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_storage_clear',
    description: 'Clear all localStorage data.',
    inputSchema: storageClearInputSchema,
    outputSchema: storageClearOutputSchema,
    execute: async (): Promise<StorageClearOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.evaluate(() => {
          localStorage.clear();
        });

        return {
          success: true,
          url: page.url(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'unknown',
          message,
        };
      }
    },
  });
}
