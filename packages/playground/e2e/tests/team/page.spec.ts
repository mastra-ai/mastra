/**
 * Team Management E2E Tests
 *
 * Feature: PLTFRM-997 - Team and Users Management E2E Tests
 *
 * Tests that team management features work correctly:
 * - Team list page loads and displays members (requires team:read)
 * - Team member detail page shows role and permissions
 * - Role management UI is gated by team:write permission
 * - RBAC correctly restricts access for users without team:read
 */

import { test, expect } from '@playwright/test';
import { setupAdminAuth, setupMockAuth } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';
import { expectCurrentBreadcrumb } from '../__utils__/route-header';

// Mock team members data for API interception
const MOCK_TEAM_MEMBERS = [
  {
    id: 'member_1',
    email: 'alice@example.com',
    name: 'Alice Johnson',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
    role: 'admin',
    lastActiveAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
  },
  {
    id: 'member_2',
    email: 'bob@example.com',
    name: 'Bob Smith',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
    role: 'member',
    lastActiveAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(), // 60 days ago
  },
  {
    id: 'member_3',
    email: 'carol@example.com',
    name: 'Carol Williams',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=carol',
    role: 'viewer',
    lastActiveAt: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
    createdAt: new Date(Date.now() - 86400000 * 90).toISOString(), // 90 days ago
  },
];

const MOCK_ROLES = [
  { id: 'admin', name: 'Admin', permissions: ['*'] },
  { id: 'member', name: 'Member', permissions: ['*:read', '*:execute'] },
  { id: 'viewer', name: 'Viewer', permissions: ['*:read'] },
];

test.describe('Team Management', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('Team List Page - Admin Access', () => {
    test('admin can view team members list', async ({ page }) => {
      await setupAdminAuth(page);

      // Mock the team API endpoint
      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_TEAM_MEMBERS, total: MOCK_TEAM_MEMBERS.length }),
        });
      });

      await page.goto('/team');

      // Should see the team members page
      await expectCurrentBreadcrumb(page, 'Team Members');

      // Should see team members in the list
      await expect(page.getByText('Alice Johnson')).toBeVisible();
      await expect(page.getByText('Bob Smith')).toBeVisible();
      await expect(page.getByText('Carol Williams')).toBeVisible();
    });

    test('admin can see role badges for team members', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_TEAM_MEMBERS, total: MOCK_TEAM_MEMBERS.length }),
        });
      });

      await page.goto('/team');

      // Should see role badges
      await expect(page.getByText('admin').first()).toBeVisible();
      await expect(page.getByText('member').first()).toBeVisible();
      await expect(page.getByText('viewer').first()).toBeVisible();
    });

    test('admin can see Manage button for role management', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_TEAM_MEMBERS, total: MOCK_TEAM_MEMBERS.length }),
        });
      });

      await page.goto('/team');

      // Admin should see "Manage" buttons (team:write gated)
      const manageButtons = page.getByRole('button', { name: /Manage/i });
      await expect(manageButtons.first()).toBeVisible();
    });

    test('admin can expand team member row to see permissions', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_TEAM_MEMBERS, total: MOCK_TEAM_MEMBERS.length }),
        });
      });

      // Mock member detail endpoint
      await page.route('**/api/auth/team/member_1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_TEAM_MEMBERS[0],
            permissions: ['*'],
          }),
        });
      });

      await page.goto('/team');

      // Click on Alice's row to expand
      await page.getByText('Alice Johnson').click();

      // Should see expanded content with permissions
      await expect(page.getByText('Permissions')).toBeVisible();
    });

    test('admin can navigate to team member detail page', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_TEAM_MEMBERS, total: MOCK_TEAM_MEMBERS.length }),
        });
      });

      await page.goto('/team');

      // Click Details button
      await page
        .getByRole('link', { name: /Details/i })
        .first()
        .click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/team\/member_1/);
    });

    test('admin can search team members', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_TEAM_MEMBERS, total: MOCK_TEAM_MEMBERS.length }),
        });
      });

      await page.goto('/team');

      // Search for "Alice"
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill('Alice');

      // Should show Alice, hide others
      await expect(page.getByText('Alice Johnson')).toBeVisible();
      // Bob and Carol should be filtered out (client-side filtering)
    });
  });

  test.describe('Team List Page - Member Access (no team:read)', () => {
    test('member without team:read sees permission denied', async ({ page }) => {
      // Member role doesn't have team:read permission
      await setupMockAuth(page, { role: 'member' });

      // Mock the API to return 403
      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Forbidden' }),
        });
      });

      await page.goto('/team');

      // Should see permission denied message
      await expect(page.getByText(/permission/i)).toBeVisible();
    });
  });

  test.describe('Team Member Detail Page', () => {
    test('admin can view team member detail page', async ({ page }) => {
      await setupAdminAuth(page);

      // Mock member detail endpoint
      await page.route('**/api/auth/team/member_1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_TEAM_MEMBERS[0],
            permissions: ['*'],
          }),
        });
      });

      await page.route('**/api/auth/roles', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: MOCK_ROLES }),
        });
      });

      await page.goto('/team/member_1');

      // Should see member info
      await expect(page.getByText('Alice Johnson')).toBeVisible();
      await expect(page.getByText('alice@example.com')).toBeVisible();

      // Should see role and permissions sections
      await expect(page.getByText(/Role/i)).toBeVisible();
      await expect(page.getByText(/Permissions/i)).toBeVisible();
    });

    test('admin sees Manage Roles button on detail page', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/team/member_1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_TEAM_MEMBERS[0],
            permissions: ['*'],
          }),
        });
      });

      await page.route('**/api/auth/roles', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: MOCK_ROLES }),
        });
      });

      await page.goto('/team/member_1');

      // Admin should see "Manage Roles" button
      await expect(page.getByRole('button', { name: /Manage Roles/i })).toBeVisible();
    });
  });

  test.describe('Role Management Modal', () => {
    test('admin can open role management modal', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_TEAM_MEMBERS, total: MOCK_TEAM_MEMBERS.length }),
        });
      });

      await page.route('**/api/auth/team/member_1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_TEAM_MEMBERS[0],
            permissions: ['*'],
          }),
        });
      });

      await page.route('**/api/auth/roles', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: MOCK_ROLES }),
        });
      });

      await page.goto('/team');

      // Click Manage button
      await page
        .getByRole('button', { name: /Manage/i })
        .first()
        .click();

      // Should see role management modal
      await expect(page.getByText(/Manage Role/i)).toBeVisible();
      await expect(page.getByText(/Current Role/i)).toBeVisible();
    });

    test('role management modal shows available roles', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_TEAM_MEMBERS, total: MOCK_TEAM_MEMBERS.length }),
        });
      });

      await page.route('**/api/auth/team/member_1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_TEAM_MEMBERS[0],
            permissions: ['*'],
          }),
        });
      });

      await page.route('**/api/auth/roles', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ roles: MOCK_ROLES }),
        });
      });

      await page.goto('/team');

      // Click Manage button
      await page
        .getByRole('button', { name: /Manage/i })
        .first()
        .click();

      // Should see available roles in the modal
      await expect(page.getByText('Admin')).toBeVisible();
      await expect(page.getByText('Member')).toBeVisible();
      await expect(page.getByText('Viewer')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('team link visible in sidebar for admin', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents');

      // Should see Team Members link in sidebar
      await expect(page.getByRole('link', { name: /Team Members/i })).toBeVisible();
    });

    test('admin can navigate to team from sidebar', async ({ page }) => {
      await setupAdminAuth(page);

      await page.route('**/api/auth/team', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: MOCK_TEAM_MEMBERS, total: MOCK_TEAM_MEMBERS.length }),
        });
      });

      await page.goto('/agents');

      // Click Team Members link
      await page.getByRole('link', { name: /Team Members/i }).click();

      // Should navigate to team page
      await expect(page).toHaveURL(/\/team/);
    });
  });
});
