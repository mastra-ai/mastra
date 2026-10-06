/**
 * @mastra/auth-oidc
 *
 * Generic OpenID Connect authentication for Mastra, built on `openid-client`.
 * Point it at any OIDC-compliant issuer — Keycloak, Authentik, Zitadel,
 * Microsoft Entra ID, Ping, Dex, and others — and endpoints are read from the
 * provider's discovery document.
 *
 * @example
 * ```typescript
 * import { Mastra } from '@mastra/core/mastra';
 * import { MastraAuthOidc } from '@mastra/auth-oidc';
 *
 * export const mastra = new Mastra({
 *   server: {
 *     auth: new MastraAuthOidc({
 *       issuer: 'https://id.example.com/realms/acme',
 *       clientId: 'mastra',
 *       clientSecret: process.env.OIDC_CLIENT_SECRET,
 *       redirectUri: 'http://localhost:4111/api/auth/sso/callback',
 *     }),
 *   },
 * });
 * ```
 */

export { MastraAuthOidc } from './auth-provider';

export { mapOidcClaimsToUser } from './types';
export type {
  MastraAuthOidcOptions,
  OidcSessionOptions,
  OidcTokenEndpointAuthMethod,
  OidcUser,
  ServerMetadata,
} from './types';
