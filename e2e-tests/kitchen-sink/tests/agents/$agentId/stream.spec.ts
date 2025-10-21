import { test, expect, Page } from '@playwright/test';
import { selectFixture } from '../../__utils__/select-fixture';
import { nanoid } from 'nanoid';

let page: Page;

test.beforeEach(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
});

test('text stream', async () => {
  const expectedResult = `I can help you get accurate weather forecasts by providing real-time data for your location. Just tell me your city or location, and I'll give you current conditions and detailed forecasts with temperature, humidity, and wind speed. Whether you're planning a trip or just checking today, I'm here to help! What is your current location?`;

  await selectFixture(page, 'text-stream');
  await page.goto(`http://localhost:4111/agents/weatherAgent/chat/${nanoid()}`);
  await page.click('text=Model settings');
  await page.click('text=Stream');

  await page.locator('textarea').fill('Give me the Lorem Ipsum thing');
  await page.click('button:has-text("Send")');

  // Assert partial streaming chunks
  await expect(page.getByTestId('thread-wrapper').getByText(`I can help you get accurate`)).toBeVisible({
    timeout: 20000,
  });

  await expect(page.getByTestId('thread-wrapper').getByText(expectedResult)).not.toBeVisible({ timeout: 20000 });

  // Asset streaming result
  await expect(page.getByTestId('thread-wrapper').getByText(expectedResult)).toBeVisible({ timeout: 20000 });

  // Assert thread entry refreshing
  await expect(page.getByTestId('thread-list').getByRole('link', { name: expectedResult })).toBeVisible({
    timeout: 20000,
  });
});

test('tool stream', async () => {
  await selectFixture(page, 'tool-stream');
  await page.goto(`http://localhost:4111/agents/weatherAgent/chat/${nanoid()}`);
  await page.click('text=Model settings');
  await page.click('text=Stream');

  await page.locator('textarea').fill('Give me the weather in Paris');
  await page.click('button:has-text("Send")');

  // Assert partial streaming chunks
  await expect(page.getByTestId('thread-wrapper').getByRole('button', { name: `weatherInfo` })).toBeVisible({
    timeout: 20000,
  });
});
