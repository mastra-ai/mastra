export function getAuthEntrypoint() {
  return `
  import { MastraAuthProvider } from '@mastra/core/server';

  class MastraCloudAuth extends MastraAuthProvider {
    constructor (auth) {
      super()
      this.auth = auth
    }

    async authenticateToken (...args) {
      // args[0] = Authorization header, args[1] = Hono request object
      const authHeader = args[0];
      const request = args[1];
      
      // Check Authorization header (can be either businessJwtToken or playgroundJwtToken)
      if (typeof authHeader === 'string') {
        const token = authHeader.replace('Bearer ', '');
        
        // Check if it matches BUSINESS_JWT_TOKEN (only if defined)
        ${
          process.env.BUSINESS_JWT_TOKEN
            ? `if (token === '${process.env.BUSINESS_JWT_TOKEN}') {
          return { id: 'business-api' }
        }`
            : ''
        }
        
        // Check if it matches PLAYGROUND_JWT_TOKEN (only if defined)
        ${
          process.env.PLAYGROUND_JWT_TOKEN
            ? `if (token === '${process.env.PLAYGROUND_JWT_TOKEN}') {
          return { id: 'business-api' }
        }`
            : ''
        }
      }
      
      // Check X-Playground-Access header (new playground token)
      if (request && request.header) {
        const playgroundHeader = request.header('X-Playground-Access');
        if (playgroundHeader && typeof playgroundHeader === 'string') {
          const token = playgroundHeader.replace('Bearer ', '');
          ${
            process.env.PLAYGROUND_JWT_TOKEN
              ? `if (token === '${process.env.PLAYGROUND_JWT_TOKEN}') {
            return { id: 'business-api' }
          }`
              : ''
          }
        }
      }
      
      return this.auth.authenticateToken(...args)
    }

    async authorizeUser (...args) {
      if (args[1] && args[1].path === '/api') {
        return true
      }
      if (args[0] && args[0].id === 'business-api') {
        return true
      }
      return this.auth.authorizeUser(...args)
    }
  }

  const serverConfig = mastra.getServer()
  if (serverConfig && serverConfig.auth) {
    const auth = serverConfig.auth
    serverConfig.auth = new MastraCloudAuth(auth)
  }
  `;
}
