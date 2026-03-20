import type { NetworkStartOutput, NetworkGetOutput, NetworkClearOutput } from '@mastra/core/browser';
import {
  networkStartInputSchema,
  networkStartOutputSchema,
  networkGetInputSchema,
  networkGetOutputSchema,
  networkClearInputSchema,
  networkClearOutputSchema,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createNetworkStartTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_network_start',
    description: 'Start tracking network requests.',
    inputSchema: networkStartInputSchema,
    outputSchema: networkStartOutputSchema,
    execute: async (): Promise<NetworkStartOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.startRequestTracking) {
          return {
            success: false,
            code: 'unknown',
            message: 'Network tracking not supported by this browser provider.',
          };
        }

        browser.startRequestTracking();

        return {
          success: true,
          message: 'Network tracking started.',
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

export function createNetworkGetTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_network_get',
    description: 'Get tracked network requests. Optionally filter by URL pattern.',
    inputSchema: networkGetInputSchema,
    outputSchema: networkGetOutputSchema,
    execute: async ({ context }): Promise<NetworkGetOutput> => {
      const { filter } = context;

      try {
        const browser = await getBrowser();

        if (!browser.getRequests) {
          return {
            success: false,
            code: 'unknown',
            message: 'Network tracking not supported by this browser provider.',
          };
        }

        const requests = browser.getRequests(filter);

        return {
          success: true,
          requests: requests.map(req => ({
            url: req.url,
            method: req.method,
            resourceType: req.resourceType,
            timestamp: req.timestamp,
          })),
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

export function createNetworkClearTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_network_clear',
    description: 'Clear tracked network requests.',
    inputSchema: networkClearInputSchema,
    outputSchema: networkClearOutputSchema,
    execute: async (): Promise<NetworkClearOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.clearRequests) {
          return {
            success: false,
            code: 'unknown',
            message: 'Network tracking not supported by this browser provider.',
          };
        }

        browser.clearRequests();

        return {
          success: true,
          message: 'Network requests cleared.',
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
