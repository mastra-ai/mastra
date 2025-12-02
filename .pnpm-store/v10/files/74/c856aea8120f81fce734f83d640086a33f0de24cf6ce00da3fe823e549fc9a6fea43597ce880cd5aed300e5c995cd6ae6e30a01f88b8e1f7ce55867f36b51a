import { t as InferOptionSchema } from "./plugins-Brc8BsoZ.mjs";
import * as _better_auth_core4 from "@better-auth/core";
import * as _better_auth_core_db7 from "@better-auth/core/db";
import * as better_call149 from "better-call";
import * as z from "zod";

//#region src/plugins/username/schema.d.ts
declare const getSchema: (normalizer: {
  username: (username: string) => string;
  displayUsername: (displayUsername: string) => string;
}) => {
  user: {
    fields: {
      username: {
        type: "string";
        required: false;
        sortable: true;
        unique: true;
        returned: true;
        transform: {
          input(value: _better_auth_core_db7.DBPrimitive): string | number | boolean | Date | unknown[] | Record<string, unknown> | null | undefined;
        };
      };
      displayUsername: {
        type: "string";
        required: false;
        transform: {
          input(value: _better_auth_core_db7.DBPrimitive): string | number | boolean | Date | unknown[] | Record<string, unknown> | null | undefined;
        };
      };
    };
  };
};
type UsernameSchema = ReturnType<typeof getSchema>;
//#endregion
//#region src/plugins/username/error-codes.d.ts
declare const USERNAME_ERROR_CODES: {
  readonly INVALID_USERNAME_OR_PASSWORD: "Invalid username or password";
  readonly EMAIL_NOT_VERIFIED: "Email not verified";
  readonly UNEXPECTED_ERROR: "Unexpected error";
  readonly USERNAME_IS_ALREADY_TAKEN: "Username is already taken. Please try another.";
  readonly USERNAME_TOO_SHORT: "Username is too short";
  readonly USERNAME_TOO_LONG: "Username is too long";
  readonly INVALID_USERNAME: "Username is invalid";
  readonly INVALID_DISPLAY_USERNAME: "Display username is invalid";
};
//#endregion
//#region src/plugins/username/index.d.ts
type UsernameOptions = {
  schema?: InferOptionSchema<UsernameSchema> | undefined;
  /**
   * The minimum length of the username
   *
   * @default 3
   */
  minUsernameLength?: number | undefined;
  /**
   * The maximum length of the username
   *
   * @default 30
   */
  maxUsernameLength?: number | undefined;
  /**
   * A function to validate the username
   *
   * By default, the username should only contain alphanumeric characters and underscores
   */
  usernameValidator?: ((username: string) => boolean | Promise<boolean>) | undefined;
  /**
   * A function to validate the display username
   *
   * By default, no validation is applied to display username
   */
  displayUsernameValidator?: ((displayUsername: string) => boolean | Promise<boolean>) | undefined;
  /**
   * A function to normalize the username
   *
   * @default (username) => username.toLowerCase()
   */
  usernameNormalization?: (((username: string) => string) | false) | undefined;
  /**
   * A function to normalize the display username
   *
   * @default false
   */
  displayUsernameNormalization?: (((displayUsername: string) => string) | false) | undefined;
  /**
   * The order of validation
   *
   * @default { username: "pre-normalization", displayUsername: "pre-normalization" }
   */
  validationOrder?: {
    /**
     * The order of username validation
     *
     * @default "pre-normalization"
     */
    username?: "pre-normalization" | "post-normalization";
    /**
     * The order of display username validation
     *
     * @default "pre-normalization"
     */
    displayUsername?: "pre-normalization" | "post-normalization";
  } | undefined;
};
declare const username: (options?: UsernameOptions | undefined) => {
  id: "username";
  init(ctx: _better_auth_core4.AuthContext): {
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
            } & Record<string, unknown>, context: _better_auth_core4.GenericEndpointContext | undefined): Promise<{
              data: {
                displayUsername?: string | undefined;
                username?: string | undefined;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
              };
            }>;
          };
          update: {
            before(user: Partial<{
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            }> & Record<string, unknown>, context: _better_auth_core4.GenericEndpointContext | undefined): Promise<{
              data: {
                displayUsername?: string | undefined;
                username?: string | undefined;
                id?: string | undefined;
                createdAt?: Date | undefined;
                updatedAt?: Date | undefined;
                email?: string | undefined;
                emailVerified?: boolean | undefined;
                name?: string | undefined;
                image?: string | null | undefined;
              };
            }>;
          };
        };
      };
    };
  };
  endpoints: {
    signInUsername: better_call149.StrictEndpoint<"/sign-in/username", {
      method: "POST";
      body: z.ZodObject<{
        username: z.ZodString;
        password: z.ZodString;
        rememberMe: z.ZodOptional<z.ZodBoolean>;
        callbackURL: z.ZodOptional<z.ZodString>;
      }, z.core.$strip>;
      metadata: {
        openapi: {
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
                      token: {
                        type: string;
                        description: string;
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
            422: {
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
      token: string;
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        username: string;
        displayUsername: string;
        name: string;
        image: string | null | undefined;
        createdAt: Date;
        updatedAt: Date;
      };
    } | null>;
    isUsernameAvailable: better_call149.StrictEndpoint<"/is-username-available", {
      method: "POST";
      body: z.ZodObject<{
        username: z.ZodString;
      }, z.core.$strip>;
    } & {
      use: any[];
    }, {
      available: boolean;
    }>;
  };
  schema: {
    user: {
      fields: {
        username: {
          type: "string";
          required: false;
          sortable: true;
          unique: true;
          returned: true;
          transform: {
            input(value: _better_auth_core_db7.DBPrimitive): string | number | boolean | Date | unknown[] | Record<string, unknown> | null | undefined;
          };
        };
        displayUsername: {
          type: "string";
          required: false;
          transform: {
            input(value: _better_auth_core_db7.DBPrimitive): string | number | boolean | Date | unknown[] | Record<string, unknown> | null | undefined;
          };
        };
      };
    };
  };
  hooks: {
    before: {
      matcher(context: _better_auth_core4.HookEndpointContext): boolean;
      handler: (inputContext: better_call149.MiddlewareInputContext<better_call149.MiddlewareOptions>) => Promise<void>;
    }[];
  };
  $ERROR_CODES: {
    readonly INVALID_USERNAME_OR_PASSWORD: "Invalid username or password";
    readonly EMAIL_NOT_VERIFIED: "Email not verified";
    readonly UNEXPECTED_ERROR: "Unexpected error";
    readonly USERNAME_IS_ALREADY_TAKEN: "Username is already taken. Please try another.";
    readonly USERNAME_TOO_SHORT: "Username is too short";
    readonly USERNAME_TOO_LONG: "Username is too long";
    readonly INVALID_USERNAME: "Username is invalid";
    readonly INVALID_DISPLAY_USERNAME: "Display username is invalid";
  };
};
//#endregion
export { username as n, USERNAME_ERROR_CODES as r, UsernameOptions as t };