import { expect, test } from '@playwright/test';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  test.describe(`Agent configuration on ${viewport.name}`, () => {
    test.use({ viewport });
    test.describe('when opening a bookmarked resource', () => {
      test('keeps resources together, scrolls to the section and preserves tool inspection', async ({
        page,
      }, testInfo) => {
        const agentId = process.env.E2E_AGENT_ID ?? 'weather-agent';
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`/agents/${agentId}/resources/tools`);
        await expect(page).toHaveURL(new RegExp(`/agents/${agentId}/configuration#tools$`));
        const tools = page.locator('#tools');
        await expect(tools.getByRole('link', { name: /^Inspect and test/ }).first()).toBeVisible();
        const position = await tools.boundingBox();
        expect(position?.y).toBeLessThan(150);
        await tools.getByRole('button', { name: 'Input & output schemas' }).first().click();
        await expect(tools.getByText('Input', { exact: true }).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

        await tools
          .getByRole('link', { name: /^Inspect and test/ })
          .first()
          .click();
        await expect(page.getByRole('button', { name: 'Close Panel', exact: true })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Playground', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Close Panel', exact: true }).click();

        if (viewport.width >= 1024) {
          const separator = page.getByRole('separator', { name: 'Resize Agent navigation' });
          await separator.focus();
          await page.keyboard.press('End');
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await page.keyboard.press('Home');
          await page.keyboard.press('ArrowRight');
        }
        await page.goto(`/agents/${agentId}/overview`);
        await expect(page.getByRole('heading', { name: 'Connected capabilities' })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Configured model' })).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        await page.screenshot({ path: testInfo.outputPath(`${viewport.name}.png`) });
        if (viewport.width < 1024) await page.getByRole('button', { name: 'Agent navigation', exact: true }).click();
        const sidebar = page.getByRole('complementary', { name: 'Agent navigation', exact: true });
        await expect(sidebar.getByRole('heading', { name: 'Recent chats' })).toBeVisible();
        await expect(sidebar.getByRole('region', { name: 'Agent activity' })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-sidebar.png`) });
        expect(errors).toEqual([]);
      });
    });
  });
}
