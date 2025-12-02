import { Sn as InferRoute, Yt as InferAPI, _ as User, g as Session, hn as InferErrorCodes, o as Auth, yn as IsSignal } from "../index--CrC0_x3.mjs";
import "../types-CRiHq5rJ.mjs";
import { h as UnionToIntersection, u as Prettify$1 } from "../helper-DU33OcfW.mjs";
import "../index-CNCxG_Zo.mjs";
import "../plugins-Brc8BsoZ.mjs";
import { p as setCookieToHeader } from "../index-BKo25X5y.mjs";
import * as _better_auth_core21 from "@better-auth/core";
import { BetterAuthClientOptions, BetterAuthOptions } from "@better-auth/core";
import * as _better_auth_core_oauth22 from "@better-auth/core/oauth2";
import * as better_call240 from "better-call";
import * as zod415 from "zod";
import * as nanostores3 from "nanostores";
import * as _better_fetch_fetch85 from "@better-fetch/fetch";
import { SuccessContext } from "@better-fetch/fetch";
import * as _better_auth_core_db_adapter0 from "@better-auth/core/db/adapter";
import * as zod_v4_core57 from "zod/v4/core";

//#region src/test-utils/headers.d.ts
/**
 * converts set cookie containing headers to
 * cookie containing headers
 */
declare function convertSetCookieToCookie(headers: Headers): Headers;
//#endregion
//#region src/test-utils/test-instance.d.ts
declare function getTestInstance<O extends Partial<BetterAuthOptions>, C extends BetterAuthClientOptions>(options?: O | undefined, config?: {
  clientOptions?: C;
  port?: number;
  disableTestUser?: boolean;
  testUser?: Partial<User>;
  testWith?: "sqlite" | "postgres" | "mongodb" | "mysql";
} | undefined): Promise<{
  auth: Auth<O>;
  client: UnionToIntersection<(C extends undefined ? {} : C) & {
    baseURL: string | undefined;
    fetchOptions: {
      customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
    };
  } extends infer T ? T extends (C extends undefined ? {} : C) & {
    baseURL: string | undefined;
    fetchOptions: {
      customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
    };
  } ? T extends {
    plugins: Array<infer Plugin>;
  } ? UnionToIntersection<Plugin extends _better_auth_core21.BetterAuthClientPlugin ? Plugin["getAtoms"] extends ((fetch: any) => infer Atoms) ? Atoms extends Record<string, any> ? { [key in keyof Atoms as IsSignal<key> extends true ? never : key extends string ? `use${Capitalize<key>}` : never]: Atoms[key] } : {} : {} : {}> : {} : never : never> & UnionToIntersection<InferRoute<((C extends undefined ? {} : C) & {
    baseURL: string | undefined;
    fetchOptions: {
      customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
    };
  })["plugins"] extends any[] ? {
    getSession: <R extends boolean, H extends boolean = false>(context: {
      headers: Headers;
      query?: {
        disableCookieCache?: boolean;
        disableRefresh?: boolean;
      } | undefined;
      asResponse?: R | undefined;
      returnHeaders?: H | undefined;
    }) => false extends R ? H extends true ? Promise<{
      headers: Headers;
      response: {
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
      } | null;
    }> : Promise<{
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
    } | null> : Promise<Response>;
  } & {
    readonly ok: better_call240.StrictEndpoint<"/ok", {
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
                    type: "object";
                    properties: {
                      ok: {
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
        isAction: false;
      };
    } & {
      use: any[];
    }, {
      ok: boolean;
    }>;
    readonly error: better_call240.StrictEndpoint<"/error", {
      method: "GET";
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "text/html": {
                  schema: {
                    type: "string";
                    description: string;
                  };
                };
              };
            };
          };
        };
        isAction: false;
      };
    } & {
      use: any[];
    }, Response>;
    readonly signInSocial: better_call240.StrictEndpoint<"/sign-in/social", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
        newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
        errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
        provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
        disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
        idToken: zod415.ZodOptional<zod415.ZodObject<{
          token: zod415.ZodString;
          nonce: zod415.ZodOptional<zod415.ZodString>;
          accessToken: zod415.ZodOptional<zod415.ZodString>;
          refreshToken: zod415.ZodOptional<zod415.ZodString>;
          expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
        }, zod_v4_core57.$strip>>;
        scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
        requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
        loginHint: zod415.ZodOptional<zod415.ZodString>;
        additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
      }, zod_v4_core57.$strip>;
      metadata: {
        $Infer: {
          body: zod415.infer<zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
            }, zod_v4_core57.$strip>>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            loginHint: zod415.ZodOptional<zod415.ZodString>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>>;
          returned: {
            redirect: boolean;
            token?: string | undefined;
            url?: string | undefined;
            user?: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } | undefined;
          };
        };
        openapi: {
          description: string;
          operationId: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    description: string;
                    properties: {
                      token: {
                        type: string;
                      };
                      user: {
                        type: string;
                        $ref: string;
                      };
                      url: {
                        type: string;
                      };
                      redirect: {
                        type: string;
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
      redirect: boolean;
      url: string;
    } | {
      redirect: boolean;
      token: string;
      url: undefined;
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
    readonly callbackOAuth: better_call240.StrictEndpoint<"/callback/:id", {
      method: ("GET" | "POST")[];
      operationId: string;
      body: zod415.ZodOptional<zod415.ZodObject<{
        code: zod415.ZodOptional<zod415.ZodString>;
        error: zod415.ZodOptional<zod415.ZodString>;
        device_id: zod415.ZodOptional<zod415.ZodString>;
        error_description: zod415.ZodOptional<zod415.ZodString>;
        state: zod415.ZodOptional<zod415.ZodString>;
        user: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>>;
      query: zod415.ZodOptional<zod415.ZodObject<{
        code: zod415.ZodOptional<zod415.ZodString>;
        error: zod415.ZodOptional<zod415.ZodString>;
        device_id: zod415.ZodOptional<zod415.ZodString>;
        error_description: zod415.ZodOptional<zod415.ZodString>;
        state: zod415.ZodOptional<zod415.ZodString>;
        user: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>>;
      metadata: {
        allowedMediaTypes: string[];
        isAction: false;
      };
    } & {
      use: any[];
    }, void>;
    readonly getSession: better_call240.StrictEndpoint<"/get-session", {
      method: "GET";
      operationId: string;
      query: zod415.ZodOptional<zod415.ZodObject<{
        disableCookieCache: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
        disableRefresh: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
      }, zod_v4_core57.$strip>>;
      requireHeaders: true;
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
                      session: {
                        $ref: string;
                      };
                      user: {
                        $ref: string;
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
    } | null>;
    readonly signOut: better_call240.StrictEndpoint<"/sign-out", {
      method: "POST";
      operationId: string;
      requireHeaders: true;
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
    readonly signUpEmail: better_call240.StrictEndpoint<"/sign-up/email", {
      method: "POST";
      operationId: string;
      body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
      metadata: {
        $Infer: {
          body: {
            name: string;
            email: string;
            password: string;
            image?: string | undefined;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
          };
          returned: {
            token: string | null;
            user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            };
          };
        };
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    name: {
                      type: string;
                      description: string;
                    };
                    email: {
                      type: string;
                      description: string;
                    };
                    password: {
                      type: string;
                      description: string;
                    };
                    image: {
                      type: string;
                      description: string;
                    };
                    callbackURL: {
                      type: string;
                      description: string;
                    };
                    rememberMe: {
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
                      token: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                            description: string;
                          };
                          email: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          name: {
                            type: string;
                            description: string;
                          };
                          image: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          emailVerified: {
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
                    required: string[];
                  };
                };
              };
            };
            "422": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
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
      token: null;
      user: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    } | {
      token: string;
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
    readonly signInEmail: better_call240.StrictEndpoint<"/sign-in/email", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        email: zod415.ZodString;
        password: zod415.ZodString;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
        rememberMe: zod415.ZodOptional<zod415.ZodDefault<zod415.ZodBoolean>>;
      }, zod_v4_core57.$strip>;
      metadata: {
        $Infer: {
          body: {
            email: string;
            password: string;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
          };
          returned: {
            redirect: boolean;
            token: string;
            url?: string | undefined;
            user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            };
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
                    description: string;
                    properties: {
                      redirect: {
                        type: string;
                        enum: boolean[];
                      };
                      token: {
                        type: string;
                        description: string;
                      };
                      url: {
                        type: string;
                        nullable: boolean;
                      };
                      user: {
                        type: string;
                        $ref: string;
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
      redirect: boolean;
      token: string;
      url?: string | undefined;
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
    readonly resetPassword: better_call240.StrictEndpoint<"/reset-password", {
      method: "POST";
      operationId: string;
      query: zod415.ZodOptional<zod415.ZodObject<{
        token: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>>;
      body: zod415.ZodObject<{
        newPassword: zod415.ZodString;
        token: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
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
    readonly verifyEmail: better_call240.StrictEndpoint<"/verify-email", {
      method: "GET";
      operationId: string;
      query: zod415.ZodObject<{
        token: zod415.ZodString;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          description: string;
          parameters: ({
            name: string;
            in: "query";
            description: string;
            required: true;
            schema: {
              type: "string";
            };
          } | {
            name: string;
            in: "query";
            description: string;
            required: false;
            schema: {
              type: "string";
            };
          })[];
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                      status: {
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
    }, void | {
      status: boolean;
    }>;
    readonly sendVerificationEmail: better_call240.StrictEndpoint<"/send-verification-email", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        email: zod415.ZodEmail;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    email: {
                      type: string;
                      description: string;
                      example: string;
                    };
                    callbackURL: {
                      type: string;
                      description: string;
                      example: string;
                      nullable: boolean;
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
                      status: {
                        type: string;
                        description: string;
                        example: boolean;
                      };
                    };
                  };
                };
              };
            };
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
                        type: string;
                        description: string;
                        example: string;
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
    readonly changeEmail: better_call240.StrictEndpoint<"/change-email", {
      method: "POST";
      body: zod415.ZodObject<{
        newEmail: zod415.ZodEmail;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                      status: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
                        description: string;
                        nullable: boolean;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
            "422": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
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
    readonly changePassword: better_call240.StrictEndpoint<"/change-password", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        newPassword: zod415.ZodString;
        currentPassword: zod415.ZodString;
        revokeOtherSessions: zod415.ZodOptional<zod415.ZodBoolean>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                            description: string;
                          };
                          email: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          name: {
                            type: string;
                            description: string;
                          };
                          image: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          emailVerified: {
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
      token: string | null;
      user: {
        id: string;
        email: string;
        name: string;
        image: string | null | undefined;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
    readonly setPassword: better_call240.StrictEndpoint<"/set-password", {
      method: "POST";
      body: zod415.ZodObject<{
        newPassword: zod415.ZodString;
      }, zod_v4_core57.$strip>;
      metadata: {
        SERVER_ONLY: true;
      };
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly updateUser: better_call240.StrictEndpoint<"/update-user", {
      method: "POST";
      operationId: string;
      body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        $Infer: {
          body: Partial<{}> & {
            name?: string | undefined;
            image?: string | undefined;
          };
        };
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    name: {
                      type: string;
                      description: string;
                    };
                    image: {
                      type: string;
                      description: string;
                    };
                  };
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
                      user: {
                        type: string;
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
      status: boolean;
    }>;
    readonly deleteUser: better_call240.StrictEndpoint<"/delete-user", {
      method: "POST";
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
      body: zod415.ZodObject<{
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
        password: zod415.ZodOptional<zod415.ZodString>;
        token: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    callbackURL: {
                      type: string;
                      description: string;
                    };
                    password: {
                      type: string;
                      description: string;
                    };
                    token: {
                      type: string;
                      description: string;
                    };
                  };
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
                      message: {
                        type: string;
                        enum: string[];
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
      message: string;
    }>;
    readonly requestPasswordReset: better_call240.StrictEndpoint<"/request-password-reset", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        email: zod415.ZodEmail;
        redirectTo: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
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
                      status: {
                        type: string;
                      };
                      message: {
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
      message: string;
    }>;
    readonly requestPasswordResetCallback: better_call240.StrictEndpoint<"/reset-password/:token", {
      method: "GET";
      operationId: string;
      query: zod415.ZodObject<{
        callbackURL: zod415.ZodString;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          parameters: ({
            name: string;
            in: "path";
            required: true;
            description: string;
            schema: {
              type: "string";
            };
          } | {
            name: string;
            in: "query";
            required: true;
            description: string;
            schema: {
              type: "string";
            };
          })[];
          responses: {
            "200": {
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
    }, never>;
    readonly listSessions: better_call240.StrictEndpoint<"/list-sessions", {
      method: "GET";
      operationId: string;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
      requireHeaders: true;
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
    }, Prettify$1<{
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      expiresAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    }>[]>;
    readonly revokeSession: better_call240.StrictEndpoint<"/revoke-session", {
      method: "POST";
      body: zod415.ZodObject<{
        token: zod415.ZodString;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
      requireHeaders: true;
      metadata: {
        openapi: {
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    token: {
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
                      status: {
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
      status: boolean;
    }>;
    readonly revokeSessions: better_call240.StrictEndpoint<"/revoke-sessions", {
      method: "POST";
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                      status: {
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
      status: boolean;
    }>;
    readonly revokeOtherSessions: better_call240.StrictEndpoint<"/revoke-other-sessions", {
      method: "POST";
      requireHeaders: true;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                      status: {
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
      status: boolean;
    }>;
    readonly linkSocialAccount: better_call240.StrictEndpoint<"/link-social", {
      method: "POST";
      requireHeaders: true;
      body: zod415.ZodObject<{
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
        provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
        idToken: zod415.ZodOptional<zod415.ZodObject<{
          token: zod415.ZodString;
          nonce: zod415.ZodOptional<zod415.ZodString>;
          accessToken: zod415.ZodOptional<zod415.ZodString>;
          refreshToken: zod415.ZodOptional<zod415.ZodString>;
          scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
        }, zod_v4_core57.$strip>>;
        requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
        scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
        errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
        disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
        additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          operationId: string;
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
                        description: string;
                      };
                      redirect: {
                        type: string;
                        description: string;
                      };
                      status: {
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
      url: string;
      redirect: boolean;
    }>;
    readonly listUserAccounts: better_call240.StrictEndpoint<"/list-accounts", {
      method: "GET";
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                        };
                        providerId: {
                          type: string;
                        };
                        createdAt: {
                          type: string;
                          format: string;
                        };
                        updatedAt: {
                          type: string;
                          format: string;
                        };
                        accountId: {
                          type: string;
                        };
                        userId: {
                          type: string;
                        };
                        scopes: {
                          type: string;
                          items: {
                            type: string;
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
      };
    } & {
      use: any[];
    }, {
      id: string;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
      accountId: string;
      userId: string;
      scopes: string[];
    }[]>;
    readonly deleteUserCallback: better_call240.StrictEndpoint<"/delete-user/callback", {
      method: "GET";
      query: zod415.ZodObject<{
        token: zod415.ZodString;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
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
                      success: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
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
      message: string;
    }>;
    readonly unlinkAccount: better_call240.StrictEndpoint<"/unlink-account", {
      method: "POST";
      body: zod415.ZodObject<{
        providerId: zod415.ZodString;
        accountId: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
    readonly refreshToken: better_call240.StrictEndpoint<"/refresh-token", {
      method: "POST";
      body: zod415.ZodObject<{
        providerId: zod415.ZodString;
        accountId: zod415.ZodOptional<zod415.ZodString>;
        userId: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
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
                      tokenType: {
                        type: string;
                      };
                      idToken: {
                        type: string;
                      };
                      accessToken: {
                        type: string;
                      };
                      refreshToken: {
                        type: string;
                      };
                      accessTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                      refreshTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      accessToken: string | undefined;
      refreshToken: string | undefined;
      accessTokenExpiresAt: Date | undefined;
      refreshTokenExpiresAt: Date | undefined;
      scope: string | null | undefined;
      idToken: string | null | undefined;
      providerId: string;
      accountId: string;
    }>;
    readonly getAccessToken: better_call240.StrictEndpoint<"/get-access-token", {
      method: "POST";
      body: zod415.ZodObject<{
        providerId: zod415.ZodString;
        accountId: zod415.ZodOptional<zod415.ZodString>;
        userId: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
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
                      tokenType: {
                        type: string;
                      };
                      idToken: {
                        type: string;
                      };
                      accessToken: {
                        type: string;
                      };
                      refreshToken: {
                        type: string;
                      };
                      accessTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                      refreshTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      accessToken: string;
      accessTokenExpiresAt: Date | undefined;
      scopes: string[];
      idToken: string | undefined;
    }>;
    readonly accountInfo: better_call240.StrictEndpoint<"/account-info", {
      method: "GET";
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                          };
                          name: {
                            type: string;
                          };
                          email: {
                            type: string;
                          };
                          image: {
                            type: string;
                          };
                          emailVerified: {
                            type: string;
                          };
                        };
                        required: string[];
                      };
                      data: {
                        type: string;
                        properties: {};
                        additionalProperties: boolean;
                      };
                    };
                    required: string[];
                    additionalProperties: boolean;
                  };
                };
              };
            };
          };
        };
      };
      query: zod415.ZodOptional<zod415.ZodObject<{
        accountId: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>>;
    } & {
      use: any[];
    }, {
      user: _better_auth_core_oauth22.OAuth2UserInfo;
      data: Record<string, any>;
    } | null>;
  } & (((C extends undefined ? {} : C) & {
    baseURL: string | undefined;
    fetchOptions: {
      customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
    };
  })["plugins"] extends (infer Pl)[] ? UnionToIntersection<Pl extends {
    $InferServerPlugin: infer Plug;
  } ? Plug extends {
    endpoints: infer Endpoints;
  } ? Endpoints : {} : {}> : {}) : InferAPI<{
    readonly ok: better_call240.StrictEndpoint<"/ok", {
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
                    type: "object";
                    properties: {
                      ok: {
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
        isAction: false;
      };
    } & {
      use: any[];
    }, {
      ok: boolean;
    }>;
    readonly error: better_call240.StrictEndpoint<"/error", {
      method: "GET";
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "text/html": {
                  schema: {
                    type: "string";
                    description: string;
                  };
                };
              };
            };
          };
        };
        isAction: false;
      };
    } & {
      use: any[];
    }, Response>;
    readonly signInSocial: better_call240.StrictEndpoint<"/sign-in/social", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
        newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
        errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
        provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
        disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
        idToken: zod415.ZodOptional<zod415.ZodObject<{
          token: zod415.ZodString;
          nonce: zod415.ZodOptional<zod415.ZodString>;
          accessToken: zod415.ZodOptional<zod415.ZodString>;
          refreshToken: zod415.ZodOptional<zod415.ZodString>;
          expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
        }, zod_v4_core57.$strip>>;
        scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
        requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
        loginHint: zod415.ZodOptional<zod415.ZodString>;
        additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
      }, zod_v4_core57.$strip>;
      metadata: {
        $Infer: {
          body: zod415.infer<zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
            }, zod_v4_core57.$strip>>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            loginHint: zod415.ZodOptional<zod415.ZodString>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>>;
          returned: {
            redirect: boolean;
            token?: string | undefined;
            url?: string | undefined;
            user?: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } | undefined;
          };
        };
        openapi: {
          description: string;
          operationId: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    description: string;
                    properties: {
                      token: {
                        type: string;
                      };
                      user: {
                        type: string;
                        $ref: string;
                      };
                      url: {
                        type: string;
                      };
                      redirect: {
                        type: string;
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
      redirect: boolean;
      url: string;
    } | {
      redirect: boolean;
      token: string;
      url: undefined;
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
    readonly callbackOAuth: better_call240.StrictEndpoint<"/callback/:id", {
      method: ("GET" | "POST")[];
      operationId: string;
      body: zod415.ZodOptional<zod415.ZodObject<{
        code: zod415.ZodOptional<zod415.ZodString>;
        error: zod415.ZodOptional<zod415.ZodString>;
        device_id: zod415.ZodOptional<zod415.ZodString>;
        error_description: zod415.ZodOptional<zod415.ZodString>;
        state: zod415.ZodOptional<zod415.ZodString>;
        user: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>>;
      query: zod415.ZodOptional<zod415.ZodObject<{
        code: zod415.ZodOptional<zod415.ZodString>;
        error: zod415.ZodOptional<zod415.ZodString>;
        device_id: zod415.ZodOptional<zod415.ZodString>;
        error_description: zod415.ZodOptional<zod415.ZodString>;
        state: zod415.ZodOptional<zod415.ZodString>;
        user: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>>;
      metadata: {
        allowedMediaTypes: string[];
        isAction: false;
      };
    } & {
      use: any[];
    }, void>;
    readonly getSession: better_call240.StrictEndpoint<"/get-session", {
      method: "GET";
      operationId: string;
      query: zod415.ZodOptional<zod415.ZodObject<{
        disableCookieCache: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
        disableRefresh: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
      }, zod_v4_core57.$strip>>;
      requireHeaders: true;
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
                      session: {
                        $ref: string;
                      };
                      user: {
                        $ref: string;
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
    } | null>;
    readonly signOut: better_call240.StrictEndpoint<"/sign-out", {
      method: "POST";
      operationId: string;
      requireHeaders: true;
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
    readonly signUpEmail: better_call240.StrictEndpoint<"/sign-up/email", {
      method: "POST";
      operationId: string;
      body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
      metadata: {
        $Infer: {
          body: {
            name: string;
            email: string;
            password: string;
            image?: string | undefined;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
          };
          returned: {
            token: string | null;
            user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            };
          };
        };
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    name: {
                      type: string;
                      description: string;
                    };
                    email: {
                      type: string;
                      description: string;
                    };
                    password: {
                      type: string;
                      description: string;
                    };
                    image: {
                      type: string;
                      description: string;
                    };
                    callbackURL: {
                      type: string;
                      description: string;
                    };
                    rememberMe: {
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
                      token: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                            description: string;
                          };
                          email: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          name: {
                            type: string;
                            description: string;
                          };
                          image: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          emailVerified: {
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
                    required: string[];
                  };
                };
              };
            };
            "422": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
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
      token: null;
      user: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    } | {
      token: string;
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
    readonly signInEmail: better_call240.StrictEndpoint<"/sign-in/email", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        email: zod415.ZodString;
        password: zod415.ZodString;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
        rememberMe: zod415.ZodOptional<zod415.ZodDefault<zod415.ZodBoolean>>;
      }, zod_v4_core57.$strip>;
      metadata: {
        $Infer: {
          body: {
            email: string;
            password: string;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
          };
          returned: {
            redirect: boolean;
            token: string;
            url?: string | undefined;
            user: {
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            };
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
                    description: string;
                    properties: {
                      redirect: {
                        type: string;
                        enum: boolean[];
                      };
                      token: {
                        type: string;
                        description: string;
                      };
                      url: {
                        type: string;
                        nullable: boolean;
                      };
                      user: {
                        type: string;
                        $ref: string;
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
      redirect: boolean;
      token: string;
      url?: string | undefined;
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
    readonly resetPassword: better_call240.StrictEndpoint<"/reset-password", {
      method: "POST";
      operationId: string;
      query: zod415.ZodOptional<zod415.ZodObject<{
        token: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>>;
      body: zod415.ZodObject<{
        newPassword: zod415.ZodString;
        token: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
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
    readonly verifyEmail: better_call240.StrictEndpoint<"/verify-email", {
      method: "GET";
      operationId: string;
      query: zod415.ZodObject<{
        token: zod415.ZodString;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          description: string;
          parameters: ({
            name: string;
            in: "query";
            description: string;
            required: true;
            schema: {
              type: "string";
            };
          } | {
            name: string;
            in: "query";
            description: string;
            required: false;
            schema: {
              type: "string";
            };
          })[];
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                      status: {
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
    }, void | {
      status: boolean;
    }>;
    readonly sendVerificationEmail: better_call240.StrictEndpoint<"/send-verification-email", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        email: zod415.ZodEmail;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    email: {
                      type: string;
                      description: string;
                      example: string;
                    };
                    callbackURL: {
                      type: string;
                      description: string;
                      example: string;
                      nullable: boolean;
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
                      status: {
                        type: string;
                        description: string;
                        example: boolean;
                      };
                    };
                  };
                };
              };
            };
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
                        type: string;
                        description: string;
                        example: string;
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
    readonly changeEmail: better_call240.StrictEndpoint<"/change-email", {
      method: "POST";
      body: zod415.ZodObject<{
        newEmail: zod415.ZodEmail;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                      status: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
                        description: string;
                        nullable: boolean;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
            "422": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
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
    readonly changePassword: better_call240.StrictEndpoint<"/change-password", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        newPassword: zod415.ZodString;
        currentPassword: zod415.ZodString;
        revokeOtherSessions: zod415.ZodOptional<zod415.ZodBoolean>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                            description: string;
                          };
                          email: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          name: {
                            type: string;
                            description: string;
                          };
                          image: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          emailVerified: {
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
      token: string | null;
      user: {
        id: string;
        email: string;
        name: string;
        image: string | null | undefined;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
    readonly setPassword: better_call240.StrictEndpoint<"/set-password", {
      method: "POST";
      body: zod415.ZodObject<{
        newPassword: zod415.ZodString;
      }, zod_v4_core57.$strip>;
      metadata: {
        SERVER_ONLY: true;
      };
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly updateUser: better_call240.StrictEndpoint<"/update-user", {
      method: "POST";
      operationId: string;
      body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        $Infer: {
          body: Partial<{}> & {
            name?: string | undefined;
            image?: string | undefined;
          };
        };
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    name: {
                      type: string;
                      description: string;
                    };
                    image: {
                      type: string;
                      description: string;
                    };
                  };
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
                      user: {
                        type: string;
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
      status: boolean;
    }>;
    readonly deleteUser: better_call240.StrictEndpoint<"/delete-user", {
      method: "POST";
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
      body: zod415.ZodObject<{
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
        password: zod415.ZodOptional<zod415.ZodString>;
        token: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    callbackURL: {
                      type: string;
                      description: string;
                    };
                    password: {
                      type: string;
                      description: string;
                    };
                    token: {
                      type: string;
                      description: string;
                    };
                  };
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
                      message: {
                        type: string;
                        enum: string[];
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
      message: string;
    }>;
    readonly requestPasswordReset: better_call240.StrictEndpoint<"/request-password-reset", {
      method: "POST";
      operationId: string;
      body: zod415.ZodObject<{
        email: zod415.ZodEmail;
        redirectTo: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
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
                      status: {
                        type: string;
                      };
                      message: {
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
      message: string;
    }>;
    readonly requestPasswordResetCallback: better_call240.StrictEndpoint<"/reset-password/:token", {
      method: "GET";
      operationId: string;
      query: zod415.ZodObject<{
        callbackURL: zod415.ZodString;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          parameters: ({
            name: string;
            in: "path";
            required: true;
            description: string;
            schema: {
              type: "string";
            };
          } | {
            name: string;
            in: "query";
            required: true;
            description: string;
            schema: {
              type: "string";
            };
          })[];
          responses: {
            "200": {
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
    }, never>;
    readonly listSessions: better_call240.StrictEndpoint<"/list-sessions", {
      method: "GET";
      operationId: string;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
      requireHeaders: true;
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
    }, Prettify$1<{
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      expiresAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    }>[]>;
    readonly revokeSession: better_call240.StrictEndpoint<"/revoke-session", {
      method: "POST";
      body: zod415.ZodObject<{
        token: zod415.ZodString;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
      requireHeaders: true;
      metadata: {
        openapi: {
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    token: {
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
                      status: {
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
      status: boolean;
    }>;
    readonly revokeSessions: better_call240.StrictEndpoint<"/revoke-sessions", {
      method: "POST";
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                      status: {
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
      status: boolean;
    }>;
    readonly revokeOtherSessions: better_call240.StrictEndpoint<"/revoke-other-sessions", {
      method: "POST";
      requireHeaders: true;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                      status: {
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
      status: boolean;
    }>;
    readonly linkSocialAccount: better_call240.StrictEndpoint<"/link-social", {
      method: "POST";
      requireHeaders: true;
      body: zod415.ZodObject<{
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
        provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
        idToken: zod415.ZodOptional<zod415.ZodObject<{
          token: zod415.ZodString;
          nonce: zod415.ZodOptional<zod415.ZodString>;
          accessToken: zod415.ZodOptional<zod415.ZodString>;
          refreshToken: zod415.ZodOptional<zod415.ZodString>;
          scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
        }, zod_v4_core57.$strip>>;
        requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
        scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
        errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
        disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
        additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          operationId: string;
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
                        description: string;
                      };
                      redirect: {
                        type: string;
                        description: string;
                      };
                      status: {
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
      url: string;
      redirect: boolean;
    }>;
    readonly listUserAccounts: better_call240.StrictEndpoint<"/list-accounts", {
      method: "GET";
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                        };
                        providerId: {
                          type: string;
                        };
                        createdAt: {
                          type: string;
                          format: string;
                        };
                        updatedAt: {
                          type: string;
                          format: string;
                        };
                        accountId: {
                          type: string;
                        };
                        userId: {
                          type: string;
                        };
                        scopes: {
                          type: string;
                          items: {
                            type: string;
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
      };
    } & {
      use: any[];
    }, {
      id: string;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
      accountId: string;
      userId: string;
      scopes: string[];
    }[]>;
    readonly deleteUserCallback: better_call240.StrictEndpoint<"/delete-user/callback", {
      method: "GET";
      query: zod415.ZodObject<{
        token: zod415.ZodString;
        callbackURL: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
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
                      success: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
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
      message: string;
    }>;
    readonly unlinkAccount: better_call240.StrictEndpoint<"/unlink-account", {
      method: "POST";
      body: zod415.ZodObject<{
        providerId: zod415.ZodString;
        accountId: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
    readonly refreshToken: better_call240.StrictEndpoint<"/refresh-token", {
      method: "POST";
      body: zod415.ZodObject<{
        providerId: zod415.ZodString;
        accountId: zod415.ZodOptional<zod415.ZodString>;
        userId: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
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
                      tokenType: {
                        type: string;
                      };
                      idToken: {
                        type: string;
                      };
                      accessToken: {
                        type: string;
                      };
                      refreshToken: {
                        type: string;
                      };
                      accessTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                      refreshTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      accessToken: string | undefined;
      refreshToken: string | undefined;
      accessTokenExpiresAt: Date | undefined;
      refreshTokenExpiresAt: Date | undefined;
      scope: string | null | undefined;
      idToken: string | null | undefined;
      providerId: string;
      accountId: string;
    }>;
    readonly getAccessToken: better_call240.StrictEndpoint<"/get-access-token", {
      method: "POST";
      body: zod415.ZodObject<{
        providerId: zod415.ZodString;
        accountId: zod415.ZodOptional<zod415.ZodString>;
        userId: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>;
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
                      tokenType: {
                        type: string;
                      };
                      idToken: {
                        type: string;
                      };
                      accessToken: {
                        type: string;
                      };
                      refreshToken: {
                        type: string;
                      };
                      accessTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                      refreshTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      accessToken: string;
      accessTokenExpiresAt: Date | undefined;
      scopes: string[];
      idToken: string | undefined;
    }>;
    readonly accountInfo: better_call240.StrictEndpoint<"/account-info", {
      method: "GET";
      use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                          };
                          name: {
                            type: string;
                          };
                          email: {
                            type: string;
                          };
                          image: {
                            type: string;
                          };
                          emailVerified: {
                            type: string;
                          };
                        };
                        required: string[];
                      };
                      data: {
                        type: string;
                        properties: {};
                        additionalProperties: boolean;
                      };
                    };
                    required: string[];
                    additionalProperties: boolean;
                  };
                };
              };
            };
          };
        };
      };
      query: zod415.ZodOptional<zod415.ZodObject<{
        accountId: zod415.ZodOptional<zod415.ZodString>;
      }, zod_v4_core57.$strip>>;
    } & {
      use: any[];
    }, {
      user: _better_auth_core_oauth22.OAuth2UserInfo;
      data: Record<string, any>;
    } | null>;
  }>, (C extends undefined ? {} : C) & {
    baseURL: string | undefined;
    fetchOptions: {
      customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
    };
  }>> & (((C extends undefined ? {} : C) & {
    baseURL: string | undefined;
    fetchOptions: {
      customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
    };
  })["plugins"] extends (infer Plugin_1)[] ? UnionToIntersection<Plugin_1 extends _better_auth_core21.BetterAuthClientPlugin ? Plugin_1["getActions"] extends ((...args: any) => infer Actions) ? Actions : {} : {}> : {}) & UnionToIntersection<InferRoute<((C extends undefined ? {} : C) & {
    baseURL: string | undefined;
    fetchOptions: {
      customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
    };
  })["$InferAuth"] extends {
    plugins: infer Plugins;
  } ? Plugins extends (infer Plugin_2)[] ? Plugin_2 extends {
    endpoints: infer Endpoints_1;
  } ? Endpoints_1 : {} : {} : {}, (C extends undefined ? {} : C) & {
    baseURL: string | undefined;
    fetchOptions: {
      customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
    };
  }>> & {
    useSession: nanostores3.Atom<{
      data: UnionToIntersection<InferRoute<((C extends undefined ? {} : C) & {
        baseURL: string | undefined;
        fetchOptions: {
          customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
        };
      })["plugins"] extends any[] ? {
        getSession: <R extends boolean, H extends boolean = false>(context: {
          headers: Headers;
          query?: {
            disableCookieCache?: boolean;
            disableRefresh?: boolean;
          } | undefined;
          asResponse?: R | undefined;
          returnHeaders?: H | undefined;
        }) => false extends R ? H extends true ? Promise<{
          headers: Headers;
          response: {
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
          } | null;
        }> : Promise<{
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
        } | null> : Promise<Response>;
      } & {
        readonly ok: better_call240.StrictEndpoint<"/ok", {
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
                        type: "object";
                        properties: {
                          ok: {
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
            isAction: false;
          };
        } & {
          use: any[];
        }, {
          ok: boolean;
        }>;
        readonly error: better_call240.StrictEndpoint<"/error", {
          method: "GET";
          metadata: {
            openapi: {
              description: string;
              responses: {
                "200": {
                  description: string;
                  content: {
                    "text/html": {
                      schema: {
                        type: "string";
                        description: string;
                      };
                    };
                  };
                };
              };
            };
            isAction: false;
          };
        } & {
          use: any[];
        }, Response>;
        readonly signInSocial: better_call240.StrictEndpoint<"/sign-in/social", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
            }, zod_v4_core57.$strip>>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            loginHint: zod415.ZodOptional<zod415.ZodString>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>;
          metadata: {
            $Infer: {
              body: zod415.infer<zod415.ZodObject<{
                callbackURL: zod415.ZodOptional<zod415.ZodString>;
                newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
                errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
                provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
                disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
                idToken: zod415.ZodOptional<zod415.ZodObject<{
                  token: zod415.ZodString;
                  nonce: zod415.ZodOptional<zod415.ZodString>;
                  accessToken: zod415.ZodOptional<zod415.ZodString>;
                  refreshToken: zod415.ZodOptional<zod415.ZodString>;
                  expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
                }, zod_v4_core57.$strip>>;
                scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
                requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
                loginHint: zod415.ZodOptional<zod415.ZodString>;
                additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
              }, zod_v4_core57.$strip>>;
              returned: {
                redirect: boolean;
                token?: string | undefined;
                url?: string | undefined;
                user?: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                } | undefined;
              };
            };
            openapi: {
              description: string;
              operationId: string;
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        description: string;
                        properties: {
                          token: {
                            type: string;
                          };
                          user: {
                            type: string;
                            $ref: string;
                          };
                          url: {
                            type: string;
                          };
                          redirect: {
                            type: string;
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
          redirect: boolean;
          url: string;
        } | {
          redirect: boolean;
          token: string;
          url: undefined;
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
        readonly callbackOAuth: better_call240.StrictEndpoint<"/callback/:id", {
          method: ("GET" | "POST")[];
          operationId: string;
          body: zod415.ZodOptional<zod415.ZodObject<{
            code: zod415.ZodOptional<zod415.ZodString>;
            error: zod415.ZodOptional<zod415.ZodString>;
            device_id: zod415.ZodOptional<zod415.ZodString>;
            error_description: zod415.ZodOptional<zod415.ZodString>;
            state: zod415.ZodOptional<zod415.ZodString>;
            user: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          query: zod415.ZodOptional<zod415.ZodObject<{
            code: zod415.ZodOptional<zod415.ZodString>;
            error: zod415.ZodOptional<zod415.ZodString>;
            device_id: zod415.ZodOptional<zod415.ZodString>;
            error_description: zod415.ZodOptional<zod415.ZodString>;
            state: zod415.ZodOptional<zod415.ZodString>;
            user: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          metadata: {
            allowedMediaTypes: string[];
            isAction: false;
          };
        } & {
          use: any[];
        }, void>;
        readonly getSession: better_call240.StrictEndpoint<"/get-session", {
          method: "GET";
          operationId: string;
          query: zod415.ZodOptional<zod415.ZodObject<{
            disableCookieCache: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
            disableRefresh: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
          }, zod_v4_core57.$strip>>;
          requireHeaders: true;
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
                          session: {
                            $ref: string;
                          };
                          user: {
                            $ref: string;
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
        } | null>;
        readonly signOut: better_call240.StrictEndpoint<"/sign-out", {
          method: "POST";
          operationId: string;
          requireHeaders: true;
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
        readonly signUpEmail: better_call240.StrictEndpoint<"/sign-up/email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
          metadata: {
            $Infer: {
              body: {
                name: string;
                email: string;
                password: string;
                image?: string | undefined;
                callbackURL?: string | undefined;
                rememberMe?: boolean | undefined;
              };
              returned: {
                token: string | null;
                user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                };
              };
            };
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        name: {
                          type: string;
                          description: string;
                        };
                        email: {
                          type: string;
                          description: string;
                        };
                        password: {
                          type: string;
                          description: string;
                        };
                        image: {
                          type: string;
                          description: string;
                        };
                        callbackURL: {
                          type: string;
                          description: string;
                        };
                        rememberMe: {
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
                          token: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                                description: string;
                              };
                              email: {
                                type: string;
                                format: string;
                                description: string;
                              };
                              name: {
                                type: string;
                                description: string;
                              };
                              image: {
                                type: string;
                                format: string;
                                nullable: boolean;
                                description: string;
                              };
                              emailVerified: {
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
                        required: string[];
                      };
                    };
                  };
                };
                "422": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
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
          token: null;
          user: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        } | {
          token: string;
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
        readonly signInEmail: better_call240.StrictEndpoint<"/sign-in/email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodString;
            password: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            rememberMe: zod415.ZodOptional<zod415.ZodDefault<zod415.ZodBoolean>>;
          }, zod_v4_core57.$strip>;
          metadata: {
            $Infer: {
              body: {
                email: string;
                password: string;
                callbackURL?: string | undefined;
                rememberMe?: boolean | undefined;
              };
              returned: {
                redirect: boolean;
                token: string;
                url?: string | undefined;
                user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                };
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
                        description: string;
                        properties: {
                          redirect: {
                            type: string;
                            enum: boolean[];
                          };
                          token: {
                            type: string;
                            description: string;
                          };
                          url: {
                            type: string;
                            nullable: boolean;
                          };
                          user: {
                            type: string;
                            $ref: string;
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
          redirect: boolean;
          token: string;
          url?: string | undefined;
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
        readonly resetPassword: better_call240.StrictEndpoint<"/reset-password", {
          method: "POST";
          operationId: string;
          query: zod415.ZodOptional<zod415.ZodObject<{
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
        readonly verifyEmail: better_call240.StrictEndpoint<"/verify-email", {
          method: "GET";
          operationId: string;
          query: zod415.ZodObject<{
            token: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
          metadata: {
            openapi: {
              description: string;
              parameters: ({
                name: string;
                in: "query";
                description: string;
                required: true;
                schema: {
                  type: "string";
                };
              } | {
                name: string;
                in: "query";
                description: string;
                required: false;
                schema: {
                  type: "string";
                };
              })[];
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          user: {
                            type: string;
                            $ref: string;
                          };
                          status: {
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
        }, void | {
          status: boolean;
        }>;
        readonly sendVerificationEmail: better_call240.StrictEndpoint<"/send-verification-email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodEmail;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        email: {
                          type: string;
                          description: string;
                          example: string;
                        };
                        callbackURL: {
                          type: string;
                          description: string;
                          example: string;
                          nullable: boolean;
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
                          status: {
                            type: string;
                            description: string;
                            example: boolean;
                          };
                        };
                      };
                    };
                  };
                };
                "400": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
                            type: string;
                            description: string;
                            example: string;
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
        readonly changeEmail: better_call240.StrictEndpoint<"/change-email", {
          method: "POST";
          body: zod415.ZodObject<{
            newEmail: zod415.ZodEmail;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          user: {
                            type: string;
                            $ref: string;
                          };
                          status: {
                            type: string;
                            description: string;
                          };
                          message: {
                            type: string;
                            enum: string[];
                            description: string;
                            nullable: boolean;
                          };
                        };
                        required: string[];
                      };
                    };
                  };
                };
                "422": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
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
        readonly changePassword: better_call240.StrictEndpoint<"/change-password", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
            currentPassword: zod415.ZodString;
            revokeOtherSessions: zod415.ZodOptional<zod415.ZodBoolean>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          token: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                                description: string;
                              };
                              email: {
                                type: string;
                                format: string;
                                description: string;
                              };
                              name: {
                                type: string;
                                description: string;
                              };
                              image: {
                                type: string;
                                format: string;
                                nullable: boolean;
                                description: string;
                              };
                              emailVerified: {
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
          token: string | null;
          user: {
            id: string;
            email: string;
            name: string;
            image: string | null | undefined;
            emailVerified: boolean;
            createdAt: Date;
            updatedAt: Date;
          };
        }>;
        readonly setPassword: better_call240.StrictEndpoint<"/set-password", {
          method: "POST";
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          metadata: {
            SERVER_ONLY: true;
          };
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        } & {
          use: any[];
        }, {
          status: boolean;
        }>;
        readonly updateUser: better_call240.StrictEndpoint<"/update-user", {
          method: "POST";
          operationId: string;
          body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
            $Infer: {
              body: Partial<{}> & {
                name?: string | undefined;
                image?: string | undefined;
              };
            };
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        name: {
                          type: string;
                          description: string;
                        };
                        image: {
                          type: string;
                          description: string;
                        };
                      };
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
                          user: {
                            type: string;
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
          status: boolean;
        }>;
        readonly deleteUser: better_call240.StrictEndpoint<"/delete-user", {
          method: "POST";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            password: zod415.ZodOptional<zod415.ZodString>;
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        callbackURL: {
                          type: string;
                          description: string;
                        };
                        password: {
                          type: string;
                          description: string;
                        };
                        token: {
                          type: string;
                          description: string;
                        };
                      };
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
                          message: {
                            type: string;
                            enum: string[];
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
          message: string;
        }>;
        readonly requestPasswordReset: better_call240.StrictEndpoint<"/request-password-reset", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodEmail;
            redirectTo: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          status: {
                            type: string;
                          };
                          message: {
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
          message: string;
        }>;
        readonly requestPasswordResetCallback: better_call240.StrictEndpoint<"/reset-password/:token", {
          method: "GET";
          operationId: string;
          query: zod415.ZodObject<{
            callbackURL: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              parameters: ({
                name: string;
                in: "path";
                required: true;
                description: string;
                schema: {
                  type: "string";
                };
              } | {
                name: string;
                in: "query";
                required: true;
                description: string;
                schema: {
                  type: "string";
                };
              })[];
              responses: {
                "200": {
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
        }, never>;
        readonly listSessions: better_call240.StrictEndpoint<"/list-sessions", {
          method: "GET";
          operationId: string;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          requireHeaders: true;
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
        }, Prettify$1<{
          id: string;
          createdAt: Date;
          updatedAt: Date;
          userId: string;
          expiresAt: Date;
          token: string;
          ipAddress?: string | null | undefined;
          userAgent?: string | null | undefined;
        }>[]>;
        readonly revokeSession: better_call240.StrictEndpoint<"/revoke-session", {
          method: "POST";
          body: zod415.ZodObject<{
            token: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          requireHeaders: true;
          metadata: {
            openapi: {
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        token: {
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
                          status: {
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
          status: boolean;
        }>;
        readonly revokeSessions: better_call240.StrictEndpoint<"/revoke-sessions", {
          method: "POST";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          status: {
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
          status: boolean;
        }>;
        readonly revokeOtherSessions: better_call240.StrictEndpoint<"/revoke-other-sessions", {
          method: "POST";
          requireHeaders: true;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          status: {
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
          status: boolean;
        }>;
        readonly linkSocialAccount: better_call240.StrictEndpoint<"/link-social", {
          method: "POST";
          requireHeaders: true;
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            }, zod_v4_core57.$strip>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
              operationId: string;
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
                            description: string;
                          };
                          redirect: {
                            type: string;
                            description: string;
                          };
                          status: {
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
          url: string;
          redirect: boolean;
        }>;
        readonly listUserAccounts: better_call240.StrictEndpoint<"/list-accounts", {
          method: "GET";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                            };
                            providerId: {
                              type: string;
                            };
                            createdAt: {
                              type: string;
                              format: string;
                            };
                            updatedAt: {
                              type: string;
                              format: string;
                            };
                            accountId: {
                              type: string;
                            };
                            userId: {
                              type: string;
                            };
                            scopes: {
                              type: string;
                              items: {
                                type: string;
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
          };
        } & {
          use: any[];
        }, {
          id: string;
          providerId: string;
          createdAt: Date;
          updatedAt: Date;
          accountId: string;
          userId: string;
          scopes: string[];
        }[]>;
        readonly deleteUserCallback: better_call240.StrictEndpoint<"/delete-user/callback", {
          method: "GET";
          query: zod415.ZodObject<{
            token: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
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
                          success: {
                            type: string;
                            description: string;
                          };
                          message: {
                            type: string;
                            enum: string[];
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
          message: string;
        }>;
        readonly unlinkAccount: better_call240.StrictEndpoint<"/unlink-account", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        readonly refreshToken: better_call240.StrictEndpoint<"/refresh-token", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
            userId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          tokenType: {
                            type: string;
                          };
                          idToken: {
                            type: string;
                          };
                          accessToken: {
                            type: string;
                          };
                          refreshToken: {
                            type: string;
                          };
                          accessTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                          refreshTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                        };
                      };
                    };
                  };
                };
                400: {
                  description: string;
                };
              };
            };
          };
        } & {
          use: any[];
        }, {
          accessToken: string | undefined;
          refreshToken: string | undefined;
          accessTokenExpiresAt: Date | undefined;
          refreshTokenExpiresAt: Date | undefined;
          scope: string | null | undefined;
          idToken: string | null | undefined;
          providerId: string;
          accountId: string;
        }>;
        readonly getAccessToken: better_call240.StrictEndpoint<"/get-access-token", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
            userId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          tokenType: {
                            type: string;
                          };
                          idToken: {
                            type: string;
                          };
                          accessToken: {
                            type: string;
                          };
                          refreshToken: {
                            type: string;
                          };
                          accessTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                          refreshTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                        };
                      };
                    };
                  };
                };
                400: {
                  description: string;
                };
              };
            };
          };
        } & {
          use: any[];
        }, {
          accessToken: string;
          accessTokenExpiresAt: Date | undefined;
          scopes: string[];
          idToken: string | undefined;
        }>;
        readonly accountInfo: better_call240.StrictEndpoint<"/account-info", {
          method: "GET";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                              };
                              name: {
                                type: string;
                              };
                              email: {
                                type: string;
                              };
                              image: {
                                type: string;
                              };
                              emailVerified: {
                                type: string;
                              };
                            };
                            required: string[];
                          };
                          data: {
                            type: string;
                            properties: {};
                            additionalProperties: boolean;
                          };
                        };
                        required: string[];
                        additionalProperties: boolean;
                      };
                    };
                  };
                };
              };
            };
          };
          query: zod415.ZodOptional<zod415.ZodObject<{
            accountId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
        } & {
          use: any[];
        }, {
          user: _better_auth_core_oauth22.OAuth2UserInfo;
          data: Record<string, any>;
        } | null>;
      } & (((C extends undefined ? {} : C) & {
        baseURL: string | undefined;
        fetchOptions: {
          customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
        };
      })["plugins"] extends (infer Pl)[] ? UnionToIntersection<Pl extends {
        $InferServerPlugin: infer Plug;
      } ? Plug extends {
        endpoints: infer Endpoints;
      } ? Endpoints : {} : {}> : {}) : InferAPI<{
        readonly ok: better_call240.StrictEndpoint<"/ok", {
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
                        type: "object";
                        properties: {
                          ok: {
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
            isAction: false;
          };
        } & {
          use: any[];
        }, {
          ok: boolean;
        }>;
        readonly error: better_call240.StrictEndpoint<"/error", {
          method: "GET";
          metadata: {
            openapi: {
              description: string;
              responses: {
                "200": {
                  description: string;
                  content: {
                    "text/html": {
                      schema: {
                        type: "string";
                        description: string;
                      };
                    };
                  };
                };
              };
            };
            isAction: false;
          };
        } & {
          use: any[];
        }, Response>;
        readonly signInSocial: better_call240.StrictEndpoint<"/sign-in/social", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
            }, zod_v4_core57.$strip>>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            loginHint: zod415.ZodOptional<zod415.ZodString>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>;
          metadata: {
            $Infer: {
              body: zod415.infer<zod415.ZodObject<{
                callbackURL: zod415.ZodOptional<zod415.ZodString>;
                newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
                errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
                provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
                disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
                idToken: zod415.ZodOptional<zod415.ZodObject<{
                  token: zod415.ZodString;
                  nonce: zod415.ZodOptional<zod415.ZodString>;
                  accessToken: zod415.ZodOptional<zod415.ZodString>;
                  refreshToken: zod415.ZodOptional<zod415.ZodString>;
                  expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
                }, zod_v4_core57.$strip>>;
                scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
                requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
                loginHint: zod415.ZodOptional<zod415.ZodString>;
                additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
              }, zod_v4_core57.$strip>>;
              returned: {
                redirect: boolean;
                token?: string | undefined;
                url?: string | undefined;
                user?: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                } | undefined;
              };
            };
            openapi: {
              description: string;
              operationId: string;
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        description: string;
                        properties: {
                          token: {
                            type: string;
                          };
                          user: {
                            type: string;
                            $ref: string;
                          };
                          url: {
                            type: string;
                          };
                          redirect: {
                            type: string;
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
          redirect: boolean;
          url: string;
        } | {
          redirect: boolean;
          token: string;
          url: undefined;
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
        readonly callbackOAuth: better_call240.StrictEndpoint<"/callback/:id", {
          method: ("GET" | "POST")[];
          operationId: string;
          body: zod415.ZodOptional<zod415.ZodObject<{
            code: zod415.ZodOptional<zod415.ZodString>;
            error: zod415.ZodOptional<zod415.ZodString>;
            device_id: zod415.ZodOptional<zod415.ZodString>;
            error_description: zod415.ZodOptional<zod415.ZodString>;
            state: zod415.ZodOptional<zod415.ZodString>;
            user: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          query: zod415.ZodOptional<zod415.ZodObject<{
            code: zod415.ZodOptional<zod415.ZodString>;
            error: zod415.ZodOptional<zod415.ZodString>;
            device_id: zod415.ZodOptional<zod415.ZodString>;
            error_description: zod415.ZodOptional<zod415.ZodString>;
            state: zod415.ZodOptional<zod415.ZodString>;
            user: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          metadata: {
            allowedMediaTypes: string[];
            isAction: false;
          };
        } & {
          use: any[];
        }, void>;
        readonly getSession: better_call240.StrictEndpoint<"/get-session", {
          method: "GET";
          operationId: string;
          query: zod415.ZodOptional<zod415.ZodObject<{
            disableCookieCache: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
            disableRefresh: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
          }, zod_v4_core57.$strip>>;
          requireHeaders: true;
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
                          session: {
                            $ref: string;
                          };
                          user: {
                            $ref: string;
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
        } | null>;
        readonly signOut: better_call240.StrictEndpoint<"/sign-out", {
          method: "POST";
          operationId: string;
          requireHeaders: true;
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
        readonly signUpEmail: better_call240.StrictEndpoint<"/sign-up/email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
          metadata: {
            $Infer: {
              body: {
                name: string;
                email: string;
                password: string;
                image?: string | undefined;
                callbackURL?: string | undefined;
                rememberMe?: boolean | undefined;
              };
              returned: {
                token: string | null;
                user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                };
              };
            };
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        name: {
                          type: string;
                          description: string;
                        };
                        email: {
                          type: string;
                          description: string;
                        };
                        password: {
                          type: string;
                          description: string;
                        };
                        image: {
                          type: string;
                          description: string;
                        };
                        callbackURL: {
                          type: string;
                          description: string;
                        };
                        rememberMe: {
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
                          token: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                                description: string;
                              };
                              email: {
                                type: string;
                                format: string;
                                description: string;
                              };
                              name: {
                                type: string;
                                description: string;
                              };
                              image: {
                                type: string;
                                format: string;
                                nullable: boolean;
                                description: string;
                              };
                              emailVerified: {
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
                        required: string[];
                      };
                    };
                  };
                };
                "422": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
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
          token: null;
          user: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        } | {
          token: string;
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
        readonly signInEmail: better_call240.StrictEndpoint<"/sign-in/email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodString;
            password: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            rememberMe: zod415.ZodOptional<zod415.ZodDefault<zod415.ZodBoolean>>;
          }, zod_v4_core57.$strip>;
          metadata: {
            $Infer: {
              body: {
                email: string;
                password: string;
                callbackURL?: string | undefined;
                rememberMe?: boolean | undefined;
              };
              returned: {
                redirect: boolean;
                token: string;
                url?: string | undefined;
                user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                };
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
                        description: string;
                        properties: {
                          redirect: {
                            type: string;
                            enum: boolean[];
                          };
                          token: {
                            type: string;
                            description: string;
                          };
                          url: {
                            type: string;
                            nullable: boolean;
                          };
                          user: {
                            type: string;
                            $ref: string;
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
          redirect: boolean;
          token: string;
          url?: string | undefined;
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
        readonly resetPassword: better_call240.StrictEndpoint<"/reset-password", {
          method: "POST";
          operationId: string;
          query: zod415.ZodOptional<zod415.ZodObject<{
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
        readonly verifyEmail: better_call240.StrictEndpoint<"/verify-email", {
          method: "GET";
          operationId: string;
          query: zod415.ZodObject<{
            token: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
          metadata: {
            openapi: {
              description: string;
              parameters: ({
                name: string;
                in: "query";
                description: string;
                required: true;
                schema: {
                  type: "string";
                };
              } | {
                name: string;
                in: "query";
                description: string;
                required: false;
                schema: {
                  type: "string";
                };
              })[];
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          user: {
                            type: string;
                            $ref: string;
                          };
                          status: {
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
        }, void | {
          status: boolean;
        }>;
        readonly sendVerificationEmail: better_call240.StrictEndpoint<"/send-verification-email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodEmail;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        email: {
                          type: string;
                          description: string;
                          example: string;
                        };
                        callbackURL: {
                          type: string;
                          description: string;
                          example: string;
                          nullable: boolean;
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
                          status: {
                            type: string;
                            description: string;
                            example: boolean;
                          };
                        };
                      };
                    };
                  };
                };
                "400": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
                            type: string;
                            description: string;
                            example: string;
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
        readonly changeEmail: better_call240.StrictEndpoint<"/change-email", {
          method: "POST";
          body: zod415.ZodObject<{
            newEmail: zod415.ZodEmail;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          user: {
                            type: string;
                            $ref: string;
                          };
                          status: {
                            type: string;
                            description: string;
                          };
                          message: {
                            type: string;
                            enum: string[];
                            description: string;
                            nullable: boolean;
                          };
                        };
                        required: string[];
                      };
                    };
                  };
                };
                "422": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
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
        readonly changePassword: better_call240.StrictEndpoint<"/change-password", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
            currentPassword: zod415.ZodString;
            revokeOtherSessions: zod415.ZodOptional<zod415.ZodBoolean>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          token: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                                description: string;
                              };
                              email: {
                                type: string;
                                format: string;
                                description: string;
                              };
                              name: {
                                type: string;
                                description: string;
                              };
                              image: {
                                type: string;
                                format: string;
                                nullable: boolean;
                                description: string;
                              };
                              emailVerified: {
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
          token: string | null;
          user: {
            id: string;
            email: string;
            name: string;
            image: string | null | undefined;
            emailVerified: boolean;
            createdAt: Date;
            updatedAt: Date;
          };
        }>;
        readonly setPassword: better_call240.StrictEndpoint<"/set-password", {
          method: "POST";
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          metadata: {
            SERVER_ONLY: true;
          };
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        } & {
          use: any[];
        }, {
          status: boolean;
        }>;
        readonly updateUser: better_call240.StrictEndpoint<"/update-user", {
          method: "POST";
          operationId: string;
          body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
            $Infer: {
              body: Partial<{}> & {
                name?: string | undefined;
                image?: string | undefined;
              };
            };
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        name: {
                          type: string;
                          description: string;
                        };
                        image: {
                          type: string;
                          description: string;
                        };
                      };
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
                          user: {
                            type: string;
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
          status: boolean;
        }>;
        readonly deleteUser: better_call240.StrictEndpoint<"/delete-user", {
          method: "POST";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            password: zod415.ZodOptional<zod415.ZodString>;
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        callbackURL: {
                          type: string;
                          description: string;
                        };
                        password: {
                          type: string;
                          description: string;
                        };
                        token: {
                          type: string;
                          description: string;
                        };
                      };
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
                          message: {
                            type: string;
                            enum: string[];
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
          message: string;
        }>;
        readonly requestPasswordReset: better_call240.StrictEndpoint<"/request-password-reset", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodEmail;
            redirectTo: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          status: {
                            type: string;
                          };
                          message: {
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
          message: string;
        }>;
        readonly requestPasswordResetCallback: better_call240.StrictEndpoint<"/reset-password/:token", {
          method: "GET";
          operationId: string;
          query: zod415.ZodObject<{
            callbackURL: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              parameters: ({
                name: string;
                in: "path";
                required: true;
                description: string;
                schema: {
                  type: "string";
                };
              } | {
                name: string;
                in: "query";
                required: true;
                description: string;
                schema: {
                  type: "string";
                };
              })[];
              responses: {
                "200": {
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
        }, never>;
        readonly listSessions: better_call240.StrictEndpoint<"/list-sessions", {
          method: "GET";
          operationId: string;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          requireHeaders: true;
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
        }, Prettify$1<{
          id: string;
          createdAt: Date;
          updatedAt: Date;
          userId: string;
          expiresAt: Date;
          token: string;
          ipAddress?: string | null | undefined;
          userAgent?: string | null | undefined;
        }>[]>;
        readonly revokeSession: better_call240.StrictEndpoint<"/revoke-session", {
          method: "POST";
          body: zod415.ZodObject<{
            token: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          requireHeaders: true;
          metadata: {
            openapi: {
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        token: {
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
                          status: {
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
          status: boolean;
        }>;
        readonly revokeSessions: better_call240.StrictEndpoint<"/revoke-sessions", {
          method: "POST";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          status: {
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
          status: boolean;
        }>;
        readonly revokeOtherSessions: better_call240.StrictEndpoint<"/revoke-other-sessions", {
          method: "POST";
          requireHeaders: true;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          status: {
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
          status: boolean;
        }>;
        readonly linkSocialAccount: better_call240.StrictEndpoint<"/link-social", {
          method: "POST";
          requireHeaders: true;
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            }, zod_v4_core57.$strip>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
              operationId: string;
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
                            description: string;
                          };
                          redirect: {
                            type: string;
                            description: string;
                          };
                          status: {
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
          url: string;
          redirect: boolean;
        }>;
        readonly listUserAccounts: better_call240.StrictEndpoint<"/list-accounts", {
          method: "GET";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                            };
                            providerId: {
                              type: string;
                            };
                            createdAt: {
                              type: string;
                              format: string;
                            };
                            updatedAt: {
                              type: string;
                              format: string;
                            };
                            accountId: {
                              type: string;
                            };
                            userId: {
                              type: string;
                            };
                            scopes: {
                              type: string;
                              items: {
                                type: string;
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
          };
        } & {
          use: any[];
        }, {
          id: string;
          providerId: string;
          createdAt: Date;
          updatedAt: Date;
          accountId: string;
          userId: string;
          scopes: string[];
        }[]>;
        readonly deleteUserCallback: better_call240.StrictEndpoint<"/delete-user/callback", {
          method: "GET";
          query: zod415.ZodObject<{
            token: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
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
                          success: {
                            type: string;
                            description: string;
                          };
                          message: {
                            type: string;
                            enum: string[];
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
          message: string;
        }>;
        readonly unlinkAccount: better_call240.StrictEndpoint<"/unlink-account", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        readonly refreshToken: better_call240.StrictEndpoint<"/refresh-token", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
            userId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          tokenType: {
                            type: string;
                          };
                          idToken: {
                            type: string;
                          };
                          accessToken: {
                            type: string;
                          };
                          refreshToken: {
                            type: string;
                          };
                          accessTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                          refreshTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                        };
                      };
                    };
                  };
                };
                400: {
                  description: string;
                };
              };
            };
          };
        } & {
          use: any[];
        }, {
          accessToken: string | undefined;
          refreshToken: string | undefined;
          accessTokenExpiresAt: Date | undefined;
          refreshTokenExpiresAt: Date | undefined;
          scope: string | null | undefined;
          idToken: string | null | undefined;
          providerId: string;
          accountId: string;
        }>;
        readonly getAccessToken: better_call240.StrictEndpoint<"/get-access-token", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
            userId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          tokenType: {
                            type: string;
                          };
                          idToken: {
                            type: string;
                          };
                          accessToken: {
                            type: string;
                          };
                          refreshToken: {
                            type: string;
                          };
                          accessTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                          refreshTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                        };
                      };
                    };
                  };
                };
                400: {
                  description: string;
                };
              };
            };
          };
        } & {
          use: any[];
        }, {
          accessToken: string;
          accessTokenExpiresAt: Date | undefined;
          scopes: string[];
          idToken: string | undefined;
        }>;
        readonly accountInfo: better_call240.StrictEndpoint<"/account-info", {
          method: "GET";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                              };
                              name: {
                                type: string;
                              };
                              email: {
                                type: string;
                              };
                              image: {
                                type: string;
                              };
                              emailVerified: {
                                type: string;
                              };
                            };
                            required: string[];
                          };
                          data: {
                            type: string;
                            properties: {};
                            additionalProperties: boolean;
                          };
                        };
                        required: string[];
                        additionalProperties: boolean;
                      };
                    };
                  };
                };
              };
            };
          };
          query: zod415.ZodOptional<zod415.ZodObject<{
            accountId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
        } & {
          use: any[];
        }, {
          user: _better_auth_core_oauth22.OAuth2UserInfo;
          data: Record<string, any>;
        } | null>;
      }>, (C extends undefined ? {} : C) & {
        baseURL: string | undefined;
        fetchOptions: {
          customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
        };
      }>> extends {
        getSession: () => Promise<infer Res>;
      } ? Res extends {
        data: null;
        error: {
          message?: string | undefined;
          status: number;
          statusText: string;
        };
      } | {
        data: infer S;
        error: null;
      } ? S : Res extends Record<string, any> ? Res : never : never;
      error: _better_fetch_fetch85.BetterFetchError | null;
      isPending: boolean;
    }>;
    $fetch: _better_fetch_fetch85.BetterFetch<{
      plugins: (_better_fetch_fetch85.BetterFetchPlugin | {
        id: string;
        name: string;
        hooks: {
          onSuccess(context: SuccessContext<any>): void;
        };
      } | {
        id: string;
        name: string;
        hooks: {
          onRequest<T_1 extends Record<string, any>>(context: _better_fetch_fetch85.RequestContext<T_1>): void;
        };
      } | {
        id: string;
        name: string;
        hooks: {
          onSuccess: ((context: SuccessContext<any>) => Promise<void> | void) | undefined;
          onError: ((context: _better_fetch_fetch85.ErrorContext) => Promise<void> | void) | undefined;
          onRequest: (<T_1 extends Record<string, any>>(context: _better_fetch_fetch85.RequestContext<T_1>) => Promise<_better_fetch_fetch85.RequestContext | void> | _better_fetch_fetch85.RequestContext | void) | undefined;
          onResponse: ((context: _better_fetch_fetch85.ResponseContext) => Promise<Response | void | _better_fetch_fetch85.ResponseContext> | Response | _better_fetch_fetch85.ResponseContext | void) | undefined;
        };
      })[];
      cache?: RequestCache | undefined;
      method: string;
      headers?: (HeadersInit & (HeadersInit | {
        accept: "application/json" | "text/plain" | "application/octet-stream";
        "content-type": "application/json" | "text/plain" | "application/x-www-form-urlencoded" | "multipart/form-data" | "application/octet-stream";
        authorization: "Bearer" | "Basic";
      })) | undefined;
      redirect?: RequestRedirect | undefined;
      credentials?: RequestCredentials;
      integrity?: string | undefined;
      keepalive?: boolean | undefined;
      mode?: RequestMode | undefined;
      priority?: RequestPriority | undefined;
      referrer?: string | undefined;
      referrerPolicy?: ReferrerPolicy | undefined;
      signal?: (AbortSignal | null) | undefined;
      window?: null | undefined;
      onRetry?: ((response: _better_fetch_fetch85.ResponseContext) => Promise<void> | void) | undefined;
      hookOptions?: {
        cloneResponse?: boolean;
      } | undefined;
      timeout?: number | undefined;
      customFetchImpl: _better_fetch_fetch85.FetchEsque;
      baseURL: string;
      throw?: boolean | undefined;
      auth?: ({
        type: "Bearer";
        token: string | Promise<string | undefined> | (() => string | Promise<string | undefined> | undefined) | undefined;
      } | {
        type: "Basic";
        username: string | (() => string | undefined) | undefined;
        password: string | (() => string | undefined) | undefined;
      } | {
        type: "Custom";
        prefix: string | (() => string | undefined) | undefined;
        value: string | (() => string | undefined) | undefined;
      }) | undefined;
      body?: any;
      query?: any;
      params?: any;
      duplex?: "full" | "half" | undefined;
      jsonParser: (text: string) => Promise<any> | any;
      retry?: _better_fetch_fetch85.RetryOptions | undefined;
      retryAttempt?: number | undefined;
      output?: (_better_fetch_fetch85.StandardSchemaV1 | typeof Blob | typeof File) | undefined;
      errorSchema?: _better_fetch_fetch85.StandardSchemaV1 | undefined;
      disableValidation?: boolean | undefined;
      disableSignal?: boolean | undefined;
    }, unknown, unknown, {}>;
    $store: {
      notify: (signal?: (Omit<string, "$sessionSignal"> | "$sessionSignal") | undefined) => void;
      listen: (signal: Omit<string, "$sessionSignal"> | "$sessionSignal", listener: (value: boolean, oldValue?: boolean | undefined) => void) => void;
      atoms: Record<string, nanostores3.WritableAtom<any>>;
    };
    $Infer: {
      Session: NonNullable<UnionToIntersection<InferRoute<((C extends undefined ? {} : C) & {
        baseURL: string | undefined;
        fetchOptions: {
          customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
        };
      })["plugins"] extends any[] ? {
        getSession: <R extends boolean, H extends boolean = false>(context: {
          headers: Headers;
          query?: {
            disableCookieCache?: boolean;
            disableRefresh?: boolean;
          } | undefined;
          asResponse?: R | undefined;
          returnHeaders?: H | undefined;
        }) => false extends R ? H extends true ? Promise<{
          headers: Headers;
          response: {
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
          } | null;
        }> : Promise<{
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
        } | null> : Promise<Response>;
      } & {
        readonly ok: better_call240.StrictEndpoint<"/ok", {
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
                        type: "object";
                        properties: {
                          ok: {
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
            isAction: false;
          };
        } & {
          use: any[];
        }, {
          ok: boolean;
        }>;
        readonly error: better_call240.StrictEndpoint<"/error", {
          method: "GET";
          metadata: {
            openapi: {
              description: string;
              responses: {
                "200": {
                  description: string;
                  content: {
                    "text/html": {
                      schema: {
                        type: "string";
                        description: string;
                      };
                    };
                  };
                };
              };
            };
            isAction: false;
          };
        } & {
          use: any[];
        }, Response>;
        readonly signInSocial: better_call240.StrictEndpoint<"/sign-in/social", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
            }, zod_v4_core57.$strip>>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            loginHint: zod415.ZodOptional<zod415.ZodString>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>;
          metadata: {
            $Infer: {
              body: zod415.infer<zod415.ZodObject<{
                callbackURL: zod415.ZodOptional<zod415.ZodString>;
                newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
                errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
                provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
                disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
                idToken: zod415.ZodOptional<zod415.ZodObject<{
                  token: zod415.ZodString;
                  nonce: zod415.ZodOptional<zod415.ZodString>;
                  accessToken: zod415.ZodOptional<zod415.ZodString>;
                  refreshToken: zod415.ZodOptional<zod415.ZodString>;
                  expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
                }, zod_v4_core57.$strip>>;
                scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
                requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
                loginHint: zod415.ZodOptional<zod415.ZodString>;
                additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
              }, zod_v4_core57.$strip>>;
              returned: {
                redirect: boolean;
                token?: string | undefined;
                url?: string | undefined;
                user?: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                } | undefined;
              };
            };
            openapi: {
              description: string;
              operationId: string;
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        description: string;
                        properties: {
                          token: {
                            type: string;
                          };
                          user: {
                            type: string;
                            $ref: string;
                          };
                          url: {
                            type: string;
                          };
                          redirect: {
                            type: string;
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
          redirect: boolean;
          url: string;
        } | {
          redirect: boolean;
          token: string;
          url: undefined;
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
        readonly callbackOAuth: better_call240.StrictEndpoint<"/callback/:id", {
          method: ("GET" | "POST")[];
          operationId: string;
          body: zod415.ZodOptional<zod415.ZodObject<{
            code: zod415.ZodOptional<zod415.ZodString>;
            error: zod415.ZodOptional<zod415.ZodString>;
            device_id: zod415.ZodOptional<zod415.ZodString>;
            error_description: zod415.ZodOptional<zod415.ZodString>;
            state: zod415.ZodOptional<zod415.ZodString>;
            user: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          query: zod415.ZodOptional<zod415.ZodObject<{
            code: zod415.ZodOptional<zod415.ZodString>;
            error: zod415.ZodOptional<zod415.ZodString>;
            device_id: zod415.ZodOptional<zod415.ZodString>;
            error_description: zod415.ZodOptional<zod415.ZodString>;
            state: zod415.ZodOptional<zod415.ZodString>;
            user: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          metadata: {
            allowedMediaTypes: string[];
            isAction: false;
          };
        } & {
          use: any[];
        }, void>;
        readonly getSession: better_call240.StrictEndpoint<"/get-session", {
          method: "GET";
          operationId: string;
          query: zod415.ZodOptional<zod415.ZodObject<{
            disableCookieCache: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
            disableRefresh: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
          }, zod_v4_core57.$strip>>;
          requireHeaders: true;
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
                          session: {
                            $ref: string;
                          };
                          user: {
                            $ref: string;
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
        } | null>;
        readonly signOut: better_call240.StrictEndpoint<"/sign-out", {
          method: "POST";
          operationId: string;
          requireHeaders: true;
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
        readonly signUpEmail: better_call240.StrictEndpoint<"/sign-up/email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
          metadata: {
            $Infer: {
              body: {
                name: string;
                email: string;
                password: string;
                image?: string | undefined;
                callbackURL?: string | undefined;
                rememberMe?: boolean | undefined;
              };
              returned: {
                token: string | null;
                user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                };
              };
            };
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        name: {
                          type: string;
                          description: string;
                        };
                        email: {
                          type: string;
                          description: string;
                        };
                        password: {
                          type: string;
                          description: string;
                        };
                        image: {
                          type: string;
                          description: string;
                        };
                        callbackURL: {
                          type: string;
                          description: string;
                        };
                        rememberMe: {
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
                          token: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                                description: string;
                              };
                              email: {
                                type: string;
                                format: string;
                                description: string;
                              };
                              name: {
                                type: string;
                                description: string;
                              };
                              image: {
                                type: string;
                                format: string;
                                nullable: boolean;
                                description: string;
                              };
                              emailVerified: {
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
                        required: string[];
                      };
                    };
                  };
                };
                "422": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
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
          token: null;
          user: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        } | {
          token: string;
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
        readonly signInEmail: better_call240.StrictEndpoint<"/sign-in/email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodString;
            password: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            rememberMe: zod415.ZodOptional<zod415.ZodDefault<zod415.ZodBoolean>>;
          }, zod_v4_core57.$strip>;
          metadata: {
            $Infer: {
              body: {
                email: string;
                password: string;
                callbackURL?: string | undefined;
                rememberMe?: boolean | undefined;
              };
              returned: {
                redirect: boolean;
                token: string;
                url?: string | undefined;
                user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                };
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
                        description: string;
                        properties: {
                          redirect: {
                            type: string;
                            enum: boolean[];
                          };
                          token: {
                            type: string;
                            description: string;
                          };
                          url: {
                            type: string;
                            nullable: boolean;
                          };
                          user: {
                            type: string;
                            $ref: string;
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
          redirect: boolean;
          token: string;
          url?: string | undefined;
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
        readonly resetPassword: better_call240.StrictEndpoint<"/reset-password", {
          method: "POST";
          operationId: string;
          query: zod415.ZodOptional<zod415.ZodObject<{
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
        readonly verifyEmail: better_call240.StrictEndpoint<"/verify-email", {
          method: "GET";
          operationId: string;
          query: zod415.ZodObject<{
            token: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
          metadata: {
            openapi: {
              description: string;
              parameters: ({
                name: string;
                in: "query";
                description: string;
                required: true;
                schema: {
                  type: "string";
                };
              } | {
                name: string;
                in: "query";
                description: string;
                required: false;
                schema: {
                  type: "string";
                };
              })[];
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          user: {
                            type: string;
                            $ref: string;
                          };
                          status: {
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
        }, void | {
          status: boolean;
        }>;
        readonly sendVerificationEmail: better_call240.StrictEndpoint<"/send-verification-email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodEmail;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        email: {
                          type: string;
                          description: string;
                          example: string;
                        };
                        callbackURL: {
                          type: string;
                          description: string;
                          example: string;
                          nullable: boolean;
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
                          status: {
                            type: string;
                            description: string;
                            example: boolean;
                          };
                        };
                      };
                    };
                  };
                };
                "400": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
                            type: string;
                            description: string;
                            example: string;
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
        readonly changeEmail: better_call240.StrictEndpoint<"/change-email", {
          method: "POST";
          body: zod415.ZodObject<{
            newEmail: zod415.ZodEmail;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          user: {
                            type: string;
                            $ref: string;
                          };
                          status: {
                            type: string;
                            description: string;
                          };
                          message: {
                            type: string;
                            enum: string[];
                            description: string;
                            nullable: boolean;
                          };
                        };
                        required: string[];
                      };
                    };
                  };
                };
                "422": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
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
        readonly changePassword: better_call240.StrictEndpoint<"/change-password", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
            currentPassword: zod415.ZodString;
            revokeOtherSessions: zod415.ZodOptional<zod415.ZodBoolean>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          token: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                                description: string;
                              };
                              email: {
                                type: string;
                                format: string;
                                description: string;
                              };
                              name: {
                                type: string;
                                description: string;
                              };
                              image: {
                                type: string;
                                format: string;
                                nullable: boolean;
                                description: string;
                              };
                              emailVerified: {
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
          token: string | null;
          user: {
            id: string;
            email: string;
            name: string;
            image: string | null | undefined;
            emailVerified: boolean;
            createdAt: Date;
            updatedAt: Date;
          };
        }>;
        readonly setPassword: better_call240.StrictEndpoint<"/set-password", {
          method: "POST";
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          metadata: {
            SERVER_ONLY: true;
          };
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        } & {
          use: any[];
        }, {
          status: boolean;
        }>;
        readonly updateUser: better_call240.StrictEndpoint<"/update-user", {
          method: "POST";
          operationId: string;
          body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
            $Infer: {
              body: Partial<{}> & {
                name?: string | undefined;
                image?: string | undefined;
              };
            };
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        name: {
                          type: string;
                          description: string;
                        };
                        image: {
                          type: string;
                          description: string;
                        };
                      };
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
                          user: {
                            type: string;
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
          status: boolean;
        }>;
        readonly deleteUser: better_call240.StrictEndpoint<"/delete-user", {
          method: "POST";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            password: zod415.ZodOptional<zod415.ZodString>;
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        callbackURL: {
                          type: string;
                          description: string;
                        };
                        password: {
                          type: string;
                          description: string;
                        };
                        token: {
                          type: string;
                          description: string;
                        };
                      };
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
                          message: {
                            type: string;
                            enum: string[];
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
          message: string;
        }>;
        readonly requestPasswordReset: better_call240.StrictEndpoint<"/request-password-reset", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodEmail;
            redirectTo: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          status: {
                            type: string;
                          };
                          message: {
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
          message: string;
        }>;
        readonly requestPasswordResetCallback: better_call240.StrictEndpoint<"/reset-password/:token", {
          method: "GET";
          operationId: string;
          query: zod415.ZodObject<{
            callbackURL: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              parameters: ({
                name: string;
                in: "path";
                required: true;
                description: string;
                schema: {
                  type: "string";
                };
              } | {
                name: string;
                in: "query";
                required: true;
                description: string;
                schema: {
                  type: "string";
                };
              })[];
              responses: {
                "200": {
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
        }, never>;
        readonly listSessions: better_call240.StrictEndpoint<"/list-sessions", {
          method: "GET";
          operationId: string;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          requireHeaders: true;
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
        }, Prettify$1<{
          id: string;
          createdAt: Date;
          updatedAt: Date;
          userId: string;
          expiresAt: Date;
          token: string;
          ipAddress?: string | null | undefined;
          userAgent?: string | null | undefined;
        }>[]>;
        readonly revokeSession: better_call240.StrictEndpoint<"/revoke-session", {
          method: "POST";
          body: zod415.ZodObject<{
            token: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          requireHeaders: true;
          metadata: {
            openapi: {
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        token: {
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
                          status: {
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
          status: boolean;
        }>;
        readonly revokeSessions: better_call240.StrictEndpoint<"/revoke-sessions", {
          method: "POST";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          status: {
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
          status: boolean;
        }>;
        readonly revokeOtherSessions: better_call240.StrictEndpoint<"/revoke-other-sessions", {
          method: "POST";
          requireHeaders: true;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          status: {
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
          status: boolean;
        }>;
        readonly linkSocialAccount: better_call240.StrictEndpoint<"/link-social", {
          method: "POST";
          requireHeaders: true;
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            }, zod_v4_core57.$strip>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
              operationId: string;
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
                            description: string;
                          };
                          redirect: {
                            type: string;
                            description: string;
                          };
                          status: {
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
          url: string;
          redirect: boolean;
        }>;
        readonly listUserAccounts: better_call240.StrictEndpoint<"/list-accounts", {
          method: "GET";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                            };
                            providerId: {
                              type: string;
                            };
                            createdAt: {
                              type: string;
                              format: string;
                            };
                            updatedAt: {
                              type: string;
                              format: string;
                            };
                            accountId: {
                              type: string;
                            };
                            userId: {
                              type: string;
                            };
                            scopes: {
                              type: string;
                              items: {
                                type: string;
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
          };
        } & {
          use: any[];
        }, {
          id: string;
          providerId: string;
          createdAt: Date;
          updatedAt: Date;
          accountId: string;
          userId: string;
          scopes: string[];
        }[]>;
        readonly deleteUserCallback: better_call240.StrictEndpoint<"/delete-user/callback", {
          method: "GET";
          query: zod415.ZodObject<{
            token: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
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
                          success: {
                            type: string;
                            description: string;
                          };
                          message: {
                            type: string;
                            enum: string[];
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
          message: string;
        }>;
        readonly unlinkAccount: better_call240.StrictEndpoint<"/unlink-account", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        readonly refreshToken: better_call240.StrictEndpoint<"/refresh-token", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
            userId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          tokenType: {
                            type: string;
                          };
                          idToken: {
                            type: string;
                          };
                          accessToken: {
                            type: string;
                          };
                          refreshToken: {
                            type: string;
                          };
                          accessTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                          refreshTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                        };
                      };
                    };
                  };
                };
                400: {
                  description: string;
                };
              };
            };
          };
        } & {
          use: any[];
        }, {
          accessToken: string | undefined;
          refreshToken: string | undefined;
          accessTokenExpiresAt: Date | undefined;
          refreshTokenExpiresAt: Date | undefined;
          scope: string | null | undefined;
          idToken: string | null | undefined;
          providerId: string;
          accountId: string;
        }>;
        readonly getAccessToken: better_call240.StrictEndpoint<"/get-access-token", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
            userId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          tokenType: {
                            type: string;
                          };
                          idToken: {
                            type: string;
                          };
                          accessToken: {
                            type: string;
                          };
                          refreshToken: {
                            type: string;
                          };
                          accessTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                          refreshTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                        };
                      };
                    };
                  };
                };
                400: {
                  description: string;
                };
              };
            };
          };
        } & {
          use: any[];
        }, {
          accessToken: string;
          accessTokenExpiresAt: Date | undefined;
          scopes: string[];
          idToken: string | undefined;
        }>;
        readonly accountInfo: better_call240.StrictEndpoint<"/account-info", {
          method: "GET";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                              };
                              name: {
                                type: string;
                              };
                              email: {
                                type: string;
                              };
                              image: {
                                type: string;
                              };
                              emailVerified: {
                                type: string;
                              };
                            };
                            required: string[];
                          };
                          data: {
                            type: string;
                            properties: {};
                            additionalProperties: boolean;
                          };
                        };
                        required: string[];
                        additionalProperties: boolean;
                      };
                    };
                  };
                };
              };
            };
          };
          query: zod415.ZodOptional<zod415.ZodObject<{
            accountId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
        } & {
          use: any[];
        }, {
          user: _better_auth_core_oauth22.OAuth2UserInfo;
          data: Record<string, any>;
        } | null>;
      } & (((C extends undefined ? {} : C) & {
        baseURL: string | undefined;
        fetchOptions: {
          customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
        };
      })["plugins"] extends (infer Pl)[] ? UnionToIntersection<Pl extends {
        $InferServerPlugin: infer Plug;
      } ? Plug extends {
        endpoints: infer Endpoints;
      } ? Endpoints : {} : {}> : {}) : InferAPI<{
        readonly ok: better_call240.StrictEndpoint<"/ok", {
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
                        type: "object";
                        properties: {
                          ok: {
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
            isAction: false;
          };
        } & {
          use: any[];
        }, {
          ok: boolean;
        }>;
        readonly error: better_call240.StrictEndpoint<"/error", {
          method: "GET";
          metadata: {
            openapi: {
              description: string;
              responses: {
                "200": {
                  description: string;
                  content: {
                    "text/html": {
                      schema: {
                        type: "string";
                        description: string;
                      };
                    };
                  };
                };
              };
            };
            isAction: false;
          };
        } & {
          use: any[];
        }, Response>;
        readonly signInSocial: better_call240.StrictEndpoint<"/sign-in/social", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
            }, zod_v4_core57.$strip>>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            loginHint: zod415.ZodOptional<zod415.ZodString>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>;
          metadata: {
            $Infer: {
              body: zod415.infer<zod415.ZodObject<{
                callbackURL: zod415.ZodOptional<zod415.ZodString>;
                newUserCallbackURL: zod415.ZodOptional<zod415.ZodString>;
                errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
                provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
                disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
                idToken: zod415.ZodOptional<zod415.ZodObject<{
                  token: zod415.ZodString;
                  nonce: zod415.ZodOptional<zod415.ZodString>;
                  accessToken: zod415.ZodOptional<zod415.ZodString>;
                  refreshToken: zod415.ZodOptional<zod415.ZodString>;
                  expiresAt: zod415.ZodOptional<zod415.ZodNumber>;
                }, zod_v4_core57.$strip>>;
                scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
                requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
                loginHint: zod415.ZodOptional<zod415.ZodString>;
                additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
              }, zod_v4_core57.$strip>>;
              returned: {
                redirect: boolean;
                token?: string | undefined;
                url?: string | undefined;
                user?: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                } | undefined;
              };
            };
            openapi: {
              description: string;
              operationId: string;
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        description: string;
                        properties: {
                          token: {
                            type: string;
                          };
                          user: {
                            type: string;
                            $ref: string;
                          };
                          url: {
                            type: string;
                          };
                          redirect: {
                            type: string;
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
          redirect: boolean;
          url: string;
        } | {
          redirect: boolean;
          token: string;
          url: undefined;
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
        readonly callbackOAuth: better_call240.StrictEndpoint<"/callback/:id", {
          method: ("GET" | "POST")[];
          operationId: string;
          body: zod415.ZodOptional<zod415.ZodObject<{
            code: zod415.ZodOptional<zod415.ZodString>;
            error: zod415.ZodOptional<zod415.ZodString>;
            device_id: zod415.ZodOptional<zod415.ZodString>;
            error_description: zod415.ZodOptional<zod415.ZodString>;
            state: zod415.ZodOptional<zod415.ZodString>;
            user: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          query: zod415.ZodOptional<zod415.ZodObject<{
            code: zod415.ZodOptional<zod415.ZodString>;
            error: zod415.ZodOptional<zod415.ZodString>;
            device_id: zod415.ZodOptional<zod415.ZodString>;
            error_description: zod415.ZodOptional<zod415.ZodString>;
            state: zod415.ZodOptional<zod415.ZodString>;
            user: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          metadata: {
            allowedMediaTypes: string[];
            isAction: false;
          };
        } & {
          use: any[];
        }, void>;
        readonly getSession: better_call240.StrictEndpoint<"/get-session", {
          method: "GET";
          operationId: string;
          query: zod415.ZodOptional<zod415.ZodObject<{
            disableCookieCache: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
            disableRefresh: zod415.ZodOptional<zod415.ZodCoercedBoolean<unknown>>;
          }, zod_v4_core57.$strip>>;
          requireHeaders: true;
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
                          session: {
                            $ref: string;
                          };
                          user: {
                            $ref: string;
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
        } | null>;
        readonly signOut: better_call240.StrictEndpoint<"/sign-out", {
          method: "POST";
          operationId: string;
          requireHeaders: true;
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
        readonly signUpEmail: better_call240.StrictEndpoint<"/sign-up/email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
          metadata: {
            $Infer: {
              body: {
                name: string;
                email: string;
                password: string;
                image?: string | undefined;
                callbackURL?: string | undefined;
                rememberMe?: boolean | undefined;
              };
              returned: {
                token: string | null;
                user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                };
              };
            };
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        name: {
                          type: string;
                          description: string;
                        };
                        email: {
                          type: string;
                          description: string;
                        };
                        password: {
                          type: string;
                          description: string;
                        };
                        image: {
                          type: string;
                          description: string;
                        };
                        callbackURL: {
                          type: string;
                          description: string;
                        };
                        rememberMe: {
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
                          token: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                                description: string;
                              };
                              email: {
                                type: string;
                                format: string;
                                description: string;
                              };
                              name: {
                                type: string;
                                description: string;
                              };
                              image: {
                                type: string;
                                format: string;
                                nullable: boolean;
                                description: string;
                              };
                              emailVerified: {
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
                        required: string[];
                      };
                    };
                  };
                };
                "422": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
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
          token: null;
          user: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        } | {
          token: string;
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
        readonly signInEmail: better_call240.StrictEndpoint<"/sign-in/email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodString;
            password: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            rememberMe: zod415.ZodOptional<zod415.ZodDefault<zod415.ZodBoolean>>;
          }, zod_v4_core57.$strip>;
          metadata: {
            $Infer: {
              body: {
                email: string;
                password: string;
                callbackURL?: string | undefined;
                rememberMe?: boolean | undefined;
              };
              returned: {
                redirect: boolean;
                token: string;
                url?: string | undefined;
                user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
                };
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
                        description: string;
                        properties: {
                          redirect: {
                            type: string;
                            enum: boolean[];
                          };
                          token: {
                            type: string;
                            description: string;
                          };
                          url: {
                            type: string;
                            nullable: boolean;
                          };
                          user: {
                            type: string;
                            $ref: string;
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
          redirect: boolean;
          token: string;
          url?: string | undefined;
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
        readonly resetPassword: better_call240.StrictEndpoint<"/reset-password", {
          method: "POST";
          operationId: string;
          query: zod415.ZodOptional<zod415.ZodObject<{
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
        readonly verifyEmail: better_call240.StrictEndpoint<"/verify-email", {
          method: "GET";
          operationId: string;
          query: zod415.ZodObject<{
            token: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
          metadata: {
            openapi: {
              description: string;
              parameters: ({
                name: string;
                in: "query";
                description: string;
                required: true;
                schema: {
                  type: "string";
                };
              } | {
                name: string;
                in: "query";
                description: string;
                required: false;
                schema: {
                  type: "string";
                };
              })[];
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          user: {
                            type: string;
                            $ref: string;
                          };
                          status: {
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
        }, void | {
          status: boolean;
        }>;
        readonly sendVerificationEmail: better_call240.StrictEndpoint<"/send-verification-email", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodEmail;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        email: {
                          type: string;
                          description: string;
                          example: string;
                        };
                        callbackURL: {
                          type: string;
                          description: string;
                          example: string;
                          nullable: boolean;
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
                          status: {
                            type: string;
                            description: string;
                            example: boolean;
                          };
                        };
                      };
                    };
                  };
                };
                "400": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
                            type: string;
                            description: string;
                            example: string;
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
        readonly changeEmail: better_call240.StrictEndpoint<"/change-email", {
          method: "POST";
          body: zod415.ZodObject<{
            newEmail: zod415.ZodEmail;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
              responses: {
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          user: {
                            type: string;
                            $ref: string;
                          };
                          status: {
                            type: string;
                            description: string;
                          };
                          message: {
                            type: string;
                            enum: string[];
                            description: string;
                            nullable: boolean;
                          };
                        };
                        required: string[];
                      };
                    };
                  };
                };
                "422": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          message: {
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
        readonly changePassword: better_call240.StrictEndpoint<"/change-password", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
            currentPassword: zod415.ZodString;
            revokeOtherSessions: zod415.ZodOptional<zod415.ZodBoolean>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                "200": {
                  description: string;
                  content: {
                    "application/json": {
                      schema: {
                        type: "object";
                        properties: {
                          token: {
                            type: string;
                            nullable: boolean;
                            description: string;
                          };
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                                description: string;
                              };
                              email: {
                                type: string;
                                format: string;
                                description: string;
                              };
                              name: {
                                type: string;
                                description: string;
                              };
                              image: {
                                type: string;
                                format: string;
                                nullable: boolean;
                                description: string;
                              };
                              emailVerified: {
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
          token: string | null;
          user: {
            id: string;
            email: string;
            name: string;
            image: string | null | undefined;
            emailVerified: boolean;
            createdAt: Date;
            updatedAt: Date;
          };
        }>;
        readonly setPassword: better_call240.StrictEndpoint<"/set-password", {
          method: "POST";
          body: zod415.ZodObject<{
            newPassword: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          metadata: {
            SERVER_ONLY: true;
          };
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        } & {
          use: any[];
        }, {
          status: boolean;
        }>;
        readonly updateUser: better_call240.StrictEndpoint<"/update-user", {
          method: "POST";
          operationId: string;
          body: zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
            $Infer: {
              body: Partial<{}> & {
                name?: string | undefined;
                image?: string | undefined;
              };
            };
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        name: {
                          type: string;
                          description: string;
                        };
                        image: {
                          type: string;
                          description: string;
                        };
                      };
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
                          user: {
                            type: string;
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
          status: boolean;
        }>;
        readonly deleteUser: better_call240.StrictEndpoint<"/delete-user", {
          method: "POST";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            password: zod415.ZodOptional<zod415.ZodString>;
            token: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        callbackURL: {
                          type: string;
                          description: string;
                        };
                        password: {
                          type: string;
                          description: string;
                        };
                        token: {
                          type: string;
                          description: string;
                        };
                      };
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
                          message: {
                            type: string;
                            enum: string[];
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
          message: string;
        }>;
        readonly requestPasswordReset: better_call240.StrictEndpoint<"/request-password-reset", {
          method: "POST";
          operationId: string;
          body: zod415.ZodObject<{
            email: zod415.ZodEmail;
            redirectTo: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          status: {
                            type: string;
                          };
                          message: {
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
          message: string;
        }>;
        readonly requestPasswordResetCallback: better_call240.StrictEndpoint<"/reset-password/:token", {
          method: "GET";
          operationId: string;
          query: zod415.ZodObject<{
            callbackURL: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
          metadata: {
            openapi: {
              operationId: string;
              description: string;
              parameters: ({
                name: string;
                in: "path";
                required: true;
                description: string;
                schema: {
                  type: "string";
                };
              } | {
                name: string;
                in: "query";
                required: true;
                description: string;
                schema: {
                  type: "string";
                };
              })[];
              responses: {
                "200": {
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
        }, never>;
        readonly listSessions: better_call240.StrictEndpoint<"/list-sessions", {
          method: "GET";
          operationId: string;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          requireHeaders: true;
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
        }, Prettify$1<{
          id: string;
          createdAt: Date;
          updatedAt: Date;
          userId: string;
          expiresAt: Date;
          token: string;
          ipAddress?: string | null | undefined;
          userAgent?: string | null | undefined;
        }>[]>;
        readonly revokeSession: better_call240.StrictEndpoint<"/revoke-session", {
          method: "POST";
          body: zod415.ZodObject<{
            token: zod415.ZodString;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
          requireHeaders: true;
          metadata: {
            openapi: {
              description: string;
              requestBody: {
                content: {
                  "application/json": {
                    schema: {
                      type: "object";
                      properties: {
                        token: {
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
                          status: {
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
          status: boolean;
        }>;
        readonly revokeSessions: better_call240.StrictEndpoint<"/revoke-sessions", {
          method: "POST";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          status: {
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
          status: boolean;
        }>;
        readonly revokeOtherSessions: better_call240.StrictEndpoint<"/revoke-other-sessions", {
          method: "POST";
          requireHeaders: true;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          status: {
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
          status: boolean;
        }>;
        readonly linkSocialAccount: better_call240.StrictEndpoint<"/link-social", {
          method: "POST";
          requireHeaders: true;
          body: zod415.ZodObject<{
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
            provider: zod415.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core57.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            idToken: zod415.ZodOptional<zod415.ZodObject<{
              token: zod415.ZodString;
              nonce: zod415.ZodOptional<zod415.ZodString>;
              accessToken: zod415.ZodOptional<zod415.ZodString>;
              refreshToken: zod415.ZodOptional<zod415.ZodString>;
              scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            }, zod_v4_core57.$strip>>;
            requestSignUp: zod415.ZodOptional<zod415.ZodBoolean>;
            scopes: zod415.ZodOptional<zod415.ZodArray<zod415.ZodString>>;
            errorCallbackURL: zod415.ZodOptional<zod415.ZodString>;
            disableRedirect: zod415.ZodOptional<zod415.ZodBoolean>;
            additionalData: zod415.ZodOptional<zod415.ZodRecord<zod415.ZodString, zod415.ZodAny>>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
              operationId: string;
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
                            description: string;
                          };
                          redirect: {
                            type: string;
                            description: string;
                          };
                          status: {
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
          url: string;
          redirect: boolean;
        }>;
        readonly listUserAccounts: better_call240.StrictEndpoint<"/list-accounts", {
          method: "GET";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                            };
                            providerId: {
                              type: string;
                            };
                            createdAt: {
                              type: string;
                              format: string;
                            };
                            updatedAt: {
                              type: string;
                              format: string;
                            };
                            accountId: {
                              type: string;
                            };
                            userId: {
                              type: string;
                            };
                            scopes: {
                              type: string;
                              items: {
                                type: string;
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
          };
        } & {
          use: any[];
        }, {
          id: string;
          providerId: string;
          createdAt: Date;
          updatedAt: Date;
          accountId: string;
          userId: string;
          scopes: string[];
        }[]>;
        readonly deleteUserCallback: better_call240.StrictEndpoint<"/delete-user/callback", {
          method: "GET";
          query: zod415.ZodObject<{
            token: zod415.ZodString;
            callbackURL: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<void>)[];
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
                          success: {
                            type: string;
                            description: string;
                          };
                          message: {
                            type: string;
                            enum: string[];
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
          message: string;
        }>;
        readonly unlinkAccount: better_call240.StrictEndpoint<"/unlink-account", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
        readonly refreshToken: better_call240.StrictEndpoint<"/refresh-token", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
            userId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          tokenType: {
                            type: string;
                          };
                          idToken: {
                            type: string;
                          };
                          accessToken: {
                            type: string;
                          };
                          refreshToken: {
                            type: string;
                          };
                          accessTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                          refreshTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                        };
                      };
                    };
                  };
                };
                400: {
                  description: string;
                };
              };
            };
          };
        } & {
          use: any[];
        }, {
          accessToken: string | undefined;
          refreshToken: string | undefined;
          accessTokenExpiresAt: Date | undefined;
          refreshTokenExpiresAt: Date | undefined;
          scope: string | null | undefined;
          idToken: string | null | undefined;
          providerId: string;
          accountId: string;
        }>;
        readonly getAccessToken: better_call240.StrictEndpoint<"/get-access-token", {
          method: "POST";
          body: zod415.ZodObject<{
            providerId: zod415.ZodString;
            accountId: zod415.ZodOptional<zod415.ZodString>;
            userId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>;
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
                          tokenType: {
                            type: string;
                          };
                          idToken: {
                            type: string;
                          };
                          accessToken: {
                            type: string;
                          };
                          refreshToken: {
                            type: string;
                          };
                          accessTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                          refreshTokenExpiresAt: {
                            type: string;
                            format: string;
                          };
                        };
                      };
                    };
                  };
                };
                400: {
                  description: string;
                };
              };
            };
          };
        } & {
          use: any[];
        }, {
          accessToken: string;
          accessTokenExpiresAt: Date | undefined;
          scopes: string[];
          idToken: string | undefined;
        }>;
        readonly accountInfo: better_call240.StrictEndpoint<"/account-info", {
          method: "GET";
          use: ((inputContext: better_call240.MiddlewareInputContext<better_call240.MiddlewareOptions>) => Promise<{
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
                          user: {
                            type: string;
                            properties: {
                              id: {
                                type: string;
                              };
                              name: {
                                type: string;
                              };
                              email: {
                                type: string;
                              };
                              image: {
                                type: string;
                              };
                              emailVerified: {
                                type: string;
                              };
                            };
                            required: string[];
                          };
                          data: {
                            type: string;
                            properties: {};
                            additionalProperties: boolean;
                          };
                        };
                        required: string[];
                        additionalProperties: boolean;
                      };
                    };
                  };
                };
              };
            };
          };
          query: zod415.ZodOptional<zod415.ZodObject<{
            accountId: zod415.ZodOptional<zod415.ZodString>;
          }, zod_v4_core57.$strip>>;
        } & {
          use: any[];
        }, {
          user: _better_auth_core_oauth22.OAuth2UserInfo;
          data: Record<string, any>;
        } | null>;
      }>, (C extends undefined ? {} : C) & {
        baseURL: string | undefined;
        fetchOptions: {
          customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
        };
      }>> extends {
        getSession: () => Promise<infer Res>;
      } ? Res extends {
        data: null;
        error: {
          message?: string | undefined;
          status: number;
          statusText: string;
        };
      } | {
        data: infer S;
        error: null;
      } ? S : Res extends Record<string, any> ? Res : never : never>;
    };
    $ERROR_CODES: InferErrorCodes<(C extends undefined ? {} : C) & {
      baseURL: string | undefined;
      fetchOptions: {
        customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
      };
    }> & {
      readonly USER_NOT_FOUND: "User not found";
      readonly FAILED_TO_CREATE_USER: "Failed to create user";
      readonly FAILED_TO_CREATE_SESSION: "Failed to create session";
      readonly FAILED_TO_UPDATE_USER: "Failed to update user";
      readonly FAILED_TO_GET_SESSION: "Failed to get session";
      readonly INVALID_PASSWORD: "Invalid password";
      readonly INVALID_EMAIL: "Invalid email";
      readonly INVALID_EMAIL_OR_PASSWORD: "Invalid email or password";
      readonly SOCIAL_ACCOUNT_ALREADY_LINKED: "Social account already linked";
      readonly PROVIDER_NOT_FOUND: "Provider not found";
      readonly INVALID_TOKEN: "Invalid token";
      readonly ID_TOKEN_NOT_SUPPORTED: "id_token not supported";
      readonly FAILED_TO_GET_USER_INFO: "Failed to get user info";
      readonly USER_EMAIL_NOT_FOUND: "User email not found";
      readonly EMAIL_NOT_VERIFIED: "Email not verified";
      readonly PASSWORD_TOO_SHORT: "Password too short";
      readonly PASSWORD_TOO_LONG: "Password too long";
      readonly USER_ALREADY_EXISTS: "User already exists.";
      readonly USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "User already exists. Use another email.";
      readonly EMAIL_CAN_NOT_BE_UPDATED: "Email can not be updated";
      readonly CREDENTIAL_ACCOUNT_NOT_FOUND: "Credential account not found";
      readonly SESSION_EXPIRED: "Session expired. Re-authenticate to perform this action.";
      readonly FAILED_TO_UNLINK_LAST_ACCOUNT: "You can't unlink your last account";
      readonly ACCOUNT_NOT_FOUND: "Account not found";
      readonly USER_ALREADY_HAS_PASSWORD: "User already has a password. Provide that to delete the account.";
    } extends infer T_1 ? { [K in keyof T_1]: T_1[K] extends ((...args: any[]) => any) ? T_1[K] : T_1[K] extends object ? T_1[K] extends any[] ? T_1[K] : T_1[K] extends Date ? T_1[K] : T_1[K] extends infer T_2 ? { [K_2 in keyof T_2]: T_2[K_2] extends ((...args: any[]) => any) ? T_2[K_2] : T_2[K_2] extends object ? T_2[K_2] extends any[] ? T_2[K_2] : T_2[K_2] extends Date ? T_2[K_2] : T_2[K_2] extends infer T_3 ? { [K_3 in keyof T_3]: T_3[K_3] extends ((...args: any[]) => any) ? T_3[K_3] : T_3[K_3] extends object ? T_3[K_3] extends any[] ? T_3[K_3] : T_3[K_3] extends Date ? T_3[K_3] : T_3[K_3] extends infer T_4 ? { [K_4 in keyof T_4]: T_4[K_4] extends ((...args: any[]) => any) ? T_4[K_4] : T_4[K_4] extends object ? T_4[K_4] extends any[] ? T_4[K_4] : T_4[K_4] extends Date ? T_4[K_4] : T_4[K_4] extends infer T_5 ? { [K_5 in keyof T_5]: T_5[K_5] extends ((...args: any[]) => any) ? T_5[K_5] : T_5[K_5] extends object ? T_5[K_5] extends any[] ? T_5[K_5] : T_5[K_5] extends Date ? T_5[K_5] : T_5[K_5] extends infer T_6 ? { [K_6 in keyof T_6]: T_6[K_6] extends ((...args: any[]) => any) ? T_6[K_6] : T_6[K_6] extends object ? T_6[K_6] extends any[] ? T_6[K_6] : T_6[K_6] extends Date ? T_6[K_6] : T_6[K_6] extends infer T_7 ? { [K_7 in keyof T_7]: T_7[K_7] extends ((...args: any[]) => any) ? T_7[K_7] : T_7[K_7] extends object ? T_7[K_7] extends any[] ? T_7[K_7] : T_7[K_7] extends Date ? T_7[K_7] : T_7[K_7] extends infer T_8 ? { [K_8 in keyof T_8]: T_8[K_8] extends ((...args: any[]) => any) ? T_8[K_8] : T_8[K_8] extends object ? T_8[K_8] extends any[] ? T_8[K_8] : T_8[K_8] extends Date ? T_8[K_8] : T_8[K_8] extends infer T_9 ? { [K_9 in keyof T_9]: T_9[K_9] extends ((...args: any[]) => any) ? T_9[K_9] : T_9[K_9] extends object ? T_9[K_9] extends any[] ? T_9[K_9] : T_9[K_9] extends Date ? T_9[K_9] : T_9[K_9] extends infer T_10 ? { [K_10 in keyof T_10]: T_10[K_10] extends ((...args: any[]) => any) ? T_10[K_10] : T_10[K_10] extends object ? T_10[K_10] extends any[] ? T_10[K_10] : T_10[K_10] extends Date ? T_10[K_10] : T_10[K_10] extends infer T_11 ? { [K_11 in keyof T_11]: T_11[K_11] extends ((...args: any[]) => any) ? T_11[K_11] : T_11[K_11] extends object ? T_11[K_11] extends any[] ? T_11[K_11] : T_11[K_11] extends Date ? T_11[K_11] : /*elided*/any : T_11[K_11] } : never : T_10[K_10] } : never : T_9[K_9] } : never : T_8[K_8] } : never : T_7[K_7] } : never : T_6[K_6] } : never : T_5[K_5] } : never : T_4[K_4] } : never : T_3[K_3] } : never : T_2[K_2] } : never : T_1[K] } : never;
  };
  testUser: {
    id?: string | undefined;
    createdAt?: Date | undefined;
    updatedAt?: Date | undefined;
    email: string;
    emailVerified?: boolean | undefined;
    name: string;
    image?: string | null | undefined;
    password: string;
  };
  signInWithTestUser: () => Promise<{
    session: Session;
    user: User;
    headers: Headers;
    setCookie: (name: string, value: string) => void;
    runWithUser: (fn: (headers: Headers) => Promise<void>) => Promise<void>;
  }>;
  signInWithUser: (email: string, password: string) => Promise<{
    res: {
      user: User;
      session: Session;
    };
    headers: Headers;
  }>;
  cookieSetter: typeof setCookieToHeader;
  customFetchImpl: (url: string | URL | Request, init?: RequestInit | undefined) => Promise<Response>;
  sessionSetter: (headers: Headers) => (context: SuccessContext) => void;
  db: _better_auth_core_db_adapter0.DBAdapter<BetterAuthOptions>;
  runWithUser: (email: string, password: string, fn: (headers: Headers) => Promise<void> | void) => Promise<void>;
}>;
//#endregion
export { convertSetCookieToCookie, getTestInstance };