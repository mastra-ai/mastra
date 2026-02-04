/**
 * Login Flow E2E Tests
 *
 * Feature: F002 - Login Flow E2E Tests
 *
 * Tests the complete login flow including:
 * - Unauthenticated user redirect to login page
 * - Successful login redirect to original destination
 * - Login with invalid credentials shows error
 * - Session persistence across page reloads
 * - Login state reflected in UI (user avatar, name display)
 */

import { test, expect } from '@playwright/test';
import {
  setupMockAuth,
  setupUnauthenticated,
  setupAdminAuth,
  clearMockAuth,
  MOCK_USERS,
  MockAuthConfig,
} from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

test.describe('Login Flow', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('Unauthenticated Access Redirect', () => {
    test('unauthenticated user sees login prompt on protected page', async ({ page }) => {
      await setupUnauthenticated(page);
      await page.goto('/agents');

      // Should see the sign in prompt from AuthRequired component
      await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
      await expect(page.getByText('You need to sign in to access this page.')).toBeVisible();
    });

    test('unauthenticated user sees login button on protected page', async ({ page }) => {
      await setupUnauthenticated(page);
      await page.goto('/workflows');

      // Should see either SSO login button or sign in link
      const ssoButton = page.getByRole('button', { name: /Sign in with SSO/i });
      const signInButton = page.getByRole('button', { name: /Sign in/i });

      // Wait for one of them to be visible
      await expect(ssoButton.or(signInButton).first()).toBeVisible();
    });

    test('login page shows when navigating directly', async ({ page }) => {
      await setupUnauthenticated(page);
      await page.goto('/login');

      // Should see the login page content
      await expect(page.getByRole('heading', { name: /Sign in to Mastra Studio/i })).toBeVisible();
    });

    test('login page shows SSO option when configured', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'sso',
      });
      await page.goto('/login');

      // Should see SSO login button
      await expect(page.getByRole('button', { name: /Sign in with SSO/i })).toBeVisible();
    });

    test('login page shows credentials form when configured', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
      });
      await page.goto('/login');

      // Should see email and password fields
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Sign in$/i })).toBeVisible();
    });

    test('login page shows both SSO and credentials when configured', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'both',
      });
      await page.goto('/login');

      // Should see both options
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      await expect(page.getByLabel(/Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Sign in with SSO/i })).toBeVisible();
    });
  });

  test.describe('Successful Login', () => {
    test('successful login shows authenticated content', async ({ page }) => {
      // Start unauthenticated
      await setupUnauthenticated(page);
      await page.goto('/agents');

      // Verify we see the login prompt
      await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();

      // Clear routes and set up authenticated state
      await clearMockAuth(page);
      await setupAdminAuth(page);

      // Reload to apply new auth state
      await page.reload();

      // Should now see the agents page content
      await expect(page.locator('h1')).toHaveText('Agents');
    });

    test('redirect parameter is preserved in login URL', async ({ page }) => {
      await setupUnauthenticated(page);

      // Navigate to login with redirect parameter
      await page.goto('/login?redirect=/workflows');

      // The redirect parameter should be preserved (verify by checking the URL)
      expect(page.url()).toContain('redirect=/workflows');
    });

    test('login page preserves redirect to original destination', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
      });

      // Go to login with a specific redirect
      await page.goto('/login?redirect=/agents');

      // Verify the login page is displayed
      await expect(page.getByRole('heading', { name: /Sign in to Mastra Studio/i })).toBeVisible();

      // The redirect should be preserved in the URL for later use
      expect(page.url()).toContain('redirect=');
    });
  });

  test.describe('Invalid Credentials', () => {
    test('shows error for invalid credentials login attempt', async ({ page }) => {
      // Set up credentials login with mock error response
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
      });

      // Mock the sign-in endpoint to return an error
      await page.route('**/api/auth/credentials/sign-in', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid email or password' }),
        });
      });

      await page.goto('/login');

      // Fill in credentials
      await page.getByLabel(/Email/i).fill('wrong@example.com');
      await page.getByLabel(/Password/i).fill('wrongpassword');

      // Submit the form
      await page.getByRole('button', { name: /Sign in$/i }).click();

      // Should see error message
      await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
    });

    test('form validation requires email', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
      });
      await page.goto('/login');

      // Try to submit without email
      await page.getByLabel(/Password/i).fill('somepassword');

      // The email field should have required validation
      const emailInput = page.getByLabel(/Email/i);
      await expect(emailInput).toHaveAttribute('required', '');
    });

    test('form validation requires password', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
      });
      await page.goto('/login');

      // Try to fill only email
      await page.getByLabel(/Email/i).fill('test@example.com');

      // The password field should have required validation
      const passwordInput = page.getByLabel(/Password/i);
      await expect(passwordInput).toHaveAttribute('required', '');
    });
  });

  test.describe('Session Persistence', () => {
    test('authenticated state persists after page reload', async ({ page }) => {
      // Set up authenticated state
      await setupAdminAuth(page);
      await page.goto('/agents');

      // Verify we see authenticated content
      await expect(page.locator('h1')).toHaveText('Agents');

      // Reload the page (auth state will still be mocked)
      await page.reload();

      // Should still see authenticated content
      await expect(page.locator('h1')).toHaveText('Agents');
    });

    test('authenticated state persists across navigation', async ({ page }) => {
      await setupAdminAuth(page);

      // Navigate to agents
      await page.goto('/agents');
      await expect(page.locator('h1')).toHaveText('Agents');

      // Navigate to workflows
      await page.goto('/workflows');
      await expect(page.locator('h1')).toHaveText('Workflows');

      // Navigate back to agents
      await page.goto('/agents');
      await expect(page.locator('h1')).toHaveText('Agents');
    });

    test('unauthenticated state shows login prompt consistently', async ({ page }) => {
      await setupUnauthenticated(page);

      // Navigate to different protected pages
      await page.goto('/agents');
      await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();

      await page.goto('/workflows');
      await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();

      await page.goto('/tools');
      await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
    });
  });

  test.describe('Login State in UI', () => {
    test('authenticated user sees main application content', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents');

      // Wait for the page to load
      await expect(page.locator('h1')).toHaveText('Agents');

      // Should see application UI elements (sidebar navigation)
      await expect(page.getByRole('link', { name: /Workflows/i })).toBeVisible();
    });

    test('authenticated user can access protected pages', async ({ page }) => {
      await setupAdminAuth(page);

      // Access agents page
      await page.goto('/agents');
      await expect(page.locator('h1')).toHaveText('Agents');

      // Access workflows page
      await page.goto('/workflows');
      await expect(page.locator('h1')).toHaveText('Workflows');

      // Access tools page
      await page.goto('/tools');
      await expect(page.locator('h1')).toHaveText('Tools');
    });

    test('authenticated user does not see login prompt', async ({ page }) => {
      await setupAdminAuth(page);
      await page.goto('/agents');

      // Should NOT see the login prompt
      await expect(page.getByRole('heading', { name: 'Sign in to continue' })).not.toBeVisible();

      // Should see the agents content
      await expect(page.locator('h1')).toHaveText('Agents');
    });

    test('unauthenticated user sees login prompt instead of content', async ({ page }) => {
      await setupUnauthenticated(page);
      await page.goto('/agents');

      // Should see login prompt instead of content
      await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();

      // Should NOT see the agents heading
      await expect(page.locator('h1:has-text("Agents")')).not.toBeVisible();
    });
  });

  test.describe('Sign Up Link', () => {
    test('sign up link is visible when sign up is enabled', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
        signUpEnabled: true,
      });
      await page.goto('/login');

      // Should see sign up link
      await expect(page.getByRole('button', { name: /Sign up/i })).toBeVisible();
    });

    test('sign up link is hidden when sign up is disabled', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
        signUpEnabled: false,
      });
      await page.goto('/login');

      // Sign up link should not be visible
      await expect(page.getByRole('button', { name: /Sign up/i })).not.toBeVisible();
    });

    test('clicking sign up toggles to sign up mode', async ({ page }) => {
      await setupMockAuth(page, {
        authenticated: false,
        loginType: 'credentials',
        signUpEnabled: true,
      });
      await page.goto('/login');

      // Click sign up
      await page.getByRole('button', { name: /Sign up/i }).click();

      // Should now see "Create your account" heading
      await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible();

      // Should see name field (only in sign up mode)
      await expect(page.getByLabel(/Name/i)).toBeVisible();
    });
  });

  test.describe('Auth Not Configured', () => {
    test('shows appropriate message when auth is disabled', async ({ page }) => {
      await setupMockAuth(page, {
        enabled: false,
      });
      await page.goto('/login');

      // Should see auth not configured message
      await expect(page.getByText(/Authentication is not configured/i)).toBeVisible();
    });
  });
});
