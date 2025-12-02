import { serve as serve$1 } from "./edge.js";

//#region src/bun.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "bun";
/**
* Using `Bun.serve()`, serve and register any declared functions with Inngest,
* making them available to be triggered by events.
*
* @example
* ```ts
* import { serve } from "inngest/bun";
* import { functions, inngest } from "./inngest";
*
* Bun.serve({
*   port: 3000,
*   fetch(request: Request) {
*     const url = new URL(request.url);
*
*     if (url.pathname === "/api/inngest") {
*       return serve({ client: inngest, functions })(request);
*     }
*
*     return new Response("Not found", { status: 404 });
*   },
* });
* ```
*
* @public
*/
const serve = (options) => {
	const optsOverrides = {
		...options,
		frameworkName
	};
	return serve$1(optsOverrides);
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=bun.js.map