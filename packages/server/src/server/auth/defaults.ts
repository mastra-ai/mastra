import type { MastraAuthConfig } from '@mastra/core/server';

// Default configuration that can be extended by clients
export const defaultAuthConfig: MastraAuthConfig = {
  protected: ['/api/*'],
  // Auth callback routes are public (login, logout, SSO flows)
  // but management routes (/api/auth/team, /api/auth/roles, etc.) require auth
  public: [
    '/api',
    '/api/auth/sso/*',
    '/api/auth/callback',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/session',
    '/api/auth/capabilities',
  ],
  // Simple rule system
  rules: [
    // Admin users can do anything
    {
      condition: user => {
        if (typeof user === 'object' && user !== null) {
          if ('isAdmin' in user) {
            return !!user.isAdmin;
          }

          if ('role' in user) {
            return user.role === 'admin';
          }
        }
        return false;
      },
      allow: true,
    },
  ],
};
