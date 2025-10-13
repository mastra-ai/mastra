import { Page } from '@playwright/test';
import { Fixtures } from '../../template/types';

export const selectFixture = async (page: Page, fixture: Fixtures) => {
  await page.addInitScript(browserFixture => {
    window.localStorage.setItem(
      'mastra-playground-store',
      `{"state":{"runtimeContext":{"fixture":"${browserFixture}"}},"version":0}`,
    );
  }, fixture);
};
