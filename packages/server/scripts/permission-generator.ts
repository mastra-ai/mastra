/**
 * Shared permission generation logic.
 *
 * This module derives permissions from SERVER_ROUTES and generates the
 * TypeScript content for permissions.generated.ts.
 *
 * Used by both generate-permissions.ts and check-permissions.ts.
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SERVER_ROUTES } from '../src/server/server-adapter/routes/index.js';
import { getEffectivePermission } from '../src/server/server-adapter/routes/permissions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Path to the generated permissions file in @mastra/core */
export const OUTPUT_PATH = path.join(__dirname, '../../core/src/auth/ee/interfaces/permissions.generated.ts');

/** Descriptions for actions (used for TSDoc comments in autocomplete) */
const ACTION_DESCRIPTIONS: Record<string, string> = {
  create: 'Create',
  delete: 'Delete',
  execute: 'Execute',
  publish: 'Publish, activate, or restore',
  read: 'View',
  share: 'Change visibility/audience (e.g. private↔public)',
  write: 'Create and modify',
};

/**
 * Permissions that are not derived from any HTTP route (no `requiresPermission`,
 * no method/path mapping) but are asserted in handler code via helpers like
 * `assertShareAccess`. Seeded here so they appear in `PERMISSION_PATTERNS`
 * and `PermissionPattern`, making them grantable in role configs.
 */
export const ASSERTION_ONLY_PERMISSIONS: readonly string[] = ['stored-agents:share', 'stored-skills:share'];

/** Descriptions for resources (used for TSDoc comments in autocomplete) */
const RESOURCE_DESCRIPTIONS: Record<string, string> = {
  a2a: 'agent-to-agent communication',
  'agent-builder': 'agent builder',
  agents: 'agents',
  'background-tasks': 'background tasks',
  logs: 'logs',
  mcp: 'MCP servers',
  memory: 'memory and threads',
  observability: 'traces and spans',
  processors: 'processors',
  scores: 'evaluation scores',
  'stored-agents': 'stored agents',
  'stored-mcp-clients': 'stored MCP clients',
  'stored-prompt-blocks': 'stored prompt blocks',
  'stored-scorers': 'stored scorers',
  'stored-skills': 'stored skills',
  'stored-workspaces': 'stored workspaces',
  system: 'system info',
  tools: 'tools',
  vector: 'vector stores',
  workflows: 'workflows',
  workspaces: 'workspaces',
};

/**
 * Compound permission patterns that expand across the per-family stored resources.
 *
 * Emitted in PERMISSION_PATTERNS so role configs can grant the broad form. Runtime
 * matching in matchesPermission expands `stored:<action>` to each
 * `stored-<family>:<action>`.
 */
const COMPOUND_PATTERNS: Record<string, string> = {
  'stored:*':
    'Full access to all stored-* resources (stored-agents, stored-skills, stored-prompt-blocks, stored-mcp-clients, stored-scorers, stored-workspaces)',
  'stored:read': 'View any stored-* resource',
  'stored:write': 'Create and modify any stored-* resource',
  'stored:delete': 'Delete any stored-* resource',
};

/**
 * Generates a human-readable description for a permission pattern.
 */
function getPermissionDescription(pattern: string): string {
  if (pattern === '*') {
    return 'Full access to all resources and actions';
  }

  if (pattern.startsWith('*:')) {
    const action = pattern.slice(2);
    const actionDesc = ACTION_DESCRIPTIONS[action] || action;
    return `${actionDesc} all resources`;
  }

  if (pattern.endsWith(':*')) {
    const resource = pattern.slice(0, -2);
    const resourceDesc = RESOURCE_DESCRIPTIONS[resource] || resource;
    return `Full access to ${resourceDesc}`;
  }

  const [resource = '', action = ''] = pattern.split(':');
  const resourceDesc = RESOURCE_DESCRIPTIONS[resource] || resource;
  const actionDesc = ACTION_DESCRIPTIONS[action] || action;
  return `${actionDesc} ${resourceDesc}`;
}

function getPermissionConstantName(permission: string): string {
  return permission.replace(/[:-]/g, '_').toUpperCase();
}

export interface PermissionData {
  resources: string[];
  actions: string[];
  permissions: string[];
}

/**
 * Derives permission data from SERVER_ROUTES using getEffectivePermission.
 * This ensures the generated permissions match runtime behavior exactly.
 */
export function derivePermissionData(): PermissionData {
  const resourceSet = new Set<string>();
  const actionSet = new Set<string>();
  const permissionSet = new Set<string>();

  for (const route of SERVER_ROUTES) {
    const effective = getEffectivePermission(route);
    if (effective) {
      const permissions = Array.isArray(effective) ? effective : [effective];
      for (const permission of permissions) {
        const [resource, action] = permission.split(':');
        if (resource && action) {
          resourceSet.add(resource);
          actionSet.add(action);
          permissionSet.add(permission);
        }
      }
    }
  }

  // Seed assertion-only permissions (not derivable from any route).
  for (const permission of ASSERTION_ONLY_PERMISSIONS) {
    const [resource, action] = permission.split(':');
    if (resource && action) {
      resourceSet.add(resource);
      actionSet.add(action);
      permissionSet.add(permission);
    }
  }

  const resources = [...resourceSet].sort();
  const actions = [...actionSet].sort();
  const permissions = [...permissionSet].sort();

  return { resources, actions, permissions };
}

/**
 * Generates the TypeScript file content from permission data.
 */
export function generatePermissionFileContent(data: PermissionData): string {
  const { resources, actions, permissions } = data;

  // Build all permission patterns (wildcards + specific permissions)
  const allPatterns: string[] = [
    '*', // Global wildcard
    ...actions.map(a => `*:${a}`), // Action wildcards
    ...resources.map(r => `${r}:*`), // Resource wildcards
    ...permissions, // Specific permissions
  ];

  // Generate the PERMISSION_PATTERNS object entries with TSDoc comments
  const patternEntries = allPatterns
    .map(pattern => {
      const desc = getPermissionDescription(pattern);
      return `  /** ${desc} */\n  '${pattern}': '${pattern}'`;
    })
    .join(',\n');

  // Compound patterns: broad shorthand entries that expand across per-family resources at match time.
  // Skip any that collide with a current pattern (none today, but guard against regressions).
  const compoundEntries = Object.entries(COMPOUND_PATTERNS)
    .filter(([pattern]) => !allPatterns.includes(pattern))
    .map(([pattern, desc]) => `  /** ${desc} */\n  '${pattern}': '${pattern}'`)
    .join(',\n');

  const fgaPermissionEntries = permissions
    .map(permission => {
      const name = getPermissionConstantName(permission);
      const desc = getPermissionDescription(permission);
      return `  /** ${desc} */\n  ${name}: '${permission}'`;
    })
    .join(',\n');

  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 *
 * This file is generated by packages/server/scripts/generate-permissions.ts
 * Run \`pnpm generate:permissions\` from packages/server to regenerate.
 *
 * Source of truth: SERVER_ROUTES in @mastra/server
 */

/**
 * All known API resources.
 * Derived from SERVER_ROUTES paths in @mastra/server.
 */
export const RESOURCES = [
${resources.map(r => `  '${r}',`).join('\n')}
] as const;

/**
 * Resource type union.
 */
export type Resource = (typeof RESOURCES)[number];

/**
 * All permission actions.
 * Derived from HTTP methods and route overrides:
 * - GET → read
 * - POST → write or execute (context-dependent)
 * - PUT/PATCH → write
 * - DELETE → delete
 * - Additional actions from explicit requiresPermission overrides
 */
export const ACTIONS = [${actions.map(a => `'${a}'`).join(', ')}] as const;

/**
 * Action type union.
 */
export type Action = (typeof ACTIONS)[number];

/**
 * All valid permission patterns.
 * Use \`keyof typeof PERMISSION_PATTERNS\` or the \`PermissionPattern\` type.
 */
export const PERMISSION_PATTERNS = {
${patternEntries},${compoundEntries ? `\n${compoundEntries},` : ''}
} as const;

/**
 * Permission pattern that can be used in role definitions.
 * Supports:
 * - Specific permissions: 'agents:read', 'workflows:execute'
 * - Resource wildcards: 'agents:*', 'workflows:*' (all actions on a resource)
 * - Action wildcards: '*:read', '*:write' (an action across all resources)
 * - Global wildcard: '*' (full access)
 */
export type PermissionPattern = keyof typeof PERMISSION_PATTERNS;

/**
 * All valid resource:action permission combinations (excludes wildcards).
 */
export const PERMISSIONS = [
${permissions.map(p => `  '${p}',`).join('\n')}
] as const;

/**
 * Specific permission type (e.g., 'agents:read', 'workflows:execute').
 */
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Type-safe constants for Mastra-owned FGA permissions.
 *
 * These values are generated from server routes and can be used wherever
 * Mastra checks or maps FGA permissions.
 */
export const MastraFGAPermissions = {
${fgaPermissionEntries},
} as const satisfies Record<string, Permission>;

/**
 * Mastra-owned FGA permission values.
 */
export type MastraFGAPermission = (typeof MastraFGAPermissions)[keyof typeof MastraFGAPermissions];

/**
 * FGA permission input accepted by public config and provider APIs.
 * Keeps autocomplete for Mastra-owned permissions while allowing custom provider strings.
 */
export type MastraFGAPermissionInput = MastraFGAPermission | (string & {});

/**
 * Type-safe role mapping configuration.
 *
 * Maps role names (from your identity provider) to Mastra permission patterns.
 *
 * @example
 * \`\`\`typescript
 * const roleMapping: TypedRoleMapping = {
 *   "Engineering": ["agents:*", "workflows:*"],
 *   "Product": ["agents:read", "workflows:read"],
 *   "Admin": ["*"],
 *   "_default": [],
 * };
 * \`\`\`
 */
export type TypedRoleMapping = {
  [role: string]: PermissionPattern[];
};

/**
 * Validates that a string is a valid permission pattern.
 * Useful for runtime validation of permission strings.
 */
export function isValidPermissionPattern(pattern: string): pattern is PermissionPattern {
  return pattern in PERMISSION_PATTERNS;
}

/**
 * Validates that all permissions in an array are valid patterns.
 */
export function validatePermissions(permissions: string[]): permissions is PermissionPattern[] {
  return permissions.every(isValidPermissionPattern);
}
`;
}
