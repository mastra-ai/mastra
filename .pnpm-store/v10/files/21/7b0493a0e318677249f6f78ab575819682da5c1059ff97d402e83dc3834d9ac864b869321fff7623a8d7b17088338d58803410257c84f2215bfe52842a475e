import { _ as User, g as Session } from "./index--CrC0_x3.mjs";
import { t as InferOptionSchema } from "./plugins-Brc8BsoZ.mjs";
import * as _better_auth_core3 from "@better-auth/core";
import { AuthContext, GenericEndpointContext } from "@better-auth/core";
import * as better_call131 from "better-call";
import { EndpointContext } from "better-call";

//#region src/plugins/anonymous/schema.d.ts
declare const schema: {
  user: {
    fields: {
      isAnonymous: {
        type: "boolean";
        required: false;
        input: false;
        defaultValue: false;
      };
    };
  };
};
//#endregion
//#region src/plugins/anonymous/types.d.ts
interface UserWithAnonymous extends User {
  isAnonymous: boolean;
}
interface AnonymousOptions {
  /**
   * Configure the domain name of the temporary email
   * address for anonymous users in the database.
   * @default "baseURL"
   */
  emailDomainName?: string | undefined;
  /**
   * A useful hook to run after an anonymous user
   * is about to link their account.
   */
  onLinkAccount?: ((data: {
    anonymousUser: {
      user: UserWithAnonymous & Record<string, any>;
      session: Session & Record<string, any>;
    };
    newUser: {
      user: User & Record<string, any>;
      session: Session & Record<string, any>;
    };
    ctx: GenericEndpointContext;
  }) => Promise<void> | void) | undefined;
  /**
   * Disable deleting the anonymous user after linking
   */
  disableDeleteAnonymousUser?: boolean | undefined;
  /**
   * A hook to generate a name for the anonymous user.
   * Useful if you want to have random names for anonymous users, or if `name` is unique in your database.
   * @returns The name for the anonymous user.
   */
  generateName?: ((ctx: EndpointContext<"/sign-in/anonymous", {
    method: "POST";
  }, AuthContext>) => Promise<string> | string) | undefined;
  /**
   * A custom random email generation function.
   * Useful when you want to specify a temporary email in a different format from the default.
   * You are responsible for ensuring the email is unique to avoid conflicts.
   * @returns The email address for the anonymous user.
   */
  generateRandomEmail?: (() => Promise<string> | string) | undefined;
  /**
   * Custom schema for the anonymous plugin
   */
  schema?: InferOptionSchema<typeof schema> | undefined;
}
//#endregion
//#region src/plugins/anonymous/index.d.ts
declare const anonymous: (options?: AnonymousOptions | undefined) => {
  id: "anonymous";
  endpoints: {
    signInAnonymous: better_call131.StrictEndpoint<"/sign-in/anonymous", {
      method: "POST";
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
                      user: {
                        $ref: string;
                      };
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
      token: string;
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        name: string;
        createdAt: Date;
        updatedAt: Date;
      };
    } | null>;
  };
  hooks: {
    after: {
      matcher(ctx: _better_auth_core3.HookEndpointContext): boolean;
      handler: (inputContext: better_call131.MiddlewareInputContext<better_call131.MiddlewareOptions>) => Promise<void>;
    }[];
  };
  schema: {
    user: {
      fields: {
        isAnonymous: {
          type: "boolean";
          required: false;
          input: false;
          defaultValue: false;
        };
      };
    };
  };
  $ERROR_CODES: {
    readonly INVALID_EMAIL_FORMAT: "Email was not generated in a valid format";
    readonly FAILED_TO_CREATE_USER: "Failed to create user";
    readonly COULD_NOT_CREATE_SESSION: "Could not create session";
    readonly ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY: "Anonymous users cannot sign in again anonymously";
  };
};
//#endregion
export { anonymous as t };