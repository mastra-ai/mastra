/**
 * Permission derivation utilities for automatic route permission assignment.
 *
 * This module provides convention-based permission derivation from route paths and methods,
 * reducing the need to manually specify permissions on each route.
 *
 * Convention: `{resource}:{action}`
 * - resource: First path segment after common prefixes (e.g., 'agents', 'workflows', 'memory')
 * - action: Derived from HTTP method (GET→read, POST→write/execute, DELETE→delete, etc.)
 */

import type { ServerRoute } from './index';

/**
 * Map HTTP methods to permission actions.
 * POST is context-dependent (write for data, execute for operations).
 */
const METHOD_TO_ACTION: Record<string, string> = {
  GET: 'read',
  POST: 'write', // Default for POST, may be overridden to 'execute'
  PUT: 'write',
  PATCH: 'write',
  DELETE: 'delete',
};

/**
 * Path patterns that indicate an "execute" action rather than "write" for POST requests.
 * These are typically operation endpoints rather than data creation endpoints.
 */
const EXECUTE_PATTERNS = [
  '/generate',
  '/stream',
  '/execute',
  '/start',
  '/resume',
  '/restart',
  '/cancel',
  '/approve',
  '/decline',
  '/speak',
  '/listen',
  '/query',
  '/search',
  '/observe',
  '/time-travel',
  '/enhance',
  '/clone',
];

/**
 * Extracts the primary resource name from a route path.
 *
 * The resource is derived from the first path segment, with special handling
 * for compound resources and well-known paths.
 *
 * Note: The canonical list of resources is generated in permissions.generated.ts
 * from SERVER_ROUTES via `pnpm generate:permissions`.
 *
 * @param path - The route path (e.g., '/agents/:agentId/generate')
 * @returns The resource name (e.g., 'agents') or null if not identifiable
 *
 * @example
 * extractResource('/agents/:agentId') // → 'agents'
 * extractResource('/memory/threads/:threadId') // → 'memory'
 * extractResource('/stored/agents/:agentId') // → 'stored-agents'
 */
export function extractResource(path: string): string | null {
  // Remove leading slash and split by segments
  const segments = path.replace(/^\//, '').split('/');

  if (segments.length === 0) {
    return null;
  }

  const firstSegment = segments[0];

  // Handle special case: /stored/agents → 'stored-agents'
  if (firstSegment === 'stored' && segments[1] === 'agents') {
    return 'stored-agents';
  }

  // Handle .well-known paths (A2A protocol)
  if (firstSegment === '.well-known') {
    return 'a2a';
  }

  return firstSegment || null;
}

/**
 * Determines the action based on HTTP method and path context.
 *
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param path - The route path for context
 * @returns The action string (read, write, execute, delete)
 */
export function deriveAction(method: string, path: string): string {
  const upperMethod = method.toUpperCase();

  // For POST requests, check if it's an execute operation
  if (upperMethod === 'POST') {
    const isExecuteOperation = EXECUTE_PATTERNS.some(pattern => path.includes(pattern));
    return isExecuteOperation ? 'execute' : 'write';
  }

  return METHOD_TO_ACTION[upperMethod] || 'read';
}

/**
 * Derives a permission string from a route's path and method.
 *
 * Uses convention: `{resource}:{action}`
 *
 * @param route - The server route to derive permission for
 * @returns The derived permission string, or null if cannot be derived
 *
 * @example
 * derivePermission({ path: '/agents', method: 'GET' }) // → 'agents:read'
 * derivePermission({ path: '/agents/:id/generate', method: 'POST' }) // → 'agents:execute'
 * derivePermission({ path: '/workflows/:id', method: 'DELETE' }) // → 'workflows:delete'
 */
export function derivePermission(route: Pick<ServerRoute, 'path' | 'method'>): string | null {
  // Skip for ALL method (typically MCP transports)
  if (route.method === 'ALL') {
    return null;
  }

  const resource = extractResource(route.path);
  if (!resource) {
    return null;
  }

  const action = deriveAction(route.method, route.path);

  return `${resource}:${action}`;
}

/**
 * Gets the effective permission for a route.
 *
 * Priority:
 * 1. Explicit requiresPermission on the route
 * 2. Derived permission from path/method convention
 * 3. null (no permission required - should only happen for public routes)
 *
 * @param route - The server route
 * @returns The permission string or null
 */
export function getEffectivePermission(route: ServerRoute): string | null {
  // If route is explicitly public, no permission needed
  if (route.requiresAuth === false) {
    return null;
  }

  // Use explicit permission if set
  if (route.requiresPermission) {
    return route.requiresPermission;
  }

  // Derive permission from convention
  return derivePermission(route);
}
