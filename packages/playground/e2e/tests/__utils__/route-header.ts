import { expect, type Page } from '@playwright/test';

function routeHeader(page: Page) {
  return page.getByLabel('Breadcrumb').locator('xpath=ancestor::header[1]');
}

export async function expectCurrentBreadcrumb(page: Page, text: string) {
  const breadcrumb = page.getByLabel('Breadcrumb');
  await expect(breadcrumb).toBeVisible();
  await expect(breadcrumb.locator('[aria-current="page"]')).toContainText(text);
  await expect(page.locator('main > h1').first()).not.toHaveText('');
}

export async function expectBreadcrumbLink(page: Page, text: string, href: string | RegExp) {
  await expect(page.getByLabel('Breadcrumb').getByRole('link', { name: text })).toHaveAttribute('href', href);
}

export async function expectRouteDocsLink(page: Page, name: string, href: string) {
  await expect(routeHeader(page).getByRole('link', { name })).toHaveAttribute('href', href);
}
