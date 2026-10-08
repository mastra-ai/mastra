import { expect, test } from '@playwright/test';

// Returning to Build should recover the resources and sections used, without
// replacing the full catalog with a second list in navigation.
test.describe('Build discovery', () => {
  test.describe('when resources from different catalogs have been opened', () => {
    test('pins a resource across reloads and resumes its last configuration section', async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const agentId = process.env.E2E_AGENT_ID ?? 'weather-agent';
      const toolId = process.env.E2E_TOOL_ID ?? 'weatherInfo';
      await page.goto(`/agents/${agentId}/configuration#tools`);
      await expect(page.locator('#tools')).toBeVisible();
      const name = await page.locator('main').getByRole('heading', { level: 1 }).innerText();
      await page.goto(`/tools/${toolId}`);
      await expect(page.getByRole('tab', { name: 'Playground', exact: true })).toBeVisible();
      await page
        .getByRole('complementary', { name: 'Studio navigation', exact: true })
        .getByRole('link', { name: 'Build', exact: true })
        .click();
      const sidebar = page.getByRole('complementary', { name: 'Build navigation', exact: true });
      const shortcuts = sidebar.getByRole('navigation', { name: 'Build shortcuts' });
      await expect(shortcuts.getByRole('link', { name, exact: true })).toHaveAttribute(
        'href',
        `/agents/${agentId}/configuration#tools`,
      );
      await shortcuts.getByRole('button', { name: `Pin ${name}`, exact: true }).click();
      await expect(shortcuts.getByRole('button', { name: `Unpin ${name}`, exact: true })).toBeVisible();
      await page.reload();
      await expect(shortcuts.getByRole('button', { name: `Unpin ${name}`, exact: true })).toBeVisible();
      await expect(shortcuts.getByRole('link', { name, exact: true })).toHaveCount(1);
      await page.screenshot({ path: testInfo.outputPath('build-discovery-desktop.png') });
      await shortcuts.getByRole('link', { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/agents/${agentId}/configuration#tools$`));
      await expect(
        page
          .locator('#tools')
          .getByRole('link', { name: /^Inspect and test/ })
          .first(),
      ).toBeVisible();
    });
  });
});
