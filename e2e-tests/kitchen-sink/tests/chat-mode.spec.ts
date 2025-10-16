import { test, expect, Page } from '@playwright/test';
import { selectFixture } from './utils/select-fixture';
import { nanoid } from 'nanoid';

test.describe('chat modes', () => {
  let page: Page;
  let chatId: string;

  test.beforeEach(async ({ browser }) => {
    chatId = nanoid();
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.describe('stream', () => {
    test('text stream', async () => {
      await selectFixture(page, 'text-stream');
      await page.goto(`http://localhost:4111/agents/weatherAgent/chat/${chatId}`);
      await page.click('text=Model settings');
      await page.click('text=Stream');

      await page.locator('textarea').fill('Give me the Lorem Ipsum thing');
      await page.click('button:has-text("Send")');

      await expect(
        page.locator(
          `text=I can help you get accurate weather forecasts by providing real-time data for your location. Just tell me your city or location, and I'll give you current conditions and detailed forecasts with temperature, humidity, and wind speed. Whether you're planning a trip or just checking today, I'm here to help! What is your current location?`,
        ),
      ).toBeVisible({ timeout: 20000 });
    });

    test('tool stream', async () => {
      await selectFixture(page, 'tool-stream');
      await page.goto(`http://localhost:4111/agents/weatherAgent/chat/${chatId}`);
      await page.click('text=Model settings');
      await page.click('text=Stream');

      await page.locator('textarea').fill('Weather in Paris');
      await page.click('button:has-text("Send")');

      await expect(page.getByRole('button', { name: 'weatherInfo' })).toBeVisible({ timeout: 20000 });
      await page.getByRole('button', { name: 'weatherInfo' }).click();

      await expect(page.locator('[data-language="json"]').first()).toHaveText(`{  \"city\": \"Paris\"}`);
    });
  });
});
