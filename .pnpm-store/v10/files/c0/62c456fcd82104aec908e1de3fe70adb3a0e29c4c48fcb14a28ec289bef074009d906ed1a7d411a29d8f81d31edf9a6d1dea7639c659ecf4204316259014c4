import { GenericEndpointContext } from "@better-auth/core";
import * as better_call219 from "better-call";
import * as z from "zod";

//#region src/plugins/magic-link/index.d.ts
interface MagicLinkOptions {
  /**
   * Time in seconds until the magic link expires.
   * @default (60 * 5) // 5 minutes
   */
  expiresIn?: number | undefined;
  /**
   * Send magic link implementation.
   */
  sendMagicLink: (data: {
    email: string;
    url: string;
    token: string;
  }, ctx?: GenericEndpointContext | undefined) => Promise<void> | void;
  /**
   * Disable sign up if user is not found.
   *
   * @default false
   */
  disableSignUp?: boolean | undefined;
  /**
   * Rate limit configuration.
   *
   * @default {
   *  window: 60,
   *  max: 5,
   * }
   */
  rateLimit?: {
    window: number;
    max: number;
  } | undefined;
  /**
   * Custom function to generate a token
   */
  generateToken?: ((email: string) => Promise<string> | string) | undefined;
  /**
   * This option allows you to configure how the token is stored in your database.
   * Note: This will not affect the token that's sent, it will only affect the token stored in your database.
   *
   * @default "plain"
   */
  storeToken?: ("plain" | "hashed" | {
    type: "custom-hasher";
    hash: (token: string) => Promise<string>;
  }) | undefined;
}
declare const magicLink: (options: MagicLinkOptions) => {
  id: "magic-link";
  endpoints: {
    /**
     * ### Endpoint
     *
     * POST `/sign-in/magic-link`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.signInMagicLink`
     *
     * **client:**
     * `authClient.signIn.magicLink`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/sign-in#api-method-sign-in-magic-link)
     */
    signInMagicLink: better_call219.StrictEndpoint<"/sign-in/magic-link", {
      method: "POST";
      requireHeaders: true;
      body: z.ZodObject<{
        email: z.ZodEmail;
        name: z.ZodOptional<z.ZodString>;
        callbackURL: z.ZodOptional<z.ZodString>;
        newUserCallbackURL: z.ZodOptional<z.ZodString>;
        errorCallbackURL: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>;
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
                      status: {
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
      status: boolean;
    }>;
    /**
     * ### Endpoint
     *
     * GET `/magic-link/verify`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.magicLinkVerify`
     *
     * **client:**
     * `authClient.magicLink.verify`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/magic-link#api-method-magic-link-verify)
     */
    magicLinkVerify: better_call219.StrictEndpoint<"/magic-link/verify", {
      method: "GET";
      query: z.ZodObject<{
        token: z.ZodString;
        callbackURL: z.ZodOptional<z.ZodString>;
        errorCallbackURL: z.ZodOptional<z.ZodString>;
        newUserCallbackURL: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>;
      use: ((inputContext: better_call219.MiddlewareInputContext<better_call219.MiddlewareOptions>) => Promise<void>)[];
      requireHeaders: true;
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
                      session: {
                        $ref: string;
                      };
                      user: {
                        $ref: string;
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
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        name: string;
        image: string | null | undefined;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
  };
  rateLimit: {
    pathMatcher(path: string): boolean;
    window: number;
    max: number;
  }[];
};
//#endregion
export { magicLink as n, MagicLinkOptions as t };