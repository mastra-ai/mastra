import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { buildAuthCapabilities, buildCurrentUserResponse } from '../__utils__/auth';
import type { MockAuthConfig } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Studio Layout Cold-Load Stability
 *
 * The app is wrapped in `RoutePermissionsGate`, which renders a full-screen
 * spinner until `/api/auth/capabilities` resolves and only then mounts the
 * router (and therefore the sidebar). That single async boundary is what now
 * guarantees there is no cold-load layout jump: the sidebar+main grid never
 * paints in a half-resolved state, so it cannot snap from full-width to a
 * gridded layout once auth lands.
 *
 * This test stalls the auth route to assert that boundary directly:
 *   - while auth is in flight, the gate shows its spinner and the sidebar is
 *     NOT in the DOM;
 *   - once auth resolves, the sidebar mounts at a real width and stays stable
 *     across the next paint.
 *
 * Post-resolution role-specific nav rendering is covered elsewhere:
 *   - `e2e/tests/auth/login-flow.spec.ts`, `e2e/tests/auth/viewer-role.spec.ts`.
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

  test.describe('when auth is still in flight on cold load', () => {
    test('holds the layout behind a spinner until auth resolves (no cold-load layout jump)', async ({ page }) => {
      // ARRANGE: Stall the auth routes so the page renders its first paint with auth
      // still in flight. Auth disabled so the gate resolves to children without an
      // RBAC permission-patterns request.
      const releaseAuth = await gateAuth(page, { enabled: false });
      await page.goto('/agents');

      const sidebar = page.locator('.sidebar-layout').first();

      // ASSERT 1 (pre-resolution): The gate is showing its spinner and the sidebar
      // has NOT been mounted yet. This is the boundary that prevents a half-resolved
      // layout from painting and then snapping.
      await expect(page.getByRole('status', { name: 'Loading' })).toBeVisible({ timeout: 5000 });
      await expect(sidebar).toHaveCount(0);

      // ACT: Release the auth response. Register the waiter BEFORE calling release()
      // so the response cannot be flushed before we are listening for it.
      const responsePromise = page.waitForResponse('**/api/auth/capabilities');
      releaseAuth();
      await responsePromise;

      // ASSERT 2 (post-resolution): The sidebar now mounts at a real width.
      // MainSidebarProvider hydrates width synchronously from localStorage (default
      // 240px); anything smaller would mean the sidebar collapsed or was unmounted.
      await expect(sidebar).toBeVisible({ timeout: 5000 });
      const boxBefore = await sidebar.boundingBox();
      expect(boxBefore).not.toBeNull();
      expect(boxBefore!.width).toBeGreaterThan(100);

      // Flush one frame so any subsequent React commit has been painted before we
      // re-measure, then prove the sidebar position/width is unchanged within
      // sub-pixel tolerance — i.e. it mounted once, in its final position.
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));

      const boxAfter = await sidebar.boundingBox();
      expect(boxAfter).not.toBeNull();
      expect(Math.abs(boxAfter!.x - boxBefore!.x)).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
      expect(Math.abs(boxAfter!.width - boxBefore!.width)).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
    });
  });
});
