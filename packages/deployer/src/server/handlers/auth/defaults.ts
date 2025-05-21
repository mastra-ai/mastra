import type { MastraAuthConfig } from '@mastra/core/server';

// Default configuration that can be extended by clients
export const defaultAuthConfig: MastraAuthConfig = {
  public: [
    '/',
    '/refresh-events',
    '/__refresh',
    '/assets/*',
    '/auth/*',
    '/openapi.json',
    '/swagger-ui',
    ['/api/agents', 'GET'],
    ['/a2a/*', ['GET']],
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
