import { test, expect, type Locator, type Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

/** Locate the MetricsCard containing a given title (h2). Walks up to the
 *  outermost dashboard card so assertions can scope to just this card. */
function cardByTitle(page: Page, title: string): Locator {
  return page.locator('div.border-border1', {
    has: page.getByRole('heading', { name: title, exact: true }),
  });
}

/** The metrics dashboard surfaces drilldown icon buttons for whole-card
 *  navigation and makes table/bar rows clickable. These tests assert the URL
 *  each surface produces. They don't require seeded metrics data, because card
 *  header icons render as soon as the card mounts. */

test('Latency card header opens traces filtered to active tab rootEntityType', async ({ page }) => {
  await page.goto('/metrics');

  const latencyCard = cardByTitle(page, 'Latency');

  const openInTraces = latencyCard.getByRole('link', { name: 'View in Traces' });
  await expect(openInTraces).toBeVisible();

  const agentHref = await openInTraces.getAttribute('href');
  expect(agentHref).toContain('/observability?');
  expect(agentHref).toContain('datePreset=last-24h');
  expect(agentHref).toContain('rootEntityType=agent');
});

test('Latency card header honors the active tab (workflows)', async ({ page }) => {
  await page.goto('/metrics');

  const latencyCard = cardByTitle(page, 'Latency');
  await latencyCard.getByRole('tab', { name: 'Workflows' }).click();

  const href = await latencyCard.getByRole('link', { name: 'View in Traces' }).getAttribute('href');
  expect(href).toContain('rootEntityType=workflow_run');
});

test('Trace Volume card exposes both traces and logs drilldown buttons', async ({ page }) => {
  await page.goto('/metrics');

  const card = cardByTitle(page, 'Trace Volume');

  const tracesLink = card.getByRole('link', { name: 'View in Traces' });
  const logsLink = card.getByRole('link', { name: 'View errors in Logs' });

  await expect(tracesLink).toBeVisible();
  await expect(logsLink).toBeVisible();

  const logsHref = await logsLink.getAttribute('href');
  expect(logsHref).toContain('/logs?');
  expect(logsHref).toContain('filterLevel=error');
  expect(logsHref).toContain('rootEntityType=agent');
});

test('drilldown preserves dashboard dimensional filters (filterEnvironment=prod)', async ({ page }) => {
  await page.goto('/metrics?filterEnvironment=prod');

  const latencyCard = cardByTitle(page, 'Latency');
  const href = await latencyCard.getByRole('link', { name: 'View in Traces' }).getAttribute('href');
  expect(href).toContain('filterEnvironment=prod');
});

test('drilldown propagates a 7-day metrics preset as last-7d', async ({ page }) => {
  await page.goto('/metrics?period=7d');

  const latencyCard = cardByTitle(page, 'Latency');
  const href = await latencyCard.getByRole('link', { name: 'View in Traces' }).getAttribute('href');
  expect(href).toContain('datePreset=last-7d');
});

test('Model Usage and Scores cards expose traces drilldown buttons', async ({ page }) => {
  await page.goto('/metrics');

  await expect(cardByTitle(page, 'Model Usage & Cost').getByRole('link', { name: 'View in Traces' })).toBeAttached();
  await expect(cardByTitle(page, 'Scores').getByRole('link', { name: 'View in Traces' })).toBeAttached();
});

test('Scores card header drilldown uses rootEntityType=scorer', async ({ page }) => {
  await page.goto('/metrics');

  const href = await cardByTitle(page, 'Scores').getByRole('link', { name: 'View in Traces' }).getAttribute('href');
  expect(href).toContain('rootEntityType=scorer');
});
