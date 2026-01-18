import type { RoleMapping } from '../interfaces/rbac';

/**
 * Default role definitions for Mastra Studio.
 *
 * These roles provide a standard hierarchy for access control:
 * - owner: Full access to all resources
 * - admin: Administrative access to studio features
 * - member: Read and execute permissions for most resources
 * - viewer: Read-only access
 */
export const DEFAULT_ROLES = [
  {
    id: 'owner',
    name: 'Owner',
    permissions: ['*'],
  },
  {
    id: 'admin',
    name: 'Admin',
    permissions: ['studio:*', 'agents:*', 'workflows:*', 'tools:*', 'logs:*', 'settings:*'],
  },
  {
    id: 'member',
    name: 'Member',
    permissions: [
      'studio:read',
      'agents:read',
      'agents:execute',
      'workflows:read',
      'workflows:execute',
      'tools:read',
      'logs:read',
    ],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    permissions: ['studio:read', 'agents:read', 'workflows:read', 'logs:read'],
  },
] as const;

/**
 * Default role mapping for Mastra Studio.
 *
 * Maps role names to their permission sets using dot-notation:
 * - namespace:action (e.g., 'agents:read', 'workflows:execute')
 * - namespace:* (e.g., 'agents:*' grants all agent permissions)
 * - * (full access to all resources)
 *
 * Permission namespaces:
 * - studio: General studio access
 * - agents: Agent management and execution
 * - workflows: Workflow management and execution
 * - tools: Tool management and configuration
 * - logs: Log and audit access
 * - settings: Settings and configuration
 */
export const DEFAULT_ROLE_MAPPING: RoleMapping = {
  owner: ['*'],
  admin: ['studio:*', 'agents:*', 'workflows:*', 'tools:*', 'logs:*', 'settings:*'],
  member: [
    'studio:read',
    'agents:read',
    'agents:execute',
    'workflows:read',
    'workflows:execute',
    'tools:read',
    'logs:read',
  ],
  viewer: ['studio:read', 'agents:read', 'workflows:read', 'logs:read'],
};
