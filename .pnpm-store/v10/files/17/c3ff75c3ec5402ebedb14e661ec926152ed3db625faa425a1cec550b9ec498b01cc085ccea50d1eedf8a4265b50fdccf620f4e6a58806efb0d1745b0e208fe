import * as _better_auth_core13 from "@better-auth/core";
import * as better_call167 from "better-call";
import * as z from "zod";

//#region src/plugins/oauth-proxy/index.d.ts
interface OAuthProxyOptions {
  /**
   * The current URL of the application.
   * The plugin will attempt to infer the current URL from your environment
   * by checking the base URL from popular hosting providers,
   * from the request URL if invoked by a client,
   * or as a fallback, from the `baseURL` in your auth config.
   * If the URL is not inferred correctly, you can provide a value here."
   */
  currentURL?: string | undefined;
  /**
   * If a request in a production url it won't be proxied.
   *
   * default to `BETTER_AUTH_URL`
   */
  productionURL?: string | undefined;
}
declare const oAuthProxy: (opts?: OAuthProxyOptions | undefined) => {
  id: "oauth-proxy";
  options: OAuthProxyOptions | undefined;
  endpoints: {
    oAuthProxy: better_call167.StrictEndpoint<"/oauth-proxy-callback", {
      method: "GET";
      operationId: string;
      query: z.ZodObject<{
        callbackURL: z.ZodString;
        cookies: z.ZodString;
      }, z.core.$strip>;
      use: ((inputContext: better_call167.MiddlewareInputContext<better_call167.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          parameters: {
            in: "query";
            name: string;
            required: true;
            description: string;
          }[];
          responses: {
            302: {
              description: string;
              headers: {
                Location: {
                  description: string;
                  schema: {
                    type: string;
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
  };
  hooks: {
    before: {
      matcher(context: _better_auth_core13.HookEndpointContext): boolean;
      handler: (inputContext: better_call167.MiddlewareInputContext<better_call167.MiddlewareOptions>) => Promise<void>;
    }[];
    after: {
      matcher(context: _better_auth_core13.HookEndpointContext): boolean;
      handler: (inputContext: better_call167.MiddlewareInputContext<better_call167.MiddlewareOptions>) => Promise<void>;
    }[];
  };
};
//#endregion
export { oAuthProxy as n, OAuthProxyOptions as t };