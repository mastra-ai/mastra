export function getAuthEntrypoint() {
  return `
  import { MastraAuthProvider } from '@mastra/core/server';

  class MastraCloudAuth extends MastraAuthProvider {
    constructor (auth) {
      super()
      this.auth = auth
    }

    async authenticateToken (...args) {
      if (typeof args[0] === 'string') {
        const token = args[0].replace('Bearer ', '');
        const validTokens = [];
        ${process.env.PLAYGROUND_JWT_TOKEN ? `validTokens.push('${process.env.PLAYGROUND_JWT_TOKEN}');` : ''}
        ${process.env.BUSINESS_JWT_TOKEN ? `validTokens.push('${process.env.BUSINESS_JWT_TOKEN}');` : ''}
        
        if (validTokens.includes(token)) {
          return { id: 'business-api' }
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
