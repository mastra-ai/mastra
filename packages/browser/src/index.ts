import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LanguageModelV1 } from 'ai';
import { elementActionTool } from './tools/action';
import { closeBrowserTool } from './tools/close-browser';
import { closePageTool } from './tools/close-page';
import { getElementsTool } from './tools/get-elements';
import { launchBrowserTool } from './tools/launch';
import { navigateTool } from './tools/navigate';
import { newPageTool } from './tools/new-page';
import type { ToolContext } from './tools/types';

type BrowserToolkitOptions = Parameters<typeof launchBrowserTool>[0] & {
  model: LanguageModelV1;
  batchSize?: number;
};

export function createBrowserToolkit({ model, batchSize, ...options }: BrowserToolkitOptions) {
  const context: ToolContext = {
    browser: null,
    context: null,
    page: null,
  };
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const domUtilsPath = join(__dirname, 'browser-tool.global.js');

  return {
    launchBrowser: launchBrowserTool(options, context),
    newPage: newPageTool({ domUtilsPath }, context),
    navigate: navigateTool(context),
    getElement: getElementsTool({ model, batchSize }, context),
    actionTool: elementActionTool(context),
    closePage: closePageTool(context),
    closeBrowser: closeBrowserTool(context),
  };
}
