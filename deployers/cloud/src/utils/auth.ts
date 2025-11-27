export function getAuthEntrypoint() {
  const tokensObject: Record<string, { id: string }> = {};

  if (process.env.PLAYGROUND_JWT_TOKEN) {
    tokensObject[process.env.PLAYGROUND_JWT_TOKEN] = { id: 'business-api' };
  }
  if (process.env.BUSINESS_JWT_TOKEN) {
    tokensObject[process.env.BUSINESS_JWT_TOKEN] = { id: 'business-api' };
  }

  return `
  import { SimpleAuth, CompositeAuth } from '@mastra/core/server';

  class MastraCloudAuth extends SimpleAuth {
    constructor() {
      super({
        tokens: ${JSON.stringify(tokensObject)}
      });
    }

    async authorizeUser (...args) {
      if (args[1] && args[1].path === '/api') {
        return true
      }
      if (args[0] && args[0].id === 'business-api') {
        return true
      }
      return super.authorizeUser(...args)
    }
  }

  const serverConfig = mastra.getServer()
  if (serverConfig && serverConfig.auth) {
    const existingAuth = serverConfig.auth
    const cloudAuth = new MastraCloudAuth()
    
    // Use CompositeAuth to combine cloud auth with existing auth
    serverConfig.auth = new CompositeAuth([cloudAuth, existingAuth])
  }
  `;
}
