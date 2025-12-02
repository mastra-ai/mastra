import { getResponse } from "./helpers/env.js";
import { InngestCommHandler } from "./components/InngestCommHandler.js";

//#region src/next.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "nextjs";
const isRecord = (val) => {
	return typeof val === "object" && val !== null;
};
const isFunction = (val) => {
	return typeof val === "function";
};
const isNext12ApiResponse = (val) => {
	return isRecord(val) && isFunction(val.setHeader) && isFunction(val.status) && isFunction(val.send);
};
/**
* In Next.js, serve and register any declared functions with Inngest, making
* them available to be triggered by events.
*
* Supports Next.js 12+, both serverless and edge.
*
* @example Next.js <=12 or the pages router can export the handler directly
* ```ts
* export default serve({ client: inngest, functions: [fn1, fn2] });
* ```
*
* @example Next.js >=13 with the `app` dir must export individual methods
* ```ts
* export const { GET, POST, PUT } = serve({
*            client: inngest,
*            functions: [fn1, fn2],
* });
* ```
*
* @public
*/
const serve = (options) => {
	/**
	* Next.js 13 uses
	* {@link https://beta.nextjs.org/docs/routing/route-handlers Route Handlers}
	* to declare API routes instead of a generic catch-all method that was
	* available using the `pages/api` directory.
	*
	* This means that users must now export a function for each method supported
	* by the endpoint. For us, this means requiring a user explicitly exports
	* `GET`, `POST`, and `PUT` functions.
	*
	* Because of this, we'll add circular references to those property names of
	* the returned handler, meaning we can write some succinct code to export
	* them. Thanks, @goodoldneon.
	*
	* @example
	* ```ts
	* export const { GET, POST, PUT } = serve(...);
	* ```
	*
	* See {@link https://beta.nextjs.org/docs/routing/route-handlers}
	*/
	const baseFn = new InngestCommHandler({
		frameworkName,
		...options,
		handler: (reqMethod, ...args) => {
			const [expectedReq, res] = args;
			const req = expectedReq;
			const getHeader = (key) => {
				const header = typeof req.headers.get === "function" ? req.headers.get(key) : req.headers[key];
				return Array.isArray(header) ? header[0] : header;
			};
			return {
				body: () => typeof req.json === "function" ? req.json() : req.body,
				headers: getHeader,
				method: () => {
					return reqMethod || req.method || "";
				},
				isProduction: () => {
					/**
					* Vercel Edge Functions do not allow dynamic access to environment
					* variables, so we'll manage production checks directly here.
					*
					* We try/catch to avoid situations where Next.js is being used in
					* environments where `process.env` is not accessible or polyfilled.
					*/
					try {
						return process.env.NODE_ENV === "production";
					} catch (_err) {}
				},
				queryString: (key, url) => {
					const qs = req.query?.[key] || url.searchParams.get(key);
					return Array.isArray(qs) ? qs[0] : qs;
				},
				url: () => {
					let absoluteUrl;
					try {
						absoluteUrl = new URL(req.url);
					} catch {}
					if (absoluteUrl) {
						/**
						* `req.url` here should may be the full URL, including query string.
						* There are some caveats, however, where Next.js will obfuscate
						* the host. For example, in the case of `host.docker.internal`,
						* Next.js will instead set the host here to `localhost`.
						*
						* To avoid this, we'll try to parse the URL from `req.url`, but
						* also use the `host` header if it's available.
						*/
						const host$1 = options.serveHost || getHeader("host");
						if (host$1) {
							const hostWithProtocol = new URL(host$1.includes("://") ? host$1 : `${absoluteUrl.protocol}//${host$1}`);
							absoluteUrl.protocol = hostWithProtocol.protocol;
							absoluteUrl.host = hostWithProtocol.host;
							absoluteUrl.port = hostWithProtocol.port;
							absoluteUrl.username = hostWithProtocol.username;
							absoluteUrl.password = hostWithProtocol.password;
						}
						return absoluteUrl;
					}
					let scheme = "https";
					const host = options.serveHost || getHeader("host") || "";
					try {
						if (process.env.NODE_ENV === "development") scheme = "http";
					} catch (_err) {}
					return new URL(req.url, `${scheme}://${host}`);
				},
				transformResponse: ({ body, headers, status }) => {
					/**
					* Carefully attempt to set headers and data on the response object
					* for Next.js 12 support.
					*
					* This also assumes that we're not using Next.js 15, where the `res`
					* object is repopulated as a `RouteContext` object. We expect these
					* methods to NOT be defined in Next.js 15.
					*
					* We could likely use `instanceof ServerResponse` to better check the
					* type of this, though Next.js 12 had issues with this due to not
					* instantiating the response correctly.
					*/
					if (isNext12ApiResponse(res)) {
						for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
						res.status(status);
						res.send(body);
						/**
						* If we're here, we're in a serverless endpoint (not edge), so
						* we've correctly sent the response and can return `undefined`.
						*
						* Next.js 13 edge requires that the return value is typed as
						* `Response`, so we still enforce that as we cannot dynamically
						* adjust typing based on the environment.
						*/
						return;
					}
					return new (getResponse())(body, {
						status,
						headers
					});
				},
				transformStreamingResponse: ({ body, headers, status }) => {
					return new Response(body, {
						status,
						headers
					});
				}
			};
		}
	}).createHandler();
	const fn = baseFn.bind(null, void 0);
	/**
	* Ensure we have a non-variadic length to avoid issues with forced type
	* checking.
	*/
	Object.defineProperty(fn, "length", { value: 1 });
	return Object.defineProperties(fn, {
		GET: { value: baseFn.bind(null, "GET") },
		POST: { value: baseFn.bind(null, "POST") },
		PUT: { value: baseFn.bind(null, "PUT") }
	});
};

//#endregion
export { frameworkName, serve };
//# sourceMappingURL=next.js.map