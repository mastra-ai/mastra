const require_rolldown_runtime = require('./_virtual/rolldown_runtime.cjs');
const require_InngestCommHandler = require('./components/InngestCommHandler.cjs');
let node_http = require("node:http");
node_http = require_rolldown_runtime.__toESM(node_http);
let node_url = require("node:url");
node_url = require_rolldown_runtime.__toESM(node_url);

//#region src/node.ts
/**
* The name of the framework, used to identify the framework in Inngest
* dashboards and during testing.
*/
const frameworkName = "nodejs";
/**
* Parse the incoming message request as a JSON body
*/
async function parseRequestBody(req) {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk;
		});
		req.on("end", () => {
			try {
				const json = JSON.parse(body);
				resolve(json);
			} catch (err) {
				reject(err);
			}
		});
	});
}
function getURL(req, hostnameOption) {
	const protocol = req.headers["x-forwarded-proto"] || (req.socket?.encrypted ? "https" : "http");
	const origin = hostnameOption || `${protocol}://${req.headers.host}`;
	return new node_url.URL(req.url || "", origin);
}
/**
* Serve and register any declared functions with Inngest, making them available
* to be triggered by events.
*
* @example Serve Inngest functions on all paths
* ```ts
* import { serve } from "inngest/node";
* import { inngest } from "./src/inngest/client";
* import myFn from "./src/inngest/myFn"; // Your own function
*
* const server = http.createServer(serve({
*   client: inngest, functions: [myFn]
* }));
* server.listen(3000);
* ```
*
* @example Serve Inngest on a specific path
* ```ts
* import { serve } from "inngest/node";
* import { inngest } from "./src/inngest/client";
* import myFn from "./src/inngest/myFn"; // Your own function
*
* const server = http.createServer((req, res) => {
*   if (req.url.start === '/api/inngest') {
*     return serve({
*       client: inngest, functions: [myFn]
*     })(req, res);
*   }
*   // ...
* });
* server.listen(3000);
* ```
*
* @public
*/
const serve = (options) => {
	return new require_InngestCommHandler.InngestCommHandler({
		frameworkName,
		...options,
		handler: (req, res) => {
			return {
				body: async () => parseRequestBody(req),
				headers: (key) => {
					return req.headers[key] && Array.isArray(req.headers[key]) ? req.headers[key][0] : req.headers[key];
				},
				method: () => {
					if (!req.method) throw new Error("Request method not defined. Potential use outside of context of Server.");
					return req.method;
				},
				url: () => getURL(req, options.serveHost),
				transformResponse: ({ body, status, headers }) => {
					res.writeHead(status, headers);
					res.end(body);
				},
				transformStreamingResponse: async ({ body, headers, status }) => {
					res.writeHead(status, headers);
					const reader = body.getReader();
					try {
						let done = false;
						while (!done) {
							const result = await reader.read();
							done = result.done;
							if (!done) res.write(result.value);
						}
						res.end();
					} catch (error) {
						if (error instanceof Error) res.destroy(error);
						else res.destroy(new Error(String(error)));
					}
				}
			};
		}
	}).createHandler();
};
/**
* EXPERIMENTAL - Create an http server to serve Inngest functions.
*
* @example
* ```ts
* import { createServer } from "inngest/node";
* import { inngest } from "./src/inngest/client";
* import myFn from "./src/inngest/myFn"; // Your own function
*
* const server = createServer({
*   client: inngest, functions: [myFn]
* });
* server.listen(3000);
* ```
*
* @public
*/
const createServer = (options) => {
	const server = node_http.default.createServer((req, res) => {
		const url = getURL(req, options.serveHost);
		const pathname = options.servePath || "/api/inngest";
		if (url.pathname === pathname) return serve(options)(req, res);
		res.writeHead(404);
		res.end();
	});
	server.on("clientError", (_err, socket) => {
		socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
	});
	return server;
};

//#endregion
exports.createServer = createServer;
exports.frameworkName = frameworkName;
exports.serve = serve;
//# sourceMappingURL=node.cjs.map