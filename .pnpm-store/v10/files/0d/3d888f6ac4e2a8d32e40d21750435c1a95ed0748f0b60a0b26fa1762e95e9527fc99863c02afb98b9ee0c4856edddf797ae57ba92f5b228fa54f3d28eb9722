import { m as InferUser, p as InferSession } from "./index--CrC0_x3.mjs";
import * as _better_auth_core9 from "@better-auth/core";
import { BetterAuthOptions, GenericEndpointContext } from "@better-auth/core";
import * as better_call158 from "better-call";
import * as z from "zod";

//#region src/plugins/custom-session/index.d.ts
type CustomSessionPluginOptions = {
  /**
   * This option is used to determine if the list-device-sessions endpoint should be mutated to the custom session data.
   * @default false
   */
  shouldMutateListDeviceSessionsEndpoint?: boolean | undefined;
};
declare const customSession: <Returns extends Record<string, any>, O extends BetterAuthOptions = BetterAuthOptions>(fn: (session: {
  user: InferUser<O>;
  session: InferSession<O>;
}, ctx: GenericEndpointContext) => Promise<Returns>, options?: O | undefined, pluginOptions?: CustomSessionPluginOptions | undefined) => {
  id: "custom-session";
  hooks: {
    after: {
      matcher: (ctx: _better_auth_core9.HookEndpointContext) => boolean;
      handler: (inputContext: better_call158.MiddlewareInputContext<better_call158.MiddlewareOptions>) => Promise<Awaited<Returns>[] | undefined>;
    }[];
  };
  endpoints: {
    getSession: better_call158.StrictEndpoint<"/get-session", {
      method: "GET";
      query: z.ZodOptional<z.ZodObject<{
        disableCookieCache: z.ZodOptional<z.ZodUnion<[z.ZodBoolean, z.ZodPipe<z.ZodString, z.ZodTransform<boolean, string>>]>>;
        disableRefresh: z.ZodOptional<z.ZodBoolean>;
      }, z.core.$strip>>;
      metadata: {
        CUSTOM_SESSION: boolean;
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "array";
                    nullable: boolean;
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
      requireHeaders: true;
    } & {
      use: any[];
    }, Returns | null>;
  };
  $Infer: {
    Session: Awaited<ReturnType<typeof fn>>;
  };
};
//#endregion
export { customSession as n, CustomSessionPluginOptions as t };