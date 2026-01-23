/**
 * Server-Side Permission Enforcement E2E Tests (F011)
 *
 * CRITICAL: These tests verify that the SERVER properly enforces RBAC permissions
 * on API endpoints. Unlike UI tests that mock auth endpoints, these tests make
 * real API calls and verify the server's response codes.
 *
 * These tests do NOT mock auth endpoints. They use the X-Test-Auth-Role header
 * to control authentication state via the TestAuthProvider configured in the
 * kitchen-sink app.
 *
 * Test requirements:
 * - Server must be running with E2E_TEST_AUTH=true
 * - No route interception for auth endpoints
 * - Direct API calls to verify 401/403 responses
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

// Base URL for API calls (matches E2E config)
const BASE_URL = 'http://localhost:4111';

/**
 * Helper to make API requests with a specific role.
 *
 * The role is sent as a Bearer token (e.g., "Authorization: Bearer admin").
 * The TestAuthProvider uses the token value as the role.
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

  // Send the role as a Bearer token
  // The TestAuthProvider interprets the token value as the role
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

test.describe('Server-Side Permission Enforcement', () => {
  test.describe('Unauthenticated Access', () => {
    test('unauthenticated request to GET /api/agents returns 401', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('unauthenticated request to GET /api/agents/:id returns 401', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents/weatherAgent');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('unauthenticated request to POST /api/agents/:id/generate returns 401', async ({ request }) => {
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  test.describe('Admin Role Access', () => {
    test('admin can GET /api/agents', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents', { role: 'admin' });

      expect(response.status).toBe(200);
    });

    test('admin can GET /api/agents/:id', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents/weatherAgent', {
        role: 'admin',
      });

      expect(response.status).toBe(200);
    });

    test('admin can access agents:execute endpoint', async ({ request }) => {
      // Note: This may return 400 if the request body is invalid,
      // but should NOT return 401 or 403
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'admin',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });

      // Admin should have permission - may fail for other reasons (missing API key, etc.)
      // but should NOT be 401 or 403
      expect([200, 400, 500]).toContain(response.status);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    });
  });

  test.describe('Member Role Access', () => {
    test('member can GET /api/agents (has agents:read)', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents', { role: 'member' });

      expect(response.status).toBe(200);
    });

    test('member can GET /api/agents/:id (has agents:read)', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents/weatherAgent', {
        role: 'member',
      });

      expect(response.status).toBe(200);
    });

    test('member CANNOT POST /api/agents/:id/generate (lacks agents:execute)', async ({ request }) => {
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'member',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });

      // Member lacks agents:execute permission, should get 403
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  test.describe('Viewer Role Access', () => {
    test('viewer can GET /api/agents (has agents:read)', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents', { role: 'viewer' });

      expect(response.status).toBe(200);
    });

    test('viewer can GET /api/agents/:id (has agents:read)', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents/weatherAgent', {
        role: 'viewer',
      });

      expect(response.status).toBe(200);
    });

    test('viewer CANNOT POST /api/agents/:id/generate (lacks agents:execute)', async ({ request }) => {
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'viewer',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });

      // Viewer lacks agents:execute permission, should get 403
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  test.describe('Default Role Access (No Permissions)', () => {
    test('_default role CANNOT GET /api/agents (lacks agents:read)', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents', { role: '_default' });

      // _default role has no permissions, should get 403
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('_default role CANNOT GET /api/agents/:id (lacks agents:read)', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents/weatherAgent', {
        role: '_default',
      });

      // _default role has no permissions, should get 403
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('_default role CANNOT POST /api/agents/:id/generate (lacks agents:execute)', async ({ request }) => {
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: '_default',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });

      // _default role has no permissions, should get 403
      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  test.describe('Error Response Security', () => {
    test('403 response does not leak sensitive information', async ({ request }) => {
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'viewer',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });

      expect(response.status).toBe(403);

      // Check that the response doesn't contain sensitive info
      const bodyStr = JSON.stringify(response.body);
      expect(bodyStr).not.toContain('apiKey');
      expect(bodyStr).not.toContain('secret');
      expect(bodyStr).not.toContain('password');
      expect(bodyStr).not.toContain('token');
    });

    test('401 response does not leak sensitive information', async ({ request }) => {
      const response = await apiRequest(request, 'GET', '/api/agents');

      expect(response.status).toBe(401);

      // Check that the response doesn't contain sensitive info
      const bodyStr = JSON.stringify(response.body);
      expect(bodyStr).not.toContain('apiKey');
      expect(bodyStr).not.toContain('secret');
      expect(bodyStr).not.toContain('password');
    });

    test('server returns 403 not 404 for unauthorized access to existing resource', async ({ request }) => {
      // Viewer trying to execute a known agent should get 403, not 404
      const response = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'viewer',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });

      // Should be 403 (forbidden) not 404 (not found)
      // This ensures no information leakage about resource existence
      expect(response.status).toBe(403);
    });
  });

  test.describe('Permission Boundary Verification', () => {
    test('wildcard permission (*) grants access to all endpoints', async ({ request }) => {
      // Admin has ['*'] permission
      const agentsResponse = await apiRequest(request, 'GET', '/api/agents', { role: 'admin' });
      expect(agentsResponse.status).toBe(200);

      const agentResponse = await apiRequest(request, 'GET', '/api/agents/weatherAgent', {
        role: 'admin',
      });
      expect(agentResponse.status).toBe(200);
    });

    test('specific read permission does not grant execute access', async ({ request }) => {
      // Member has agents:read but NOT agents:execute
      // First verify read works
      const readResponse = await apiRequest(request, 'GET', '/api/agents/weatherAgent', {
        role: 'member',
      });
      expect(readResponse.status).toBe(200);

      // Then verify execute fails
      const executeResponse = await apiRequest(request, 'POST', '/api/agents/weatherAgent/generate', {
        role: 'member',
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      });
      expect(executeResponse.status).toBe(403);
    });

    test('authenticated user without required permission gets 403 not 401', async ({ request }) => {
      // _default role is authenticated but has no permissions
      const response = await apiRequest(request, 'GET', '/api/agents', { role: '_default' });

      // Should be 403 (authenticated but forbidden) not 401 (not authenticated)
      expect(response.status).toBe(403);
    });
  });

  test.describe('Role Consistency', () => {
    test('same request returns consistent results for same role', async ({ request }) => {
      // Make multiple requests with viewer role - should consistently return 200
      const results = await Promise.all([
        apiRequest(request, 'GET', '/api/agents', { role: 'viewer' }),
        apiRequest(request, 'GET', '/api/agents', { role: 'viewer' }),
        apiRequest(request, 'GET', '/api/agents', { role: 'viewer' }),
      ]);

      for (const result of results) {
        expect(result.status).toBe(200);
      }
    });

    test('different roles get different access to same endpoint', async ({ request }) => {
      const endpoint = '/api/agents/weatherAgent/generate';
      const body = { messages: [{ role: 'user', content: 'Hello' }] };

      const adminResponse = await apiRequest(request, 'POST', endpoint, {
        role: 'admin',
        body,
      });
      const memberResponse = await apiRequest(request, 'POST', endpoint, {
        role: 'member',
        body,
      });
      const viewerResponse = await apiRequest(request, 'POST', endpoint, {
        role: 'viewer',
        body,
      });

      // Admin should have access (may fail for other reasons, but not 401/403)
      expect([200, 400, 500]).toContain(adminResponse.status);
      expect(adminResponse.status).not.toBe(403);

      // Member and viewer should be forbidden
      expect(memberResponse.status).toBe(403);
      expect(viewerResponse.status).toBe(403);
    });
  });
});
