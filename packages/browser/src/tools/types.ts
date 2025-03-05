import type { Browser, BrowserContext, Page } from 'playwright';

export interface ToolContext {
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
}
