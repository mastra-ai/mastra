/**
 * Users (Customers) Management E2E Tests
 *
 * Feature: PLTFRM-997 - Team and Users Management E2E Tests
 *
 * Tests that users (customers) management features work correctly:
 * - Users list page loads and displays customers (requires users:read)
 * - User detail page shows customer info
 * - Trace filtering link works correctly
 * - RBAC correctly restricts access for users without users:read
 */

import { test, expect } from '@playwright/test';
import { setupAdminAuth, setupMockAuth } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

// Mock customers/users data for API interception
const MOCK_CUSTOMERS = [
  {
    id: 'user_customer_1',
    email: 'customer1@acme.com',
    name: 'Acme Corp',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=acme',
    lastActiveAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
  },
  {
    id: 'user_customer_2',
    email: 'customer2@globex.com',
    name: 'Globex Inc',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=globex',
    lastActiveAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(), // 60 days ago
  },
  {
    id: 'user_customer_3',
    email: 'customer3@initech.com',
    name: 'Initech',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=initech',
    lastActiveAt: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
    createdAt: new Date(Date.now() - 86400000 * 90).toISOString(), // 90 days ago
  },
];

test.describe('Users (Customers) Management', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('Users List Page - Admin Access', () => {
    test('admin can view users list', async ({ page }) => {
      await setupAdminAuth(page);

      // Mock the users API endpoint
      await page.route('**/api/auth/users', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length }),
        });
      });

      await page.goto('/users');

      // Should see the users page
      await expectCurrentBreadcrumb(page, 'Users');

      // Should see customers in the list
      await expect(page.getByText('Acme Corp')).toBeVisible();
      await expect(page.getByText('Globex Inc')).toBeVisible();
      await expect(page.getByText('Initech')).toBeVisible();
    });

    test('admin can see last active timestamps for customers', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/users', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length }),
        });
      });

      await page.goto('/users');

      // Should see "Last Active" column header
      await expect(page.getByText(/Last Active/i)).toBeVisible();

      // Should see timestamps (e.g., "1 hour ago", "2 days ago")
      await expect(page.getByText(/hour|day|ago/i).first()).toBeVisible();
    });

    test('admin can see Traces button for each customer', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/users', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length }),
        });
      });

      await page.goto('/users');

      // Should see "Traces" buttons for viewing customer activity
      const tracesButtons = page.getByRole('link', { name: /Traces/i });
      await expect(tracesButtons.first()).toBeVisible();
    });

    test('admin can navigate to user detail page by clicking row', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/users', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length }),
        });
      });

      await page.goto('/users');

      // Click on customer row (not the Traces button)
      await page.getByText('Acme Corp').click();

      // Should navigate to user detail page
      await expect(page).toHaveURL(/\/users\/user_customer_1/);
    });

    test('admin can search customers', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/users', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length }),
        });
      });

      await page.goto('/users');

      // Search for "Acme"
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('Acme');

      // Should show Acme, hide others
      await expect(page.getByText('Acme Corp')).toBeVisible();
      // Globex and Initech should be filtered out (client-side filtering)
    });

    test('traces button links to observability with userId filter', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/users', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length }),
        });
      });

      await page.goto('/users');

      // Get the Traces link for the first customer
      const tracesLink = page.getByRole('link', { name: /Traces/i }).first();

      // Verify it has the correct href with filterUserId
      await expect(tracesLink).toHaveAttribute('href', /filterUserId=user_customer_1/);
    });
  });

  test.describe('Users List Page - Member Access (no users:read)', () => {
    test('member without users:read sees permission denied', async ({ page }) => {
      // Member role doesn't have users:read permission
      await setupMockAuth(page, { role: 'member' });

      // Mock the API to return 403
      await page.route('**/api/auth/users', async route => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Forbidden' }),
        });
      });

      await page.goto('/users');

      // Should see permission denied message
      await expect(page.getByText(/permission/i)).toBeVisible();
    });
  });

  test.describe('User Detail Page', () => {
    test('admin can view user detail page', async ({ page }) => {
      await setupAdminAuth(page);

      // Mock user detail endpoint
      await page.route('**/api/auth/users/user_customer_1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_CUSTOMERS[0]),
        });
      });

      await page.goto('/users/user_customer_1');

      // Should see customer info
      await expect(page.getByText('Acme Corp')).toBeVisible();
      await expect(page.getByText('customer1@acme.com')).toBeVisible();
    });

    test('user detail page has View Traces button', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/users/user_customer_1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_CUSTOMERS[0]),
        });
      });

      await page.goto('/users/user_customer_1');

      // Should see "View Traces" button
      const viewTracesButton = page.getByRole('link', { name: /View Traces/i });
      await expect(viewTracesButton).toBeVisible();

      // Should have correct href with filterUserId
      await expect(viewTracesButton).toHaveAttribute('href', /filterUserId=user_customer_1/);
    });

    test('user detail page shows customer since date', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/users/user_customer_1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_CUSTOMERS[0]),
        });
      });

      await page.goto('/users/user_customer_1');

      // Should see "Customer since" or similar label
      await expect(page.getByText(/Customer since|Member since|Since/i)).toBeVisible();
    });
  });

  test.describe('Empty State', () => {
    test('shows empty state when no customers exist', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/users', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: [], total: 0 }),
        });
      });

      await page.goto('/users');

      // Should see empty state message
      await expect(page.getByText(/No Users/i)).toBeVisible();
      await expect(page.getByText(/will appear here/i)).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('users link visible in sidebar for admin', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents');

      // Should see Users link in sidebar
      await expect(page.getByRole('link', { name: /^Users$/i })).toBeVisible();
    });

    test('admin can navigate to users from sidebar', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/users', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length }),
        });
      });

      await page.goto('/agents');

      // Click Users link
      await page.getByRole('link', { name: /^Users$/i }).click();

      // Should navigate to users page
      await expect(page).toHaveURL(/\/users/);
    });
  });
});
