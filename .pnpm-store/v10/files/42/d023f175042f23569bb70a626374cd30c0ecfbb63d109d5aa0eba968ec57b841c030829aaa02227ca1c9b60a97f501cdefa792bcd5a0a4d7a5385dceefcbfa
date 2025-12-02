import { _ as User } from "./index--CrC0_x3.mjs";
import { AuthContext, GenericEndpointContext } from "@better-auth/core";
import * as _better_auth_core_oauth21 from "@better-auth/core/oauth2";
import { OAuth2Tokens, OAuth2UserInfo, OAuthProvider } from "@better-auth/core/oauth2";
import * as better_call235 from "better-call";
import * as z from "zod";

//#region src/plugins/generic-oauth/providers/auth0.d.ts
interface Auth0Options extends BaseOAuthProviderOptions {
  /**
   * Auth0 domain (e.g., dev-xxx.eu.auth0.com)
   * This will be used to construct the discovery URL.
   */
  domain: string;
}
/**
 * Auth0 OAuth provider helper
 *
 * @example
 * ```ts
 * import { genericOAuth, auth0 } from "better-auth/plugins/generic-oauth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     genericOAuth({
 *       config: [
 *         auth0({
 *           clientId: process.env.AUTH0_CLIENT_ID,
 *           clientSecret: process.env.AUTH0_CLIENT_SECRET,
 *           domain: process.env.AUTH0_DOMAIN,
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
declare function auth0(options: Auth0Options): GenericOAuthConfig;
//#endregion
//#region src/plugins/generic-oauth/providers/hubspot.d.ts
interface HubSpotOptions extends BaseOAuthProviderOptions {
  /**
   * OAuth scopes to request.
   * @default ["oauth"]
   */
  scopes?: string[];
}
/**
 * HubSpot OAuth provider helper
 *
 * @example
 * ```ts
 * import { genericOAuth, hubspot } from "better-auth/plugins/generic-oauth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     genericOAuth({
 *       config: [
 *         hubspot({
 *           clientId: process.env.HUBSPOT_CLIENT_ID,
 *           clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
 *           scopes: ["oauth", "contacts"],
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
declare function hubspot(options: HubSpotOptions): GenericOAuthConfig;
//#endregion
//#region src/plugins/generic-oauth/providers/keycloak.d.ts
interface KeycloakOptions extends BaseOAuthProviderOptions {
  /**
   * Keycloak issuer URL (includes realm, e.g., https://my-domain/realms/MyRealm)
   * This will be used to construct the discovery URL.
   */
  issuer: string;
}
/**
 * Keycloak OAuth provider helper
 *
 * @example
 * ```ts
 * import { genericOAuth, keycloak } from "better-auth/plugins/generic-oauth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     genericOAuth({
 *       config: [
 *         keycloak({
 *           clientId: process.env.KEYCLOAK_CLIENT_ID,
 *           clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
 *           issuer: process.env.KEYCLOAK_ISSUER,
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
declare function keycloak(options: KeycloakOptions): GenericOAuthConfig;
//#endregion
//#region src/plugins/generic-oauth/providers/line.d.ts
interface LineOptions extends BaseOAuthProviderOptions {
  /**
   * Unique provider identifier for this LINE channel.
   * Use different providerIds for different countries/channels (e.g., "line-jp", "line-th", "line-tw").
   * @default "line"
   */
  providerId?: string;
}
/**
 * LINE OAuth provider helper
 *
 * LINE requires separate channels for different countries (Japan, Thailand, Taiwan, etc.).
 * Each channel has its own clientId and clientSecret. To support multiple countries,
 * call this function multiple times with different providerIds and credentials.
 *
 * @example
 * ```ts
 * import { genericOAuth, line } from "better-auth/plugins/generic-oauth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     genericOAuth({
 *       config: [
 *         // Japan channel
 *         line({
 *           providerId: "line-jp",
 *           clientId: process.env.LINE_JP_CLIENT_ID,
 *           clientSecret: process.env.LINE_JP_CLIENT_SECRET,
 *         }),
 *         // Thailand channel
 *         line({
 *           providerId: "line-th",
 *           clientId: process.env.LINE_TH_CLIENT_ID,
 *           clientSecret: process.env.LINE_TH_CLIENT_SECRET,
 *         }),
 *         // Taiwan channel
 *         line({
 *           providerId: "line-tw",
 *           clientId: process.env.LINE_TW_CLIENT_ID,
 *           clientSecret: process.env.LINE_TW_CLIENT_SECRET,
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
declare function line(options: LineOptions): GenericOAuthConfig;
//#endregion
//#region src/plugins/generic-oauth/providers/microsoft-entra-id.d.ts
interface MicrosoftEntraIdOptions extends BaseOAuthProviderOptions {
  /**
   * Microsoft Entra ID tenant ID.
   * Can be a GUID, "common", "organizations", or "consumers"
   */
  tenantId: string;
}
/**
 * Microsoft Entra ID (Azure AD) OAuth provider helper
 *
 * @example
 * ```ts
 * import { genericOAuth, microsoftEntraId } from "better-auth/plugins/generic-oauth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     genericOAuth({
 *       config: [
 *         microsoftEntraId({
 *           clientId: process.env.MS_APP_ID,
 *           clientSecret: process.env.MS_CLIENT_SECRET,
 *           tenantId: process.env.MS_TENANT_ID,
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
declare function microsoftEntraId(options: MicrosoftEntraIdOptions): GenericOAuthConfig;
//#endregion
//#region src/plugins/generic-oauth/providers/okta.d.ts
interface OktaOptions extends BaseOAuthProviderOptions {
  /**
   * Okta issuer URL (e.g., https://dev-xxxxx.okta.com/oauth2/default)
   * This will be used to construct the discovery URL.
   */
  issuer: string;
}
/**
 * Okta OAuth provider helper
 *
 * @example
 * ```ts
 * import { genericOAuth, okta } from "better-auth/plugins/generic-oauth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     genericOAuth({
 *       config: [
 *         okta({
 *           clientId: process.env.OKTA_CLIENT_ID,
 *           clientSecret: process.env.OKTA_CLIENT_SECRET,
 *           issuer: process.env.OKTA_ISSUER,
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
declare function okta(options: OktaOptions): GenericOAuthConfig;
//#endregion
//#region src/plugins/generic-oauth/providers/slack.d.ts
interface SlackOptions extends BaseOAuthProviderOptions {}
/**
 * Slack OAuth provider helper
 *
 * @example
 * ```ts
 * import { genericOAuth, slack } from "better-auth/plugins/generic-oauth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     genericOAuth({
 *       config: [
 *         slack({
 *           clientId: process.env.SLACK_CLIENT_ID,
 *           clientSecret: process.env.SLACK_CLIENT_SECRET,
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
declare function slack(options: SlackOptions): GenericOAuthConfig;
//#endregion
//#region src/plugins/generic-oauth/index.d.ts
/**
 * Configuration interface for generic OAuth providers.
 */
interface GenericOAuthConfig {
  /** Unique identifier for the OAuth provider */
  providerId: string;
  /**
   * URL to fetch OAuth 2.0 configuration.
   * If provided, the authorization and token endpoints will be fetched from this URL.
   */
  discoveryUrl?: string | undefined;
  /**
   * URL for the authorization endpoint.
   * Optional if using discoveryUrl.
   */
  authorizationUrl?: string | undefined;
  /**
   * URL for the token endpoint.
   * Optional if using discoveryUrl.
   */
  tokenUrl?: string | undefined;
  /**
   * URL for the user info endpoint.
   * Optional if using discoveryUrl.
   */
  userInfoUrl?: string | undefined;
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret?: string | undefined;
  /**
   * Array of OAuth scopes to request.
   * @default []
   */
  scopes?: string[] | undefined;
  /**
   * Custom redirect URI.
   * If not provided, a default URI will be constructed.
   */
  redirectURI?: string | undefined;
  /**
   * OAuth response type.
   * @default "code"
   */
  responseType?: string | undefined;
  /**
   * The response mode to use for the authorization code request.
    */
  responseMode?: ("query" | "form_post") | undefined;
  /**
   * Prompt parameter for the authorization request.
   * Controls the authentication experience for the user.
   */
  prompt?: ("none" | "login" | "consent" | "select_account") | undefined;
  /**
   * Whether to use PKCE (Proof Key for Code Exchange)
   * @default false
   */
  pkce?: boolean | undefined;
  /**
   * Access type for the authorization request.
   * Use "offline" to request a refresh token.
   */
  accessType?: string | undefined;
  /**
   * Custom function to exchange authorization code for tokens.
   * If provided, this function will be used instead of the default token exchange logic.
   * This is useful for providers with non-standard token endpoints.
   * @param data - Authorization code exchange parameters
   * @returns A promise that resolves to OAuth2Tokens
   */
  getToken?: ((data: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>) | undefined;
  /**
   * Custom function to fetch user info.
   * If provided, this function will be used instead of the default user info fetching logic.
   * @param tokens - The OAuth tokens received after successful authentication
   * @returns A promise that resolves to a User object or null
   */
  getUserInfo?: ((tokens: OAuth2Tokens) => Promise<OAuth2UserInfo | null>) | undefined;
  /**
   * Custom function to map the user profile to a User object.
   */
  mapProfileToUser?: ((profile: Record<string, any>) => Partial<Partial<User>> | Promise<Partial<User>>) | undefined;
  /**
   * Additional search-params to add to the authorizationUrl.
   * Warning: Search-params added here overwrite any default params.
   */
  authorizationUrlParams?: (Record<string, string> | ((ctx: GenericEndpointContext) => Record<string, string>)) | undefined;
  /**
   * Additional search-params to add to the tokenUrl.
   * Warning: Search-params added here overwrite any default params.
   */
  tokenUrlParams?: (Record<string, string> | ((ctx: GenericEndpointContext) => Record<string, string>)) | undefined;
  /**
   * Disable implicit sign up for new users. When set to true for the provider,
   * sign-in need to be called with with requestSignUp as true to create new users.
   */
  disableImplicitSignUp?: boolean | undefined;
  /**
   * Disable sign up for new users.
   */
  disableSignUp?: boolean | undefined;
  /**
   * Authentication method for token requests.
   * @default "post"
   */
  authentication?: ("basic" | "post") | undefined;
  /**
   * Custom headers to include in the discovery request.
   * Useful for providers like Epic that require specific headers (e.g., Epic-Client-ID).
   */
  discoveryHeaders?: Record<string, string> | undefined;
  /**
   * Custom headers to include in the authorization request.
   * Useful for providers like Qonto that require specific headers (e.g., X-Qonto-Staging-Token for local development).
   */
  authorizationHeaders?: Record<string, string> | undefined;
  /**
   * Override user info with the provider info.
   *
   * This will update the user info with the provider info,
   * when the user signs in with the provider.
   * @default false
   */
  overrideUserInfo?: boolean | undefined;
}
/**
 * Base type for OAuth provider options.
 * Extracts common fields from GenericOAuthConfig and makes clientSecret required.
 */
type BaseOAuthProviderOptions = Omit<Pick<GenericOAuthConfig, "clientId" | "clientSecret" | "scopes" | "redirectURI" | "pkce" | "disableImplicitSignUp" | "disableSignUp" | "overrideUserInfo">, "clientSecret"> & {
  /** OAuth client secret (required for provider options) */
  clientSecret: string;
};
interface GenericOAuthOptions {
  /**
   * Array of OAuth provider configurations.
   */
  config: GenericOAuthConfig[];
}
/**
 * A generic OAuth plugin that can be used to add OAuth support to any provider
 */
declare const genericOAuth: (options: GenericOAuthOptions) => {
  id: "generic-oauth";
  init: (ctx: AuthContext) => {
    context: {
      socialProviders: OAuthProvider<Record<string, any>, Partial<_better_auth_core_oauth21.ProviderOptions<any>>>[];
    };
  };
  endpoints: {
    /**
     * ### Endpoint
     *
     * POST `/sign-in/oauth2`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.signInWithOAuth2`
     *
     * **client:**
     * `authClient.signIn.oauth2`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/sign-in#api-method-sign-in-oauth2)
     */
    signInWithOAuth2: better_call235.StrictEndpoint<"/sign-in/oauth2", {
      method: "POST";
      body: z.ZodObject<{
        providerId: z.ZodString;
        callbackURL: z.ZodOptional<z.ZodString>;
        errorCallbackURL: z.ZodOptional<z.ZodString>;
        newUserCallbackURL: z.ZodOptional<z.ZodString>;
        disableRedirect: z.ZodOptional<z.ZodBoolean>;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        requestSignUp: z.ZodOptional<z.ZodBoolean>;
        additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      url: {
                        type: string;
                      };
                      redirect: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      url: string;
      redirect: boolean;
    }>;
    oAuth2Callback: better_call235.StrictEndpoint<"/oauth2/callback/:providerId", {
      method: "GET";
      query: z.ZodObject<{
        code: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
        error_description: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>;
      metadata: {
        client: boolean;
        allowedMediaTypes: string[];
        openapi: {
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      url: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, void>;
    /**
     * ### Endpoint
     *
     * POST `/oauth2/link`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.oAuth2LinkAccount`
     *
     * **client:**
     * `authClient.oauth2.link`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/generic-oauth#api-method-oauth2-link)
     */
    oAuth2LinkAccount: better_call235.StrictEndpoint<"/oauth2/link", {
      method: "POST";
      body: z.ZodObject<{
        providerId: z.ZodString;
        callbackURL: z.ZodString;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        errorCallbackURL: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>;
      use: ((inputContext: better_call235.MiddlewareInputContext<better_call235.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      url: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      redirect: {
                        type: string;
                        description: string;
                        enum: boolean[];
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      url: string;
      redirect: boolean;
    }>;
  };
  $ERROR_CODES: {
    readonly INVALID_OAUTH_CONFIGURATION: "Invalid OAuth configuration";
    readonly TOKEN_URL_NOT_FOUND: "Invalid OAuth configuration. Token URL not found.";
    readonly PROVIDER_CONFIG_NOT_FOUND: "No config found for provider";
    readonly PROVIDER_ID_REQUIRED: "Provider ID is required";
    readonly INVALID_OAUTH_CONFIG: "Invalid OAuth configuration.";
    readonly SESSION_REQUIRED: "Session is required";
  };
};
//#endregion
export { auth0 as _, slack as a, MicrosoftEntraIdOptions as c, line as d, KeycloakOptions as f, Auth0Options as g, hubspot as h, SlackOptions as i, microsoftEntraId as l, HubSpotOptions as m, GenericOAuthConfig as n, OktaOptions as o, keycloak as p, genericOAuth as r, okta as s, BaseOAuthProviderOptions as t, LineOptions as u };