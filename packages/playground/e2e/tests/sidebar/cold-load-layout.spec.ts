import { test, expect, Page } from '@playwright/test';
import { buildAuthCapabilities, buildCurrentUserResponse } from '../__utils__/auth';
import type { MockAuthConfig } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Studio Layout Cold-Load Stability
 * REGRESSION GUARD: Prevents reintroduction of an `isFetched`-gated sidebar render
 *   that left the main panel stretched full-width until /api/auth/capabilities
 *   resolved, then snapped into a sidebar+main grid.
 *
 * Existing coverage we do NOT duplicate:
 *   - Post-resolution unauthenticated state (sidebar hidden, inline login shown):
 *     `e2e/tests/auth/login-flow.spec.ts` → "unauthenticated user sees login prompt
 *     on protected page".
 *   - Post-resolution authenticated state (full nav rendered for admin/member/viewer):
 *     `e2e/tests/auth/login-flow.spec.ts` + `e2e/tests/auth/viewer-role.spec.ts`.
 *
 * The unique observation here is the pre-resolution paint, which requires stalling
 * the auth route — something the existing `setupMockAuth` utility cannot express.
 */

const LAYOUT_TOLERANCE_PX = 1;

/**
 * Intercept the auth routes and gate their resolution behind a returned `release()`
 * function. Allows the test to assert pre-resolution UI state deterministically.
 */
async function gateAuth(page: Page, config: MockAuthConfig): Promise<() => void> {
  const capabilitiesResponse = buildAuthCapabilities(config);
  const meResponse = buildCurrentUserResponse(config);

  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });

  await page.route('**/api/auth/capabilities', async route => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(capabilitiesResponse),
    });
  });

  await page.route('**/api/auth/me', async route => {
    await gate;
    if (meResponse) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(meResponse),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not authenticated' }),
      });
    }
  });

  return release;
}

test.describe('Studio Layout - Cold-Load Stability', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('sidebar column stays stable across auth resolution (no cold-load layout jump)', async ({ page }) => {
    // ARRANGE: Stall the auth routes so the page renders its first paint with auth
    // still in flight. Admin response so post-resolution keeps the sidebar.
    const releaseAuth = await gateAuth(page, { role: 'admin' });
    await page.goto('/agents');

    // ASSERT 1 (pre-resolution): The sidebar is in the DOM and laid out at a real
    // width BEFORE auth resolves. Without the optimistic render this would never
    // appear until `releaseAuth()` fires, and the test would time out here.
    const sidebar = page.locator('.sidebar-layout').first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    const boxBefore = await sidebar.boundingBox();
    expect(boxBefore).not.toBeNull();
    // MainSidebarProvider hydrates width synchronously from localStorage (default 240px).
    // Anything smaller would mean the sidebar collapsed or was unmounted.
    expect(boxBefore!.width).toBeGreaterThan(100);

    // ACT: Release the auth response. Register the waiter BEFORE calling release()
    // so the response cannot be flushed before we are listening for it.
    const responsePromise = page.waitForResponse('**/api/auth/capabilities');
    releaseAuth();
    await responsePromise;

    // Flush one frame so any React commit triggered by the resolved auth query
    // has been painted before we re-measure.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));

    // ASSERT 2 (post-resolution): Sidebar position and width are unchanged within
    // sub-pixel tolerance — proves there was no horizontal layout jump.
    const boxAfter = await sidebar.boundingBox();
    expect(boxAfter).not.toBeNull();
    expect(Math.abs(boxAfter!.x - boxBefore!.x)).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
    expect(Math.abs(boxAfter!.width - boxBefore!.width)).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
  });
});
