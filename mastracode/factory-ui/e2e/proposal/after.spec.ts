import { expect, test } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { HEAVY, listen, memberHandlers, providerHandlers, relayToFixture, server } from './fixtures';

const OUT = process.env.PROPOSAL_OUT ?? '/tmp/proposal-shots';
const shot = (name: string) => `${OUT}/after-${name}.png`;
const settle = (page: import('@playwright/test').Page, ms = 1500) => page.waitForTimeout(ms);

test.describe('After: one setup path for members, from the web and from Slack', () => {
  test.beforeAll(() => listen());
  test.afterAll(() => server.close());
  test.afterEach(() => server.resetHandlers());
  test.beforeEach(async ({ context, baseURL }) => {
    server.use(...memberHandlers);
    await relayToFixture(context, baseURL);
  });

  test('invited member: setup asks only for their own model', async ({ page }) => {
    server.use(...providerHandlers());
    await page.goto(`/factories/${HEAVY.factoryId}/setup`);
    await expect(page.getByRole('heading', { name: /Welcome to/ })).toBeVisible({ timeout: 30_000 });
    await settle(page, 2500);
    await page.screenshot({ path: shot('01-member-setup') });
  });

  test('provider picker: subscription sign-in or API key, inline', async ({ page }) => {
    server.use(...providerHandlers());
    await page.goto(`/factories/${HEAVY.factoryId}/setup`);
    await expect(page.getByRole('heading', { name: /Welcome to/ })).toBeVisible({ timeout: 30_000 });
    await settle(page, 1500);
    const trigger = page
      .getByRole('combobox')
      .or(page.getByRole('button', { name: /provider/i }))
      .first();
    await trigger.click();
    await settle(page, 600);
    await page
      .getByRole('radio', { name: 'Subscription' })
      .or(page.getByRole('tab', { name: 'Subscription' }))
      .or(page.getByText('Subscription', { exact: true }))
      .first()
      .click();
    await settle(page, 800);
    await page.screenshot({ path: shot('02-provider-picker') });
  });

  test('from Slack: signed in and linked in one go, model is the last step', async ({ page }) => {
    server.use(...providerHandlers({ personal: 'anthropic' }));
    await page.goto(`/factories/${HEAVY.factoryId}/setup?from=slack&ready=1`);
    await expect(page.getByRole('heading', { name: /Finish setting up/ })).toBeVisible({ timeout: 30_000 });
    await settle(page, 2500);
    await page.screenshot({ path: shot('03-from-slack') });
  });

  test('from Slack: done, the waiting message already runs', async ({ page }) => {
    server.use(...providerHandlers({ personal: 'anthropic' }));
    await page.goto(`/factories/${HEAVY.factoryId}/setup?from=slack&step=done`);
    await expect(page.getByRole('heading', { name: /all set/ })).toBeVisible({ timeout: 30_000 });
    await settle(page, 2000);
    await page.screenshot({ path: shot('04-done-slack') });
  });

  test('no-model wall becomes an inline connect', async ({ page }) => {
    server.use(...providerHandlers());
    await page.goto(`/factories/${HEAVY.factoryId}/new`);
    await expect(page.getByRole('heading', { name: /Connect your model/ })).toBeVisible({ timeout: 30_000 });
    await settle(page, 1500);
    await page.screenshot({ path: shot('05-inline-model') });
  });

  test('non-member: request access instead of a dead end', async ({ page }) => {
    server.use(
      http.get('*/auth/me', () =>
        HttpResponse.json({
          authenticated: true,
          authEnabled: true,
          provider: 'workos',
          user: { userId: 'user-alex', email: 'alex@contractor.dev', name: 'Alex' },
        }),
      ),
      http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [] })),
    );
    await page.goto(`/join?agent=Shipyard&factory=the-factory&org=Kepler`);
    await expect(page.getByRole('heading', { name: /not in/ })).toBeVisible({ timeout: 30_000 });
    await settle(page, 1200);
    await page.screenshot({ path: shot('06-not-a-member') });
    await page.goto(`/join?agent=Shipyard&factory=the-factory&org=Kepler&state=requested`);
    await expect(page.getByRole('heading', { name: 'Request sent' })).toBeVisible();
    await settle(page, 1200);
    await page.screenshot({ path: shot('07-request-sent') });
  });
});
