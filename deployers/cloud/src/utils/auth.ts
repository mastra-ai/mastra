export function getAuthEntrypoint() {
  return `
  import { MastraAuthProvider } from '@mastra/core/server';

  class MastraCloudAuth extends MastraAuthProvider {
    constructor (auth) {
      super()
      this.auth = auth
    }

    async authenticateToken (...args) {
      if (typeof args[0] === 'string' && args[0].replace('Bearer ', '') === '${process.env.BUSINESS_JWT_TOKEN}') {
        return { id: 'business-api' }
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
  if (serverConfig && serverConfig.experimental_auth) {
    const auth = serverConfig.experimental_auth
    serverConfig.experimental_auth = new MastraCloudAuth(auth)
  }
  `;
}
