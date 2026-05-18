import { test, expect, Page } from '@playwright/test';
import { setupAdminAuth, setupMockAuth, buildAuthCapabilities, buildCurrentUserResponse } from '../__utils__/auth';
import type { MockAuthConfig } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

/**
 * FEATURE: Studio Layout Cold-Load Stability
 * USER STORY: As a user opening Studio, I want the sidebar and route header to be in
 *   place from the first paint so the main content does not visibly shift when the
 *   /api/auth/capabilities request resolves.
 * BEHAVIOR UNDER TEST:
 *   - Chrome (sidebar + header) renders optimistically while auth is still loading.
 *   - When auth resolves to "authenticated" or "auth disabled", layout dimensions stay constant.
 *   - When auth resolves to "enabled but unauthenticated", the chrome is removed so the
 *     inline login screen takes the full viewport (preserves prior UX).
 *   - RBAC nav-permission filtering still works correctly for authenticated users.
 */

// Allow up to 1px drift on bounding-box comparisons to absorb subpixel CSS layout
// values. Anything larger than this would be a visible jump.
const LAYOUT_TOLERANCE_PX = 1;

/**
 * Intercept /api/auth/capabilities and /api/auth/me with a configurable delay.
 * Returns a `release()` function that lets the mocked response flush.
 *
 * This is the only way to deterministically observe pre-resolution UI state in
 * Playwright — `setupMockAuth` resolves the route synchronously on every request.
 */
async function mockAuthWithDelay(page: Page, config: MockAuthConfig): Promise<() => void> {
  const capabilitiesResponse = buildAuthCapabilities(config);
  const meResponse = buildCurrentUserResponse(config);

  let releaseFn: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    releaseFn = resolve;
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

  return releaseFn;
}

/**
 * Release the gated auth response and wait for it to be received by the page.
 * The waiter is registered BEFORE releasing so we never miss the response.
 */
async function releaseAndAwaitAuth(page: Page, release: () => void): Promise<void> {
  const responsePromise = page.waitForResponse('**/api/auth/capabilities');
  release();
  await responsePromise;
}

/**
 * Flush one animation frame so any React commit triggered by the resolved auth
 * query has been painted before the next measurement. More deterministic than
 * `page.waitForTimeout(...)`.
 */
async function flushFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
}

test.describe('Studio Layout - Cold-Load Stability', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test('sidebar nav is rendered before auth capabilities resolve (auth disabled)', async ({ page }) => {
    // ARRANGE: Stall the auth response so we can observe the pre-resolution state.
    const releaseAuth = await mockAuthWithDelay(page, { enabled: false });

    // ACT: Open a protected route.
    await page.goto('/agents');

    // ASSERT: The Agents nav link is visible BEFORE auth resolves — proves the fix.
    // Without the optimistic render this would never appear until `releaseAuth()` fires.
    await expect(page.getByRole('link', { name: 'Agents', exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: 'Workflows', exact: true })).toBeVisible();

    // Cleanup: let auth resolve so the page can tear down cleanly.
    await releaseAndAwaitAuth(page, releaseAuth);
  });

  test('sidebar nav is rendered before auth capabilities resolve (authenticated user)', async ({ page }) => {
    const releaseAuth = await mockAuthWithDelay(page, { role: 'admin' });

    await page.goto('/agents');

    await expect(page.getByRole('link', { name: 'Agents', exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: 'Workflows', exact: true })).toBeVisible();

    await releaseAndAwaitAuth(page, releaseAuth);
  });

  test('sidebar column width stays constant when auth resolves (no layout jump)', async ({ page }) => {
    // ARRANGE: Stalled admin auth.
    const releaseAuth = await mockAuthWithDelay(page, { role: 'admin' });
    await page.goto('/agents');

    // Wait for the sidebar root to be attached (optimistic render). Only one
    // `.sidebar-layout` exists per layout; `.first()` is defensive in case
    // future code introduces a portal-rendered duplicate.
    const sidebar = page.locator('.sidebar-layout').first();
    await expect(sidebar).toBeVisible({ timeout: 5000 });

    // Capture the layout BEFORE auth resolves.
    const sidebarBoxBefore = await sidebar.boundingBox();
    expect(sidebarBoxBefore).not.toBeNull();
    expect(sidebarBoxBefore!.width).toBeGreaterThan(100); // hydrated from MainSidebarProvider default (240px)

    // ACT: Resolve auth (waiter is set up before release inside the helper).
    await releaseAndAwaitAuth(page, releaseAuth);
    await flushFrame(page);

    // ASSERT: Sidebar dimensions are stable within sub-pixel tolerance — proves
    // no horizontal jump occurred.
    const sidebarBoxAfter = await sidebar.boundingBox();
    expect(sidebarBoxAfter).not.toBeNull();
    expect(Math.abs(sidebarBoxAfter!.x - sidebarBoxBefore!.x)).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
    expect(Math.abs(sidebarBoxAfter!.width - sidebarBoxBefore!.width)).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
  });

  test('chrome is hidden after auth resolves as enabled-but-unauthenticated (chromeless login)', async ({ page }) => {
    // ARRANGE: Auth enabled, user unauthenticated. Resolve immediately — we want
    // post-resolution state, not the optimistic flash.
    await setupMockAuth(page, { authenticated: false, loginType: 'sso' });

    // ACT
    await page.goto('/agents');

    // Inline login form appears.
    await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();

    // ASSERT: Sidebar chrome is gone — preserves prior UX (and avoids leaking the
    // full nav around the login form, which would happen if RBAC permission
    // filtering were bypassed for unauthed users).
    await expect(page.getByRole('link', { name: 'Agents', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Workflows', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
  });

  test('admin user keeps the full sidebar nav across auth resolution', async ({ page }) => {
    await setupAdminAuth(page);
    await page.goto('/agents');

    // Admin has the '*' permission → every nav item with a `requiredPermission` must appear.
    await expect(page.getByRole('link', { name: 'Agents', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Workflows', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tools', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  });
});
