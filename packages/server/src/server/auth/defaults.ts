import type { MastraAuthConfig } from '@mastra/core/server';

// Default configuration that can be extended by clients
// TODO: Wire up RBAC provider to authorization middleware for granular permission checks.
// Currently allows all authenticated users. See auth-middleware.ts in server adapters.
export const defaultAuthConfig: MastraAuthConfig = {
  protected: ['/api/*'],
  public: ['/api', '/api/auth/*', '/api/system/*'],
  // Simple rule system
  rules: [
    // Allow all authenticated users (quick fix - RBAC should be used for granular control)
    {
      condition: user => {
        // Any authenticated user is allowed
        return typeof user === 'object' && user !== null;
      },
      allow: true,
    },
  ],
};
