// @ts-check

import open from 'open'
import { config } from '../config.js'

/** @typedef {import("@modelcontextprotocol/sdk/client/auth.js").OAuthClientProvider} OAuthClientProvider */
/** @implements {OAuthClientProvider} */
export class McpOAuthClientProvider {
  constructor(serverId, redirectUrl) {
    this.serverId = serverId
    this.redirectUrl = redirectUrl
  }

  get clientMetadata() {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: 'mcp-cli',
      client_uri: 'https://github.com/wong2/mcp-cli',
    }
  }

  async clientInformation() {
    return config.get(`oauth.${this.serverId}.clientInformation`)
  }

  async saveClientInformation(clientInformation) {
    await config.set(`oauth.${this.serverId}.clientInformation`, clientInformation)
  }

  async tokens() {
    return config.get(`oauth.${this.serverId}.tokens`)
  }

  async saveTokens(tokens) {
    await config.set(`oauth.${this.serverId}.tokens`, tokens)
  }

  async redirectToAuthorization(authorizationUrl) {
    await open(authorizationUrl.toString())
  }

  async codeVerifier() {
    return config.get(`oauth.${this.serverId}.codeVerifier`)
  }

  async saveCodeVerifier(codeVerifier) {
    await config.set(`oauth.${this.serverId}.codeVerifier`, codeVerifier)
  }
}
