import * as _better_auth_core20 from "@better-auth/core";
import * as _better_auth_core_db3 from "@better-auth/core/db";
import * as better_call223 from "better-call";
import * as z from "zod";

//#region src/plugins/multi-session/index.d.ts
interface MultiSessionConfig {
  /**
   * The maximum number of sessions a user can have
   * at a time
   * @default 5
   */
  maximumSessions?: number | undefined;
}
declare const multiSession: (options?: MultiSessionConfig | undefined) => {
  id: "multi-session";
  endpoints: {
    /**
     * ### Endpoint
     *
     * GET `/multi-session/list-device-sessions`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.listDeviceSessions`
     *
     * **client:**
     * `authClient.multiSession.listDeviceSessions`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/multi-session#api-method-multi-session-list-device-sessions)
     */
    listDeviceSessions: better_call223.StrictEndpoint<"/multi-session/list-device-sessions", {
      method: "GET";
      requireHeaders: true;
    } & {
      use: any[];
    }, {
      session: _better_auth_core_db3.Session;
      user: _better_auth_core_db3.User;
    }[]>;
    /**
     * ### Endpoint
     *
     * POST `/multi-session/set-active`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.setActiveSession`
     *
     * **client:**
     * `authClient.multiSession.setActive`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/multi-session#api-method-multi-session-set-active)
     */
    setActiveSession: better_call223.StrictEndpoint<"/multi-session/set-active", {
      method: "POST";
      body: z.ZodObject<{
        sessionToken: z.ZodString;
      }, z.core.$strip>;
      requireHeaders: true;
      use: ((inputContext: better_call223.MiddlewareInputContext<better_call223.MiddlewareOptions>) => Promise<{
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
      session: _better_auth_core_db3.Session & Record<string, any>;
      user: _better_auth_core_db3.User & Record<string, any>;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/multi-session/revoke`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.revokeDeviceSession`
     *
     * **client:**
     * `authClient.multiSession.revoke`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/multi-session#api-method-multi-session-revoke)
     */
    revokeDeviceSession: better_call223.StrictEndpoint<"/multi-session/revoke", {
      method: "POST";
      body: z.ZodObject<{
        sessionToken: z.ZodString;
      }, z.core.$strip>;
      requireHeaders: true;
      use: ((inputContext: better_call223.MiddlewareInputContext<better_call223.MiddlewareOptions>) => Promise<{
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
  };
  hooks: {
    after: {
      matcher: (context: _better_auth_core20.HookEndpointContext) => boolean;
      handler: (inputContext: better_call223.MiddlewareInputContext<better_call223.MiddlewareOptions>) => Promise<void>;
    }[];
  };
  $ERROR_CODES: {
    readonly INVALID_SESSION_TOKEN: "Invalid session token";
  };
};
//#endregion
export { multiSession as t };