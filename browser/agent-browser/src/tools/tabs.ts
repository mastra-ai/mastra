import type { TabsListOutput, TabNewOutput, TabSwitchOutput, TabCloseOutput } from '@mastra/core/browser';
import {
  tabsListInputSchema,
  tabsListOutputSchema,
  tabNewInputSchema,
  tabNewOutputSchema,
  tabSwitchInputSchema,
  tabSwitchOutputSchema,
  tabCloseInputSchema,
  tabCloseOutputSchema,
  ErrorCode,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createTabsListTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_tabs_list',
    description: 'List all open browser tabs.',
    inputSchema: tabsListInputSchema,
    outputSchema: tabsListOutputSchema,
    execute: async (): Promise<TabsListOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.listTabs) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Tab management not supported by this browser provider.',
          };
        }

        const tabs = await browser.listTabs();

        return {
          success: true,
          tabs: tabs.map(tab => ({
            index: tab.index,
            url: tab.url,
            title: tab.title,
            active: tab.active,
          })),
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

export function createTabNewTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_tab_new',
    description: 'Open a new browser tab, optionally navigating to a URL.',
    inputSchema: tabNewInputSchema,
    outputSchema: tabNewOutputSchema,
    execute: async ({ context }): Promise<TabNewOutput> => {
      const { url } = context;

      try {
        const browser = await getBrowser();

        if (!browser.newTab) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Tab management not supported by this browser provider.',
          };
        }

        const result = await browser.newTab(url);
        const tabs = (await browser.listTabs?.()) ?? [];

        return {
          success: true,
          index: result.index ?? tabs.length - 1,
          total: result.total ?? tabs.length,
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

export function createTabSwitchTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_tab_switch',
    description: 'Switch to a specific browser tab by index.',
    inputSchema: tabSwitchInputSchema,
    outputSchema: tabSwitchOutputSchema,
    execute: async ({ context }): Promise<TabSwitchOutput> => {
      const { index } = context;

      try {
        const browser = await getBrowser();

        if (!browser.switchTo) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Tab management not supported by this browser provider.',
          };
        }

        await browser.switchTo(index);
        const page = browser.getPage();

        return {
          success: true,
          index,
          url: page.url(),
          title: await page.title(),
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

export function createTabCloseTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_tab_close',
    description: 'Close a browser tab. Closes current tab if no index specified.',
    inputSchema: tabCloseInputSchema,
    outputSchema: tabCloseOutputSchema,
    execute: async ({ context }): Promise<TabCloseOutput> => {
      const { index } = context;

      try {
        const browser = await getBrowser();

        if (!browser.closeTab) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Tab management not supported by this browser provider.',
          };
        }

        const closedIndex = index ?? browser.getActiveIndex?.() ?? 0;
        await browser.closeTab(index);
        const tabs = (await browser.listTabs?.()) ?? [];

        return {
          success: true,
          closed: closedIndex,
          remaining: tabs.length,
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
