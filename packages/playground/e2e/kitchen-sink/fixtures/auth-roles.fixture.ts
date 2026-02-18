/**
 * Auth role fixtures for E2E testing.
 *
 * Defines role configurations matching the PRD permission model.
 * These fixtures are used by the auth testing utilities to mock different user roles.
 */

/**
 * Role permissions as defined in the PRD.
 *
 * From plans/prd.json:
 * - admin: Full access ['*']
 * - member: agents:read, workflows:*, tools:read, tools:execute
 * - viewer: agents:read, workflows:read
 * - _default: No permissions []
 */
export const rolePermissions = {
  admin: ['*'],
  member: ['agents:read', 'workflows:*', 'tools:read', 'tools:execute'],
  viewer: ['agents:read', 'workflows:read'],
  _default: [],
} as const;

export type Role = keyof typeof rolePermissions;

/**
 * Mock user profiles for each role.
 */
export const roleUsers = {
  admin: {
    id: 'user_admin_e2e',
    email: 'admin@e2e-test.mastra.dev',
    name: 'E2E Admin',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=e2e-admin',
  },
  member: {
    id: 'user_member_e2e',
    email: 'member@e2e-test.mastra.dev',
    name: 'E2E Member',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=e2e-member',
  },
  viewer: {
    id: 'user_viewer_e2e',
    email: 'viewer@e2e-test.mastra.dev',
    name: 'E2E Viewer',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=e2e-viewer',
  },
  _default: {
    id: 'user_default_e2e',
    email: 'default@e2e-test.mastra.dev',
    name: 'E2E Default User',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=e2e-default',
  },
} as const;

/**
 * Capabilities flags for each role.
 * All roles have the same capabilities, only permissions differ.
 */
export const roleCapabilities = {
  user: true,
  session: true,
  sso: true,
  rbac: true,
  acl: false,
} as const;

/**
 * Expected permission checks for each role.
 *
 * These can be used to verify that the correct permissions are enforced.
 */
export const permissionExpectations = {
  admin: {
    // Admin can do everything
    'agents:read': true,
    'agents:write': true,
    'agents:delete': true,
    'agents:execute': true,
    'workflows:read': true,
    'workflows:write': true,
    'workflows:delete': true,
    'workflows:execute': true,
    'tools:read': true,
    'tools:execute': true,
    'settings:read': true,
    'settings:write': true,
  },
  member: {
    // Member has limited access
    'agents:read': true,
    'agents:write': false,
    'agents:delete': false,
    'agents:execute': false,
    'workflows:read': true,
    'workflows:write': true,
    'workflows:delete': true,
    'workflows:execute': true,
    'tools:read': true,
    'tools:execute': true,
    'settings:read': false,
    'settings:write': false,
  },
  viewer: {
    // Viewer is read-only
    'agents:read': true,
    'agents:write': false,
    'agents:delete': false,
    'agents:execute': false,
    'workflows:read': true,
    'workflows:write': false,
    'workflows:delete': false,
    'workflows:execute': false,
    'tools:read': false,
    'tools:execute': false,
    'settings:read': false,
    'settings:write': false,
  },
  _default: {
    // Default has no permissions
    'agents:read': false,
    'agents:write': false,
    'agents:delete': false,
    'agents:execute': false,
    'workflows:read': false,
    'workflows:write': false,
    'workflows:delete': false,
    'workflows:execute': false,
    'tools:read': false,
    'tools:execute': false,
    'settings:read': false,
    'settings:write': false,
  },
} as const;

/**
 * UI elements that should be visible/hidden for each role.
 *
 * These are used to verify that the UI correctly reflects permissions.
 */
export const uiExpectations = {
  admin: {
    agentsListVisible: true,
    createAgentButtonVisible: true,
    editAgentButtonVisible: true,
    deleteAgentButtonVisible: true,
    workflowsListVisible: true,
    createWorkflowButtonVisible: true,
    runWorkflowButtonVisible: true,
    toolsListVisible: true,
    executeToolButtonVisible: true,
    settingsLinkVisible: true,
  },
  member: {
    agentsListVisible: true,
    createAgentButtonVisible: false,
    editAgentButtonVisible: false,
    deleteAgentButtonVisible: false,
    workflowsListVisible: true,
    createWorkflowButtonVisible: true,
    runWorkflowButtonVisible: true,
    toolsListVisible: true,
    executeToolButtonVisible: true,
    settingsLinkVisible: false,
  },
  viewer: {
    agentsListVisible: true,
    createAgentButtonVisible: false,
    editAgentButtonVisible: false,
    deleteAgentButtonVisible: false,
    workflowsListVisible: true,
    createWorkflowButtonVisible: false,
    runWorkflowButtonVisible: false,
    toolsListVisible: false, // viewer doesn't have tools:read
    executeToolButtonVisible: false,
    settingsLinkVisible: false,
  },
  _default: {
    agentsListVisible: false,
    createAgentButtonVisible: false,
    editAgentButtonVisible: false,
    deleteAgentButtonVisible: false,
    workflowsListVisible: false,
    createWorkflowButtonVisible: false,
    runWorkflowButtonVisible: false,
    toolsListVisible: false,
    executeToolButtonVisible: false,
    settingsLinkVisible: false,
  },
} as const;
