import { Bt as index_d_exports, _ as User, g as Session } from "./index--CrC0_x3.mjs";
import { t as Awaitable } from "./helper-DU33OcfW.mjs";
import { t as InferOptionSchema } from "./plugins-Brc8BsoZ.mjs";
import * as _better_auth_core19 from "@better-auth/core";
import { GenericEndpointContext } from "@better-auth/core";
import * as better_call211 from "better-call";
import * as z from "zod";
import * as jose0 from "jose";
import { JSONWebKeySet, JWTPayload } from "jose";

//#region src/plugins/jwt/schema.d.ts
declare const schema: {
  jwks: {
    fields: {
      publicKey: {
        type: "string";
        required: true;
      };
      privateKey: {
        type: "string";
        required: true;
      };
      createdAt: {
        type: "date";
        required: true;
      };
      expiresAt: {
        type: "date";
        required: false;
      };
    };
  };
};
//#endregion
//#region src/plugins/jwt/types.d.ts
interface JwtOptions {
  jwks?: {
    /**
     * Disables the /jwks endpoint and uses this endpoint in discovery.
     *
     * Useful if jwks are not managed at /jwks or
     * if your jwks are signed with a certificate and placed on your CDN.
     */
    remoteUrl?: string;
    /**
     * Key pair configuration
     * @description A subset of the options available for the generateKeyPair function
     *
     * @see https://github.com/panva/jose/blob/main/src/runtime/node/generate.ts
     *
     * @default { alg: 'EdDSA', crv: 'Ed25519' }
     */
    keyPairConfig?: JWKOptions;
    /**
     * Disable private key encryption
     * @description Disable the encryption of the private key in the database
     *
     * @default false
     */
    disablePrivateKeyEncryption?: boolean;
    /**
     * The key rotation interval in seconds.
     *
     * @default undefined (disabled)
     */
    rotationInterval?: number;
    /**
     * The grace period in seconds.
     *
     * @default 2592000 (30 days)
     */
    gracePeriod?: number;
    /**
     * The path of the endpoint exposing the JWKS.
     * When set, this replaces the default /jwks endpoint.
     * The old endpoint will return 404.
     *
     * @default /jwks
     * @example "/.well-known/jwks.json"
     */
    jwksPath?: string;
  } | undefined;
  jwt?: {
    /**
     * The issuer of the JWT
     */
    issuer?: string;
    /**
     * The audience of the JWT
     */
    audience?: string;
    /**
     * Set the "exp" (Expiration Time) Claim.
     *
     * - If a `number` is passed as an argument it is used as the claim directly.
     * - If a `Date` instance is passed as an argument it is converted to unix timestamp and used as the
     *   claim.
     * - If a `string` is passed as an argument it is resolved to a time span, and then added to the
     *   current unix timestamp and used as the claim.
     *
     * Format used for time span should be a number followed by a unit, such as "5 minutes" or "1
     * day".
     *
     * Valid units are: "sec", "secs", "second", "seconds", "s", "minute", "minutes", "min", "mins",
     * "m", "hour", "hours", "hr", "hrs", "h", "day", "days", "d", "week", "weeks", "w", "year",
     * "years", "yr", "yrs", and "y". It is not possible to specify months. 365.25 days is used as an
     * alias for a year.
     *
     * If the string is suffixed with "ago", or prefixed with a "-", the resulting time span gets
     * subtracted from the current unix timestamp. A "from now" suffix can also be used for
     * readability when adding to the current unix timestamp.
     *
     * @default 15m
     */
    expirationTime?: number | string | Date;
    /**
     * A function that is called to define the payload of the JWT
     */
    definePayload?: (session: {
      user: User & Record<string, any>;
      session: Session & Record<string, any>;
    }) => Promise<Record<string, any>> | Record<string, any>;
    /**
     * A function that is called to get the subject of the JWT
     *
     * @default session.user.id
     */
    getSubject?: (session: {
      user: User & Record<string, any>;
      session: Session & Record<string, any>;
    }) => Promise<string> | string;
    /**
     * A custom function to remote sign the jwt payload.
     *
     * All headers, such as `alg` and `kid`,
     * MUST be defined within this function.
     * You can safely define the header `typ: 'JWT'`.
     *
     * @requires jwks.remoteUrl
     * @invalidates other jwt.* options
     */
    sign?: (payload: JWTPayload) => Awaitable<string>;
  } | undefined;
  /**
   * Disables setting JWTs through middleware.
   *
   * Recommended to set `true` when using an oAuth provider plugin
   * like OIDC or MCP where session payloads should not be signed.
   *
   * @default false
   */
  disableSettingJwtHeader?: boolean | undefined;
  /**
   * Custom schema for the admin plugin
   */
  schema?: InferOptionSchema<typeof schema> | undefined;
  /**
   * Custom adapter for the jwt plugin
   *
   * This will override the default adapter
   *
   * @default adapter from the database
   */
  adapter?: {
    /**
     * A custom function to get the JWKS from the database or
     * other source
     *
     * This will override the default getJwks from the database
     *
     * @param ctx - The context of the request
     * @returns The JWKS
     */
    getJwks?: (ctx: index_d_exports.GenericEndpointContext) => Promise<Jwk[] | null | undefined>;
    /**
     * A custom function to create a new key in the database or
     * other source
     *
     * This will override the default createJwk from the database
     *
     * @param data - The key to create
     * @returns The created key
     */
    createJwk?: (data: Omit<Jwk, "id">, ctx: index_d_exports.GenericEndpointContext) => Promise<Jwk>;
  };
}
/**
 * Asymmetric (JWS) Supported.
 *
 * @see https://github.com/panva/jose/issues/210
 */
type JWKOptions = {
  alg: "EdDSA";
  crv?: "Ed25519" | undefined;
} | {
  alg: "ES256";
  crv?: never | undefined;
} | {
  alg: "ES512";
  crv?: never | undefined;
} | {
  alg: "PS256";
  modulusLength?: number | undefined;
} | {
  alg: "RS256";
  modulusLength?: number | undefined;
};
type JWSAlgorithms = JWKOptions["alg"];
interface Jwk {
  id: string;
  publicKey: string;
  privateKey: string;
  createdAt: Date;
  expiresAt?: Date;
  alg?: JWSAlgorithms | undefined;
  crv?: ("Ed25519" | "P-256" | "P-521") | undefined;
}
//#endregion
//#region src/plugins/jwt/sign.d.ts
declare function getJwtToken(ctx: GenericEndpointContext, options?: JwtOptions | undefined): Promise<string>;
//#endregion
//#region src/plugins/jwt/utils.d.ts
declare function generateExportedKeyPair(options?: JwtOptions | undefined): Promise<{
  publicWebKey: jose0.JWK;
  privateWebKey: jose0.JWK;
  alg: "EdDSA" | "ES256" | "ES512" | "PS256" | "RS256";
  cfg: {
    crv?: "Ed25519" | undefined;
  } | {
    crv?: never | undefined;
  } | {
    crv?: never | undefined;
  } | {
    modulusLength?: number | undefined;
  } | {
    modulusLength?: number | undefined;
  };
}>;
/**
 * Creates a Jwk on the database
 *
 * @param ctx
 * @param options
 * @returns
 */
declare function createJwk(ctx: GenericEndpointContext, options?: JwtOptions | undefined): Promise<Jwk>;
//#endregion
//#region src/plugins/jwt/verify.d.ts
/**
 * Verify a JWT token using the JWKS public keys
 * Returns the payload if valid, null otherwise
 */
declare function verifyJWT<T extends JWTPayload = JWTPayload>(token: string, options?: JwtOptions): Promise<(T & Required<Pick<JWTPayload, "sub" | "aud">>) | null>;
//#endregion
//#region src/plugins/jwt/index.d.ts
declare const jwt: (options?: JwtOptions | undefined) => {
  id: "jwt";
  options: JwtOptions | undefined;
  endpoints: {
    getJwks: better_call211.StrictEndpoint<string, {
      method: "GET";
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      keys: {
                        type: string;
                        description: string;
                        items: {
                          type: string;
                          properties: {
                            kid: {
                              type: string;
                              description: string;
                            };
                            kty: {
                              type: string;
                              description: string;
                            };
                            alg: {
                              type: string;
                              description: string;
                            };
                            use: {
                              type: string;
                              description: string;
                              enum: string[];
                              nullable: boolean;
                            };
                            n: {
                              type: string;
                              description: string;
                              nullable: boolean;
                            };
                            e: {
                              type: string;
                              description: string;
                              nullable: boolean;
                            };
                            crv: {
                              type: string;
                              description: string;
                              nullable: boolean;
                            };
                            x: {
                              type: string;
                              description: string;
                              nullable: boolean;
                            };
                            y: {
                              type: string;
                              description: string;
                              nullable: boolean;
                            };
                          };
                          required: string[];
                        };
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
    }, JSONWebKeySet>;
    getToken: better_call211.StrictEndpoint<"/token", {
      method: "GET";
      requireHeaders: true;
      use: ((inputContext: better_call211.MiddlewareInputContext<better_call211.MiddlewareOptions>) => Promise<{
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
          operationId: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
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
      token: string;
    }>;
    signJWT: better_call211.StrictEndpoint<"/sign-jwt", {
      method: "POST";
      metadata: {
        SERVER_ONLY: true;
        $Infer: {
          body: {
            payload: JWTPayload;
            overrideOptions?: JwtOptions | undefined;
          };
        };
      };
      body: z.ZodObject<{
        payload: z.ZodRecord<z.ZodString, z.ZodAny>;
        overrideOptions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
      }, z.core.$strip>;
    } & {
      use: any[];
    }, {
      token: string;
    }>;
    verifyJWT: better_call211.StrictEndpoint<"/verify-jwt", {
      method: "POST";
      metadata: {
        SERVER_ONLY: true;
        $Infer: {
          body: {
            token: string;
            issuer?: string;
          };
          response: {
            payload: {
              sub: string;
              aud: string;
              [key: string]: any;
            } | null;
          };
        };
      };
      body: z.ZodObject<{
        token: z.ZodString;
        issuer: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>;
    } & {
      use: any[];
    }, {
      payload: (JWTPayload & Required<Pick<JWTPayload, "sub" | "aud">>) | null;
    }>;
  };
  hooks: {
    after: {
      matcher(context: _better_auth_core19.HookEndpointContext): boolean;
      handler: (inputContext: better_call211.MiddlewareInputContext<better_call211.MiddlewareOptions>) => Promise<void>;
    }[];
  };
  schema: {
    jwks: {
      fields: {
        publicKey: {
          type: "string";
          required: true;
        };
        privateKey: {
          type: "string";
          required: true;
        };
        createdAt: {
          type: "date";
          required: true;
        };
        expiresAt: {
          type: "date";
          required: false;
        };
      };
    };
  };
};
//#endregion
export { getJwtToken as a, Jwk as c, generateExportedKeyPair as i, JwtOptions as l, verifyJWT as n, JWKOptions as o, createJwk as r, JWSAlgorithms as s, jwt as t };