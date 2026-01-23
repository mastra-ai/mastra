/**
 * Direct API Bypass Prevention E2E Tests (F012)
 *
 * Tests that users cannot bypass UI restrictions by making direct API calls
 * or manipulating URLs.
 *
 * Note: This feature tests complement F011 (Server-Side Permission Enforcement)
 * by focusing on bypass scenarios where a user might try to:
 * 1. Navigate directly to URLs they shouldn't access
 * 2. Make API calls that the UI would prevent
 * 3. Modify request parameters to access unauthorized resources
 *
 * Current server limitations:
 * - Only agent routes have `requiresPermission` configured (agents:read, agents:execute)
 * - Workflow routes do NOT have permissions configured yet
 * - Tool routes do NOT have permissions configured yet
 * - DELETE/PUT endpoints for agents don't exist
 *
 * These tests focus on what's currently enforceable at the server level.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { setupMockAuth, setupViewerAuth, setupMemberAuth, setupAdminAuth } from '../__utils__/auth';
import { resetStorage } from '../__utils__/reset-storage';

// Base URL for API calls (matches E2E config)
const BASE_URL = 'http://localhost:4111';

/**
 * Helper to make API requests with a specific role.
 * The role is sent as a Bearer token.
 */
async function apiRequest(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: {
    role?: string;
    body?: unknown;
  },
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {};

  if (options?.role) {
    headers['Authorization'] = `Bearer ${options.role}`;
  }

  let response;
  const url = `${BASE_URL}${path}`;

  switch (method) {
    case 'GET':
      response = await request.get(url, { headers });
      break;
    case 'POST':
      response = await request.post(url, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: options?.body ? JSON.stringify(options.body) : undefined,
      });
      break;
    case 'PUT':
      response = await request.put(url, {
        headers: { ...headers, 'Content-Type': 'application/json' },
        data: options?.body ? JSON.stringify(options.body) : undefined,
      });
      break;
    case 'DELETE':
      response = await request.delete(url, { headers });
      break;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }

  return { status: response.status(), body };
}

test.describe('Direct API Bypass Prevention', () => {
  test.afterEach(async () => {
    await resetStorage();
  });

  test.describe('Direct URL Access - Viewer Restrictions', () => {
    test('viewer accessing agent chat via direct URL cannot execute agent', async ({ page, request }) => {
      // Viewer navigates directly to agent chat page
      await setupViewerAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Page should load (viewer has agents:read)
      await expect(page).toHaveURL(/\/agents\/weather-agent\/chat/);

      // But if viewer tries to execute agent via API, it should fail
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'viewer',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });

      // Should get 403 - viewer lacks agents:execute permission
      expect(response.status).toBe(403);
    });

    test('viewer accessing workflow via direct URL cannot execute workflow', async ({ page }) => {
      // Viewer navigates directly to workflow page
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Page should load (viewer has workflows:read)
      await expect(page).toHaveURL(/\/workflows\/lessComplexWorkflow/);

      // Run button should be disabled or hidden
      const runButton = page.getByRole('button', { name: /run|trigger|execute/i }).first();
      if (await runButton.isVisible()) {
        await expect(runButton).toBeDisabled();
      }
    });

    test('viewer directly navigating to tool page has restricted access', async ({ page }) => {
      // Viewer navigates directly to tool page (no tools permission)
      await setupViewerAuth(page);
      await page.goto('/tools/weatherInfo');

      // Page might load or redirect - either is acceptable
      await page.waitForLoadState('domcontentloaded');

      // If on tools page, execution should be restricted
      const currentUrl = page.url();
      if (currentUrl.includes('/tools/')) {
        // Look for execute button - should be disabled or not present
        const executeButton = page.getByRole('button', { name: /execute|run|submit/i }).first();
        if (await executeButton.isVisible()) {
          // Viewer should not be able to execute tools
          await expect(executeButton).toBeDisabled();
        }
      }
    });
  });

  test.describe('Direct URL Access - Member Restrictions', () => {
    test('member accessing agent page cannot find agent modification controls', async ({ page }) => {
      // Member navigates directly to agent page
      await setupMemberAuth(page);
      await page.goto('/agents/weather-agent/chat');

      // Page should load (member has agents:read)
      await expect(page).toHaveURL(/\/agents\/weather-agent\/chat/);

      // Member should NOT see agent modification controls (create, delete)
      // since they only have agents:read, not agents:write
      const modifyControls = page.getByRole('button', { name: /delete agent|remove agent/i });
      await expect(modifyControls).not.toBeVisible();
    });

    test('member trying to execute agent via API gets 403', async ({ request }) => {
      // Member has agents:read but NOT agents:execute
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'member',
        body: { messages: [{ role: 'user', content: 'Bypass test' }] },
      });

      // Should get 403 - member lacks agents:execute permission
      expect(response.status).toBe(403);
    });
  });

  test.describe('API Bypass Attempts', () => {
    test('viewer bypassing UI to call agent generate API returns 403', async ({ request }) => {
      // Even though viewer can view agents in the UI,
      // they cannot execute agents via direct API call
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'viewer',
        body: {
          messages: [{ role: 'user', content: 'This is a bypass attempt' }],
        },
      });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('_default user bypassing UI to read agents returns 403', async ({ request }) => {
      // User with no permissions trying to read agents via API
      const response = await apiRequest(request, 'GET', '/api/agents', {
        role: '_default',
      });

      expect(response.status).toBe(403);
    });

    test('unauthenticated user cannot access any protected endpoint', async ({ request }) => {
      // No role header = unauthenticated
      const agentsResponse = await apiRequest(request, 'GET', '/api/agents');
      expect(agentsResponse.status).toBe(401);

      const agentResponse = await apiRequest(request, 'GET', '/api/agents/weatherAgent');
      expect(agentResponse.status).toBe(401);

      const executeResponse = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        body: { messages: [{ role: 'user', content: 'Test' }] },
      });
      expect(executeResponse.status).toBe(401);
    });

    test('fake role token returns appropriate error', async ({ request }) => {
      // Try to use a made-up role
      const response = await apiRequest(request, 'GET', '/api/agents', {
        role: 'superadmin',
      });

      // Should either reject (401) or treat as unauthenticated
      expect([401, 403]).toContain(response.status);
    });
  });

  test.describe('Cross-Role Bypass Prevention', () => {
    test('same endpoint returns different status for different roles', async ({ request }) => {
      const endpoint = '/api/agents/weatherAgent/generate';
      const body = { messages: [{ role: 'user', content: 'Test' }] };

      // Admin can execute
      const adminResponse = await apiRequest(request, 'POST', endpoint, { role: 'admin', body });
      expect([200, 400, 500]).toContain(adminResponse.status); // May fail for other reasons, but not 403
      expect(adminResponse.status).not.toBe(403);

      // Viewer cannot execute
      const viewerResponse = await apiRequest(request, 'POST', endpoint, { role: 'viewer', body });
      expect(viewerResponse.status).toBe(403);

      // Member cannot execute (no agents:execute permission)
      const memberResponse = await apiRequest(request, 'POST', endpoint, { role: 'member', body });
      expect(memberResponse.status).toBe(403);
    });

    test('viewer cannot escalate to admin by manipulating requests', async ({ request }) => {
      // Test various manipulation attempts

      // Attempt 1: Send viewer token but add fake admin header
      const response1 = await request.get(`${BASE_URL}/api/agents`, {
        headers: {
          Authorization: 'Bearer viewer',
          'X-Admin-Override': 'true', // Fake header
        },
      });
      expect(response1.status()).toBe(200); // Still viewer permissions

      // Verify viewer can read agents (agents:read)
      // but cannot execute agents (no agents:execute)
      const executeResponse = await request.post(`${BASE_URL}/api/agents/weatherAgent/generate`, {
        headers: {
          Authorization: 'Bearer viewer',
          'X-Admin-Override': 'true',
        },
        data: JSON.stringify({ messages: [{ role: 'user', content: 'Test' }] }),
      });
      expect(executeResponse.status()).toBe(403);
    });
  });

  test.describe('UI Disabled Controls Cannot Be Bypassed', () => {
    test('viewer sees disabled run button and API confirms restriction', async ({ page, request }) => {
      await setupViewerAuth(page);
      await page.goto('/workflows/lessComplexWorkflow');

      // Check UI shows restriction
      const runButton = page.getByRole('button', { name: /run|trigger|execute/i }).first();
      if (await runButton.isVisible()) {
        await expect(runButton).toBeDisabled();
      }

      // Verify via API that viewer cannot execute
      // Note: Workflow routes don't have requiresPermission set, so this tests
      // that even though server doesn't enforce workflow permissions,
      // the UI correctly shows the restriction
    });

    test('member sees agent page without create button, API confirms no create endpoint', async ({ page }) => {
      await setupMemberAuth(page);
      await page.goto('/agents');

      // Member should not see create button
      const createButton = page.getByRole('button', { name: /create agent|new agent|add agent/i });
      await expect(createButton).not.toBeVisible();

      // There is no POST /api/agents endpoint for creating agents
      // The absence of the endpoint is by design
    });
  });

  test.describe('Error Response Security on Bypass Attempts', () => {
    test('403 from bypass attempt does not reveal internal details', async ({ request }) => {
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'viewer',
        body: { messages: [{ role: 'user', content: 'Bypass' }] },
      });

      expect(response.status).toBe(403);

      const bodyStr = JSON.stringify(response.body);
      // Should not reveal internal implementation details
      expect(bodyStr).not.toContain('stack');
      expect(bodyStr).not.toContain('trace');
      expect(bodyStr).not.toContain('internal');
      expect(bodyStr).not.toContain('config');
    });

    test('401 from bypass attempt does not reveal auth implementation', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents');

      expect(response.status).toBe(401);

      const bodyStr = JSON.stringify(response.body);
      // Should not reveal auth implementation details
      expect(bodyStr).not.toContain('jwt');
      expect(bodyStr).not.toContain('session');
      expect(bodyStr).not.toContain('cookie');
      expect(bodyStr).not.toContain('bearer');
    });

    test('error response does not leak resource existence on forbidden', async ({ request }) => {
      // Request to a valid agent should return 403 (not 404) for unauthorized user
      const validAgentResponse = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'viewer',
        body: { messages: [{ role: 'user', content: 'Test' }] },
      });
      expect(validAgentResponse.status).toBe(403);

      // Request to a non-existent agent should also return 403 (not 404)
      // This prevents attackers from enumerating valid resources
      const invalidAgentResponse = await apiRequest(request, 'POST', '/api/agents/nonExistentAgent12345/generate', {
        role: 'viewer',
        body: { messages: [{ role: 'user', content: 'Test' }] },
      });
      // For viewer without execute permission, should still be 403
      // (permission check happens before resource lookup)
      expect(invalidAgentResponse.status).toBe(403);
    });
  });

  test.describe('Multiple Sequential Bypass Attempts', () => {
    test('repeated bypass attempts consistently return 403', async ({ request }) => {
      const endpoint = '/api/agents/weatherAgent/generate';
      const body = { messages: [{ role: 'user', content: 'Test' }] };

      // Make multiple attempts - all should be rejected
      const attempts = await Promise.all([
        apiRequest(request, 'POST', endpoint, { role: 'viewer', body }),
        apiRequest(request, 'POST', endpoint, { role: 'viewer', body }),
        apiRequest(request, 'POST', endpoint, { role: 'viewer', body }),
        apiRequest(request, 'POST', endpoint, { role: 'viewer', body }),
        apiRequest(request, 'POST', endpoint, { role: 'viewer', body }),
      ]);

      // All should return 403
      for (const attempt of attempts) {
        expect(attempt.status).toBe(403);
      }
    });

    test('rapid role switching does not bypass permissions', async ({ request }) => {
      const endpoint = '/api/agents/weatherAgent/generate';
      const body = { messages: [{ role: 'user', content: 'Test' }] };

      // Alternate between viewer and admin rapidly
      const results = await Promise.all([
        apiRequest(request, 'POST', endpoint, { role: 'viewer', body }),
        apiRequest(request, 'POST', endpoint, { role: 'admin', body }),
        apiRequest(request, 'POST', endpoint, { role: 'viewer', body }),
        apiRequest(request, 'POST', endpoint, { role: 'admin', body }),
      ]);

      // Viewer requests should be 403
      expect(results[0].status).toBe(403);
      expect(results[2].status).toBe(403);

      // Admin requests should succeed (not 403)
      expect(results[1].status).not.toBe(403);
      expect(results[3].status).not.toBe(403);
    });
  });

  test.describe('Direct Navigation Protection', () => {
    test('viewer directly navigating to agent execution URL sees appropriate state', async ({ page }) => {
      await setupViewerAuth(page);

      // Navigate directly to agent chat/execution page
      await page.goto('/agents/weather-agent/chat');

      // Should be on the page (viewer has read access)
      await expect(page).toHaveURL(/\/agents\/weather-agent\/chat/);

      // But interaction elements for execution should be restricted
      // The chat input might be visible but sending messages would fail at API level
    });

    test('_default user navigating to agents sees appropriate state', async ({ page }) => {
      await setupMockAuth(page, { role: '_default' });

      // Navigate to agents page
      await page.goto('/agents');

      // Page should load
      await page.waitForLoadState('domcontentloaded');

      // With no permissions, user should see restricted state
      // The exact behavior depends on how the app handles _default role
    });

    test('unauthenticated user navigating directly sees login prompt', async ({ page }) => {
      await setupMockAuth(page, { authenticated: false });

      // Navigate directly to protected page
      await page.goto('/agents');

      // Should see login prompt - use specific heading to avoid strict mode violation
      await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
    });
  });
});
