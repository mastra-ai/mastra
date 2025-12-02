import { r as BetterAuthOptions } from "../index--CrC0_x3.mjs";
import "../types-CRiHq5rJ.mjs";
import "../helper-DU33OcfW.mjs";
import "../index-CNCxG_Zo.mjs";
import "../plugins-Brc8BsoZ.mjs";
import * as better_call125 from "better-call";
import { RequestEvent } from "@sveltejs/kit";

//#region src/integrations/svelte-kit.d.ts
declare const toSvelteKitHandler: (auth: {
  handler: (request: Request) => Response | Promise<Response>;
  options: BetterAuthOptions;
}) => (event: {
  request: Request;
}) => Response | Promise<Response>;
declare const svelteKitHandler: ({
  auth,
  event,
  resolve,
  building
}: {
  auth: {
    handler: (request: Request) => Response | Promise<Response>;
    options: BetterAuthOptions;
  };
  event: RequestEvent;
  resolve: (event: RequestEvent) => Response | Promise<Response>;
  building: boolean;
}) => Promise<Response>;
declare function isAuthPath(url: string, options: BetterAuthOptions): boolean;
declare const sveltekitCookies: (getRequestEvent: () => RequestEvent<any, any>) => {
  id: "sveltekit-cookies";
  hooks: {
    after: {
      matcher(): true;
      handler: (inputContext: better_call125.MiddlewareInputContext<better_call125.MiddlewareOptions>) => Promise<void>;
    }[];
  };
};
//#endregion
export { isAuthPath, svelteKitHandler, sveltekitCookies, toSvelteKitHandler };