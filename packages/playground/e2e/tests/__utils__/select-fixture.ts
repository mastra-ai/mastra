import { Page } from '@playwright/test';

export type Fixtures = 'text-stream' | 'tool-stream' | 'workflow-stream';

export const selectFixture = async (page: Page, fixture: Fixtures) => {
  await page.addInitScript(browserFixture => {
    window.localStorage.setItem(
      'mastra-playground-store',
      `{"state":{"requestContext":{"fixture":"${browserFixture}"}},"version":0}`,
    );
  }, fixture);
};
