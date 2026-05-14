import { test, expect, type Locator, type Page } from '@playwright/test';
import { resetStorage } from '../__utils__/reset-storage';

test.afterEach(async () => {
  await resetStorage();
});

function cardByTitle(page: Page, title: string): Locator {
  return page.locator('div.border-border1', {
    has: page.getByRole('heading', { name: title, exact: true }),
  });
}

async function gotoMetricsOrSkip(page: Page, url = '/metrics') {
  await page.goto(url);

  const unsupportedStorageNotice = page.getByRole('heading', {
    name: 'Metrics are not available with your current storage',
  });
  await page
    .getByRole('heading', { name: /^(Latency|Metrics are not available with your current storage)$/ })
    .first()
    .waitFor();
  test.skip(
    await unsupportedStorageNotice.isVisible(),
    'Metrics are not available with the current kitchen-sink storage',
  );
}

test('Latency card header opens traces filtered to active tab rootEntityType', async ({ page }) => {
  await gotoMetricsOrSkip(page);

  const latencyCard = cardByTitle(page, 'Latency');

  const openInTraces = latencyCard.getByRole('link', { name: 'View in Traces' });
  await expect(openInTraces).toBeVisible();

  const agentHref = await openInTraces.getAttribute('href');
  expect(agentHref).toContain('/observability?');
  expect(agentHref).toContain('datePreset=last-24h');
  expect(agentHref).toContain('rootEntityType=agent');
});

test('Latency card header honors the active tab (workflows)', async ({ page }) => {
  await gotoMetricsOrSkip(page);

  const latencyCard = cardByTitle(page, 'Latency');
  await latencyCard.getByRole('tab', { name: 'Workflows' }).click();

  const href = await latencyCard.getByRole('link', { name: 'View in Traces' }).getAttribute('href');
  expect(href).toContain('rootEntityType=workflow_run');
});

test('Trace Volume card exposes both traces and logs drilldown buttons', async ({ page }) => {
  await gotoMetricsOrSkip(page);

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
  await gotoMetricsOrSkip(page, '/metrics?filterEnvironment=prod');

  const latencyCard = cardByTitle(page, 'Latency');
  const href = await latencyCard.getByRole('link', { name: 'View in Traces' }).getAttribute('href');
  expect(href).toContain('filterEnvironment=prod');
});

test('drilldown propagates a 7-day metrics preset as last-7d', async ({ page }) => {
  await gotoMetricsOrSkip(page, '/metrics?period=7d');

  const latencyCard = cardByTitle(page, 'Latency');
  const href = await latencyCard.getByRole('link', { name: 'View in Traces' }).getAttribute('href');
  expect(href).toContain('datePreset=last-7d');
});

test('Model Usage card exposes traces drilldown button', async ({ page }) => {
  await gotoMetricsOrSkip(page);

  await expect(cardByTitle(page, 'Model Usage & Cost').getByRole('link', { name: 'View in Traces' })).toBeAttached();
});
