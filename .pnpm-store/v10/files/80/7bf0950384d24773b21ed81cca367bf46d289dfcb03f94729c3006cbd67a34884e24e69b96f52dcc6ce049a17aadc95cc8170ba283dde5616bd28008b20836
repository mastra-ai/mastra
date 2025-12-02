import { Un as InferAdditionalFieldsFromPluginOptions, _ as User$1, g as Session$1 } from "./index--CrC0_x3.mjs";
import { d as PrettifyDeep, o as LiteralString } from "./helper-DU33OcfW.mjs";
import { a as Role, c as Subset, i as AccessControl, o as Statements, t as AuthorizeResponse } from "./index-CNCxG_Zo.mjs";
import { t as InferOptionSchema } from "./plugins-Brc8BsoZ.mjs";
import * as _better_auth_core26 from "@better-auth/core";
import { AuthContext, BetterAuthOptions, GenericEndpointContext, HookEndpointContext } from "@better-auth/core";
import * as _better_auth_core_db20 from "@better-auth/core/db";
import { BetterAuthPluginDBSchema, DBFieldAttribute } from "@better-auth/core/db";
import * as better_call636 from "better-call";
import { Prettify } from "better-call";
import * as z from "zod";
import { AuthEndpoint, AuthMiddleware, createAuthEndpoint as createAuthEndpoint$1, createAuthMiddleware as createAuthMiddleware$1, optionsMiddleware } from "@better-auth/core/api";
import * as zod_v4_core231 from "zod/v4/core";

//#region src/plugins/admin/schema.d.ts
declare const schema$1: {
  user: {
    fields: {
      role: {
        type: "string";
        required: false;
        input: false;
      };
      banned: {
        type: "boolean";
        defaultValue: false;
        required: false;
        input: false;
      };
      banReason: {
        type: "string";
        required: false;
        input: false;
      };
      banExpires: {
        type: "date";
        required: false;
        input: false;
      };
    };
  };
  session: {
    fields: {
      impersonatedBy: {
        type: "string";
        required: false;
      };
    };
  };
};
type AdminSchema = typeof schema$1;
//#endregion
//#region src/plugins/admin/types.d.ts
interface UserWithRole extends User$1 {
  role?: string | undefined;
  banned: boolean | null;
  banReason?: (string | null) | undefined;
  banExpires?: (Date | null) | undefined;
}
interface SessionWithImpersonatedBy extends Session$1 {
  impersonatedBy?: string | undefined;
}
interface AdminOptions {
  /**
   * The default role for a user
   *
   * @default "user"
   */
  defaultRole?: string | undefined;
  /**
   * Roles that are considered admin roles.
   *
   * Any user role that isn't in this list, even if they have the permission,
   * will not be considered an admin.
   *
   * @default ["admin"]
   */
  adminRoles?: (string | string[]) | undefined;
  /**
   * A default ban reason
   *
   * By default, no reason is provided
   */
  defaultBanReason?: string | undefined;
  /**
   * Number of seconds until the ban expires
   *
   * By default, the ban never expires
   */
  defaultBanExpiresIn?: number | undefined;
  /**
   * Duration of the impersonation session in seconds
   *
   * By default, the impersonation session lasts 1 hour
   */
  impersonationSessionDuration?: number | undefined;
  /**
   * Custom schema for the admin plugin
   */
  schema?: InferOptionSchema<AdminSchema> | undefined;
  /**
   * Configure the roles and permissions for the admin
   * plugin.
   */
  ac?: AccessControl | undefined;
  /**
   * Custom permissions for roles.
   */
  roles?: { [key in string]?: Role } | undefined;
  /**
   * List of user ids that should have admin access
   *
   * If this is set, the `adminRole` option is ignored
   */
  adminUserIds?: string[] | undefined;
  /**
   * Message to show when a user is banned
   *
   * By default, the message is "You have been banned from this application"
   */
  bannedUserMessage?: string | undefined;
}
type InferAdminRolesFromOption<O extends AdminOptions | undefined> = O extends {
  roles: Record<string, unknown>;
} ? keyof O["roles"] : "user" | "admin";
//#endregion
//#region src/plugins/admin/admin.d.ts
declare const admin: <O extends AdminOptions>(options?: O | undefined) => {
  id: "admin";
  init(): {
    options: {
      databaseHooks: {
        user: {
          create: {
            before(user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & Record<string, unknown>): Promise<{
              data: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
                role: string;
              };
            }>;
          };
        };
        session: {
          create: {
            before(session: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              userId: string;
              expiresAt: Date;
              token: string;
              ipAddress?: string | null | undefined;
              userAgent?: string | null | undefined;
            } & Record<string, unknown>, ctx: _better_auth_core26.GenericEndpointContext | undefined): Promise<void>;
          };
        };
      };
    };
  };
  hooks: {
    after: {
      matcher(context: _better_auth_core26.HookEndpointContext): boolean;
      handler: (inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<SessionWithImpersonatedBy[] | undefined>;
    }[];
  };
  endpoints: {
    /**
     * ### Endpoint
     *
     * POST `/admin/set-role`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.setRole`
     *
     * **client:**
     * `authClient.admin.setRole`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-set-role)
     */
    setRole: better_call636.StrictEndpoint<"/admin/set-role", {
      method: "POST";
      body: z.ZodObject<{
        userId: z.ZodCoercedString<unknown>;
        role: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
      }, z.core.$strip>;
      requireHeaders: true;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
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
        $Infer: {
          body: {
            userId: string;
            role: InferAdminRolesFromOption<O> | InferAdminRolesFromOption<O>[];
          };
        };
      };
    } & {
      use: any[];
    }, {
      user: UserWithRole;
    }>;
    getUser: better_call636.StrictEndpoint<"/admin/get-user", {
      method: "GET";
      query: z.ZodObject<{
        id: z.ZodString;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
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
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image?: string | null | undefined;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/create-user`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.createUser`
     *
     * **client:**
     * `authClient.admin.createUser`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-create-user)
     */
    createUser: better_call636.StrictEndpoint<"/admin/create-user", {
      method: "POST";
      body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        name: z.ZodString;
        role: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
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
        $Infer: {
          body: {
            email: string;
            password: string;
            name: string;
            role?: (InferAdminRolesFromOption<O> | InferAdminRolesFromOption<O>[]) | undefined;
            data?: Record<string, any> | undefined;
          };
        };
      };
    } & {
      use: any[];
    }, {
      user: UserWithRole;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/update-user`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.adminUpdateUser`
     *
     * **client:**
     * `authClient.admin.updateUser`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-update-user)
     */
    adminUpdateUser: better_call636.StrictEndpoint<"/admin/update-user", {
      method: "POST";
      body: z.ZodObject<{
        userId: z.ZodCoercedString<unknown>;
        data: z.ZodRecord<z.ZodAny, z.ZodAny>;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
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
    }, UserWithRole>;
    listUsers: better_call636.StrictEndpoint<"/admin/list-users", {
      method: "GET";
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      query: z.ZodObject<{
        searchValue: z.ZodOptional<z.ZodString>;
        searchField: z.ZodOptional<z.ZodEnum<{
          name: "name";
          email: "email";
        }>>;
        searchOperator: z.ZodOptional<z.ZodEnum<{
          contains: "contains";
          starts_with: "starts_with";
          ends_with: "ends_with";
        }>>;
        limit: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        offset: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
        sortBy: z.ZodOptional<z.ZodString>;
        sortDirection: z.ZodOptional<z.ZodEnum<{
          asc: "asc";
          desc: "desc";
        }>>;
        filterField: z.ZodOptional<z.ZodString>;
        filterValue: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBoolean]>>;
        filterOperator: z.ZodOptional<z.ZodEnum<{
          eq: "eq";
          ne: "ne";
          lt: "lt";
          lte: "lte";
          gt: "gt";
          gte: "gte";
          contains: "contains";
        }>>;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      users: {
                        type: string;
                        items: {
                          $ref: string;
                        };
                      };
                      total: {
                        type: string;
                      };
                      limit: {
                        type: string;
                      };
                      offset: {
                        type: string;
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
      users: UserWithRole[];
      total: number;
      limit: number | undefined;
      offset: number | undefined;
    } | {
      users: never[];
      total: number;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/list-user-sessions`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.listUserSessions`
     *
     * **client:**
     * `authClient.admin.listUserSessions`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-list-user-sessions)
     */
    listUserSessions: better_call636.StrictEndpoint<"/admin/list-user-sessions", {
      method: "POST";
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      body: z.ZodObject<{
        userId: z.ZodCoercedString<unknown>;
      }, z.core.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      sessions: {
                        type: string;
                        items: {
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
      };
    } & {
      use: any[];
    }, {
      sessions: SessionWithImpersonatedBy[];
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/unban-user`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.unbanUser`
     *
     * **client:**
     * `authClient.admin.unbanUser`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-unban-user)
     */
    unbanUser: better_call636.StrictEndpoint<"/admin/unban-user", {
      method: "POST";
      body: z.ZodObject<{
        userId: z.ZodCoercedString<unknown>;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
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
      user: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & Record<string, any>;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/ban-user`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.banUser`
     *
     * **client:**
     * `authClient.admin.banUser`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-ban-user)
     */
    banUser: better_call636.StrictEndpoint<"/admin/ban-user", {
      method: "POST";
      body: z.ZodObject<{
        userId: z.ZodCoercedString<unknown>;
        banReason: z.ZodOptional<z.ZodString>;
        banExpiresIn: z.ZodOptional<z.ZodNumber>;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
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
      user: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & Record<string, any>;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/impersonate-user`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.impersonateUser`
     *
     * **client:**
     * `authClient.admin.impersonateUser`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-impersonate-user)
     */
    impersonateUser: better_call636.StrictEndpoint<"/admin/impersonate-user", {
      method: "POST";
      body: z.ZodObject<{
        userId: z.ZodCoercedString<unknown>;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
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
      session: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/stop-impersonating`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.stopImpersonating`
     *
     * **client:**
     * `authClient.admin.stopImpersonating`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-stop-impersonating)
     */
    stopImpersonating: better_call636.StrictEndpoint<"/admin/stop-impersonating", {
      method: "POST";
      requireHeaders: true;
    } & {
      use: any[];
    }, {
      session: Session$1 & Record<string, any>;
      user: _better_auth_core_db20.User & Record<string, any>;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/revoke-user-session`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.revokeUserSession`
     *
     * **client:**
     * `authClient.admin.revokeUserSession`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-revoke-user-session)
     */
    revokeUserSession: better_call636.StrictEndpoint<"/admin/revoke-user-session", {
      method: "POST";
      body: z.ZodObject<{
        sessionToken: z.ZodString;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
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
      success: boolean;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/revoke-user-sessions`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.revokeUserSessions`
     *
     * **client:**
     * `authClient.admin.revokeUserSessions`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-revoke-user-sessions)
     */
    revokeUserSessions: better_call636.StrictEndpoint<"/admin/revoke-user-sessions", {
      method: "POST";
      body: z.ZodObject<{
        userId: z.ZodCoercedString<unknown>;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
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
      success: boolean;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/remove-user`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.removeUser`
     *
     * **client:**
     * `authClient.admin.removeUser`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-remove-user)
     */
    removeUser: better_call636.StrictEndpoint<"/admin/remove-user", {
      method: "POST";
      body: z.ZodObject<{
        userId: z.ZodCoercedString<unknown>;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
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
      success: boolean;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/admin/set-user-password`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.setUserPassword`
     *
     * **client:**
     * `authClient.admin.setUserPassword`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-set-user-password)
     */
    setUserPassword: better_call636.StrictEndpoint<"/admin/set-user-password", {
      method: "POST";
      body: z.ZodObject<{
        newPassword: z.ZodString;
        userId: z.ZodCoercedString<unknown>;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        session: {
          user: UserWithRole;
          session: Session$1;
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          summary: string;
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
     * POST `/admin/has-permission`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.userHasPermission`
     *
     * **client:**
     * `authClient.admin.hasPermission`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/admin#api-method-admin-has-permission)
     */
    userHasPermission: better_call636.StrictEndpoint<"/admin/has-permission", {
      method: "POST";
      body: z.ZodIntersection<z.ZodObject<{
        userId: z.ZodOptional<z.ZodCoercedString<unknown>>;
        role: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>, z.ZodUnion<readonly [z.ZodObject<{
        permission: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
        permissions: z.ZodUndefined;
      }, z.core.$strip>, z.ZodObject<{
        permission: z.ZodUndefined;
        permissions: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
      }, z.core.$strip>]>>;
      metadata: {
        openapi: {
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    permission: {
                      type: string;
                      description: string;
                      deprecated: boolean;
                    };
                    permissions: {
                      type: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      error: {
                        type: string;
                      };
                      success: {
                        type: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
        $Infer: {
          body: ({
            /**
             * @deprecated Use `permissions` instead
             */
            permission: { [key in keyof (O["ac"] extends AccessControl<infer S extends Statements> ? S : {
              readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
              readonly session: readonly ["list", "revoke", "delete"];
            })]?: ((O["ac"] extends AccessControl<infer S extends Statements> ? S : {
              readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
              readonly session: readonly ["list", "revoke", "delete"];
            })[key] extends readonly unknown[] ? (O["ac"] extends AccessControl<infer S extends Statements> ? S : {
              readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
              readonly session: readonly ["list", "revoke", "delete"];
            })[key][number] : never)[] | undefined };
            permissions?: never | undefined;
          } | {
            permissions: { [key in keyof (O["ac"] extends AccessControl<infer S extends Statements> ? S : {
              readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
              readonly session: readonly ["list", "revoke", "delete"];
            })]?: ((O["ac"] extends AccessControl<infer S extends Statements> ? S : {
              readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
              readonly session: readonly ["list", "revoke", "delete"];
            })[key] extends readonly unknown[] ? (O["ac"] extends AccessControl<infer S extends Statements> ? S : {
              readonly user: readonly ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "get", "update"];
              readonly session: readonly ["list", "revoke", "delete"];
            })[key][number] : never)[] | undefined };
            permission?: never | undefined;
          }) & {
            userId?: string | undefined;
            role?: InferAdminRolesFromOption<O> | undefined;
          };
        };
      };
    } & {
      use: any[];
    }, {
      error: null;
      success: boolean;
    }>;
  };
  $ERROR_CODES: {
    readonly FAILED_TO_CREATE_USER: "Failed to create user";
    readonly USER_ALREADY_EXISTS: "User already exists.";
    readonly USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "User already exists. Use another email.";
    readonly YOU_CANNOT_BAN_YOURSELF: "You cannot ban yourself";
    readonly YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: "You are not allowed to change users role";
    readonly YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: "You are not allowed to create users";
    readonly YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: "You are not allowed to list users";
    readonly YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: "You are not allowed to list users sessions";
    readonly YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: "You are not allowed to ban users";
    readonly YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: "You are not allowed to impersonate users";
    readonly YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: "You are not allowed to revoke users sessions";
    readonly YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: "You are not allowed to delete users";
    readonly YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: "You are not allowed to set users password";
    readonly BANNED_USER: "You have been banned from this application";
    readonly YOU_ARE_NOT_ALLOWED_TO_GET_USER: "You are not allowed to get user";
    readonly NO_DATA_TO_UPDATE: "No data to update";
    readonly YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: "You are not allowed to update users";
    readonly YOU_CANNOT_REMOVE_YOURSELF: "You cannot remove yourself";
    readonly YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: "You are not allowed to set a non-existent role value";
  };
  schema: {
    user: {
      fields: {
        role: {
          type: "string";
          required: false;
          input: false;
        };
        banned: {
          type: "boolean";
          defaultValue: false;
          required: false;
          input: false;
        };
        banReason: {
          type: "string";
          required: false;
          input: false;
        };
        banExpires: {
          type: "date";
          required: false;
          input: false;
        };
      };
    };
    session: {
      fields: {
        impersonatedBy: {
          type: "string";
          required: false;
        };
      };
    };
  };
  options: any;
};
//#endregion
//#region src/plugins/api-key/schema.d.ts
declare const apiKeySchema: ({
  timeWindow,
  rateLimitMax
}: {
  timeWindow: number;
  rateLimitMax: number;
}) => {
  apikey: {
    fields: {
      /**
       * The name of the key.
       */
      name: {
        type: "string";
        required: false;
        input: false;
      };
      /**
       * Shows the first few characters of the API key
       * This allows you to show those few characters in the UI to make it easier for users to identify the API key.
       */
      start: {
        type: "string";
        required: false;
        input: false;
      };
      /**
       * The prefix of the key.
       */
      prefix: {
        type: "string";
        required: false;
        input: false;
      };
      /**
       * The hashed key value.
       */
      key: {
        type: "string";
        required: true;
        input: false;
        index: true;
      };
      /**
       * The user id of the user who created the key.
       */
      userId: {
        type: "string";
        references: {
          model: string;
          field: string;
          onDelete: "cascade";
        };
        required: true;
        input: false;
        index: true;
      };
      /**
       * The interval to refill the key in milliseconds.
       */
      refillInterval: {
        type: "number";
        required: false;
        input: false;
      };
      /**
       * The amount to refill the remaining count of the key.
       */
      refillAmount: {
        type: "number";
        required: false;
        input: false;
      };
      /**
       * The date and time when the key was last refilled.
       */
      lastRefillAt: {
        type: "date";
        required: false;
        input: false;
      };
      /**
       * Whether the key is enabled.
       */
      enabled: {
        type: "boolean";
        required: false;
        input: false;
        defaultValue: true;
      };
      /**
       * Whether the key has rate limiting enabled.
       */
      rateLimitEnabled: {
        type: "boolean";
        required: false;
        input: false;
        defaultValue: true;
      };
      /**
       * The time window in milliseconds for the rate limit.
       */
      rateLimitTimeWindow: {
        type: "number";
        required: false;
        input: false;
        defaultValue: number;
      };
      /**
       * The maximum number of requests allowed within the `rateLimitTimeWindow`.
       */
      rateLimitMax: {
        type: "number";
        required: false;
        input: false;
        defaultValue: number;
      };
      /**
       * The number of requests made within the rate limit time window
       */
      requestCount: {
        type: "number";
        required: false;
        input: false;
        defaultValue: number;
      };
      /**
       * The remaining number of requests before the key is revoked.
       *
       * If this is null, then the key is not revoked.
       *
       * If `refillInterval` & `refillAmount` are provided, than this will refill accordingly.
       */
      remaining: {
        type: "number";
        required: false;
        input: false;
      };
      /**
       * The date and time of the last request made to the key.
       */
      lastRequest: {
        type: "date";
        required: false;
        input: false;
      };
      /**
       * The date and time when the key will expire.
       */
      expiresAt: {
        type: "date";
        required: false;
        input: false;
      };
      /**
       * The date and time when the key was created.
       */
      createdAt: {
        type: "date";
        required: true;
        input: false;
      };
      /**
       * The date and time when the key was last updated.
       */
      updatedAt: {
        type: "date";
        required: true;
        input: false;
      };
      /**
       * The permissions of the key.
       */
      permissions: {
        type: "string";
        required: false;
        input: false;
      };
      /**
       * Any additional metadata you want to store with the key.
       */
      metadata: {
        type: "string";
        required: false;
        input: true;
        transform: {
          input(value: _better_auth_core_db20.DBPrimitive): string;
          output(value: _better_auth_core_db20.DBPrimitive): any;
        };
      };
    };
  };
};
//#endregion
//#region src/plugins/api-key/types.d.ts
interface ApiKeyOptions {
  /**
   * The header name to check for API key
   * @default "x-api-key"
   */
  apiKeyHeaders?: (string | string[]) | undefined;
  /**
   * Disable hashing of the API key.
   *
   * ⚠️ Security Warning: It's strongly recommended to not disable hashing.
   * Storing API keys in plaintext makes them vulnerable to database breaches, potentially exposing all your users' API keys.
   *
   * @default false
   */
  disableKeyHashing?: boolean | undefined;
  /**
   * The function to get the API key from the context
   */
  customAPIKeyGetter?: ((ctx: HookEndpointContext) => string | null) | undefined;
  /**
   * A custom function to validate the API key
   */
  customAPIKeyValidator?: ((options: {
    ctx: GenericEndpointContext;
    key: string;
  }) => boolean | Promise<boolean>) | undefined;
  /**
   * custom key generation function
   */
  customKeyGenerator?: (options: {
    /**
     * The length of the API key to generate
     */
    length: number;
    /**
     * The prefix of the API key to generate
     */
    prefix: string | undefined;
  }) => string | Promise<string>;
  /**
   * The configuration for storing the starting characters of the API key in the database.
   *
   * Useful if you want to display the starting characters of an API key in the UI.
   */
  startingCharactersConfig?: {
    /**
     * Whether to store the starting characters in the database. If false, we will set `start` to `null`.
     *
     * @default true
     */
    shouldStore?: boolean;
    /**
     * The length of the starting characters to store in the database.
     *
     * This includes the prefix length.
     *
     * @default 6
     */
    charactersLength?: number;
  } | undefined;
  /**
   * The length of the API key. Longer is better. Default is 64. (Doesn't include the prefix length)
   * @default 64
   */
  defaultKeyLength?: number | undefined;
  /**
   * The prefix of the API key.
   *
   * Note: We recommend you append an underscore to the prefix to make the prefix more identifiable. (eg `hello_`)
   */
  defaultPrefix?: string | undefined;
  /**
   * The maximum length of the prefix.
   *
   * @default 32
   */
  maximumPrefixLength?: number | undefined;
  /**
   * Whether to require a name for the API key.
   *
   * @default false
   */
  requireName?: boolean | undefined;
  /**
   * The minimum length of the prefix.
   *
   * @default 1
   */
  minimumPrefixLength?: number | undefined;
  /**
   * The maximum length of the name.
   *
   * @default 32
   */
  maximumNameLength?: number | undefined;
  /**
   * The minimum length of the name.
   *
   * @default 1
   */
  minimumNameLength?: number | undefined;
  /**
   * Whether to enable metadata for an API key.
   *
   * @default false
   */
  enableMetadata?: boolean | undefined;
  /**
   * Customize the key expiration.
   */
  keyExpiration?: {
    /**
     * The default expires time in milliseconds.
     *
     * If `null`, then there will be no expiration time.
     *
     * @default null
     */
    defaultExpiresIn?: number | null;
    /**
     * Whether to disable the expires time passed from the client.
     *
     * If `true`, the expires time will be based on the default values.
     *
     * @default false
     */
    disableCustomExpiresTime?: boolean;
    /**
     * The minimum expiresIn value allowed to be set from the client. in days.
     *
     * @default 1
     */
    minExpiresIn?: number;
    /**
     * The maximum expiresIn value allowed to be set from the client. in days.
     *
     * @default 365
     */
    maxExpiresIn?: number;
  } | undefined;
  /**
   * Default rate limiting options.
   */
  rateLimit?: {
    /**
     * Whether to enable rate limiting.
     *
     * @default true
     */
    enabled?: boolean;
    /**
     * The duration in milliseconds where each request is counted.
     *
     * Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset.
     *
     * @default 1000 * 60 * 60 * 24 // 1 day
     */
    timeWindow?: number;
    /**
     * Maximum amount of requests allowed within a window
     *
     * Once the `maxRequests` is reached, the request will be rejected until the `timeWindow` has passed, at which point the `timeWindow` will be reset.
     *
     * @default 10 // 10 requests per day
     */
    maxRequests?: number;
  } | undefined;
  /**
   * custom schema for the API key plugin
   */
  schema?: InferOptionSchema<ReturnType<typeof apiKeySchema>> | undefined;
  /**
   * An API Key can represent a valid session, so we automatically mock a session for the user if we find a valid API key in the request headers.
   *
   * ⚠︎ This is not recommended for production use, as it can lead to security issues.
   * @default false
   */
  enableSessionForAPIKeys?: boolean | undefined;
  /**
   * Permissions for the API key.
   */
  permissions?: {
    /**
     * The default permissions for the API key.
     */
    defaultPermissions?: Statements | ((userId: string, ctx: GenericEndpointContext) => Statements | Promise<Statements>);
  } | undefined;
  /**
   * Storage backend for API keys.
   *
   * - `"database"`: Store API keys in the database adapter (default)
   * - `"secondary-storage"`: Store API keys in the configured secondary storage (e.g., Redis)
   *
   * @default "database"
   */
  storage?: "database" | "secondary-storage" | undefined;
  /**
   * When `storage` is `"secondary-storage"`, enable fallback to database if key is not found in secondary storage.
   *
   * Useful for gradual migration from database to secondary storage.
   *
   * @default false
   */
  fallbackToDatabase?: boolean | undefined;
  /**
   * Custom storage methods for API keys.
   *
   * If provided, these methods will be used instead of `ctx.context.secondaryStorage`.
   * Custom methods take precedence over global secondary storage.
   *
   * Useful when you want to use a different storage backend specifically for API keys,
   * or when you need custom logic for storage operations.
   */
  customStorage?: {
    /**
     * Get a value from storage
     */
    get: (key: string) => Promise<unknown> | unknown;
    /**
     * Set a value in storage
     */
    set: (key: string, value: string, ttl?: number | undefined) => Promise<void | null | unknown> | void;
    /**
     * Delete a value from storage
     */
    delete: (key: string) => Promise<void | null | string> | void;
  } | undefined;
}
type ApiKey = {
  /**
   * ID
   */
  id: string;
  /**
   * The name of the key
   */
  name: string | null;
  /**
   * Shows the first few characters of the API key, including the prefix.
   * This allows you to show those few characters in the UI to make it easier for users to identify the API key.
   */
  start: string | null;
  /**
   * The API Key prefix. Stored as plain text.
   */
  prefix: string | null;
  /**
   * The hashed API key value
   */
  key: string;
  /**
   * The owner of the user id
   */
  userId: string;
  /**
   * The interval in milliseconds between refills of the `remaining` count
   *
   * @example 3600000 // refill every hour (3600000ms = 1h)
   */
  refillInterval: number | null;
  /**
   * The amount to refill
   */
  refillAmount: number | null;
  /**
   * The last refill date
   */
  lastRefillAt: Date | null;
  /**
   * Sets if key is enabled or disabled
   *
   * @default true
   */
  enabled: boolean;
  /**
   * Whether the key has rate limiting enabled.
   */
  rateLimitEnabled: boolean;
  /**
   * The duration in milliseconds
   */
  rateLimitTimeWindow: number | null;
  /**
   * Maximum amount of requests allowed within a window
   */
  rateLimitMax: number | null;
  /**
   * The number of requests made within the rate limit time window
   */
  requestCount: number;
  /**
   * Remaining requests (every time API key is used this should updated and should be updated on refill as well)
   */
  remaining: number | null;
  /**
   * When last request occurred
   */
  lastRequest: Date | null;
  /**
   * Expiry date of a key
   */
  expiresAt: Date | null;
  /**
   * created at
   */
  createdAt: Date;
  /**
   * updated at
   */
  updatedAt: Date;
  /**
   * Extra metadata about the apiKey
   */
  metadata: Record<string, any> | null;
  /**
   * Permissions for the API key
   */
  permissions?: ({
    [key: string]: string[];
  } | null) | undefined;
};
//#endregion
//#region src/plugins/api-key/index.d.ts
declare const defaultKeyHasher: (key: string) => Promise<string>;
declare const ERROR_CODES: {
  readonly INVALID_METADATA_TYPE: "metadata must be an object or undefined";
  readonly REFILL_AMOUNT_AND_INTERVAL_REQUIRED: "refillAmount is required when refillInterval is provided";
  readonly REFILL_INTERVAL_AND_AMOUNT_REQUIRED: "refillInterval is required when refillAmount is provided";
  readonly USER_BANNED: "User is banned";
  readonly UNAUTHORIZED_SESSION: "Unauthorized or invalid session";
  readonly KEY_NOT_FOUND: "API Key not found";
  readonly KEY_DISABLED: "API Key is disabled";
  readonly KEY_EXPIRED: "API Key has expired";
  readonly USAGE_EXCEEDED: "API Key has reached its usage limit";
  readonly KEY_NOT_RECOVERABLE: "API Key is not recoverable";
  readonly EXPIRES_IN_IS_TOO_SMALL: "The expiresIn is smaller than the predefined minimum value.";
  readonly EXPIRES_IN_IS_TOO_LARGE: "The expiresIn is larger than the predefined maximum value.";
  readonly INVALID_REMAINING: "The remaining count is either too large or too small.";
  readonly INVALID_PREFIX_LENGTH: "The prefix length is either too large or too small.";
  readonly INVALID_NAME_LENGTH: "The name length is either too large or too small.";
  readonly METADATA_DISABLED: "Metadata is disabled.";
  readonly RATE_LIMIT_EXCEEDED: "Rate limit exceeded.";
  readonly NO_VALUES_TO_UPDATE: "No values to update.";
  readonly KEY_DISABLED_EXPIRATION: "Custom key expiration values are disabled.";
  readonly INVALID_API_KEY: "Invalid API key.";
  readonly INVALID_USER_ID_FROM_API_KEY: "The user id from the API key is invalid.";
  readonly INVALID_API_KEY_GETTER_RETURN_TYPE: "API Key getter returned an invalid key type. Expected string.";
  readonly SERVER_ONLY_PROPERTY: "The property you're trying to set can only be set from the server auth instance only.";
  readonly FAILED_TO_UPDATE_API_KEY: "Failed to update API key";
  readonly NAME_REQUIRED: "API Key name is required.";
};
declare const API_KEY_TABLE_NAME = "apikey";
declare const apiKey: (options?: ApiKeyOptions | undefined) => {
  id: "api-key";
  $ERROR_CODES: {
    readonly INVALID_METADATA_TYPE: "metadata must be an object or undefined";
    readonly REFILL_AMOUNT_AND_INTERVAL_REQUIRED: "refillAmount is required when refillInterval is provided";
    readonly REFILL_INTERVAL_AND_AMOUNT_REQUIRED: "refillInterval is required when refillAmount is provided";
    readonly USER_BANNED: "User is banned";
    readonly UNAUTHORIZED_SESSION: "Unauthorized or invalid session";
    readonly KEY_NOT_FOUND: "API Key not found";
    readonly KEY_DISABLED: "API Key is disabled";
    readonly KEY_EXPIRED: "API Key has expired";
    readonly USAGE_EXCEEDED: "API Key has reached its usage limit";
    readonly KEY_NOT_RECOVERABLE: "API Key is not recoverable";
    readonly EXPIRES_IN_IS_TOO_SMALL: "The expiresIn is smaller than the predefined minimum value.";
    readonly EXPIRES_IN_IS_TOO_LARGE: "The expiresIn is larger than the predefined maximum value.";
    readonly INVALID_REMAINING: "The remaining count is either too large or too small.";
    readonly INVALID_PREFIX_LENGTH: "The prefix length is either too large or too small.";
    readonly INVALID_NAME_LENGTH: "The name length is either too large or too small.";
    readonly METADATA_DISABLED: "Metadata is disabled.";
    readonly RATE_LIMIT_EXCEEDED: "Rate limit exceeded.";
    readonly NO_VALUES_TO_UPDATE: "No values to update.";
    readonly KEY_DISABLED_EXPIRATION: "Custom key expiration values are disabled.";
    readonly INVALID_API_KEY: "Invalid API key.";
    readonly INVALID_USER_ID_FROM_API_KEY: "The user id from the API key is invalid.";
    readonly INVALID_API_KEY_GETTER_RETURN_TYPE: "API Key getter returned an invalid key type. Expected string.";
    readonly SERVER_ONLY_PROPERTY: "The property you're trying to set can only be set from the server auth instance only.";
    readonly FAILED_TO_UPDATE_API_KEY: "Failed to update API key";
    readonly NAME_REQUIRED: "API Key name is required.";
  };
  hooks: {
    before: {
      matcher: (ctx: _better_auth_core26.HookEndpointContext) => boolean;
      handler: (inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
        user: {
          id: string;
          createdAt: Date;
          updatedAt: Date;
          email: string;
          emailVerified: boolean;
          name: string;
          image?: string | null | undefined;
        };
        session: {
          id: string;
          token: string;
          userId: string;
          userAgent: string | null;
          ipAddress: string | null;
          createdAt: Date;
          updatedAt: Date;
          expiresAt: Date;
        };
      } | {
        context: better_call636.MiddlewareContext<better_call636.MiddlewareOptions, _better_auth_core26.AuthContext & {
          returned?: unknown | undefined;
          responseHeaders?: Headers | undefined;
        }>;
      }>;
    }[];
  };
  endpoints: {
    /**
     * ### Endpoint
     *
     * POST `/api-key/create`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.createApiKey`
     *
     * **client:**
     * `authClient.apiKey.create`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/api-key#api-method-api-key-create)
     */
    createApiKey: better_call636.StrictEndpoint<"/api-key/create", {
      method: "POST";
      body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        expiresIn: z.ZodDefault<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
        userId: z.ZodOptional<z.ZodCoercedString<unknown>>;
        prefix: z.ZodOptional<z.ZodString>;
        remaining: z.ZodDefault<z.ZodNullable<z.ZodOptional<z.ZodNumber>>>;
        metadata: z.ZodOptional<z.ZodAny>;
        refillAmount: z.ZodOptional<z.ZodNumber>;
        refillInterval: z.ZodOptional<z.ZodNumber>;
        rateLimitTimeWindow: z.ZodOptional<z.ZodNumber>;
        rateLimitMax: z.ZodOptional<z.ZodNumber>;
        rateLimitEnabled: z.ZodOptional<z.ZodBoolean>;
        permissions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
      }, zod_v4_core231.$strip>;
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
                      id: {
                        type: string;
                        description: string;
                      };
                      createdAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      updatedAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      name: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      prefix: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      start: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      key: {
                        type: string;
                        description: string;
                      };
                      enabled: {
                        type: string;
                        description: string;
                      };
                      expiresAt: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      userId: {
                        type: string;
                        description: string;
                      };
                      lastRefillAt: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      lastRequest: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      metadata: {
                        type: string;
                        nullable: boolean;
                        additionalProperties: boolean;
                        description: string;
                      };
                      rateLimitMax: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      rateLimitTimeWindow: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      remaining: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      refillAmount: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      refillInterval: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      rateLimitEnabled: {
                        type: string;
                        description: string;
                      };
                      requestCount: {
                        type: string;
                        description: string;
                      };
                      permissions: {
                        type: string;
                        nullable: boolean;
                        additionalProperties: {
                          type: string;
                          items: {
                            type: string;
                          };
                        };
                        description: string;
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
      key: string;
      metadata: any;
      permissions: any;
      id: string;
      name: string | null;
      start: string | null;
      prefix: string | null;
      userId: string;
      refillInterval: number | null;
      refillAmount: number | null;
      lastRefillAt: Date | null;
      enabled: boolean;
      rateLimitEnabled: boolean;
      rateLimitTimeWindow: number | null;
      rateLimitMax: number | null;
      requestCount: number;
      remaining: number | null;
      lastRequest: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/api-key/verify`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.verifyApiKey`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/api-key#api-method-api-key-verify)
     */
    verifyApiKey: better_call636.StrictEndpoint<"/api-key/verify", {
      method: "POST";
      body: z.ZodObject<{
        key: z.ZodString;
        permissions: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
      }, zod_v4_core231.$strip>;
      metadata: {
        SERVER_ONLY: true;
      };
    } & {
      use: any[];
    }, {
      valid: boolean;
      error: {
        message: string | undefined;
        code: string;
      };
      key: null;
    } | {
      valid: boolean;
      error: null;
      key: Omit<ApiKey, "key"> | null;
    }>;
    /**
     * ### Endpoint
     *
     * GET `/api-key/get`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.getApiKey`
     *
     * **client:**
     * `authClient.apiKey.get`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/api-key#api-method-api-key-get)
     */
    getApiKey: better_call636.StrictEndpoint<"/api-key/get", {
      method: "GET";
      query: z.ZodObject<{
        id: z.ZodString;
      }, zod_v4_core231.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
                      id: {
                        type: string;
                        description: string;
                      };
                      name: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      start: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      prefix: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      userId: {
                        type: string;
                        description: string;
                      };
                      refillInterval: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      refillAmount: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      lastRefillAt: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      enabled: {
                        type: string;
                        description: string;
                        default: boolean;
                      };
                      rateLimitEnabled: {
                        type: string;
                        description: string;
                      };
                      rateLimitTimeWindow: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      rateLimitMax: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      requestCount: {
                        type: string;
                        description: string;
                      };
                      remaining: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      lastRequest: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      expiresAt: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      createdAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      updatedAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      metadata: {
                        type: string;
                        nullable: boolean;
                        additionalProperties: boolean;
                        description: string;
                      };
                      permissions: {
                        type: string;
                        nullable: boolean;
                        description: string;
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
      permissions: {
        [key: string]: string[];
      } | null;
      id: string;
      name: string | null;
      start: string | null;
      prefix: string | null;
      userId: string;
      refillInterval: number | null;
      refillAmount: number | null;
      lastRefillAt: Date | null;
      enabled: boolean;
      rateLimitEnabled: boolean;
      rateLimitTimeWindow: number | null;
      rateLimitMax: number | null;
      requestCount: number;
      remaining: number | null;
      lastRequest: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      metadata: Record<string, any> | null;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/api-key/update`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.updateApiKey`
     *
     * **client:**
     * `authClient.apiKey.update`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/api-key#api-method-api-key-update)
     */
    updateApiKey: better_call636.StrictEndpoint<"/api-key/update", {
      method: "POST";
      body: z.ZodObject<{
        keyId: z.ZodString;
        userId: z.ZodOptional<z.ZodCoercedString<unknown>>;
        name: z.ZodOptional<z.ZodString>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        remaining: z.ZodOptional<z.ZodNumber>;
        refillAmount: z.ZodOptional<z.ZodNumber>;
        refillInterval: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodAny>;
        expiresIn: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        rateLimitEnabled: z.ZodOptional<z.ZodBoolean>;
        rateLimitTimeWindow: z.ZodOptional<z.ZodNumber>;
        rateLimitMax: z.ZodOptional<z.ZodNumber>;
        permissions: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>>;
      }, zod_v4_core231.$strip>;
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
                      id: {
                        type: string;
                        description: string;
                      };
                      name: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      start: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      prefix: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      userId: {
                        type: string;
                        description: string;
                      };
                      refillInterval: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      refillAmount: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      lastRefillAt: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      enabled: {
                        type: string;
                        description: string;
                        default: boolean;
                      };
                      rateLimitEnabled: {
                        type: string;
                        description: string;
                      };
                      rateLimitTimeWindow: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      rateLimitMax: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      requestCount: {
                        type: string;
                        description: string;
                      };
                      remaining: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      lastRequest: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      expiresAt: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      createdAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      updatedAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      metadata: {
                        type: string;
                        nullable: boolean;
                        additionalProperties: boolean;
                        description: string;
                      };
                      permissions: {
                        type: string;
                        nullable: boolean;
                        description: string;
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
      permissions: {
        [key: string]: string[];
      } | null;
      id: string;
      name: string | null;
      start: string | null;
      prefix: string | null;
      userId: string;
      refillInterval: number | null;
      refillAmount: number | null;
      lastRefillAt: Date | null;
      enabled: boolean;
      rateLimitEnabled: boolean;
      rateLimitTimeWindow: number | null;
      rateLimitMax: number | null;
      requestCount: number;
      remaining: number | null;
      lastRequest: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      metadata: Record<string, any> | null;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/api-key/delete`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.deleteApiKey`
     *
     * **client:**
     * `authClient.apiKey.delete`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/api-key#api-method-api-key-delete)
     */
    deleteApiKey: better_call636.StrictEndpoint<"/api-key/delete", {
      method: "POST";
      body: z.ZodObject<{
        keyId: z.ZodString;
      }, zod_v4_core231.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    keyId: {
                      type: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
                        type: string;
                        description: string;
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
      success: boolean;
    }>;
    /**
     * ### Endpoint
     *
     * GET `/api-key/list`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.listApiKeys`
     *
     * **client:**
     * `authClient.apiKey.list`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/api-key#api-method-api-key-list)
     */
    listApiKeys: better_call636.StrictEndpoint<"/api-key/list", {
      method: "GET";
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
                    type: "array";
                    items: {
                      type: string;
                      properties: {
                        id: {
                          type: string;
                          description: string;
                        };
                        name: {
                          type: string;
                          nullable: boolean;
                          description: string;
                        };
                        start: {
                          type: string;
                          nullable: boolean;
                          description: string;
                        };
                        prefix: {
                          type: string;
                          nullable: boolean;
                          description: string;
                        };
                        userId: {
                          type: string;
                          description: string;
                        };
                        refillInterval: {
                          type: string;
                          nullable: boolean;
                          description: string;
                        };
                        refillAmount: {
                          type: string;
                          nullable: boolean;
                          description: string;
                        };
                        lastRefillAt: {
                          type: string;
                          format: string;
                          nullable: boolean;
                          description: string;
                        };
                        enabled: {
                          type: string;
                          description: string;
                          default: boolean;
                        };
                        rateLimitEnabled: {
                          type: string;
                          description: string;
                        };
                        rateLimitTimeWindow: {
                          type: string;
                          nullable: boolean;
                          description: string;
                        };
                        rateLimitMax: {
                          type: string;
                          nullable: boolean;
                          description: string;
                        };
                        requestCount: {
                          type: string;
                          description: string;
                        };
                        remaining: {
                          type: string;
                          nullable: boolean;
                          description: string;
                        };
                        lastRequest: {
                          type: string;
                          format: string;
                          nullable: boolean;
                          description: string;
                        };
                        expiresAt: {
                          type: string;
                          format: string;
                          nullable: boolean;
                          description: string;
                        };
                        createdAt: {
                          type: string;
                          format: string;
                          description: string;
                        };
                        updatedAt: {
                          type: string;
                          format: string;
                          description: string;
                        };
                        metadata: {
                          type: string;
                          nullable: boolean;
                          additionalProperties: boolean;
                          description: string;
                        };
                        permissions: {
                          type: string;
                          nullable: boolean;
                          description: string;
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
      };
    } & {
      use: any[];
    }, {
      permissions: {
        [key: string]: string[];
      } | null;
      id: string;
      name: string | null;
      start: string | null;
      prefix: string | null;
      userId: string;
      refillInterval: number | null;
      refillAmount: number | null;
      lastRefillAt: Date | null;
      enabled: boolean;
      rateLimitEnabled: boolean;
      rateLimitTimeWindow: number | null;
      rateLimitMax: number | null;
      requestCount: number;
      remaining: number | null;
      lastRequest: Date | null;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      metadata: Record<string, any> | null;
    }[]>;
    /**
     * ### Endpoint
     *
     * POST `/api-key/delete-all-expired-api-keys`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.deleteAllExpiredApiKeys`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/api-key#api-method-api-key-delete-all-expired-api-keys)
     */
    deleteAllExpiredApiKeys: better_call636.StrictEndpoint<"/api-key/delete-all-expired-api-keys", {
      method: "POST";
      metadata: {
        SERVER_ONLY: true;
        client: boolean;
      };
    } & {
      use: any[];
    }, {
      success: boolean;
      error: unknown;
    }>;
  };
  schema: {
    apikey: {
      fields: {
        name: {
          type: "string";
          required: false;
          input: false;
        };
        start: {
          type: "string";
          required: false;
          input: false;
        };
        prefix: {
          type: "string";
          required: false;
          input: false;
        };
        key: {
          type: "string";
          required: true;
          input: false;
          index: true;
        };
        userId: {
          type: "string";
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          required: true;
          input: false;
          index: true;
        };
        refillInterval: {
          type: "number";
          required: false;
          input: false;
        };
        refillAmount: {
          type: "number";
          required: false;
          input: false;
        };
        lastRefillAt: {
          type: "date";
          required: false;
          input: false;
        };
        enabled: {
          type: "boolean";
          required: false;
          input: false;
          defaultValue: true;
        };
        rateLimitEnabled: {
          type: "boolean";
          required: false;
          input: false;
          defaultValue: true;
        };
        rateLimitTimeWindow: {
          type: "number";
          required: false;
          input: false;
          defaultValue: number;
        };
        rateLimitMax: {
          type: "number";
          required: false;
          input: false;
          defaultValue: number;
        };
        requestCount: {
          type: "number";
          required: false;
          input: false;
          defaultValue: number;
        };
        remaining: {
          type: "number";
          required: false;
          input: false;
        };
        lastRequest: {
          type: "date";
          required: false;
          input: false;
        };
        expiresAt: {
          type: "date";
          required: false;
          input: false;
        };
        createdAt: {
          type: "date";
          required: true;
          input: false;
        };
        updatedAt: {
          type: "date";
          required: true;
          input: false;
        };
        permissions: {
          type: "string";
          required: false;
          input: false;
        };
        metadata: {
          type: "string";
          required: false;
          input: true;
          transform: {
            input(value: _better_auth_core_db20.DBPrimitive): string;
            output(value: _better_auth_core_db20.DBPrimitive): any;
          };
        };
      };
    };
  };
};
//#endregion
//#region src/plugins/last-login-method/index.d.ts
/**
 * Configuration for tracking different authentication methods
 */
interface LastLoginMethodOptions {
  /**
   * Name of the cookie to store the last login method
   * @default "better-auth.last_used_login_method"
   */
  cookieName?: string | undefined;
  /**
   * Cookie expiration time in seconds
   * @default 2592000 (30 days)
   */
  maxAge?: number | undefined;
  /**
   * Custom method to resolve the last login method
   * @param ctx - The context from the hook
   * @returns The last login method
   */
  customResolveMethod?: ((ctx: GenericEndpointContext) => string | null) | undefined;
  /**
   * Store the last login method in the database. This will create a new field in the user table.
   * @default false
   */
  storeInDatabase?: boolean | undefined;
  /**
   * Custom schema for the plugin
   * @default undefined
   */
  schema?: {
    user?: {
      lastLoginMethod?: string;
    };
  } | undefined;
}
/**
 * Plugin to track the last used login method
 */
declare const lastLoginMethod: <O extends LastLoginMethodOptions>(userConfig?: O | undefined) => {
  id: "last-login-method";
  init(ctx: _better_auth_core26.AuthContext): {
    options: {
      databaseHooks: {
        user: {
          create: {
            before(user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & Record<string, unknown>, context: GenericEndpointContext | undefined): Promise<{
              data: {
                lastLoginMethod: any;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
              };
            } | undefined>;
          };
        };
        session: {
          create: {
            after(session: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              userId: string;
              expiresAt: Date;
              token: string;
              ipAddress?: string | null | undefined;
              userAgent?: string | null | undefined;
            } & Record<string, unknown>, context: GenericEndpointContext | undefined): Promise<void>;
          };
        };
      };
    };
  };
  hooks: {
    after: {
      matcher(): true;
      handler: (inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<void>;
    }[];
  };
  schema: O["storeInDatabase"] extends true ? {
    user: {
      fields: {
        lastLoginMethod: {
          type: "string";
          required: false;
          input: false;
        };
      };
    };
  } : undefined;
};
//#endregion
//#region src/plugins/oidc-provider/schema.d.ts
declare const oAuthApplicationSchema: z.ZodObject<{
  clientId: z.ZodString;
  clientSecret: z.ZodOptional<z.ZodString>;
  type: z.ZodEnum<{
    public: "public";
    web: "web";
    native: "native";
    "user-agent-based": "user-agent-based";
  }>;
  name: z.ZodString;
  icon: z.ZodOptional<z.ZodString>;
  metadata: z.ZodOptional<z.ZodString>;
  disabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
  redirectUrls: z.ZodString;
  userId: z.ZodOptional<z.ZodString>;
  createdAt: z.ZodDate;
  updatedAt: z.ZodDate;
}, z.core.$strip>;
type OAuthApplication = z.infer<typeof oAuthApplicationSchema>;
declare const schema: {
  oauthApplication: {
    modelName: string;
    fields: {
      name: {
        type: "string";
      };
      icon: {
        type: "string";
        required: false;
      };
      metadata: {
        type: "string";
        required: false;
      };
      clientId: {
        type: "string";
        unique: true;
      };
      clientSecret: {
        type: "string";
        required: false;
      };
      redirectUrls: {
        type: "string";
      };
      type: {
        type: "string";
      };
      disabled: {
        type: "boolean";
        required: false;
        defaultValue: false;
      };
      userId: {
        type: "string";
        required: false;
        references: {
          model: string;
          field: string;
          onDelete: "cascade";
        };
        index: true;
      };
      createdAt: {
        type: "date";
      };
      updatedAt: {
        type: "date";
      };
    };
  };
  oauthAccessToken: {
    modelName: string;
    fields: {
      accessToken: {
        type: "string";
        unique: true;
      };
      refreshToken: {
        type: "string";
        unique: true;
      };
      accessTokenExpiresAt: {
        type: "date";
      };
      refreshTokenExpiresAt: {
        type: "date";
      };
      clientId: {
        type: "string";
        references: {
          model: string;
          field: string;
          onDelete: "cascade";
        };
        index: true;
      };
      userId: {
        type: "string";
        required: false;
        references: {
          model: string;
          field: string;
          onDelete: "cascade";
        };
        index: true;
      };
      scopes: {
        type: "string";
      };
      createdAt: {
        type: "date";
      };
      updatedAt: {
        type: "date";
      };
    };
  };
  oauthConsent: {
    modelName: string;
    fields: {
      clientId: {
        type: "string";
        references: {
          model: string;
          field: string;
          onDelete: "cascade";
        };
        index: true;
      };
      userId: {
        type: "string";
        references: {
          model: string;
          field: string;
          onDelete: "cascade";
        };
        index: true;
      };
      scopes: {
        type: "string";
      };
      createdAt: {
        type: "date";
      };
      updatedAt: {
        type: "date";
      };
      consentGiven: {
        type: "boolean";
      };
    };
  };
};
//#endregion
//#region src/plugins/oidc-provider/types.d.ts
interface OIDCOptions {
  /**
   * The amount of time in seconds that the access token is valid for.
   *
   * @default 3600 (1 hour) - Recommended by the OIDC spec
   */
  accessTokenExpiresIn?: number | undefined;
  /**
   * Allow dynamic client registration.
   */
  allowDynamicClientRegistration?: boolean | undefined;
  /**
   * The metadata for the OpenID Connect provider.
   */
  metadata?: Partial<OIDCMetadata> | undefined;
  /**
   * The amount of time in seconds that the refresh token is valid for.
   *
   * @default 604800 (7 days) - Recommended by the OIDC spec
   */
  refreshTokenExpiresIn?: number | undefined;
  /**
   * The amount of time in seconds that the authorization code is valid for.
   *
   * @default 600 (10 minutes) - Recommended by the OIDC spec
   */
  codeExpiresIn?: number | undefined;
  /**
   * The scopes that the client is allowed to request.
   *
   * @see https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims
   * @default
   * ```ts
   * ["openid", "profile", "email", "offline_access"]
   * ```
   */
  scopes?: string[] | undefined;
  /**
   * The default scope to use if the client does not provide one.
   *
   * @default "openid"
   */
  defaultScope?: string | undefined;
  /**
   * A URL to the consent page where the user will be redirected if the client
   * requests consent.
   *
   * After the user consents, they should be redirected by the client to the
   * `redirect_uri` with the authorization code.
   *
   * When the server redirects the user to the consent page, it will include the
   * following query parameters:
   * - `consent_code` - The consent code to identify the authorization request.
   * - `client_id` - The ID of the client.
   * - `scope` - The requested scopes.
   *
   * Once the user consents, you need to call the `/oauth2/consent` endpoint
   * with `accept: true` and optionally the `consent_code` (if using URL parameter flow)
   * to complete the authorization. This will return the client to the `redirect_uri`
   * with the authorization code.
   *
   * @example
   * ```ts
   * consentPage: "/oauth/authorize"
   * ```
   */
  consentPage?: string | undefined;
  /**
   * The HTML for the consent page. This is used if `consentPage` is not
   * provided. This should be a function that returns an HTML string.
   * The function will be called with the following props:
   */
  getConsentHTML?: ((props: {
    clientId: string;
    clientName: string;
    clientIcon?: string;
    clientMetadata: Record<string, any> | null;
    code: string;
    scopes: string[];
  }) => string) | undefined;
  /**
   * The URL to the login page. This is used if the client requests the `login`
   * prompt.
   */
  loginPage: string;
  /**
   * Whether to require PKCE (proof key code exchange) or not
   *
   * According to OAuth2.1 spec this should be required. But in any
   * case if you want to disable this you can use this options.
   *
   * @default true
   */
  requirePKCE?: boolean | undefined;
  /**
   * Allow plain to be used as a code challenge method.
   *
   * @default true
   */
  allowPlainCodeChallengeMethod?: boolean | undefined;
  /**
   * Custom function to generate a client ID.
   */
  generateClientId?: (() => string) | undefined;
  /**
   * Custom function to generate a client secret.
   */
  generateClientSecret?: (() => string) | undefined;
  /**
   * Get the additional user info claims
   *
   * This applies to the `userinfo` endpoint and the `id_token`.
   *
   * @param user - The user object.
   * @param scopes - The scopes that the client requested.
   * @param client - The client object.
   * @returns The user info claim.
   */
  getAdditionalUserInfoClaim?: ((user: User$1 & Record<string, any>, scopes: string[], client: Client) => Record<string, any> | Promise<Record<string, any>>) | undefined;
  /**
   * Trusted clients that are configured directly in the provider options.
   * These clients bypass database lookups and can optionally skip consent screens.
   */
  trustedClients?: Client[] | undefined;
  /**
   * Store the client secret in your database in a secure way
   * Note: This will not affect the client secret sent to the user, it will only affect the client secret stored in your database
   *
   * - "hashed" - The client secret is hashed using the `hash` function.
   * - "plain" - The client secret is stored in the database in plain text.
   * - "encrypted" - The client secret is encrypted using the `encrypt` function.
   * - { hash: (clientSecret: string) => Promise<string> } - A function that hashes the client secret.
   * - { encrypt: (clientSecret: string) => Promise<string>, decrypt: (clientSecret: string) => Promise<string> } - A function that encrypts and decrypts the client secret.
   *
   * @default "plain"
   */
  storeClientSecret?: ("hashed" | "plain" | "encrypted" | {
    hash: (clientSecret: string) => Promise<string>;
  } | {
    encrypt: (clientSecret: string) => Promise<string>;
    decrypt: (clientSecret: string) => Promise<string>;
  }) | undefined;
  /**
   * Whether to use the JWT plugin to sign the ID token.
   *
   * @default false
   */
  useJWTPlugin?: boolean | undefined;
  /**
   * Custom schema for the OIDC plugin
   */
  schema?: InferOptionSchema<typeof schema> | undefined;
}
interface AuthorizationQuery {
  /**
   * The response type. Must be 'code' or 'token'. Code is for authorization code flow, token is
   * for implicit flow.
   */
  response_type: "code" | "token";
  /**
   * The redirect URI for the client. Must be one of the registered redirect URLs for the client.
   */
  redirect_uri?: string | undefined;
  /**
   * The scope of the request. Must be a space-separated list of case sensitive strings.
   *
   * - "openid" is required for all requests
   * - "profile" is required for requests that require user profile information.
   * - "email" is required for requests that require user email information.
   * - "offline_access" is required for requests that require a refresh token.
   */
  scope?: string | undefined;
  /**
   * Opaque value used to maintain state between the request and the callback. Typically,
   * Cross-Site Request Forgery (CSRF, XSRF) mitigation is done by cryptographically binding the
   * value of this parameter with a browser cookie.
   *
   * Note: Better Auth stores the state in a database instead of a cookie. - This is to minimize
   * the complication with native apps and other clients that may not have access to cookies.
   */
  state: string;
  /**
   * The client ID. Must be the ID of a registered client.
   */
  client_id: string;
  /**
   * The prompt parameter is used to specify the type of user interaction that is required.
   */
  prompt?: (string & {}) | ("none" | "consent" | "login" | "select_account") | undefined;
  /**
   * The display parameter is used to specify how the authorization server displays the
   * authentication and consent user interface pages to the end user.
   */
  display?: ("page" | "popup" | "touch" | "wap") | undefined;
  /**
   * End-User's preferred languages and scripts for the user interface, represented as a
   * space-separated list of BCP47 [RFC5646] language tag values, ordered by preference. For
   * instance, the value "fr-CA fr en" represents a preference for French as spoken in Canada,
   * then French (without a region designation), followed by English (without a region
   * designation).
   *
   * Better Auth does not support this parameter yet. It'll not throw an error if it's provided,
   *
   * 🏗️ currently not implemented
   */
  ui_locales?: string | undefined;
  /**
   * The maximum authentication age.
   *
   * Specifies the allowable elapsed time in seconds since the last time the End-User was
   * actively authenticated by the provider. If the elapsed time is greater than this value, the
   * provider MUST attempt to actively re-authenticate the End-User.
   *
   * Note that max_age=0 is equivalent to prompt=login.
   */
  max_age?: number | undefined;
  /**
   * Requested Authentication Context Class Reference values.
   *
   * Space-separated string that
   * specifies the acr values that the Authorization Server is being requested to use for
   * processing this Authentication Request, with the values appearing in order of preference.
   * The Authentication Context Class satisfied by the authentication performed is returned as
   * the acr Claim Value, as specified in Section 2. The acr Claim is requested as a Voluntary
   * Claim by this parameter.
   */
  acr_values?: string | undefined;
  /**
   * Hint to the Authorization Server about the login identifier the End-User might use to log in
   * (if necessary). This hint can be used by an RP if it first asks the End-User for their
   * e-mail address (or other identifier) and then wants to pass that value as a hint to the
   * discovered authorization service. It is RECOMMENDED that the hint value match the value used
   * for discovery. This value MAY also be a phone number in the format specified for the
   * phone_number Claim. The use of this parameter is left to the OP's discretion.
   */
  login_hint?: string | undefined;
  /**
   * ID Token previously issued by the Authorization Server being passed as a hint about the
   * End-User's current or past authenticated session with the Client.
   *
   * 🏗️ currently not implemented
   */
  id_token_hint?: string | undefined;
  /**
   * Code challenge
   */
  code_challenge?: string | undefined;
  /**
   * Code challenge method used
   */
  code_challenge_method?: ("plain" | "s256") | undefined;
  /**
   * String value used to associate a Client session with an ID Token, and to mitigate replay
   * attacks. The value is passed through unmodified from the Authentication Request to the ID Token.
   * If present in the ID Token, Clients MUST verify that the nonce Claim Value is equal to the
   * value of the nonce parameter sent in the Authentication Request. If present in the
   * Authentication Request, Authorization Servers MUST include a nonce Claim in the ID Token
   * with the Claim Value being the nonce value sent in the Authentication Request.
   */
  nonce?: string | undefined;
}
type Client = Omit<OAuthApplication, "metadata" | "updatedAt" | "createdAt" | "redirectUrls" | "userId"> & {
  metadata: Record<string, any> | null;
  /**
   * List of registered redirect URLs. Must include the whole URL, including the protocol, port,
   * and path.
   *
   * For example, `https://example.com/auth/callback`
   */
  redirectUrls: string[];
  /**
   * Whether to skip the consent screen for this client.
   * Only applies to trusted clients.
   */
  skipConsent?: boolean | undefined;
};
interface TokenBody {
  /**
   * The grant type. Must be 'authorization_code' or 'refresh_token'.
   */
  grant_type: "authorization_code" | "refresh_token";
  /**
   * The authorization code received from the authorization server.
   */
  code?: string | undefined;
  /**
   * The redirect URI of the client.
   */
  redirect_uri?: string | undefined;
  /**
   * The client ID.
   */
  client_id?: string | undefined;
  /**
   * The client secret.
   */
  client_secret?: string | undefined;
  /**
   * The refresh token received from the authorization server.
   */
  refresh_token?: string | undefined;
}
interface CodeVerificationValue {
  /**
   * The client ID
   */
  clientId: string;
  /**
   * The redirect URI for the client
   */
  redirectURI: string;
  /**
   * The scopes that the client requested
   */
  scope: string[];
  /**
   * The user ID
   */
  userId: string;
  /**
   * The time that the user authenticated
   */
  authTime: number;
  /**
   * Whether the user needs to consent to the scopes
   * before the code can be exchanged for an access token.
   *
   * If this is true, then the code is treated as a consent
   * request. Once the user consents, the code will be updated
   * with the actual code.
   */
  requireConsent: boolean;
  /**
   * The state parameter from the request
   *
   * If the prompt is set to `consent`, then the state
   * parameter is saved here. This is to prevent the client
   * from using the code before the user consents.
   */
  state: string | null;
  /**
   * Code challenge
   */
  codeChallenge?: string | undefined;
  /**
   * Code Challenge Method
   */
  codeChallengeMethod?: ("sha256" | "plain") | undefined;
  /**
   * Nonce
   */
  nonce?: string | undefined;
}
interface OAuthAccessToken {
  /**
   * The access token
   */
  accessToken: string;
  /**
   * The refresh token
   */
  refreshToken: string;
  /**
   * The time that the access token expires
   */
  accessTokenExpiresAt: Date;
  /**
   * The time that the refresh token expires
   */
  refreshTokenExpiresAt: Date;
  /**
   * The client ID
   */
  clientId: string;
  /**
   * The user ID
   */
  userId: string;
  /**
   * The scopes that the access token has access to
   */
  scopes: string;
}
interface OIDCMetadata {
  /**
   * The issuer identifier, this is the URL of the provider and can be used to verify
   * the `iss` claim in the ID token.
   *
   * default: the base URL of the server (e.g. `https://example.com`)
   */
  issuer: string;
  /**
   * The URL of the authorization endpoint.
   *
   * @default `/oauth2/authorize`
   */
  authorization_endpoint: string;
  /**
   * The URL of the token endpoint.
   *
   * @default `/oauth2/token`
   */
  token_endpoint: string;
  /**
   * The URL of the userinfo endpoint.
   *
   * @default `/oauth2/userinfo`
   */
  userinfo_endpoint: string;
  /**
   * The URL of the jwks_uri endpoint.
   *
   * For JWKS to work, you must install the `jwt` plugin.
   *
   * This value is automatically set to `/jwks` if the `jwt` plugin is installed.
   *
   * @default `/jwks`
   */
  jwks_uri: string;
  /**
   * The URL of the dynamic client registration endpoint.
   *
   * @default `/oauth2/register`
   */
  registration_endpoint: string;
  /**
   * Supported scopes.
   */
  scopes_supported: string[];
  /**
   * Supported response types.
   *
   * only `code` is supported.
   */
  response_types_supported: ["code"];
  /**
   * Supported response modes.
   *
   * `query`: the authorization code is returned in the query string
   *
   * only `query` is supported.
   */
  response_modes_supported: ["query"];
  /**
   * Supported grant types.
   *
   * The first element MUST be "authorization_code"; additional grant types like
   * "refresh_token" can follow. Guarantees a non-empty array at the type level.
   */
  grant_types_supported: ["authorization_code", ...("authorization_code" | "refresh_token")[]];
  /**
   * acr_values supported.
   *
   * - `urn:mace:incommon:iap:silver`: Silver level of assurance
   * - `urn:mace:incommon:iap:bronze`: Bronze level of assurance
   *
   * only `urn:mace:incommon:iap:silver` and `urn:mace:incommon:iap:bronze` are supported.
   *
   *
   * @default
   * ["urn:mace:incommon:iap:silver", "urn:mace:incommon:iap:bronze"]
   * @see https://incommon.org/federation/attributes.html
   */
  acr_values_supported: string[];
  /**
   * Supported subject types.
   *
   * pairwise: the subject identifier is unique to the client
   * public: the subject identifier is unique to the server
   *
   * only `public` is supported.
   */
  subject_types_supported: ["public"];
  /**
   * Supported ID token signing algorithms.
   */
  id_token_signing_alg_values_supported: string[];
  /**
   * Supported token endpoint authentication methods.
   *
   * only `client_secret_basic` and `client_secret_post` are supported.
   *
   * @default
   * ["client_secret_basic", "client_secret_post"]
   */
  token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"];
  /**
   * Supported claims.
   *
   * @default
   * ["sub", "iss", "aud", "exp", "nbf", "iat", "jti", "email", "email_verified", "name"]
   */
  claims_supported: string[];
  /**
   * Supported code challenge methods.
   *
   * only `S256` is supported.
   *
   * @default ["S256"]
   */
  code_challenge_methods_supported: ["S256"];
  /**
   * The URL of the RP-initiated logout endpoint.
   *
   * @default `/oauth2/endsession`
   */
  end_session_endpoint?: string;
}
//#endregion
//#region src/plugins/oidc-provider/index.d.ts
/**
 * Get a client by ID, checking trusted clients first, then database
 */
declare function getClient(clientId: string, trustedClients?: (Client & {
  skipConsent?: boolean | undefined;
})[]): Promise<(Client & {
  skipConsent?: boolean | undefined;
}) | null>;
declare const getMetadata: (ctx: GenericEndpointContext, options?: OIDCOptions | undefined) => OIDCMetadata;
/**
 * OpenID Connect (OIDC) plugin for Better Auth. This plugin implements the
 * authorization code flow and the token exchange flow. It also implements the
 * userinfo endpoint.
 *
 * @param options - The options for the OIDC plugin.
 * @returns A Better Auth plugin.
 */
declare const oidcProvider: (options: OIDCOptions) => {
  id: "oidc";
  hooks: {
    after: {
      matcher(): true;
      handler: (inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<Response | {
        redirect: boolean;
        url: string;
      } | undefined>;
    }[];
  };
  endpoints: {
    getOpenIdConfig: better_call636.StrictEndpoint<"/.well-known/openid-configuration", {
      method: "GET";
      operationId: string;
      metadata: {
        isAction: false;
      };
    } & {
      use: any[];
    }, OIDCMetadata>;
    oAuth2authorize: better_call636.StrictEndpoint<"/oauth2/authorize", {
      method: "GET";
      operationId: string;
      query: z.ZodRecord<z.ZodString, z.ZodAny>;
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
                    additionalProperties: boolean;
                    description: string;
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, Response | {
      redirect: boolean;
      url: string;
    }>;
    oAuthConsent: better_call636.StrictEndpoint<"/oauth2/consent", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        accept: z.ZodBoolean;
        consent_code: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
          requestBody: {
            required: boolean;
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    accept: {
                      type: string;
                      description: string;
                    };
                    consent_code: {
                      type: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      redirectURI: {
                        type: string;
                        format: string;
                        description: string;
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
      redirectURI: string;
    }>;
    oAuth2token: better_call636.StrictEndpoint<"/oauth2/token", {
      method: "POST";
      operationId: string;
      body: z.ZodRecord<z.ZodAny, z.ZodAny>;
      metadata: {
        isAction: false;
        allowedMediaTypes: string[];
      };
    } & {
      use: any[];
    }, {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
      scope: string;
    } | {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string | undefined;
      scope: string;
      id_token: string | undefined;
    }>;
    oAuth2userInfo: better_call636.StrictEndpoint<"/oauth2/userinfo", {
      method: "GET";
      operationId: string;
      metadata: {
        isAction: false;
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
                      sub: {
                        type: string;
                        description: string;
                      };
                      email: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      name: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      picture: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      given_name: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      family_name: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      email_verified: {
                        type: string;
                        nullable: boolean;
                        description: string;
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
      sub: string;
      email: string | undefined;
      name: string | undefined;
      picture: string | null | undefined;
      given_name: string | undefined;
      family_name: string | undefined;
      email_verified: boolean | undefined;
    } | {
      sub: string;
      email: string | undefined;
      name: string | undefined;
      picture: string | null | undefined;
      given_name: string | undefined;
      family_name: string | undefined;
      email_verified: boolean | undefined;
    }>;
    /**
     * ### Endpoint
     *
     * POST `/oauth2/register`
     *
     * ### API Methods
     *
     * **server:**
     * `auth.api.registerOAuthApplication`
     *
     * **client:**
     * `authClient.oauth2.register`
     *
     * @see [Read our docs to learn more.](https://better-auth.com/docs/plugins/oidc-provider#api-method-oauth2-register)
     */
    registerOAuthApplication: better_call636.StrictEndpoint<"/oauth2/register", {
      method: "POST";
      body: z.ZodObject<{
        redirect_uris: z.ZodArray<z.ZodString>;
        token_endpoint_auth_method: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
          none: "none";
          client_secret_basic: "client_secret_basic";
          client_secret_post: "client_secret_post";
        }>>>;
        grant_types: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodEnum<{
          password: "password";
          authorization_code: "authorization_code";
          refresh_token: "refresh_token";
          implicit: "implicit";
          client_credentials: "client_credentials";
          "urn:ietf:params:oauth:grant-type:jwt-bearer": "urn:ietf:params:oauth:grant-type:jwt-bearer";
          "urn:ietf:params:oauth:grant-type:saml2-bearer": "urn:ietf:params:oauth:grant-type:saml2-bearer";
        }>>>>;
        response_types: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodEnum<{
          token: "token";
          code: "code";
        }>>>>;
        client_name: z.ZodOptional<z.ZodString>;
        client_uri: z.ZodOptional<z.ZodString>;
        logo_uri: z.ZodOptional<z.ZodString>;
        scope: z.ZodOptional<z.ZodString>;
        contacts: z.ZodOptional<z.ZodArray<z.ZodString>>;
        tos_uri: z.ZodOptional<z.ZodString>;
        policy_uri: z.ZodOptional<z.ZodString>;
        jwks_uri: z.ZodOptional<z.ZodString>;
        jwks: z.ZodOptional<z.ZodRecord<z.ZodAny, z.ZodAny>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodAny, z.ZodAny>>;
        software_id: z.ZodOptional<z.ZodString>;
        software_version: z.ZodOptional<z.ZodString>;
        software_statement: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>;
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
                      name: {
                        type: string;
                        description: string;
                      };
                      icon: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      metadata: {
                        type: string;
                        additionalProperties: boolean;
                        nullable: boolean;
                        description: string;
                      };
                      clientId: {
                        type: string;
                        description: string;
                      };
                      clientSecret: {
                        type: string;
                        description: string;
                      };
                      redirectURLs: {
                        type: string;
                        items: {
                          type: string;
                          format: string;
                        };
                        description: string;
                      };
                      type: {
                        type: string;
                        description: string;
                        enum: string[];
                      };
                      authenticationScheme: {
                        type: string;
                        description: string;
                        enum: string[];
                      };
                      disabled: {
                        type: string;
                        description: string;
                        enum: boolean[];
                      };
                      userId: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      createdAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      updatedAt: {
                        type: string;
                        format: string;
                        description: string;
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
      client_id_issued_at: number;
      client_secret_expires_at: number;
      redirect_uris: string[];
      token_endpoint_auth_method: "none" | "client_secret_basic" | "client_secret_post";
      grant_types: string[];
      response_types: string[];
      client_name: string | undefined;
      client_uri: string | undefined;
      logo_uri: string | undefined;
      scope: string | undefined;
      contacts: string[] | undefined;
      tos_uri: string | undefined;
      policy_uri: string | undefined;
      jwks_uri: string | undefined;
      jwks: Record<any, any> | undefined;
      software_id: string | undefined;
      software_version: string | undefined;
      software_statement: string | undefined;
      metadata: Record<any, any> | undefined;
      client_secret?: string | undefined;
      client_id: string;
    }>;
    getOAuthClient: better_call636.StrictEndpoint<"/oauth2/client/:id", {
      method: "GET";
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
                      clientId: {
                        type: string;
                        description: string;
                      };
                      name: {
                        type: string;
                        description: string;
                      };
                      icon: {
                        type: string;
                        nullable: boolean;
                        description: string;
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
      clientId: string;
      name: string;
      icon: string | null;
    }>;
    /**
     * ### Endpoint
     *
     * GET/POST `/oauth2/endsession`
     *
     * Implements RP-Initiated Logout as per OpenID Connect RP-Initiated Logout 1.0.
     * Allows relying parties to request that an OpenID Provider log out the end-user.
     *
     * @see [OpenID Connect RP-Initiated Logout Spec](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)
     */
    endSession: better_call636.StrictEndpoint<"/oauth2/endsession", {
      method: ("GET" | "POST")[];
      operationId: string;
      query: z.ZodOptional<z.ZodObject<{
        id_token_hint: z.ZodOptional<z.ZodString>;
        logout_hint: z.ZodOptional<z.ZodString>;
        client_id: z.ZodOptional<z.ZodString>;
        post_logout_redirect_uri: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        ui_locales: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>>;
      metadata: {
        isAction: false;
        openapi: {
          description: string;
          parameters: ({
            name: string;
            in: "query";
            description: string;
            required: false;
            schema: {
              type: "string";
              format?: undefined;
            };
          } | {
            name: string;
            in: "query";
            description: string;
            required: false;
            schema: {
              type: "string";
              format: string;
            };
          })[];
          responses: {
            "302": {
              description: string;
            };
            "200": {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: ("OK" | "CREATED" | "ACCEPTED" | "NO_CONTENT" | "MULTIPLE_CHOICES" | "MOVED_PERMANENTLY" | "FOUND" | "SEE_OTHER" | "NOT_MODIFIED" | "TEMPORARY_REDIRECT" | "BAD_REQUEST" | "UNAUTHORIZED" | "PAYMENT_REQUIRED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "NOT_ACCEPTABLE" | "PROXY_AUTHENTICATION_REQUIRED" | "REQUEST_TIMEOUT" | "CONFLICT" | "GONE" | "LENGTH_REQUIRED" | "PRECONDITION_FAILED" | "PAYLOAD_TOO_LARGE" | "URI_TOO_LONG" | "UNSUPPORTED_MEDIA_TYPE" | "RANGE_NOT_SATISFIABLE" | "EXPECTATION_FAILED" | "I'M_A_TEAPOT" | "MISDIRECTED_REQUEST" | "UNPROCESSABLE_ENTITY" | "LOCKED" | "FAILED_DEPENDENCY" | "TOO_EARLY" | "UPGRADE_REQUIRED" | "PRECONDITION_REQUIRED" | "TOO_MANY_REQUESTS" | "REQUEST_HEADER_FIELDS_TOO_LARGE" | "UNAVAILABLE_FOR_LEGAL_REASONS" | "INTERNAL_SERVER_ERROR" | "NOT_IMPLEMENTED" | "BAD_GATEWAY" | "SERVICE_UNAVAILABLE" | "GATEWAY_TIMEOUT" | "HTTP_VERSION_NOT_SUPPORTED" | "VARIANT_ALSO_NEGOTIATES" | "INSUFFICIENT_STORAGE" | "LOOP_DETECTED" | "NOT_EXTENDED" | "NETWORK_AUTHENTICATION_REQUIRED") | better_call636.Status;
      body: ({
        message?: string;
        code?: string;
        cause?: unknown;
      } & Record<string, any>) | undefined;
      headers: HeadersInit;
      statusCode: number;
      name: string;
      message: string;
      stack?: string;
      cause?: unknown;
    } | {
      success: boolean;
      message: string;
    }>;
  };
  schema: {
    oauthApplication: {
      modelName: string;
      fields: {
        name: {
          type: "string";
        };
        icon: {
          type: "string";
          required: false;
        };
        metadata: {
          type: "string";
          required: false;
        };
        clientId: {
          type: "string";
          unique: true;
        };
        clientSecret: {
          type: "string";
          required: false;
        };
        redirectUrls: {
          type: "string";
        };
        type: {
          type: "string";
        };
        disabled: {
          type: "boolean";
          required: false;
          defaultValue: false;
        };
        userId: {
          type: "string";
          required: false;
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        createdAt: {
          type: "date";
        };
        updatedAt: {
          type: "date";
        };
      };
    };
    oauthAccessToken: {
      modelName: string;
      fields: {
        accessToken: {
          type: "string";
          unique: true;
        };
        refreshToken: {
          type: "string";
          unique: true;
        };
        accessTokenExpiresAt: {
          type: "date";
        };
        refreshTokenExpiresAt: {
          type: "date";
        };
        clientId: {
          type: "string";
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        userId: {
          type: "string";
          required: false;
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        scopes: {
          type: "string";
        };
        createdAt: {
          type: "date";
        };
        updatedAt: {
          type: "date";
        };
      };
    };
    oauthConsent: {
      modelName: string;
      fields: {
        clientId: {
          type: "string";
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        userId: {
          type: "string";
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        scopes: {
          type: "string";
        };
        createdAt: {
          type: "date";
        };
        updatedAt: {
          type: "date";
        };
        consentGiven: {
          type: "boolean";
        };
      };
    };
  };
  readonly options: {
    scopes: string[];
    accessTokenExpiresIn: number;
    allowDynamicClientRegistration?: boolean | undefined;
    metadata?: Partial<OIDCMetadata> | undefined;
    refreshTokenExpiresIn: number;
    codeExpiresIn: number;
    defaultScope: string;
    consentPage?: string | undefined;
    getConsentHTML?: ((props: {
      clientId: string;
      clientName: string;
      clientIcon?: string;
      clientMetadata: Record<string, any> | null;
      code: string;
      scopes: string[];
    }) => string) | undefined;
    loginPage: string;
    requirePKCE?: boolean | undefined;
    allowPlainCodeChallengeMethod: boolean;
    generateClientId?: (() => string) | undefined;
    generateClientSecret?: (() => string) | undefined;
    getAdditionalUserInfoClaim?: ((user: _better_auth_core_db20.User & Record<string, any>, scopes: string[], client: Client) => Record<string, any> | Promise<Record<string, any>>) | undefined;
    trustedClients?: Client[] | undefined;
    storeClientSecret: "hashed" | "plain" | "encrypted" | {
      hash: (clientSecret: string) => Promise<string>;
    } | {
      encrypt: (clientSecret: string) => Promise<string>;
      decrypt: (clientSecret: string) => Promise<string>;
    };
    useJWTPlugin?: boolean | undefined;
    schema?: InferOptionSchema<typeof schema> | undefined;
  };
};
//#endregion
//#region src/plugins/mcp/index.d.ts
interface MCPOptions {
  loginPage: string;
  resource?: string | undefined;
  oidcConfig?: OIDCOptions | undefined;
}
declare const getMCPProviderMetadata: (ctx: GenericEndpointContext, options?: OIDCOptions | undefined) => OIDCMetadata;
declare const getMCPProtectedResourceMetadata: (ctx: GenericEndpointContext, options?: MCPOptions | undefined) => {
  resource: string;
  authorization_servers: string[];
  jwks_uri: string;
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_signing_alg_values_supported: string[];
};
declare const mcp: (options: MCPOptions) => {
  id: "mcp";
  hooks: {
    after: {
      matcher(): true;
      handler: (inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<void>;
    }[];
  };
  endpoints: {
    oAuthConsent: better_call636.StrictEndpoint<"/oauth2/consent", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        accept: z.ZodBoolean;
        consent_code: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
      }, z.core.$strip>;
      use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
          requestBody: {
            required: boolean;
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    accept: {
                      type: string;
                      description: string;
                    };
                    consent_code: {
                      type: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      redirectURI: {
                        type: string;
                        format: string;
                        description: string;
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
      redirectURI: string;
    }>;
    getMcpOAuthConfig: better_call636.StrictEndpoint<"/.well-known/oauth-authorization-server", {
      method: "GET";
      metadata: {
        client: boolean;
      };
    } & {
      use: any[];
    }, OIDCMetadata | null>;
    getMCPProtectedResource: better_call636.StrictEndpoint<"/.well-known/oauth-protected-resource", {
      method: "GET";
      metadata: {
        client: boolean;
      };
    } & {
      use: any[];
    }, {
      resource: string;
      authorization_servers: string[];
      jwks_uri: string;
      scopes_supported: string[];
      bearer_methods_supported: string[];
      resource_signing_alg_values_supported: string[];
    }>;
    mcpOAuthAuthorize: better_call636.StrictEndpoint<"/mcp/authorize", {
      method: "GET";
      query: z.ZodRecord<z.ZodString, z.ZodAny>;
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
                    additionalProperties: boolean;
                    description: string;
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
    mcpOAuthToken: better_call636.StrictEndpoint<"/mcp/token", {
      method: "POST";
      body: z.ZodRecord<z.ZodAny, z.ZodAny>;
      metadata: {
        isAction: false;
        allowedMediaTypes: string[];
      };
    } & {
      use: any[];
    }, {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string;
      scope: string;
    } | {
      access_token: string;
      token_type: string;
      expires_in: number;
      refresh_token: string | undefined;
      scope: string;
      id_token: string | undefined;
    }>;
    registerMcpClient: better_call636.StrictEndpoint<"/mcp/register", {
      method: "POST";
      body: z.ZodObject<{
        redirect_uris: z.ZodArray<z.ZodString>;
        token_endpoint_auth_method: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
          none: "none";
          client_secret_basic: "client_secret_basic";
          client_secret_post: "client_secret_post";
        }>>>;
        grant_types: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodEnum<{
          password: "password";
          authorization_code: "authorization_code";
          refresh_token: "refresh_token";
          implicit: "implicit";
          client_credentials: "client_credentials";
          "urn:ietf:params:oauth:grant-type:jwt-bearer": "urn:ietf:params:oauth:grant-type:jwt-bearer";
          "urn:ietf:params:oauth:grant-type:saml2-bearer": "urn:ietf:params:oauth:grant-type:saml2-bearer";
        }>>>>;
        response_types: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodEnum<{
          token: "token";
          code: "code";
        }>>>>;
        client_name: z.ZodOptional<z.ZodString>;
        client_uri: z.ZodOptional<z.ZodString>;
        logo_uri: z.ZodOptional<z.ZodString>;
        scope: z.ZodOptional<z.ZodString>;
        contacts: z.ZodOptional<z.ZodArray<z.ZodString>>;
        tos_uri: z.ZodOptional<z.ZodString>;
        policy_uri: z.ZodOptional<z.ZodString>;
        jwks_uri: z.ZodOptional<z.ZodString>;
        jwks: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodAny, z.ZodAny>>;
        software_id: z.ZodOptional<z.ZodString>;
        software_version: z.ZodOptional<z.ZodString>;
        software_statement: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>;
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
                      name: {
                        type: string;
                        description: string;
                      };
                      icon: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      metadata: {
                        type: string;
                        additionalProperties: boolean;
                        nullable: boolean;
                        description: string;
                      };
                      clientId: {
                        type: string;
                        description: string;
                      };
                      clientSecret: {
                        type: string;
                        description: string;
                      };
                      redirectUrls: {
                        type: string;
                        items: {
                          type: string;
                          format: string;
                        };
                        description: string;
                      };
                      type: {
                        type: string;
                        description: string;
                        enum: string[];
                      };
                      authenticationScheme: {
                        type: string;
                        description: string;
                        enum: string[];
                      };
                      disabled: {
                        type: string;
                        description: string;
                        enum: boolean[];
                      };
                      userId: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      createdAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      updatedAt: {
                        type: string;
                        format: string;
                        description: string;
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
    }, Response>;
    getMcpSession: better_call636.StrictEndpoint<"/mcp/get-session", {
      method: "GET";
      requireHeaders: true;
    } & {
      use: any[];
    }, OAuthAccessToken | null>;
  };
  schema: {
    oauthApplication: {
      modelName: string;
      fields: {
        name: {
          type: "string";
        };
        icon: {
          type: "string";
          required: false;
        };
        metadata: {
          type: "string";
          required: false;
        };
        clientId: {
          type: "string";
          unique: true;
        };
        clientSecret: {
          type: "string";
          required: false;
        };
        redirectUrls: {
          type: "string";
        };
        type: {
          type: "string";
        };
        disabled: {
          type: "boolean";
          required: false;
          defaultValue: false;
        };
        userId: {
          type: "string";
          required: false;
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        createdAt: {
          type: "date";
        };
        updatedAt: {
          type: "date";
        };
      };
    };
    oauthAccessToken: {
      modelName: string;
      fields: {
        accessToken: {
          type: "string";
          unique: true;
        };
        refreshToken: {
          type: "string";
          unique: true;
        };
        accessTokenExpiresAt: {
          type: "date";
        };
        refreshTokenExpiresAt: {
          type: "date";
        };
        clientId: {
          type: "string";
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        userId: {
          type: "string";
          required: false;
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        scopes: {
          type: "string";
        };
        createdAt: {
          type: "date";
        };
        updatedAt: {
          type: "date";
        };
      };
    };
    oauthConsent: {
      modelName: string;
      fields: {
        clientId: {
          type: "string";
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        userId: {
          type: "string";
          references: {
            model: string;
            field: string;
            onDelete: "cascade";
          };
          index: true;
        };
        scopes: {
          type: "string";
        };
        createdAt: {
          type: "date";
        };
        updatedAt: {
          type: "date";
        };
        consentGiven: {
          type: "boolean";
        };
      };
    };
  };
};
declare const withMcpAuth: <Auth extends {
  api: {
    getMcpSession: (...args: any) => Promise<OAuthAccessToken | null>;
  };
  options: BetterAuthOptions;
}>(auth: Auth, handler: (req: Request, sesssion: OAuthAccessToken) => Response | Promise<Response>) => (req: Request) => Promise<Response>;
declare const oAuthDiscoveryMetadata: <Auth extends {
  api: {
    getMcpOAuthConfig: (...args: any) => any;
  };
}>(auth: Auth) => (request: Request) => Promise<Response>;
declare const oAuthProtectedResourceMetadata: <Auth extends {
  api: {
    getMCPProtectedResource: (...args: any) => any;
  };
}>(auth: Auth) => (request: Request) => Promise<Response>;
//#endregion
//#region src/plugins/organization/access/statement.d.ts
declare const defaultStatements: {
  readonly organization: readonly ["update", "delete"];
  readonly member: readonly ["create", "update", "delete"];
  readonly invitation: readonly ["create", "cancel"];
  readonly team: readonly ["create", "update", "delete"];
  readonly ac: readonly ["create", "read", "update", "delete"];
};
declare const defaultAc: {
  newRole<K$1 extends "organization" | "member" | "invitation" | "ac" | "team">(statements: Subset<K$1, {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }>): {
    authorize<K_1 extends K$1>(request: K_1 extends infer T extends keyof Subset<K$1, {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }> ? { [key in T]?: Subset<K$1, {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>[key] | {
      actions: Subset<K$1, {
        readonly organization: readonly ["update", "delete"];
        readonly member: readonly ["create", "update", "delete"];
        readonly invitation: readonly ["create", "cancel"];
        readonly team: readonly ["create", "update", "delete"];
        readonly ac: readonly ["create", "read", "update", "delete"];
      }>[key];
      connector: "OR" | "AND";
    } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
    statements: Subset<K$1, {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>;
  };
  statements: {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  };
};
declare const adminAc: {
  authorize<K$1 extends "organization" | "member" | "invitation" | "ac" | "team">(request: K$1 extends infer T extends keyof Subset<"organization" | "member" | "invitation" | "ac" | "team", {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }> ? { [key in T]?: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }>[key] | {
    actions: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>[key];
    connector: "OR" | "AND";
  } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
  statements: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }>;
};
declare const ownerAc: {
  authorize<K$1 extends "organization" | "member" | "invitation" | "ac" | "team">(request: K$1 extends infer T extends keyof Subset<"organization" | "member" | "invitation" | "ac" | "team", {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }> ? { [key in T]?: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }>[key] | {
    actions: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>[key];
    connector: "OR" | "AND";
  } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
  statements: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }>;
};
declare const memberAc: {
  authorize<K$1 extends "organization" | "member" | "invitation" | "ac" | "team">(request: K$1 extends infer T extends keyof Subset<"organization" | "member" | "invitation" | "ac" | "team", {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }> ? { [key in T]?: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }>[key] | {
    actions: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>[key];
    connector: "OR" | "AND";
  } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
  statements: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
    readonly organization: readonly ["update", "delete"];
    readonly member: readonly ["create", "update", "delete"];
    readonly invitation: readonly ["create", "cancel"];
    readonly team: readonly ["create", "update", "delete"];
    readonly ac: readonly ["create", "read", "update", "delete"];
  }>;
};
declare const defaultRoles: {
  admin: {
    authorize<K$1 extends "organization" | "member" | "invitation" | "ac" | "team">(request: K$1 extends infer T extends keyof Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }> ? { [key in T]?: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>[key] | {
      actions: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
        readonly organization: readonly ["update", "delete"];
        readonly member: readonly ["create", "update", "delete"];
        readonly invitation: readonly ["create", "cancel"];
        readonly team: readonly ["create", "update", "delete"];
        readonly ac: readonly ["create", "read", "update", "delete"];
      }>[key];
      connector: "OR" | "AND";
    } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
    statements: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>;
  };
  owner: {
    authorize<K$1 extends "organization" | "member" | "invitation" | "ac" | "team">(request: K$1 extends infer T extends keyof Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }> ? { [key in T]?: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>[key] | {
      actions: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
        readonly organization: readonly ["update", "delete"];
        readonly member: readonly ["create", "update", "delete"];
        readonly invitation: readonly ["create", "cancel"];
        readonly team: readonly ["create", "update", "delete"];
        readonly ac: readonly ["create", "read", "update", "delete"];
      }>[key];
      connector: "OR" | "AND";
    } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
    statements: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>;
  };
  member: {
    authorize<K$1 extends "organization" | "member" | "invitation" | "ac" | "team">(request: K$1 extends infer T extends keyof Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }> ? { [key in T]?: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>[key] | {
      actions: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
        readonly organization: readonly ["update", "delete"];
        readonly member: readonly ["create", "update", "delete"];
        readonly invitation: readonly ["create", "cancel"];
        readonly team: readonly ["create", "update", "delete"];
        readonly ac: readonly ["create", "read", "update", "delete"];
      }>[key];
      connector: "OR" | "AND";
    } | undefined } : never, connector?: "OR" | "AND"): AuthorizeResponse;
    statements: Subset<"organization" | "member" | "invitation" | "ac" | "team", {
      readonly organization: readonly ["update", "delete"];
      readonly member: readonly ["create", "update", "delete"];
      readonly invitation: readonly ["create", "cancel"];
      readonly team: readonly ["create", "update", "delete"];
      readonly ac: readonly ["create", "read", "update", "delete"];
    }>;
  };
};
//#endregion
//#region src/plugins/organization/error-codes.d.ts
declare const ORGANIZATION_ERROR_CODES: {
  readonly YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION: "You are not allowed to create a new organization";
  readonly YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: "You have reached the maximum number of organizations";
  readonly ORGANIZATION_ALREADY_EXISTS: "Organization already exists";
  readonly ORGANIZATION_SLUG_ALREADY_TAKEN: "Organization slug already taken";
  readonly ORGANIZATION_NOT_FOUND: "Organization not found";
  readonly USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: "User is not a member of the organization";
  readonly YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION: "You are not allowed to update this organization";
  readonly YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION: "You are not allowed to delete this organization";
  readonly NO_ACTIVE_ORGANIZATION: "No active organization";
  readonly USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "User is already a member of this organization";
  readonly MEMBER_NOT_FOUND: "Member not found";
  readonly ROLE_NOT_FOUND: "Role not found";
  readonly YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM: "You are not allowed to create a new team";
  readonly TEAM_ALREADY_EXISTS: "Team already exists";
  readonly TEAM_NOT_FOUND: "Team not found";
  readonly YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: "You cannot leave the organization as the only owner";
  readonly YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: "You cannot leave the organization without an owner";
  readonly YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: "You are not allowed to delete this member";
  readonly YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: "You are not allowed to invite users to this organization";
  readonly USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "User is already invited to this organization";
  readonly INVITATION_NOT_FOUND: "Invitation not found";
  readonly YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: "You are not the recipient of the invitation";
  readonly EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: "Email verification required before accepting or rejecting invitation";
  readonly YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION: "You are not allowed to cancel this invitation";
  readonly INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION: "Inviter is no longer a member of the organization";
  readonly YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE: "You are not allowed to invite a user with this role";
  readonly FAILED_TO_RETRIEVE_INVITATION: "Failed to retrieve invitation";
  readonly YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS: "You have reached the maximum number of teams";
  readonly UNABLE_TO_REMOVE_LAST_TEAM: "Unable to remove last team";
  readonly YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: "You are not allowed to update this member";
  readonly ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: "Organization membership limit reached";
  readonly YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION: "You are not allowed to create teams in this organization";
  readonly YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION: "You are not allowed to delete teams in this organization";
  readonly YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM: "You are not allowed to update this team";
  readonly YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM: "You are not allowed to delete this team";
  readonly INVITATION_LIMIT_REACHED: "Invitation limit reached";
  readonly TEAM_MEMBER_LIMIT_REACHED: "Team member limit reached";
  readonly USER_IS_NOT_A_MEMBER_OF_THE_TEAM: "User is not a member of the team";
  readonly YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM: "You are not allowed to list the members of this team";
  readonly YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: "You do not have an active team";
  readonly YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER: "You are not allowed to create a new member";
  readonly YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER: "You are not allowed to remove a team member";
  readonly YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION: "You are not allowed to access this organization as an owner";
  readonly YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: "You are not a member of this organization";
  readonly MISSING_AC_INSTANCE: "Dynamic Access Control requires a pre-defined ac instance on the server auth plugin. Read server logs for more information";
  readonly YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE: "You must be in an organization to create a role";
  readonly YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE: "You are not allowed to create a role";
  readonly YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE: "You are not allowed to update a role";
  readonly YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE: "You are not allowed to delete a role";
  readonly YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE: "You are not allowed to read a role";
  readonly YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE: "You are not allowed to list a role";
  readonly YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE: "You are not allowed to get a role";
  readonly TOO_MANY_ROLES: "This organization has too many roles";
  readonly INVALID_RESOURCE: "The provided permission includes an invalid resource";
  readonly ROLE_NAME_IS_ALREADY_TAKEN: "That role name is already taken";
  readonly CANNOT_DELETE_A_PRE_DEFINED_ROLE: "Cannot delete a pre-defined role";
};
//#endregion
//#region src/plugins/organization/types.d.ts
interface OrganizationOptions {
  /**
   * Configure whether new users are able to create new organizations.
   * You can also pass a function that returns a boolean.
   *
   * 	@example
   * ```ts
   * allowUserToCreateOrganization: async (user) => {
   * 		const plan = await getUserPlan(user);
   *      return plan.name === "pro";
   * }
   * ```
   * @default true
   */
  allowUserToCreateOrganization?: (boolean | ((user: User$1 & Record<string, any>) => Promise<boolean> | boolean)) | undefined;
  /**
   * The maximum number of organizations a user can create.
   *
   * You can also pass a function that returns a boolean
   */
  organizationLimit?: (number | ((user: User$1) => Promise<boolean> | boolean)) | undefined;
  /**
   * The role that is assigned to the creator of the
   * organization.
   *
   * @default "owner"
   */
  creatorRole?: string | undefined;
  /**
   * The maximum number of members allowed in an organization.
   *
   * @default 100
   */
  membershipLimit?: number | undefined;
  /**
   * Configure the roles and permissions for the
   * organization plugin.
   */
  ac?: AccessControl | undefined;
  /**
   * Custom permissions for roles.
   */
  roles?: { [key in string]?: Role<any> } | undefined;
  /**
   * Dynamic access control for the organization plugin.
   */
  dynamicAccessControl?: {
    /**
     * Whether to enable dynamic access control for the organization plugin.
     *
     * @default false
     */
    enabled?: boolean;
    /**
     * The maximum number of roles that can be created for an organization.
     *
     * @default Infinite
     */
    maximumRolesPerOrganization?: number | ((organizationId: string) => Promise<number> | number);
  } | undefined;
  /**
   * Support for team.
   */
  teams?: {
    /**
     * Enable team features.
     */
    enabled: boolean;
    /**
     * Default team configuration
     */
    defaultTeam?: {
      /**
       * Enable creating a default team when an organization is created
       *
       * @default true
       */
      enabled: boolean;
      /**
       * Pass a custom default team creator function
       */
      customCreateDefaultTeam?: (organization: Organization & Record<string, any>, ctx?: GenericEndpointContext) => Promise<Team & Record<string, any>>;
    };
    /**
     * Maximum number of teams an organization can have.
     *
     * You can pass a number or a function that returns a number
     *
     * @default "unlimited"
     *
     * @param organization
     * @param request
     * @returns
     */
    maximumTeams?: ((data: {
      organizationId: string;
      session: {
        user: User$1;
        session: Session$1;
      } | null;
    }, ctx?: GenericEndpointContext) => number | Promise<number>) | number;
    /**
     * The maximum number of members per team.
     *
     * if `undefined`, there is no limit.
     *
     * @default undefined
     */
    maximumMembersPerTeam?: number | ((data: {
      teamId: string;
      session: {
        user: User$1;
        session: Session$1;
      };
      organizationId: string;
    }) => Promise<number> | number) | undefined;
    /**
     * By default, if an organization does only have one team, they'll not be able to remove it.
     *
     * You can disable this behavior by setting this to `false.
     *
     * @default false
     */
    allowRemovingAllTeams?: boolean;
  };
  /**
   * The expiration time for the invitation link.
   *
   * @default 48 hours
   */
  invitationExpiresIn?: number | undefined;
  /**
   * The maximum invitation a user can send.
   *
   * @default 100
   */
  invitationLimit?: number | ((data: {
    user: User$1 & Record<string, any>;
    organization: Organization & Record<string, any>;
    member: Member & Record<string, any>;
  }, ctx: AuthContext) => Promise<number> | number) | undefined;
  /**
   * Cancel pending invitations on re-invite.
   *
   * @default false
   */
  cancelPendingInvitationsOnReInvite?: boolean | undefined;
  /**
   * Require email verification on accepting or rejecting an invitation
   *
   * @default false
   */
  requireEmailVerificationOnInvitation?: boolean | undefined;
  /**
   * Send an email with the
   * invitation link to the user.
   *
   * Note: Better Auth doesn't
   * generate invitation URLs.
   * You'll need to construct the
   * URL using the invitation ID
   * and pass it to the
   * acceptInvitation endpoint for
   * the user to accept the
   * invitation.
   *
   * @example
   * ```ts
   * sendInvitationEmail: async (data) => {
   * 	const url = `https://yourapp.com/organization/
   * accept-invitation?id=${data.id}`;
   * 	await sendEmail(data.email, "Invitation to join
   * organization", `Click the link to join the
   * organization: ${url}`);
   * }
   * ```
   */
  sendInvitationEmail?: ((data: {
    /**
     * the invitation id
     */
    id: string;
    /**
     * the role of the user
     */
    role: string;
    /**
     * the email of the user
     */
    email: string;
    /**
     * the organization the user is invited to join
     */
    organization: Organization;
    /**
     * the invitation object
     */
    invitation: Invitation;
    /**
     * the member who is inviting the user
     */
    inviter: Member & {
      user: User$1;
    };
  },
  /**
   * The request object
   */
  request?: Request) => Promise<void>) | undefined;
  /**
   * The schema for the organization plugin.
   */
  schema?: {
    session?: {
      fields?: {
        activeOrganizationId?: string;
        activeTeamId?: string;
      };
    };
    organization?: {
      modelName?: string;
      fields?: { [key in keyof Omit<Organization, "id">]?: string };
      additionalFields?: { [key in string]: DBFieldAttribute };
    };
    member?: {
      modelName?: string;
      fields?: { [key in keyof Omit<Member, "id">]?: string };
      additionalFields?: { [key in string]: DBFieldAttribute };
    };
    invitation?: {
      modelName?: string;
      fields?: { [key in keyof Omit<Invitation, "id">]?: string };
      additionalFields?: { [key in string]: DBFieldAttribute };
    };
    team?: {
      modelName?: string;
      fields?: { [key in keyof Omit<Team, "id">]?: string };
      additionalFields?: { [key in string]: DBFieldAttribute };
    };
    teamMember?: {
      modelName?: string;
      fields?: { [key in keyof Omit<TeamMember, "id">]?: string };
    };
    organizationRole?: {
      modelName?: string;
      fields?: { [key in keyof Omit<OrganizationRole, "id">]?: string };
      additionalFields?: { [key in string]: DBFieldAttribute };
    };
  } | undefined;
  /**
   * Disable organization deletion
   *
   * @default false
   */
  disableOrganizationDeletion?: boolean | undefined;
  /**
   * Configure how organization deletion is handled
   *
   * @deprecated Use `organizationHooks` instead
   */
  organizationDeletion?: {
    /**
     * disable deleting organization
     *
     * @deprecated Use `disableOrganizationDeletion` instead
     */
    disabled?: boolean;
    /**
     * A callback that runs before the organization is
     * deleted
     *
     * @deprecated Use `organizationHooks` instead
     * @param data - organization and user object
     * @param request - the request object
     * @returns
     */
    beforeDelete?: (data: {
      organization: Organization;
      user: User$1;
    }, request?: Request) => Promise<void>;
    /**
     * A callback that runs after the organization is
     * deleted
     *
     * @deprecated Use `organizationHooks` instead
     * @param data - organization and user object
     * @param request - the request object
     * @returns
     */
    afterDelete?: (data: {
      organization: Organization;
      user: User$1;
    }, request?: Request) => Promise<void>;
  } | undefined;
  /**
   * @deprecated Use `organizationHooks` instead
   */
  organizationCreation?: {
    disabled?: boolean;
    beforeCreate?: (data: {
      organization: Omit<Organization, "id"> & Record<string, any>;
      user: User$1 & Record<string, any>;
    }, request?: Request) => Promise<void | {
      data: Record<string, any>;
    }>;
    afterCreate?: (data: {
      organization: Organization & Record<string, any>;
      member: Member & Record<string, any>;
      user: User$1 & Record<string, any>;
    }, request?: Request) => Promise<void>;
  } | undefined;
  /**
   * Hooks for organization
   */
  organizationHooks?: {
    /**
     * A callback that runs before the organization is created
     *
     * You can return a `data` object to override the default data.
     *
     * @example
     * ```ts
     * beforeCreateOrganization: async (data) => {
     * 	return {
     * 		data: {
     * 			...data.organization,
     * 		},
     * 	};
     * }
     * ```
     *
     * You can also throw `new APIError` to stop the organization creation.
     *
     * @example
     * ```ts
     * beforeCreateOrganization: async (data) => {
     * 	throw new APIError("BAD_REQUEST", {
     * 		message: "Organization creation is disabled",
     * 	});
     * }
     */
    beforeCreateOrganization?: (data: {
      organization: {
        name?: string;
        slug?: string;
        logo?: string;
        metadata?: Record<string, any>;
        [key: string]: any;
      };
      user: User$1 & Record<string, any>;
    }) => Promise<void | {
      data: Record<string, any>;
    }>;
    /**
     * A callback that runs after the organization is created
     */
    afterCreateOrganization?: (data: {
      organization: Organization & Record<string, any>;
      member: Member & Record<string, any>;
      user: User$1 & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before the organization is updated
     *
     * You can return a `data` object to override the default data.
     *
     * @example
     * ```ts
     * beforeUpdateOrganization: async (data) => {
     * 	return { data: { ...data.organization } };
     * }
     */
    beforeUpdateOrganization?: (data: {
      organization: {
        name?: string;
        slug?: string;
        logo?: string;
        metadata?: Record<string, any>;
        [key: string]: any;
      };
      user: User$1 & Record<string, any>;
      member: Member & Record<string, any>;
    }) => Promise<void | {
      data: {
        name?: string;
        slug?: string;
        logo?: string;
        metadata?: Record<string, any>;
        [key: string]: any;
      };
    }>;
    /**
     * A callback that runs after the organization is updated
     *
     * @example
     * ```ts
     * afterUpdateOrganization: async (data) => {
     * 	console.log(data.organization);
     * }
     * ```
     */
    afterUpdateOrganization?: (data: {
      /**
       * Updated organization object
       *
       * This could be `null` if an adapter doesn't return updated organization.
       */
      organization: (Organization & Record<string, any>) | null;
      user: User$1 & Record<string, any>;
      member: Member & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before the organization is deleted
     */
    beforeDeleteOrganization?: (data: {
      organization: Organization & Record<string, any>;
      user: User$1 & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs after the organization is deleted
     */
    afterDeleteOrganization?: (data: {
      organization: Organization & Record<string, any>;
      user: User$1 & Record<string, any>;
    }) => Promise<void>;
    /**
     * Member hooks
     */
    /**
     * A callback that runs before a member is added to an organization
     *
     * You can return a `data` object to override the default data.
     *
     * @example
     * ```ts
     * beforeAddMember: async (data) => {
     * 	return {
     * 		data: {
     * 			...data.member,
     * 			role: "custom-role"
     * 		}
     * 	};
     * }
     * ```
     */
    beforeAddMember?: (data: {
      member: {
        userId: string;
        organizationId: string;
        role: string;
        [key: string]: any;
      };
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void | {
      data: Record<string, any>;
    }>;
    /**
     * A callback that runs after a member is added to an organization
     */
    afterAddMember?: (data: {
      member: Member & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before a member is removed from an organization
     */
    beforeRemoveMember?: (data: {
      member: Member & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs after a member is removed from an organization
     */
    afterRemoveMember?: (data: {
      member: Member & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before a member's role is updated
     *
     * You can return a `data` object to override the default data.
     */
    beforeUpdateMemberRole?: (data: {
      member: Member & Record<string, any>;
      newRole: string;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void | {
      data: {
        role: string;
        [key: string]: any;
      };
    }>;
    /**
     * A callback that runs after a member's role is updated
     */
    afterUpdateMemberRole?: (data: {
      member: Member & Record<string, any>;
      previousRole: string;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * Invitation hooks
     */
    /**
     * A callback that runs before an invitation is created
     *
     * You can return a `data` object to override the default data.
     *
     * @example
     * ```ts
     * beforeCreateInvitation: async (data) => {
     * 	return {
     * 		data: {
     * 			...data.invitation,
     * 			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days
     * 		}
     * 	};
     * }
     * ```
     */
    beforeCreateInvitation?: (data: {
      invitation: {
        email: string;
        role: string;
        organizationId: string;
        inviterId: string;
        teamId?: string;
        [key: string]: any;
      };
      inviter: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void | {
      data: Record<string, any>;
    }>;
    /**
     * A callback that runs after an invitation is created
     */
    afterCreateInvitation?: (data: {
      invitation: Invitation & Record<string, any>;
      inviter: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before an invitation is accepted
     */
    beforeAcceptInvitation?: (data: {
      invitation: Invitation & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs after an invitation is accepted
     */
    afterAcceptInvitation?: (data: {
      invitation: Invitation & Record<string, any>;
      member: Member & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before an invitation is rejected
     */
    beforeRejectInvitation?: (data: {
      invitation: Invitation & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs after an invitation is rejected
     */
    afterRejectInvitation?: (data: {
      invitation: Invitation & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before an invitation is cancelled
     */
    beforeCancelInvitation?: (data: {
      invitation: Invitation & Record<string, any>;
      cancelledBy: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs after an invitation is cancelled
     */
    afterCancelInvitation?: (data: {
      invitation: Invitation & Record<string, any>;
      cancelledBy: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * Team hooks (when teams are enabled)
     */
    /**
     * A callback that runs before a team is created
     *
     * You can return a `data` object to override the default data.
     */
    beforeCreateTeam?: (data: {
      team: {
        name: string;
        organizationId: string;
        [key: string]: any;
      };
      user?: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void | {
      data: Record<string, any>;
    }>;
    /**
     * A callback that runs after a team is created
     */
    afterCreateTeam?: (data: {
      team: Team & Record<string, any>;
      user?: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before a team is updated
     *
     * You can return a `data` object to override the default data.
     */
    beforeUpdateTeam?: (data: {
      team: Team & Record<string, any>;
      updates: {
        name?: string;
        [key: string]: any;
      };
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void | {
      data: Record<string, any>;
    }>;
    /**
     * A callback that runs after a team is updated
     */
    afterUpdateTeam?: (data: {
      team: (Team & Record<string, any>) | null;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before a team is deleted
     */
    beforeDeleteTeam?: (data: {
      team: Team & Record<string, any>;
      user?: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs after a team is deleted
     */
    afterDeleteTeam?: (data: {
      team: Team & Record<string, any>;
      user?: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before a member is added to a team
     */
    beforeAddTeamMember?: (data: {
      teamMember: {
        teamId: string;
        userId: string;
        [key: string]: any;
      };
      team: Team & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void | {
      data: Record<string, any>;
    }>;
    /**
     * A callback that runs after a member is added to a team
     */
    afterAddTeamMember?: (data: {
      teamMember: TeamMember & Record<string, any>;
      team: Team & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs before a member is removed from a team
     */
    beforeRemoveTeamMember?: (data: {
      teamMember: TeamMember & Record<string, any>;
      team: Team & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
    /**
     * A callback that runs after a member is removed from a team
     */
    afterRemoveTeamMember?: (data: {
      teamMember: TeamMember & Record<string, any>;
      team: Team & Record<string, any>;
      user: User$1 & Record<string, any>;
      organization: Organization & Record<string, any>;
    }) => Promise<void>;
  } | undefined;
}
//#endregion
//#region src/plugins/organization/schema.d.ts
type InferSchema<Schema extends BetterAuthPluginDBSchema, TableName extends string, DefaultFields> = {
  modelName: Schema[TableName] extends {
    modelName: infer M;
  } ? M extends string ? M : string : string;
  fields: { [K in keyof DefaultFields]: DefaultFields[K] } & (Schema[TableName] extends {
    additionalFields: infer F;
  } ? F : {});
};
interface OrganizationRoleDefaultFields {
  organizationId: {
    type: "string";
    required: true;
    references: {
      model: "organization";
      field: "id";
    };
  };
  role: {
    type: "string";
    required: true;
  };
  permission: {
    type: "string";
    required: true;
  };
  createdAt: {
    type: "date";
    required: true;
    defaultValue: Date;
  };
  updatedAt: {
    type: "date";
    required: false;
  };
}
interface TeamDefaultFields {
  name: {
    type: "string";
    required: true;
  };
  organizationId: {
    type: "string";
    required: true;
    references: {
      model: "organization";
      field: "id";
    };
  };
  createdAt: {
    type: "date";
    required: true;
  };
  updatedAt: {
    type: "date";
    required: false;
  };
}
interface TeamMemberDefaultFields {
  teamId: {
    type: "string";
    required: true;
    references: {
      model: "team";
      field: "id";
    };
  };
  userId: {
    type: "string";
    required: true;
    references: {
      model: "user";
      field: "id";
    };
  };
  createdAt: {
    type: "date";
    required: false;
  };
}
interface OrganizationDefaultFields {
  name: {
    type: "string";
    required: true;
    sortable: true;
  };
  slug: {
    type: "string";
    required: true;
    unique: true;
    sortable: true;
  };
  logo: {
    type: "string";
    required: false;
  };
  createdAt: {
    type: "date";
    required: true;
  };
  updatedAt: {
    type: "date";
    required: false;
  };
}
interface MemberDefaultFields {
  organizationId: {
    type: "string";
    required: true;
    references: {
      model: "organization";
      field: "id";
    };
  };
  userId: {
    type: "string";
    required: true;
    references: {
      model: "user";
      field: "id";
    };
  };
  role: {
    type: "string";
    required: true;
    defaultValue: "member";
  };
  createdAt: {
    type: "date";
    required: true;
  };
}
interface InvitationDefaultFields {
  organizationId: {
    type: "string";
    required: true;
    references: {
      model: "organization";
      field: "id";
    };
  };
  email: {
    type: "string";
    required: true;
    sortable: true;
  };
  role: {
    type: "string";
    required: true;
    sortable: true;
  };
  status: {
    type: "string";
    required: true;
    sortable: true;
    defaultValue: "pending";
  };
  expiresAt: {
    type: "date";
    required: false;
  };
  createdAt: {
    type: "date";
    required: true;
    defaultValue: Date;
  };
  inviterId: {
    type: "string";
    required: true;
    references: {
      model: "user";
      field: "id";
    };
  };
}
interface SessionDefaultFields {
  activeOrganizationId: {
    type: "string";
    required: false;
  };
}
type OrganizationSchema<O extends OrganizationOptions> = O["dynamicAccessControl"] extends {
  enabled: true;
} ? {
  organizationRole: InferSchema<O["schema"] extends BetterAuthPluginDBSchema ? O["schema"] : {}, "organizationRole", OrganizationRoleDefaultFields>;
} & {
  session: {
    fields: InferSchema<O["schema"] extends BetterAuthPluginDBSchema ? O["schema"] : {}, "session", SessionDefaultFields>["fields"];
  };
} : {} & (O["teams"] extends {
  enabled: true;
} ? {
  team: InferSchema<O["schema"] extends BetterAuthPluginDBSchema ? O["schema"] : {}, "team", TeamDefaultFields>;
  teamMember: InferSchema<O["schema"] extends BetterAuthPluginDBSchema ? O["schema"] : {}, "teamMember", TeamMemberDefaultFields>;
} : {}) & {
  organization: InferSchema<O["schema"] extends BetterAuthPluginDBSchema ? O["schema"] : {}, "organization", OrganizationDefaultFields>;
  member: InferSchema<O["schema"] extends BetterAuthPluginDBSchema ? O["schema"] : {}, "member", MemberDefaultFields>;
  invitation: {
    modelName: O["schema"] extends BetterAuthPluginDBSchema ? InferSchema<O["schema"], "invitation", InvitationDefaultFields>["modelName"] : string;
    fields: InferSchema<O["schema"] extends BetterAuthPluginDBSchema ? O["schema"] : {}, "invitation", InvitationDefaultFields>["fields"] & (O extends {
      teams: {
        enabled: true;
      };
    } ? {
      teamId: {
        type: "string";
        required: false;
        sortable: true;
      };
    } : {});
  };
  session: {
    fields: InferSchema<O["schema"] extends BetterAuthPluginDBSchema ? O["schema"] : {}, "session", SessionDefaultFields>["fields"] & (O["teams"] extends {
      enabled: true;
    } ? {
      activeTeamId: {
        type: "string";
        required: false;
      };
    } : {});
  };
};
declare const roleSchema: z.ZodString;
declare const invitationStatus: z.ZodDefault<z.ZodEnum<{
  pending: "pending";
  accepted: "accepted";
  rejected: "rejected";
  canceled: "canceled";
}>>;
declare const organizationSchema: z.ZodObject<{
  id: z.ZodDefault<z.ZodString>;
  name: z.ZodString;
  slug: z.ZodString;
  logo: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
  metadata: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodUnknown>, z.ZodPipe<z.ZodString, z.ZodTransform<any, string>>]>>;
  createdAt: z.ZodDate;
}, z.core.$strip>;
declare const memberSchema: z.ZodObject<{
  id: z.ZodDefault<z.ZodString>;
  organizationId: z.ZodString;
  userId: z.ZodCoercedString<unknown>;
  role: z.ZodString;
  createdAt: z.ZodDefault<z.ZodDate>;
}, z.core.$strip>;
declare const invitationSchema: z.ZodObject<{
  id: z.ZodDefault<z.ZodString>;
  organizationId: z.ZodString;
  email: z.ZodString;
  role: z.ZodString;
  status: z.ZodDefault<z.ZodEnum<{
    pending: "pending";
    accepted: "accepted";
    rejected: "rejected";
    canceled: "canceled";
  }>>;
  teamId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  inviterId: z.ZodString;
  expiresAt: z.ZodDate;
  createdAt: z.ZodDefault<z.ZodDate>;
}, z.core.$strip>;
declare const teamSchema: z.ZodObject<{
  id: z.ZodDefault<z.ZodString>;
  name: z.ZodString;
  organizationId: z.ZodString;
  createdAt: z.ZodDate;
  updatedAt: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
declare const teamMemberSchema: z.ZodObject<{
  id: z.ZodDefault<z.ZodString>;
  teamId: z.ZodString;
  userId: z.ZodString;
  createdAt: z.ZodDefault<z.ZodDate>;
}, z.core.$strip>;
declare const organizationRoleSchema: z.ZodObject<{
  id: z.ZodDefault<z.ZodString>;
  organizationId: z.ZodString;
  role: z.ZodString;
  permission: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
  createdAt: z.ZodDefault<z.ZodDate>;
  updatedAt: z.ZodOptional<z.ZodDate>;
}, z.core.$strip>;
type Organization = z.infer<typeof organizationSchema>;
type Member = z.infer<typeof memberSchema>;
type TeamMember = z.infer<typeof teamMemberSchema>;
type Team = z.infer<typeof teamSchema>;
type Invitation = z.infer<typeof invitationSchema>;
type InvitationInput = z.input<typeof invitationSchema>;
type MemberInput = z.input<typeof memberSchema>;
type TeamMemberInput = z.input<typeof teamMemberSchema>;
type OrganizationInput = z.input<typeof organizationSchema>;
type TeamInput = z.infer<typeof teamSchema>;
type OrganizationRole = z.infer<typeof organizationRoleSchema>;
declare const defaultRolesSchema: z.ZodUnion<readonly [z.ZodEnum<{
  member: "member";
  admin: "admin";
  owner: "owner";
}>, z.ZodArray<z.ZodEnum<{
  member: "member";
  admin: "admin";
  owner: "owner";
}>>]>;
type CustomRolesSchema<O> = O extends {
  roles: {
    [key: string]: any;
  };
} ? z.ZodType<keyof O["roles"] | Array<keyof O["roles"]>> : typeof defaultRolesSchema;
type InferOrganizationZodRolesFromOption<O extends OrganizationOptions | undefined> = CustomRolesSchema<O>;
type InferOrganizationRolesFromOption<O extends OrganizationOptions | undefined> = O extends {
  roles: any;
} ? keyof O["roles"] extends infer K extends string ? K : "admin" | "member" | "owner" : "admin" | "member" | "owner";
type InvitationStatus = "pending" | "accepted" | "rejected" | "canceled";
type InferMember<O extends OrganizationOptions, isClientSide extends boolean = true> = Prettify<(O["teams"] extends {
  enabled: true;
} ? {
  id: string;
  organizationId: string;
  role: InferOrganizationRolesFromOption<O>;
  createdAt: Date;
  userId: string;
  teamId?: string | undefined;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | undefined;
  };
} : {
  id: string;
  organizationId: string;
  role: InferOrganizationRolesFromOption<O>;
  createdAt: Date;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | undefined;
  };
}) & InferAdditionalFieldsFromPluginOptions<"member", O, isClientSide>>;
type InferOrganization<O extends OrganizationOptions, isClientSide extends boolean = true> = Prettify<Organization & InferAdditionalFieldsFromPluginOptions<"organization", O, isClientSide>>;
type InferTeam<O extends OrganizationOptions, isClientSide extends boolean = true> = Prettify<Team & InferAdditionalFieldsFromPluginOptions<"team", O, isClientSide>>;
type InferInvitation<O extends OrganizationOptions, isClientSide extends boolean = true> = Prettify<(O["teams"] extends {
  enabled: true;
} ? {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
  teamId?: string | undefined;
} : {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
}) & InferAdditionalFieldsFromPluginOptions<"invitation", O, isClientSide>>;
//#endregion
//#region src/plugins/organization/routes/crud-access-control.d.ts
type IsExactlyEmptyObject<T$1> = keyof T$1 extends never ? T$1 extends {} ? {} extends T$1 ? true : false : false : false;
declare const createOrgRole: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/create-role", {
  method: "POST";
  body: z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodString>;
    role: z.ZodString;
    permission: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
    additionalFields: z.ZodOptional<z.ZodObject<{
      [x: string]: z.ZodOptional<z.ZodAny>;
    }, z.core.$strip>>;
  }, z.core.$strip>;
  metadata: {
    $Infer: {
      body: {
        organizationId?: string | undefined;
        role: string;
        permission: Record<string, string[]>;
      } & (IsExactlyEmptyObject<InferAdditionalFieldsFromPluginOptions<"organizationRole", O, true>> extends true ? {
        additionalFields?: {} | undefined;
      } : {
        additionalFields: InferAdditionalFieldsFromPluginOptions<"organizationRole", O, true>;
      });
    };
  };
  requireHeaders: true;
  use: ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: User$1;
    };
  }>)[];
} & {
  use: any[];
}, {
  success: boolean;
  roleData: {
    id: string;
    organizationId: string;
    role: string;
    permission: Record<string, string[]>;
    createdAt: Date;
    updatedAt?: Date | undefined;
  } & InferAdditionalFieldsFromPluginOptions<"organizationRole", O, false>;
  statements: Subset<string, Statements>;
}>;
declare const deleteOrgRole: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/delete-role", {
  method: "POST";
  body: z.ZodIntersection<z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>, z.ZodUnion<readonly [z.ZodObject<{
    roleName: z.ZodString;
  }, z.core.$strip>, z.ZodObject<{
    roleId: z.ZodString;
  }, z.core.$strip>]>>;
  requireHeaders: true;
  use: ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: User$1;
    };
  }>)[];
  metadata: {
    $Infer: {
      body: {
        roleName?: string | undefined;
        roleId?: string | undefined;
        organizationId?: string | undefined;
      };
    };
  };
} & {
  use: any[];
}, {
  success: boolean;
}>;
declare const listOrgRoles: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/list-roles", {
  method: "GET";
  use: ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: User$1;
    };
  }>)[];
  query: z.ZodOptional<z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
} & {
  use: any[];
}, ({
  id: string;
  organizationId: string;
  role: string;
  permission: Record<string, string[]>;
  createdAt: Date;
  updatedAt?: Date | undefined;
} & InferAdditionalFieldsFromPluginOptions<"organizationRole", O, false>)[]>;
declare const getOrgRole: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/get-role", {
  method: "GET";
  use: ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: User$1;
    };
  }>)[];
  query: z.ZodOptional<z.ZodIntersection<z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>, z.ZodUnion<readonly [z.ZodObject<{
    roleName: z.ZodString;
  }, z.core.$strip>, z.ZodObject<{
    roleId: z.ZodString;
  }, z.core.$strip>]>>>;
  metadata: {
    $Infer: {
      query: {
        organizationId?: string | undefined;
        roleName?: string | undefined;
        roleId?: string | undefined;
      };
    };
  };
} & {
  use: any[];
}, {
  id: string;
  organizationId: string;
  role: string;
  permission: Record<string, string[]>;
  createdAt: Date;
  updatedAt?: Date | undefined;
} & InferAdditionalFieldsFromPluginOptions<"organizationRole", O, false>>;
declare const updateOrgRole: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/update-role", {
  method: "POST";
  body: z.ZodIntersection<z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodString>;
    data: z.ZodObject<{
      permission: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>>;
      roleName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
  }, z.core.$strip>, z.ZodUnion<readonly [z.ZodObject<{
    roleName: z.ZodString;
  }, z.core.$strip>, z.ZodObject<{
    roleId: z.ZodString;
  }, z.core.$strip>]>>;
  metadata: {
    $Infer: {
      body: {
        organizationId?: string | undefined;
        data: {
          permission?: Record<string, string[]> | undefined;
          roleName?: string | undefined;
        } & Partial<InferAdditionalFieldsFromPluginOptions<"organizationRole", O, true>>;
        roleName?: string | undefined;
        roleId?: string | undefined;
      };
    };
  };
  use: ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: User$1;
    };
  }>)[];
} & {
  use: any[];
}, {
  success: boolean;
  roleData: OrganizationRole & InferAdditionalFieldsFromPluginOptions<"organizationRole", O, false>;
}>;
//#endregion
//#region src/plugins/organization/routes/crud-invites.d.ts
declare const createInvitation: <O extends OrganizationOptions>(option: O) => better_call636.StrictEndpoint<"/organization/invite-member", {
  method: "POST";
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
  body: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    organizationId: z.ZodOptional<z.ZodString>;
    resend: z.ZodOptional<z.ZodBoolean>;
    teamId: z.ZodUnion<readonly [z.ZodOptional<z.ZodString>, z.ZodOptional<z.ZodArray<z.ZodString>>]>;
  }, z.core.$strip>;
  metadata: {
    $Infer: {
      body: {
        /**
         * The email address of the user
         * to invite
         */
        email: string;
        /**
         * The role to assign to the user
         */
        role: InferOrganizationRolesFromOption<O> | InferOrganizationRolesFromOption<O>[];
        /**
         * The organization ID to invite
         * the user to
         */
        organizationId?: string | undefined;
        /**
         * Resend the invitation email, if
         * the user is already invited
         */
        resend?: boolean | undefined;
      } & (O extends {
        teams: {
          enabled: true;
        };
      } ? {
        /**
         * The team the user is
         * being invited to.
         */
        teamId?: (string | string[]) | undefined;
      } : {}) & InferAdditionalFieldsFromPluginOptions<"invitation", O, false>;
    };
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
                  id: {
                    type: string;
                  };
                  email: {
                    type: string;
                  };
                  role: {
                    type: string;
                  };
                  organizationId: {
                    type: string;
                  };
                  inviterId: {
                    type: string;
                  };
                  status: {
                    type: string;
                  };
                  expiresAt: {
                    type: string;
                  };
                  createdAt: {
                    type: string;
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
}, (O["teams"] extends {
  enabled: true;
} ? {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
  teamId?: string | undefined;
} : {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
}) & InferAdditionalFieldsFromPluginOptions<"invitation", O, false> extends infer T ? { [K in keyof T]: T[K] } : never>;
declare const acceptInvitation: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/accept-invitation", {
  method: "POST";
  body: z.ZodObject<{
    invitationId: z.ZodString;
  }, z.core.$strip>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
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
                  invitation: {
                    type: string;
                  };
                  member: {
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
  invitation: (O["teams"] extends {
    enabled: true;
  } ? {
    id: string;
    organizationId: string;
    email: string;
    role: InferOrganizationRolesFromOption<O>;
    status: InvitationStatus;
    inviterId: string;
    expiresAt: Date;
    createdAt: Date;
    teamId?: string | undefined;
  } : {
    id: string;
    organizationId: string;
    email: string;
    role: InferOrganizationRolesFromOption<O>;
    status: InvitationStatus;
    inviterId: string;
    expiresAt: Date;
    createdAt: Date;
  }) & InferAdditionalFieldsFromPluginOptions<"invitation", O, false> extends infer T ? { [K in keyof T]: T[K] } : never;
  member: {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date;
  } & InferAdditionalFieldsFromPluginOptions<"member", O, false>;
} | null>;
declare const rejectInvitation: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/reject-invitation", {
  method: "POST";
  body: z.ZodObject<{
    invitationId: z.ZodString;
  }, z.core.$strip>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
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
                  invitation: {
                    type: string;
                  };
                  member: {
                    type: string;
                    nullable: boolean;
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
  invitation: {
    id: string;
    organizationId: string;
    email: string;
    role: "member" | "admin" | "owner";
    status: InvitationStatus;
    inviterId: string;
    expiresAt: Date;
    createdAt: Date;
  } | null;
  member: null;
}>;
declare const cancelInvitation: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/cancel-invitation", {
  method: "POST";
  body: z.ZodObject<{
    invitationId: z.ZodString;
  }, z.core.$strip>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
  openapi: {
    operationId: string;
    description: string;
    responses: {
      "200": {
        description: string;
        content: {
          "application/json": {
            schema: {
              type: string;
              properties: {
                invitation: {
                  type: string;
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
}, ((O["teams"] extends {
  enabled: true;
} ? {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
  teamId?: string | undefined;
} : {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
}) & InferAdditionalFieldsFromPluginOptions<"invitation", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) | null>;
declare const getInvitation: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/get-invitation", {
  method: "GET";
  use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>)[];
  requireHeaders: true;
  query: z.ZodObject<{
    id: z.ZodString;
  }, z.core.$strip>;
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
                  id: {
                    type: string;
                  };
                  email: {
                    type: string;
                  };
                  role: {
                    type: string;
                  };
                  organizationId: {
                    type: string;
                  };
                  inviterId: {
                    type: string;
                  };
                  status: {
                    type: string;
                  };
                  expiresAt: {
                    type: string;
                  };
                  organizationName: {
                    type: string;
                  };
                  organizationSlug: {
                    type: string;
                  };
                  inviterEmail: {
                    type: string;
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
}, ((O["teams"] extends {
  enabled: true;
} ? {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
  teamId?: string | undefined;
} : {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
}) & InferAdditionalFieldsFromPluginOptions<"invitation", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) & {
  organizationName: ({
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    logo?: string | null | undefined;
    metadata?: any;
  } & InferAdditionalFieldsFromPluginOptions<"organization", O, false>)["name"];
  organizationSlug: ({
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    logo?: string | null | undefined;
    metadata?: any;
  } & InferAdditionalFieldsFromPluginOptions<"organization", O, false>)["slug"];
  inviterEmail: string;
}>;
declare const listInvitations: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/list-invitations", {
  method: "GET";
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
  query: z.ZodOptional<z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
} & {
  use: any[];
}, ((O["teams"] extends {
  enabled: true;
} ? {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
  teamId?: string | undefined;
} : {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
}) & InferAdditionalFieldsFromPluginOptions<"invitation", O, false> extends infer T ? { [K in keyof T]: T[K] } : never)[]>;
/**
 * List all invitations a user has received
 */
declare const listUserInvitations: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/list-user-invitations", {
  method: "GET";
  use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>)[];
  query: z.ZodOptional<z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
} & {
  use: any[];
}, ((O["teams"] extends {
  enabled: true;
} ? {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
  teamId?: string | undefined;
} : {
  id: string;
  organizationId: string;
  email: string;
  role: InferOrganizationRolesFromOption<O>;
  status: InvitationStatus;
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
}) & InferAdditionalFieldsFromPluginOptions<"invitation", O, false> extends infer T ? { [K in keyof T]: T[K] } : never)[]>;
//#endregion
//#region src/plugins/organization/routes/crud-members.d.ts
declare const addMember: <O extends OrganizationOptions>(option: O) => better_call636.StrictEndpoint<"/organization/add-member", {
  method: "POST";
  body: z.ZodObject<{
    userId: z.ZodCoercedString<unknown>;
    role: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    organizationId: z.ZodOptional<z.ZodString>;
    teamId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>)[];
  metadata: {
    SERVER_ONLY: true;
    $Infer: {
      body: {
        userId: string;
        role: InferOrganizationRolesFromOption<O> | InferOrganizationRolesFromOption<O>[];
        organizationId?: string | undefined;
      } & (O extends {
        teams: {
          enabled: true;
        };
      } ? {
        teamId?: string | undefined;
      } : {}) & InferAdditionalFieldsFromPluginOptions<"member", O>;
    };
    openapi: {
      operationId: string;
      description: string;
    };
  };
} & {
  use: any[];
}, ({
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
} & InferAdditionalFieldsFromPluginOptions<"member", O, false>) | null>;
declare const removeMember: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/remove-member", {
  method: "POST";
  body: z.ZodObject<{
    memberIdOrEmail: z.ZodString;
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
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
                  member: {
                    type: string;
                    properties: {
                      id: {
                        type: string;
                      };
                      userId: {
                        type: string;
                      };
                      organizationId: {
                        type: string;
                      };
                      role: {
                        type: string;
                      };
                    };
                    required: string[];
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
  member: (O["teams"] extends {
    enabled: true;
  } ? {
    id: string;
    organizationId: string;
    role: InferOrganizationRolesFromOption<O>;
    createdAt: Date;
    userId: string;
    teamId?: string | undefined;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | undefined;
    };
  } : {
    id: string;
    organizationId: string;
    role: InferOrganizationRolesFromOption<O>;
    createdAt: Date;
    userId: string;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | undefined;
    };
  }) & InferAdditionalFieldsFromPluginOptions<"member", O, false> extends infer T ? { [K in keyof T]: T[K] } : never;
} | null>;
declare const updateMemberRole: <O extends OrganizationOptions>(option: O) => better_call636.StrictEndpoint<"/organization/update-member-role", {
  method: "POST";
  body: z.ZodObject<{
    role: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>;
    memberId: z.ZodString;
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
  metadata: {
    $Infer: {
      body: {
        role: InferOrganizationRolesFromOption<O> | InferOrganizationRolesFromOption<O>[] | LiteralString | LiteralString[];
        memberId: string;
        /**
         * If not provided, the active organization will be used
         */
        organizationId?: string | undefined;
      };
    };
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
                  member: {
                    type: string;
                    properties: {
                      id: {
                        type: string;
                      };
                      userId: {
                        type: string;
                      };
                      organizationId: {
                        type: string;
                      };
                      role: {
                        type: string;
                      };
                    };
                    required: string[];
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
  id: string;
  organizationId: string;
  role: "member" | "admin" | "owner";
  createdAt: Date;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | undefined;
  };
}>;
declare const getActiveMember: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/get-active-member", {
  method: "GET";
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
  requireHeaders: true;
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
                  id: {
                    type: string;
                  };
                  userId: {
                    type: string;
                  };
                  organizationId: {
                    type: string;
                  };
                  role: {
                    type: string;
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
}, (Omit<((O["teams"] extends {
  enabled: true;
} ? {
  id: string;
  organizationId: string;
  role: InferOrganizationRolesFromOption<O>;
  createdAt: Date;
  userId: string;
  teamId?: string | undefined;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | undefined;
  };
} : {
  id: string;
  organizationId: string;
  role: InferOrganizationRolesFromOption<O>;
  createdAt: Date;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | undefined;
  };
}) & InferAdditionalFieldsFromPluginOptions<"member", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) & {
  user: _better_auth_core_db20.User;
}, "user"> & {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | undefined;
  };
}) | null>;
declare const leaveOrganization: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/leave", {
  method: "POST";
  body: z.ZodObject<{
    organizationId: z.ZodString;
  }, z.core.$strip>;
  requireHeaders: true;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) | ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>))[];
} & {
  use: any[];
}, Omit<((O["teams"] extends {
  enabled: true;
} ? {
  id: string;
  organizationId: string;
  role: InferOrganizationRolesFromOption<O>;
  createdAt: Date;
  userId: string;
  teamId?: string | undefined;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | undefined;
  };
} : {
  id: string;
  organizationId: string;
  role: InferOrganizationRolesFromOption<O>;
  createdAt: Date;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | undefined;
  };
}) & InferAdditionalFieldsFromPluginOptions<"member", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) & {
  user: _better_auth_core_db20.User;
}, "user"> & {
  user: {
    id: string;
    name: string;
    email: string;
    image: string | undefined;
  };
}>;
declare const listMembers: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/list-members", {
  method: "GET";
  query: z.ZodOptional<z.ZodObject<{
    limit: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    offset: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortDirection: z.ZodOptional<z.ZodEnum<{
      asc: "asc";
      desc: "desc";
    }>>;
    filterField: z.ZodOptional<z.ZodString>;
    filterValue: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBoolean]>>;
    filterOperator: z.ZodOptional<z.ZodEnum<{
      eq: "eq";
      ne: "ne";
      lt: "lt";
      lte: "lte";
      gt: "gt";
      gte: "gte";
      contains: "contains";
    }>>;
    organizationId: z.ZodOptional<z.ZodString>;
    organizationSlug: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
} & {
  use: any[];
}, {
  members: (((O["teams"] extends {
    enabled: true;
  } ? {
    id: string;
    organizationId: string;
    role: InferOrganizationRolesFromOption<O>;
    createdAt: Date;
    userId: string;
    teamId?: string | undefined;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | undefined;
    };
  } : {
    id: string;
    organizationId: string;
    role: InferOrganizationRolesFromOption<O>;
    createdAt: Date;
    userId: string;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | undefined;
    };
  }) & InferAdditionalFieldsFromPluginOptions<"member", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) & {
    user: {
      id: string;
      name: string;
      email: string;
      image: string | null | undefined;
    };
  })[];
  total: number;
}>;
declare const getActiveMemberRole: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/get-active-member-role", {
  method: "GET";
  query: z.ZodOptional<z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    organizationId: z.ZodOptional<z.ZodString>;
    organizationSlug: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
} & {
  use: any[];
}, {
  role: (((O["teams"] extends {
    enabled: true;
  } ? {
    id: string;
    organizationId: string;
    role: InferOrganizationRolesFromOption<O>;
    createdAt: Date;
    userId: string;
    teamId?: string | undefined;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | undefined;
    };
  } : {
    id: string;
    organizationId: string;
    role: InferOrganizationRolesFromOption<O>;
    createdAt: Date;
    userId: string;
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | undefined;
    };
  }) & InferAdditionalFieldsFromPluginOptions<"member", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) & {
    user: _better_auth_core_db20.User;
  })["role"];
}>;
//#endregion
//#region src/plugins/organization/routes/crud-org.d.ts
declare const createOrganization: <O extends OrganizationOptions>(options?: O | undefined) => better_call636.StrictEndpoint<"/organization/create", {
  method: "POST";
  body: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    userId: z.ZodOptional<z.ZodCoercedString<unknown>>;
    logo: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    keepCurrentActiveOrganization: z.ZodOptional<z.ZodBoolean>;
  }, z.core.$strip>;
  use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>)[];
  metadata: {
    $Infer: {
      body: InferAdditionalFieldsFromPluginOptions<"organization", O> & {
        name: string;
        slug: string;
        userId?: string | undefined;
        logo?: string | undefined;
        metadata?: Record<string, any> | undefined;
        keepCurrentActiveOrganization?: boolean | undefined;
      };
    };
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                description: string;
                $ref: string;
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, (({
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null | undefined;
  metadata?: any;
} & InferAdditionalFieldsFromPluginOptions<"organization", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) & {
  metadata: any;
  members: (({
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date;
  } & InferAdditionalFieldsFromPluginOptions<"member", O, false>) | undefined)[];
}) | null>;
declare const checkOrganizationSlug: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/check-slug", {
  method: "POST";
  body: z.ZodObject<{
    slug: z.ZodString;
  }, z.core.$strip>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
    } | null;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>))[];
} & {
  use: any[];
}, {
  status: boolean;
}>;
declare const updateOrganization: <O extends OrganizationOptions>(options?: O | undefined) => better_call636.StrictEndpoint<"/organization/update", {
  method: "POST";
  body: z.ZodObject<{
    data: z.ZodObject<{
      name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      slug: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      logo: z.ZodOptional<z.ZodOptional<z.ZodString>>;
      metadata: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
    }, z.core.$strip>;
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  requireHeaders: true;
  use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>)[];
  metadata: {
    $Infer: {
      body: {
        data: {
          name?: string | undefined;
          slug?: string | undefined;
          logo?: string | undefined;
          metadata?: Record<string, any> | undefined;
        } & Partial<InferAdditionalFieldsFromPluginOptions<"organization", O>>;
        organizationId?: string | undefined;
      };
    };
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                description: string;
                $ref: string;
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, (({
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null | undefined;
  metadata?: any;
} & InferAdditionalFieldsFromPluginOptions<"organization", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) & {
  metadata: Record<string, any> | undefined;
}) | null>;
declare const deleteOrganization: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/delete", {
  method: "POST";
  body: z.ZodObject<{
    organizationId: z.ZodString;
  }, z.core.$strip>;
  requireHeaders: true;
  use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
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
                type: "string";
                description: string;
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, ({
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null | undefined;
  metadata?: any;
} & InferAdditionalFieldsFromPluginOptions<"organization", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) | null>;
declare const getFullOrganization: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/get-full-organization", {
  method: "GET";
  query: z.ZodOptional<z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodString>;
    organizationSlug: z.ZodOptional<z.ZodString>;
    membersLimit: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>]>>;
  }, z.core.$strip>>;
  requireHeaders: true;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
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
                description: string;
                $ref: string;
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, (O["teams"] extends {
  enabled: true;
} ? {
  members: InferMember<O, false>[];
  invitations: InferInvitation<O, false>[];
  teams: InferTeam<O, false>[];
} & ({
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null | undefined;
  metadata?: any;
} & InferAdditionalFieldsFromPluginOptions<"organization", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) : {
  members: InferMember<O, false>[];
  invitations: InferInvitation<O, false>[];
} & ({
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null | undefined;
  metadata?: any;
} & InferAdditionalFieldsFromPluginOptions<"organization", O, false> extends infer T_1 ? { [K in keyof T_1]: T_1[K] } : never)) | null>;
declare const setActiveOrganization: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/set-active", {
  method: "POST";
  body: z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    organizationSlug: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
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
                description: string;
                $ref: string;
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, (O["teams"] extends {
  enabled: true;
} ? {
  members: InferMember<O, false>[];
  invitations: InferInvitation<O, false>[];
  teams: InferTeam<O, false>[];
} & ({
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null | undefined;
  metadata?: any;
} & InferAdditionalFieldsFromPluginOptions<"organization", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) : {
  members: InferMember<O, false>[];
  invitations: InferInvitation<O, false>[];
} & ({
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null | undefined;
  metadata?: any;
} & InferAdditionalFieldsFromPluginOptions<"organization", O, false> extends infer T_1 ? { [K in keyof T_1]: T_1[K] } : never)) | null>;
declare const listOrganizations: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/list", {
  method: "GET";
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "array";
                items: {
                  $ref: string;
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
}, ({
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  logo?: string | null | undefined;
  metadata?: any;
} & InferAdditionalFieldsFromPluginOptions<"organization", O, false> extends infer T ? { [K in keyof T]: T[K] } : never)[]>;
//#endregion
//#region src/plugins/organization/routes/crud-team.d.ts
declare const createTeam: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/create-team", {
  method: "POST";
  body: z.ZodObject<{
    name: z.ZodString;
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>)[];
  metadata: {
    $Infer: {
      body: z.infer<z.ZodObject<{
        name: z.ZodString;
        organizationId: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>> & InferAdditionalFieldsFromPluginOptions<"team", O>;
    };
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
                  id: {
                    type: string;
                    description: string;
                  };
                  name: {
                    type: string;
                    description: string;
                  };
                  organizationId: {
                    type: string;
                    description: string;
                  };
                  createdAt: {
                    type: string;
                    format: string;
                    description: string;
                  };
                  updatedAt: {
                    type: string;
                    format: string;
                    description: string;
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
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt?: Date | undefined;
} & InferAdditionalFieldsFromPluginOptions<"team", O, false> extends infer T ? { [K in keyof T]: T[K] } : never>;
declare const removeTeam: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/remove-team", {
  method: "POST";
  body: z.ZodObject<{
    teamId: z.ZodString;
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
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
                  message: {
                    type: string;
                    description: string;
                    enum: string[];
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
  message: string;
} | null>;
declare const updateTeam: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/update-team", {
  method: "POST";
  body: z.ZodObject<{
    teamId: z.ZodString;
    data: z.ZodObject<{
      id: z.ZodOptional<z.ZodDefault<z.ZodString>>;
      name: z.ZodOptional<z.ZodString>;
      organizationId: z.ZodOptional<z.ZodString>;
      createdAt: z.ZodOptional<z.ZodDate>;
      updatedAt: z.ZodOptional<z.ZodOptional<z.ZodDate>>;
    }, z.core.$strip>;
  }, z.core.$strip>;
  requireHeaders: true;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
  metadata: {
    $Infer: {
      body: {
        teamId: string;
        data: Partial<PrettifyDeep<Omit<z.infer<typeof teamSchema>, "id" | "createdAt" | "updatedAt">> & InferAdditionalFieldsFromPluginOptions<"team", O>>;
      };
    };
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
                  id: {
                    type: string;
                    description: string;
                  };
                  name: {
                    type: string;
                    description: string;
                  };
                  organizationId: {
                    type: string;
                    description: string;
                  };
                  createdAt: {
                    type: string;
                    format: string;
                    description: string;
                  };
                  updatedAt: {
                    type: string;
                    format: string;
                    description: string;
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
}, (({
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt?: Date | undefined;
} & InferAdditionalFieldsFromPluginOptions<"team", O, false> extends infer T ? { [K in keyof T]: T[K] } : never) & InferAdditionalFieldsFromPluginOptions<"team", O, true>) | null>;
declare const listOrganizationTeams: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/list-teams", {
  method: "GET";
  query: z.ZodOptional<z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  requireHeaders: true;
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "array";
                items: {
                  type: string;
                  properties: {
                    id: {
                      type: string;
                      description: string;
                    };
                    name: {
                      type: string;
                      description: string;
                    };
                    organizationId: {
                      type: string;
                      description: string;
                    };
                    createdAt: {
                      type: string;
                      format: string;
                      description: string;
                    };
                    updatedAt: {
                      type: string;
                      format: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
                description: string;
              };
            };
          };
        };
      };
    };
  };
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
} & {
  use: any[];
}, ({
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt?: Date | undefined;
} & InferAdditionalFieldsFromPluginOptions<"team", O, false> extends infer T ? { [K in keyof T]: T[K] } : never)[]>;
declare const setActiveTeam: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/set-active-team", {
  method: "POST";
  body: z.ZodObject<{
    teamId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  }, z.core.$strip>;
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
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
                description: string;
                $ref: string;
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
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt?: Date | undefined;
} | null>;
declare const listUserTeams: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/list-user-teams", {
  method: "GET";
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "array";
                items: {
                  type: string;
                  description: string;
                  $ref: string;
                };
                description: string;
              };
            };
          };
        };
      };
    };
  };
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
} & {
  use: any[];
}, {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt?: Date | undefined;
}[]>;
declare const listTeamMembers: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/list-team-members", {
  method: "GET";
  query: z.ZodOptional<z.ZodObject<{
    teamId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "array";
                items: {
                  type: string;
                  description: string;
                  properties: {
                    id: {
                      type: string;
                      description: string;
                    };
                    userId: {
                      type: string;
                      description: string;
                    };
                    teamId: {
                      type: string;
                      description: string;
                    };
                    createdAt: {
                      type: string;
                      format: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
                description: string;
              };
            };
          };
        };
      };
    };
  };
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
} & {
  use: any[];
}, {
  id: string;
  teamId: string;
  userId: string;
  createdAt: Date;
}[]>;
declare const addTeamMember: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/add-team-member", {
  method: "POST";
  body: z.ZodObject<{
    teamId: z.ZodString;
    userId: z.ZodCoercedString<unknown>;
  }, z.core.$strip>;
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
                description: string;
                properties: {
                  id: {
                    type: string;
                    description: string;
                  };
                  userId: {
                    type: string;
                    description: string;
                  };
                  teamId: {
                    type: string;
                    description: string;
                  };
                  createdAt: {
                    type: string;
                    format: string;
                    description: string;
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
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
} & {
  use: any[];
}, {
  id: string;
  teamId: string;
  userId: string;
  createdAt: Date;
}>;
declare const removeTeamMember: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/remove-team-member", {
  method: "POST";
  body: z.ZodObject<{
    teamId: z.ZodString;
    userId: z.ZodCoercedString<unknown>;
  }, z.core.$strip>;
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
                  message: {
                    type: string;
                    description: string;
                    enum: string[];
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
  use: (((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
    orgOptions: OrganizationOptions;
    roles: typeof defaultRoles & {
      [key: string]: Role<{}>;
    };
    getSession: (context: _better_auth_core26.GenericEndpointContext) => Promise<{
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    }>;
  }>) | ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>))[];
} & {
  use: any[];
}, {
  message: string;
}>;
//#endregion
//#region src/plugins/organization/organization.d.ts
declare function parseRoles(roles: string | string[]): string;
type DynamicAccessControlEndpoints<O extends OrganizationOptions> = {
  createOrgRole: ReturnType<typeof createOrgRole<O>>;
  deleteOrgRole: ReturnType<typeof deleteOrgRole<O>>;
  listOrgRoles: ReturnType<typeof listOrgRoles<O>>;
  getOrgRole: ReturnType<typeof getOrgRole<O>>;
  updateOrgRole: ReturnType<typeof updateOrgRole<O>>;
};
type TeamEndpoints<O extends OrganizationOptions> = {
  createTeam: ReturnType<typeof createTeam<O>>;
  listOrganizationTeams: ReturnType<typeof listOrganizationTeams<O>>;
  removeTeam: ReturnType<typeof removeTeam<O>>;
  updateTeam: ReturnType<typeof updateTeam<O>>;
  setActiveTeam: ReturnType<typeof setActiveTeam<O>>;
  listUserTeams: ReturnType<typeof listUserTeams<O>>;
  listTeamMembers: ReturnType<typeof listTeamMembers<O>>;
  addTeamMember: ReturnType<typeof addTeamMember<O>>;
  removeTeamMember: ReturnType<typeof removeTeamMember<O>>;
};
type OrganizationEndpoints<O extends OrganizationOptions> = {
  createOrganization: ReturnType<typeof createOrganization<O>>;
  updateOrganization: ReturnType<typeof updateOrganization<O>>;
  deleteOrganization: ReturnType<typeof deleteOrganization<O>>;
  setActiveOrganization: ReturnType<typeof setActiveOrganization<O>>;
  getFullOrganization: ReturnType<typeof getFullOrganization<O>>;
  listOrganizations: ReturnType<typeof listOrganizations<O>>;
  createInvitation: ReturnType<typeof createInvitation<O>>;
  cancelInvitation: ReturnType<typeof cancelInvitation<O>>;
  acceptInvitation: ReturnType<typeof acceptInvitation<O>>;
  getInvitation: ReturnType<typeof getInvitation<O>>;
  rejectInvitation: ReturnType<typeof rejectInvitation<O>>;
  listInvitations: ReturnType<typeof listInvitations<O>>;
  getActiveMember: ReturnType<typeof getActiveMember<O>>;
  checkOrganizationSlug: ReturnType<typeof checkOrganizationSlug<O>>;
  addMember: ReturnType<typeof addMember<O>>;
  removeMember: ReturnType<typeof removeMember<O>>;
  updateMemberRole: ReturnType<typeof updateMemberRole<O>>;
  leaveOrganization: ReturnType<typeof leaveOrganization<O>>;
  listUserInvitations: ReturnType<typeof listUserInvitations<O>>;
  listMembers: ReturnType<typeof listMembers<O>>;
  getActiveMemberRole: ReturnType<typeof getActiveMemberRole<O>>;
  hasPermission: ReturnType<typeof createHasPermission<O>>;
};
declare const createHasPermission: <O extends OrganizationOptions>(options: O) => better_call636.StrictEndpoint<"/organization/has-permission", {
  method: "POST";
  requireHeaders: true;
  body: z.ZodIntersection<z.ZodObject<{
    organizationId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>, z.ZodUnion<readonly [z.ZodObject<{
    permission: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
    permissions: z.ZodUndefined;
  }, z.core.$strip>, z.ZodObject<{
    permission: z.ZodUndefined;
    permissions: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
  }, z.core.$strip>]>>;
  use: ((inputContext: better_call636.MiddlewareInputContext<{
    use: ((inputContext: better_call636.MiddlewareInputContext<better_call636.MiddlewareOptions>) => Promise<{
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
  }>) => Promise<{
    session: {
      session: _better_auth_core_db20.Session & {
        activeTeamId?: string | undefined;
        activeOrganizationId?: string | undefined;
      };
      user: _better_auth_core_db20.User;
    };
  }>)[];
  metadata: {
    $Infer: {
      body: ({
        /**
         * @deprecated Use `permissions` instead
         */
        permission: { [key in keyof (O["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })]?: ((O["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })[key] extends readonly unknown[] ? (O["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })[key][number] : never)[] | undefined };
        permissions?: never | undefined;
      } | {
        permissions: { [key in keyof (O["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })]?: ((O["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })[key] extends readonly unknown[] ? (O["ac"] extends AccessControl<infer S extends Statements> ? S : {
          readonly organization: readonly ["update", "delete"];
          readonly member: readonly ["create", "update", "delete"];
          readonly invitation: readonly ["create", "cancel"];
          readonly team: readonly ["create", "update", "delete"];
          readonly ac: readonly ["create", "read", "update", "delete"];
        })[key][number] : never)[] | undefined };
        permission?: never | undefined;
      }) & {
        organizationId?: string | undefined;
      };
    };
    openapi: {
      description: string;
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object";
              properties: {
                permission: {
                  type: string;
                  description: string;
                  deprecated: boolean;
                };
                permissions: {
                  type: string;
                  description: string;
                };
              };
              required: string[];
            };
          };
        };
      };
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  error: {
                    type: string;
                  };
                  success: {
                    type: string;
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
  error: null;
  success: boolean;
}>;
type OrganizationPlugin<O extends OrganizationOptions> = {
  id: "organization";
  endpoints: OrganizationEndpoints<O> & (O extends {
    teams: {
      enabled: true;
    };
  } ? TeamEndpoints<O> : {}) & (O extends {
    dynamicAccessControl: {
      enabled: true;
    };
  } ? DynamicAccessControlEndpoints<O> : {});
  schema: OrganizationSchema<O>;
  $Infer: {
    Organization: InferOrganization<O>;
    Invitation: InferInvitation<O>;
    Member: InferMember<O>;
    Team: O["teams"] extends {
      enabled: true;
    } ? Team : any;
    TeamMember: O["teams"] extends {
      enabled: true;
    } ? TeamMember : any;
    ActiveOrganization: O["teams"] extends {
      enabled: true;
    } ? {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
      teams: InferTeam<O, false>[];
    } & InferOrganization<O, false> : {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
    } & InferOrganization<O, false>;
  };
  $ERROR_CODES: typeof ORGANIZATION_ERROR_CODES;
  options: O;
};
/**
 * Organization plugin for Better Auth. Organization allows you to create teams, members,
 * and manage access control for your users.
 *
 * @example
 * ```ts
 * const auth = betterAuth({
 *  plugins: [
 *    organization({
 *      allowUserToCreateOrganization: true,
 *    }),
 *  ],
 * });
 * ```
 */
declare function organization<O extends OrganizationOptions & {
  teams: {
    enabled: true;
  };
}>(options?: O | undefined): {
  id: "organization";
  endpoints: OrganizationEndpoints<O> & TeamEndpoints<O>;
  schema: OrganizationSchema<O>;
  $Infer: {
    Organization: InferOrganization<O>;
    Invitation: InferInvitation<O>;
    Member: InferMember<O>;
    Team: O["teams"] extends {
      enabled: true;
    } ? Team : unknown;
    TeamMember: O["teams"] extends {
      enabled: true;
    } ? TeamMember : unknown;
    ActiveOrganization: O["teams"] extends {
      enabled: true;
    } ? {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
      teams: InferTeam<O, false>[];
    } & InferOrganization<O, false> : {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
    } & InferOrganization<O, false>;
  };
  $ERROR_CODES: typeof ORGANIZATION_ERROR_CODES;
  options: O;
};
declare function organization<O extends OrganizationOptions & {
  teams: {
    enabled: true;
  };
  dynamicAccessControl: {
    enabled: true;
  };
}>(options?: O | undefined): {
  id: "organization";
  endpoints: OrganizationEndpoints<O> & TeamEndpoints<O> & DynamicAccessControlEndpoints<O>;
  schema: OrganizationSchema<O>;
  $Infer: {
    Organization: InferOrganization<O>;
    Invitation: InferInvitation<O>;
    Member: InferMember<O>;
    Team: O["teams"] extends {
      enabled: true;
    } ? Team : any;
    TeamMember: O["teams"] extends {
      enabled: true;
    } ? TeamMember : any;
    ActiveOrganization: O["teams"] extends {
      enabled: true;
    } ? {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
      teams: InferTeam<O, false>[];
    } & InferOrganization<O, false> : {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
    } & InferOrganization<O, false>;
  };
  $ERROR_CODES: typeof ORGANIZATION_ERROR_CODES;
  options: O;
};
declare function organization<O extends OrganizationOptions & {
  dynamicAccessControl: {
    enabled: true;
  };
}>(options?: O | undefined): {
  id: "organization";
  endpoints: OrganizationEndpoints<O> & DynamicAccessControlEndpoints<O>;
  schema: OrganizationSchema<O>;
  $Infer: {
    Organization: InferOrganization<O>;
    Invitation: InferInvitation<O>;
    Member: InferMember<O>;
    Team: O["teams"] extends {
      enabled: true;
    } ? Team : any;
    TeamMember: O["teams"] extends {
      enabled: true;
    } ? TeamMember : any;
    ActiveOrganization: O["teams"] extends {
      enabled: true;
    } ? {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
      teams: InferTeam<O, false>[];
    } & InferOrganization<O, false> : {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
    } & InferOrganization<O, false>;
  };
  $ERROR_CODES: typeof ORGANIZATION_ERROR_CODES;
  options: O;
};
declare function organization<O extends OrganizationOptions>(options?: O | undefined): {
  id: "organization";
  endpoints: OrganizationEndpoints<O>;
  schema: OrganizationSchema<O>;
  $Infer: {
    Organization: InferOrganization<O>;
    Invitation: InferInvitation<O>;
    Member: InferMember<O>;
    Team: O["teams"] extends {
      enabled: true;
    } ? Team : any;
    TeamMember: O["teams"] extends {
      enabled: true;
    } ? TeamMember : any;
    ActiveOrganization: O["teams"] extends {
      enabled: true;
    } ? {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
      teams: InferTeam<O, false>[];
    } & InferOrganization<O, false> : {
      members: InferMember<O, false>[];
      invitations: InferInvitation<O, false>[];
    } & InferOrganization<O, false>;
  };
  $ERROR_CODES: typeof ORGANIZATION_ERROR_CODES;
  options: O;
};
//#endregion
export { getClient as $, TeamMemberInput as A, OrganizationOptions as B, Organization as C, Team as D, OrganizationSchema as E, organizationRoleSchema as F, memberAc as G, defaultAc as H, organizationSchema as I, getMCPProviderMetadata as J, ownerAc as K, roleSchema as L, invitationSchema as M, invitationStatus as N, TeamInput as O, memberSchema as P, withMcpAuth as Q, teamMemberSchema as R, MemberInput as S, OrganizationRole as T, defaultRoles as U, adminAc as V, defaultStatements as W, oAuthDiscoveryMetadata as X, mcp as Y, oAuthProtectedResourceMetadata as Z, InferTeam as _, InferAdminRolesFromOption as _t, optionsMiddleware as a, OAuthAccessToken as at, InvitationStatus as b, OrganizationPlugin as c, TokenBody as ct, parseRoles as d, API_KEY_TABLE_NAME as dt, getMetadata as et, InferInvitation as f, ERROR_CODES as ft, InferOrganizationZodRolesFromOption as g, AdminOptions as gt, InferOrganizationRolesFromOption as h, admin as ht, createAuthMiddleware$1 as i, CodeVerificationValue as it, defaultRolesSchema as j, TeamMember as k, TeamEndpoints as l, LastLoginMethodOptions as lt, InferOrganization as m, defaultKeyHasher as mt, AuthMiddleware as n, AuthorizationQuery as nt, DynamicAccessControlEndpoints as o, OIDCMetadata as ot, InferMember as p, apiKey as pt, getMCPProtectedResourceMetadata as q, createAuthEndpoint$1 as r, Client as rt, OrganizationEndpoints as s, OIDCOptions as st, AuthEndpoint as t, oidcProvider as tt, organization as u, lastLoginMethod as ut, Invitation as v, SessionWithImpersonatedBy as vt, OrganizationInput as w, Member as x, InvitationInput as y, UserWithRole as yt, teamSchema as z };