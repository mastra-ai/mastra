import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { elementActionTool } from './tools/action';
import { closeBrowserTool } from './tools/close-browser';
import { closePageTool } from './tools/close-page';
import { getElementsTool } from './tools/get-elements';
import { launchBrowserTool } from './tools/launch';
import { newPageTool } from './tools/new-page';
import type { ToolContext } from './tools/types';

export function createBrowserToolbelt(options: Parameters<typeof launchBrowserTool>[0]) {
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
    findElement: getElementsTool(context),
    actionTool: elementActionTool(context),
    closePage: closePageTool(context),
    closeBrowser: closeBrowserTool(context),
  };
}
