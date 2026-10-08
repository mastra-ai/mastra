import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 950 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test.describe(`Chat Config on ${viewport.name}`, () => {
    test.use({ viewport });
    test.describe('when inspecting configuration during a conversation', () => {
      test('floats within chat without resizing it and opens advanced configuration', async ({ page }, testInfo) => {
        const agentId = process.env.E2E_AGENT_ID ?? 'weather-agent';
        await page.goto(`/agents/${agentId}/threads/new`);
        const toggle = page.getByRole('button', { name: 'Config', exact: true });
        const config = page.getByRole('dialog', { name: 'Config', exact: true });
        const canvas = page.getByTestId('agent-chat-canvas');
        await expect(toggle).toBeVisible();
        await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();
        await expect(config).toHaveCount(0);
        const before = await canvas.boundingBox();
        expect(before).not.toBeNull();
        if (!before) return;

        await toggle.click();
        await expect(config).toBeVisible();
        await expect(config.getByRole('heading', { name: 'System Prompt' })).toBeAttached();
        await expect(config.getByRole('button', { name: 'Close Config' })).toBeFocused();
        expect(await canvas.boundingBox()).toEqual(before);
        await expect
          .poll(async () => {
            const panel = await config.boundingBox();
            return (
              panel &&
              panel.x >= before.x &&
              panel.y >= before.y &&
              panel.x + panel.width <= before.x + before.width &&
              panel.y + panel.height <= before.y + before.height
            );
          })
          .toBe(true);
        const scroll = config.locator('[data-has-overflow-y][tabindex]');
        await scroll.evaluate(element => {
          element.scrollTop = element.scrollHeight;
        });
        await expect(config.getByRole('heading', { name: 'System Prompt' })).toBeVisible();
        expect(await scroll.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
        await scroll.evaluate(element => {
          element.scrollTop = 0;
        });
        await page.screenshot({ path: testInfo.outputPath(`config-${viewport.name}.png`) });

        await page.keyboard.press('Escape');
        await expect(config).toHaveCount(0);
        await expect(toggle).toBeFocused();
        expect(await canvas.boundingBox()).toEqual(before);
        await page.keyboard.press(']');
        await expect(config).toBeVisible();
        await config.getByRole('button', { name: 'Close Config' }).click();
        await expect(config).toHaveCount(0);
        await toggle.click();
        await config.getByRole('link', { name: 'Advanced config' }).click();
        await expect(page).toHaveURL(new RegExp(`/agents/${agentId}/overview$`));
        await expect(config).toHaveCount(0);
        if (viewport.width < 1024) await page.getByRole('button', { name: 'Page actions', exact: true }).click();
        await page.getByRole('link', { name: 'Open chat', exact: true }).click();
        await expect(page.getByPlaceholder('Enter your message...')).toBeVisible();
        await expect(config).toHaveCount(0);
        await toggle.click();
        await expect(config).toBeVisible();
        await page.reload();
        await expect(toggle).toBeVisible();
        await expect(config).toHaveCount(0);
      });
    });
  });
}
