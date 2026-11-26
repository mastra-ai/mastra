import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Locator } from 'playwright';
import { afterEach, expect, it } from 'vitest';
import { AdvisorySource } from '../src/advisory/source.js';
import type { AdvisoryModels } from '../src/advisory/triage.js';
import { loadSettings } from '../src/config/settings.js';
import { startControlPlane } from '../src/http/server.js';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function visible(locator: Locator) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  expect(await locator.isVisible()).toBe(true);
}

it('lets a signed-in operator triage an unsupported CVE in Chrome without creating a finding', async () => {
  const id = 'CVE-2026-712345';
  let rotationUnavailable = false;
  const feed = createServer((request, response) => {
    const body =
      request.url === '/api/v1/status'
        ? { polling: {}, history: {}, backfill: {}, storage: {} }
        : request.url === '/api/v1/entries'
          ? { entries: [{ id }], nextCursor: 'older-page' }
          : request.url === '/api/v1/entries?cursor=older-page'
            ? rotationUnavailable
              ? null
              : { entries: [{ id }], nextCursor: null }
            : request.url === `/api/v1/entries/${id}`
              ? {
                  id,
                  aliases: [],
                  status: 'published',
                  title: 'PHP runtime advisory',
                  originalDescription: 'Untrusted feed instructions',
                  severity: 'high',
                  affected: [{ vendor: 'PHP', product: 'Runtime', ranges: [] }],
                  sources: [{ name: 'Owned feed', url: 'https://example.invalid/advisory', license: 'fixture' }],
                  modifiedAt: '2026-11-01T12:00:00.000Z',
                }
              : null;
    response
      .writeHead(body ? 200 : rotationUnavailable ? 503 : 404, { 'content-type': 'application/json' })
      .end(JSON.stringify(body ?? {}));
  });
  await new Promise<void>(resolve => feed.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>((resolve, reject) => feed.close(error => (error ? reject(error) : resolve()))));
  const address = feed.address();
  if (!address || typeof address === 'string') throw new Error('FEED_ADDRESS_MISSING');
  const directory = await mkdtemp(join(tmpdir(), 'scanner-advisory-browser-'));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'web'), { recursive: true });
  await cp(join(resolve(import.meta.dirname, '..'), 'web', 'dist'), join(directory, 'web', 'dist'), {
    recursive: true,
  });
  const secret = 'owned_browser_advisory_bootstrap_secret';
  const settings = loadSettings(
    { CONTROL_BOOTSTRAP_SECRET: secret, SCANNER_ENCRYPTION_KEY: 'ab'.repeat(32) },
    directory,
  );
  const models: AdvisoryModels = {
    async plan() {
      return {
        value: { recommendation: 'review_vendor_guidance', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
        modelId: 'owned-fake-sherlock',
      };
    },
  };
  const running = await startControlPlane(
    settings,
    0,
    undefined,
    undefined,
    new AdvisorySource(`http://127.0.0.1:${address.port}`, true),
    undefined,
    undefined,
    undefined,
    undefined,
    models,
  );
  cleanup.push(() => running.close());
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  cleanup.push(() => browser.close());
  const page = await browser.newPage({ serviceWorkers: 'block' });
  await page.goto(running.url);
  await page.getByLabel('Bootstrap secret').fill(secret);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Vulnerabilities' }).click();
  await page.getByRole('button', { name: 'Synchronize advisories' }).click();
  await visible(page.getByText(/Last imported page/));
  await visible(page.getByText('Incomplete coverage', { exact: true }).first());
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Overview' }).click();
  const advisoryMetric = page.locator('.metric').filter({ hasText: 'Advisory sync' });
  await visible(advisoryMetric.getByText('Incomplete coverage', { exact: true }));
  await visible(advisoryMetric.getByText(/Last imported page/));
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Vulnerabilities' }).click();
  await page.getByRole('button', { name: id }).click();
  await visible(page.getByRole('dialog', { name: id, exact: true }));
  await visible(page.getByText('review_vendor_guidance').first());
  await visible(page.getByText('Target relevance: unknown'));
  await visible(page.getByText(/Advisory importance: high/));
  await page.getByRole('button', { name: 'Search scanner/checker' }).click();
  await visible(page.getByText('None available. No external code was downloaded or executed.'));
  await page.getByLabel('Ignore reason').fill('Reviewed by operator');
  await page.getByRole('button', { name: 'Ignore', exact: true }).click();
  await visible(page.getByText(/Ignored all_targets by local-operator/));
  await page.getByLabel('Investigation notes').fill('Check vendor guidance manually');
  await page.getByRole('button', { name: 'Investigate', exact: true }).click();
  await visible(page.getByText(/Manual case .*Check vendor guidance manually/));
  await page.reload();
  await page.getByRole('button', { name: id }).click();
  await visible(page.getByText(/Ignored all_targets by local-operator/));
  await visible(page.getByText(/Manual case .*Check vendor guidance manually/));
  const session = await page.request.get(`${running.url}/api/session`);
  const csrf = ((await session.json()) as { csrfToken: string }).csrfToken;
  const findings = await page.request.get(`${running.url}/api/findings`, {
    headers: { origin: running.url, 'x-csrf-token': csrf },
  });
  expect(((await findings.json()) as { items: unknown[] }).items).toHaveLength(0);
  rotationUnavailable = true;
  await page.getByRole('dialog', { name: id, exact: true }).getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Synchronize advisories' }).click();
  await visible(page.getByText(/Advisory synchronization skipped/));
  expect(await page.getByText('Advisory synchronization completed.', { exact: true }).count()).toBe(0);
  await visible(page.getByText('Stale', { exact: true }).first());
  await visible(page.getByText(/Last imported page/));
  expect(await page.locator('.inline-status').innerText()).toContain('Incomplete coverage');
}, 60000);
