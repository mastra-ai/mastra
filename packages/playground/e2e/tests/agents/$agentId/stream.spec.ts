import { test, expect, Page, BrowserContext } from '@playwright/test';
import { selectFixture } from '../../__utils__/select-fixture';
import { resetStorage } from '../../__utils__/reset-storage';

let page: Page;
let context: BrowserContext;

test.beforeEach(async ({ browser }) => {
  await resetStorage();
  context = await browser.newContext();
  page = await context.newPage();
});

test.afterEach(async () => {
  await context.close();
  await resetStorage();
});

/**
 * Fill the chat input, click Send, and wait for navigation away from /chat/new.
 * Uses pressSequentially to work reliably with React controlled inputs.
 * After sending, the app navigates from /chat/new to /chat/{threadId} — we wait
 * for that transition so subsequent assertions run against the correct thread.
 */
async function fillAndSend(page: Page, message: string) {
  const chatInput = page.getByPlaceholder('Enter your message...');
  const sendButton = page.getByRole('button', { name: 'Send' });

  await chatInput.click();
  await chatInput.pressSequentially(message, { delay: 10 });
  await expect(sendButton).toBeEnabled({ timeout: 5000 });
  await sendButton.click();
}

test('text stream', async () => {
  const expectedResult = `I can help you get accurate weather forecasts by providing real-time data for your location. Just tell me your city or location, and I'll give you current conditions and detailed forecasts with temperature, humidity, and wind speed. Whether you're planning a trip or just checking today, I'm here to help! What is your current location?`;

  await selectFixture(page, 'text-stream');
  await page.goto(`/agents/weather-agent/chat/new`);
  await page.click('text=Model settings');
  await page.click('text=Stream');

  await fillAndSend(page, 'Give me the Lorem Ipsum thing');

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

  // Memory
  await page.reload();
  await expect(page.getByTestId('thread-list').getByRole('link', { name: expectedResult })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByTestId('thread-wrapper').getByText(expectedResult)).toBeVisible({ timeout: 20000 });
});

test('tool stream', async () => {
  await selectFixture(page, 'tool-stream');
  await page.goto(`/agents/weather-agent/chat/new`);
  await page.click('text=Model settings');
  await page.click('text=Stream');

  await fillAndSend(page, 'Give me the weather in Paris');

  // Wait for navigation from /chat/new to the actual thread URL
  await expect(page).not.toHaveURL(/\/chat\/new/, { timeout: 20000 });

  await assertToolStream(page);
  await page.reload();
  await assertToolStream(page);
});

async function assertToolStream(page: Page) {
  const expectedTextResult = `The weather in Paris is sunny, with a temperature of 19°C (66°F). The humidity is at 50%, and there's a light wind blowing at 10 mph. Perfect weather for a lovely day out or a cozy meal at home!`;

  // Check tool badge
  await expect(page.getByTestId('thread-wrapper').getByRole('button', { name: `weatherInfo` })).toBeVisible({
    timeout: 20000,
  });

  // Asset streaming result
  await expect(page.getByTestId('thread-wrapper').getByText(expectedTextResult)).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: `weatherInfo` }).click();
  await expect(page.getByTestId('tool-args')).toContainText('{  "location": "paris"}');

  await expect(page.getByTestId('tool-result')).toContainText(`"temperature":`);
  await expect(page.getByTestId('tool-result')).toContainText(`"feelsLike":`);
  await expect(page.getByTestId('tool-result')).toContainText(`"humidity":`);
  await expect(page.getByTestId('tool-result')).toContainText(`"windSpeed":`);
  await expect(page.getByTestId('tool-result')).toContainText(`"windGust":`);
  await expect(page.getByTestId('tool-result')).toContainText(`"conditions":`);
  await expect(page.getByTestId('tool-result')).toContainText(`"location":`);
}

test('workflow stream', async () => {
  await selectFixture(page, 'workflow-stream');
  await page.goto(`/agents/weather-agent/chat/new`);
  await page.click('text=Model settings');
  await page.click('text=Stream');

  await fillAndSend(page, 'Give me the weather in Paris');

  // Assert partial streaming chunks
  await expect(page.getByTestId('thread-wrapper').getByRole('button', { name: `lessComplexWorkflow` })).toBeVisible({
    timeout: 20000,
  });

  // Workflow checks
  await expect(page.locator('[data-workflow-node]').nth(0)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(1)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(2)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(3)).toHaveAttribute('data-workflow-step-status', 'success');
  // 4 and 6 are conditional

  await expect(page.locator('[data-workflow-node]').nth(5)).toHaveAttribute('data-workflow-step-status', 'idle');
  await expect(page.locator('[data-workflow-node]').nth(7)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(7)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(8)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(9)).toHaveAttribute('data-workflow-step-status', 'running');

  // Text delta result
  await expect(
    page
      .getByTestId('thread-wrapper')
      .getByText(`It looks like the process I ran with "tomato" resulted in a playful transformation: `),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('thread-wrapper').getByText('tomatoABtomatoACLABD-ENDED')).toBeVisible({
    timeout: 20000,
  });

  // Memory
  await expect(page.getByTestId('thread-list').locator('li')).toHaveCount(2); // One is the new button, second is the new thread
  await page.reload();
  await expect(page.locator('[data-workflow-node]').nth(0)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(1)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(2)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(3)).toHaveAttribute('data-workflow-step-status', 'success');
  // 4 and 6 are conditional

  await expect(page.locator('[data-workflow-node]').nth(5)).toHaveAttribute('data-workflow-step-status', 'idle');
  await expect(page.locator('[data-workflow-node]').nth(7)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(7)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(8)).toHaveAttribute('data-workflow-step-status', 'success');
  await expect(page.locator('[data-workflow-node]').nth(9)).toHaveAttribute('data-workflow-step-status', 'success');

  // Text delta result
  await expect(
    page
      .getByTestId('thread-wrapper')
      .getByText(`It looks like the process I ran with "tomato" resulted in a playful transformation: `),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('thread-wrapper').getByText('tomatoABtomatoACLABD-ENDED')).toBeVisible({
    timeout: 20000,
  });
});
