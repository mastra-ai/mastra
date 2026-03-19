import { Mastra } from '@mastra/core/mastra';
import { SimpleAuth } from '@mastra/core/server';
import { StaticRBACProvider } from '@mastra/core/auth/ee';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';

import { weatherAgent } from './agents/weather-agent';

/**
 * Example: Mastra with SimpleAuth + RBAC
 *
 * This demonstrates token-based authentication with role-based access control.
 *
 * Users:
 *   - admin-token  → Admin user (full access)
 *   - member-token → Member user (read agents, full workflow access)
 *   - viewer-token → Viewer user (read-only access)
 *
 * Try it:
 *   curl http://localhost:4111/api/agents -H "Authorization: Bearer admin-token"
 *   curl http://localhost:4111/api/agents -H "Authorization: Bearer viewer-token"
 */

// Define users with their roles
const users = {
  'admin-token': { id: 'user-1', email: 'admin@example.com', name: 'Admin User', role: 'admin' },
  'member-token': { id: 'user-2', email: 'member@example.com', name: 'Member User', role: 'member' },
  'viewer-token': { id: 'user-3', email: 'viewer@example.com', name: 'Viewer User', role: 'viewer' },
};

export const mastra = new Mastra({
  agents: { weatherAgent },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    auth: new SimpleAuth({ tokens: users }),
    rbac: new StaticRBACProvider({
      roleMapping: {
        admin: ['*'],
        member: ['agents:read', 'agents:execute', 'workflows:*', 'tools:read', 'tools:execute'],
        viewer: ['agents:read', 'workflows:read', 'tools:read'],
      },
      getUserRoles: user => [(user as (typeof users)[keyof typeof users]).role],
    }),
  },
});
