import { expect, Page } from '@playwright/test';

export async function expectCurrentBreadcrumb(page: Page, text: string) {
  const breadcrumb = page.getByLabel('Breadcrumb');
  await expect(breadcrumb).toBeVisible();
  await expect(breadcrumb.locator('[aria-current="page"]')).toContainText(text);
}
