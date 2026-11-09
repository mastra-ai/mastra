export function getAuthEntrypoint() {
  return `
  import { SimpleAuth, CompositeAuth } from '@mastra/core/server';
  import { MastraCloudAuthProvider, MastraRBACCloud } from '@mastra/auth-cloud';

  // Service token auth (for business-api, playground internal calls).
  // Read at runtime so tokens aren't baked into the build output.
  const serviceTokens = {};
  for (const name of ['PLAYGROUND_JWT_TOKEN', 'BUSINESS_JWT_TOKEN']) {
    if (process.env[name]) {
      serviceTokens[process.env[name]] = { id: 'business-api', role: 'api' };
    }
  }

  class MastraCloudServiceAuth extends SimpleAuth {
    constructor() {
      super({
        tokens: serviceTokens
      });
    }

    async authorizeUser(user, request) {
      // Allow access to /api path
      if (request && request.url && new URL(request.url).pathname === '/api') {
        return true;
      }
      // Allow access for business-api users
      if (user && user.id === 'business-api') {
        return true;
      }
      return false;
    }
  }

  const serviceAuth = new MastraCloudServiceAuth();

  // Cloud user auth (for end users via OAuth)
  // Only enabled if MASTRA_CLOUD_API_URL is set
  let cloudUserAuth = null;
  if (process.env.MASTRA_CLOUD_API_URL) {
    cloudUserAuth = new MastraCloudAuthProvider({
      projectId: process.env.PROJECT_ID,
      cloudBaseUrl: process.env.MASTRA_CLOUD_API_URL,
      callbackUrl: process.env.MASTRA_CLOUD_CALLBACK_URL || \`\${process.env.MASTRA_CLOUD_API_URL}/auth/callback\`,
    });
  }

  const serverConfig = mastra.getServer();
  const userAuth = serverConfig?.auth;

  // Only enable auth if cloudUserAuth or userAuth are defined
  if (serverConfig && (cloudUserAuth || userAuth)) {
    // Build provider list: service auth first, then cloud user auth, then user's custom auth
    const providers = [serviceAuth];
    if (cloudUserAuth) {
      providers.push(cloudUserAuth);
    }
    if (userAuth) {
      providers.push(userAuth);
    }

    serverConfig.auth = new CompositeAuth(providers);

    // If cloud auth is enabled but no RBAC is configured, add default cloud RBAC
    if (cloudUserAuth && !serverConfig.rbac) {
      serverConfig.rbac = new MastraRBACCloud({
        roleMapping: {
          owner: ['*'],
          admin: ['*:read', '*:write', '*:execute'],
          api: ['*:read', '*:write', '*:execute'],
          member: ['*:read', '*:execute'],
          viewer: ['*:read'],
          _default: [],
        },
      });
    }
  }
  `;
}
