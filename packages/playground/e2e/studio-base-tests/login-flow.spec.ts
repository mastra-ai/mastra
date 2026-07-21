import { expect, test } from '@playwright/test';

import { setupMockAuth } from '../tests/__utils__/auth';

/**
 * FEATURE: Studio authentication under a custom base path.
 * USER STORY: As a signed-out Studio user, I want Sign in to stay within the
 * configured Studio mount so that I reach the login form instead of the server welcome page.
 * BEHAVIOR UNDER TEST: A real Mastra server mounted at /studio serves the login
 * route selected by AuthRequired after credentials capabilities are returned.
 */
test.describe('Studio base-path login flow', () => {
  test.describe('when an unauthenticated user signs in from a protected Studio route', () => {
    test('navigates to the login route within the Studio base path', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
      });
      await page.goto('/studio/agents');

      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page).toHaveURL(/\/studio\/login\?redirect=/);
    });

    test('shows the credentials login form', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
      });
      await page.goto('/studio/agents');

      await page.getByRole('button', { name: 'Sign in' }).click();

      await expect(page.getByRole('heading', { name: 'Sign in to Mastra Studio' })).toBeVisible();
    });
  });
});
