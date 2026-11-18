import { expect, test } from '@playwright/test';
import { http, HttpResponse } from 'msw';

import { HEAVY, listen, memberHandlers, relayToFixture, server, unhandled } from './fixtures';

const OUT = process.env.PROPOSAL_OUT ?? '/tmp/proposal-shots';
const shot = (name: string) => `${OUT}/before-${name}.png`;

test.describe('Before: invited member and Slack journeys', () => {
  test.beforeAll(() => listen());
  test.afterAll(() => {
    server.close();
    console.log('UNHANDLED', [...new Set(unhandled)].join('\n'));
  });
  test.afterEach(() => server.resetHandlers());
  test.beforeEach(async ({ context, baseURL }) => {
    server.use(...memberHandlers);
    await relayToFixture(context, baseURL);
  });

  test('member lands on the board with nothing asking them to finish setup', async ({ page }) => {
    await page.goto(`/factories/${HEAVY.factoryId}/work`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: shot('01-board') });
  });

  test('starting a session hits the No model available wall', async ({ page }) => {
    await page.goto(`/factories/${HEAVY.factoryId}/new`);
    await expect(page.getByRole('heading', { name: 'No model available' })).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: shot('02-no-model') });
  });

  test('Open Models settings drops them into model routing', async ({ page }) => {
    await page.goto(`/factories/${HEAVY.factoryId}/settings/models#personal-defaults`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: shot('03-models-settings') });
  });

  test('Slack "Connect account" lands on the first factory\'s Connections settings', async ({ page }) => {
    await page.goto(`/settings/connections`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: shot('04-slack-connect-landing') });
  });

  test('after Slack sign-in: no confirmation, no way back to Slack', async ({ page }) => {
    server.use(
      http.get('*/web/channel-accounts', () =>
        HttpResponse.json({
          canConnect: true,
          accounts: [
            {
              platform: 'slack',
              externalTeamId: 'T0001',
              externalUserId: 'U0001',
              externalTeamName: 'Kepler',
              externalUserName: 'Ward',
              linkedAt: '2026-11-17T23:50:00.000Z',
            },
          ],
        }),
      ),
    );
    await page.goto(`/factories/${HEAVY.factoryId}/settings/connections/slack?slack=connected`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: shot('05-slack-connected') });
  });

  test('non-member on Mastra Platform auth: access denied dead end', async ({ page }) => {
    server.use(
      http.get('*/auth/me', () =>
        HttpResponse.json({ authenticated: false, authEnabled: true, provider: 'mastra-studio' }),
      ),
    );
    const description =
      'You do not have access to this application. Please sign in with an account that belongs to this organization.';
    await page.goto(`/signin?error=access_denied&error_description=${encodeURIComponent(description)}`);
    await expect(page.getByText('Access denied')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: shot('06-access-denied') });
  });

  test('non-member on WorkOS auth: dropped into creating a brand-new factory', async ({ page }) => {
    server.use(
      http.get('*/auth/me', () =>
        HttpResponse.json({ authenticated: true, authEnabled: true, provider: 'workos', user: { userId: 'user-new' } }),
      ),
      http.get('*/web/factory/projects', () => HttpResponse.json({ projects: [] })),
    );
    await page.goto(`/settings/connections`);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: shot('07-nonmember-onboarding') });
  });
});
