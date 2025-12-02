const require_rolldown_runtime = require('../_virtual/rolldown_runtime.cjs');
const require_consts = require('../helpers/consts.cjs');
const require_version = require('../version.cjs');
const require_strings = require('../helpers/strings.cjs');
const require_env = require('../helpers/env.cjs');
const require_devserver = require('../helpers/devserver.cjs');
const require_enum = require('../helpers/enum.cjs');
const require_errors = require('../helpers/errors.cjs');
const require_types = require('../types.cjs');
const require_InngestExecution = require('./execution/InngestExecution.cjs');
const require_functions = require('../helpers/functions.cjs');
const require_net = require('../helpers/net.cjs');
const require_promises = require('../helpers/promises.cjs');
const require_ServerTiming = require('../helpers/ServerTiming.cjs');
const require_stream = require('../helpers/stream.cjs');
let debug = require("debug");
debug = require_rolldown_runtime.__toESM(debug);
let zod_v3 = require("zod/v3");
zod_v3 = require_rolldown_runtime.__toESM(zod_v3);

//#region src/components/InngestCommHandler.ts
/**
* A schema for the response from Inngest when registering.
*/
const registerResSchema = zod_v3.z.object({
	status: zod_v3.z.number().default(200),
	skipped: zod_v3.z.boolean().optional().default(false),
	modified: zod_v3.z.boolean().optional().default(false),
	error: zod_v3.z.string().default("Successfully registered")
});
/**
* `InngestCommHandler` is a class for handling incoming requests from Inngest (or
* Inngest's tooling such as the dev server or CLI) and taking appropriate
* action for any served functions.
*
* All handlers (Next.js, RedwoodJS, Remix, Deno Fresh, etc.) are created using
* this class; the exposed `serve` function will - most commonly - create an
* instance of `InngestCommHandler` and then return `instance.createHandler()`.
*
* See individual parameter details for more information, or see the
* source code for an existing handler, e.g.
* {@link https://github.com/inngest/inngest-js/blob/main/src/next.ts}
*
* @example
* ```
* // my-custom-handler.ts
* import {
*   InngestCommHandler,
*   type ServeHandlerOptions,
* } from "./components/InngestCommHandler";
*
* export const serve = (options: ServeHandlerOptions) => {
*   const handler = new InngestCommHandler({
*     frameworkName: "my-custom-handler",
*     ...options,
*     handler: (req: Request) => {
*       return {
*         body: () => req.json(),
*         headers: (key) => req.headers.get(key),
*         method: () => req.method,
*         url: () => new URL(req.url, `https://${req.headers.get("host") || ""}`),
*         transformResponse: ({ body, status, headers }) => {
*           return new Response(body, { status, headers });
*         },
*       };
*     },
*   });
*
*   return handler.createHandler();
* };
* ```
*
* @public
*/
var InngestCommHandler = class {
	/**
	* The ID of this serve handler, e.g. `"my-app"`. It's recommended that this
	* value represents the overarching app/service that this set of functions is
	* being served from.
	*/
	id;
	/**
	* The handler specified during instantiation of the class.
	*/
	handler;
	/**
	* The URL of the Inngest function registration endpoint.
	*/
	inngestRegisterUrl;
	/**
	* The name of the framework this handler is designed for. Should be
	* lowercase, alphanumeric characters inclusive of `-` and `/`.
	*/
	frameworkName;
	/**
	* The signing key used to validate requests from Inngest. This is
	* intentionally mutable so that we can pick up the signing key from the
	* environment during execution if needed.
	*/
	signingKey;
	/**
	* The same as signingKey, except used as a fallback when auth fails using the
	* primary signing key.
	*/
	signingKeyFallback;
	/**
	* A property that can be set to indicate whether we believe we are in
	* production mode.
	*
	* Should be set every time a request is received.
	*/
	_mode;
	/**
	* The localized `fetch` implementation used by this handler.
	*/
	fetch;
	/**
	* The host used to access the Inngest serve endpoint, e.g.:
	*
	*     "https://myapp.com"
	*
	* By default, the library will try to infer this using request details such
	* as the "Host" header and request path, but sometimes this isn't possible
	* (e.g. when running in a more controlled environments such as AWS Lambda or
	* when dealing with proxies/redirects).
	*
	* Provide the custom hostname here to ensure that the path is reported
	* correctly when registering functions with Inngest.
	*
	* To also provide a custom path, use `servePath`.
	*/
	_serveHost;
	/**
	* The path to the Inngest serve endpoint. e.g.:
	*
	*     "/some/long/path/to/inngest/endpoint"
	*
	* By default, the library will try to infer this using request details such
	* as the "Host" header and request path, but sometimes this isn't possible
	* (e.g. when running in a more controlled environments such as AWS Lambda or
	* when dealing with proxies/redirects).
	*
	* Provide the custom path (excluding the hostname) here to ensure that the
	* path is reported correctly when registering functions with Inngest.
	*
	* To also provide a custom hostname, use `serveHost`.
	*/
	_servePath;
	/**
	* The minimum level to log from the Inngest serve handler.
	*/
	logLevel;
	streaming;
	/**
	* A private collection of just Inngest functions, as they have been passed
	* when instantiating the class.
	*/
	rawFns;
	client;
	/**
	* A private collection of functions that are being served. This map is used
	* to find and register functions when interacting with Inngest Cloud.
	*/
	fns = {};
	env = require_env.allProcessEnv();
	allowExpiredSignatures;
	_options;
	skipSignatureValidation;
	constructor(options) {
		this._options = options;
		/**
		* v2 -> v3 migration error.
		*
		* If a serve handler is passed a client as the first argument, it'll be
		* spread in to these options. We should be able to detect this by picking
		* up a unique property on the object.
		*/
		if (Object.hasOwn(options, "eventKey")) throw new Error(`${require_consts.logPrefix} You've passed an Inngest client as the first argument to your serve handler. This is no longer supported in v3; please pass the Inngest client as the \`client\` property of an options object instead. See https://www.inngest.com/docs/sdk/migration`);
		this.frameworkName = options.frameworkName;
		this.client = options.client;
		if (options.id) console.warn(`${require_consts.logPrefix} The \`id\` serve option is deprecated and will be removed in v4`);
		this.id = options.id || this.client.id;
		this.handler = options.handler;
		/**
		* Provide a hidden option to allow expired signatures to be accepted during
		* testing.
		*/
		this.allowExpiredSignatures = Boolean(arguments["0"]?.__testingAllowExpiredSignatures);
		this.rawFns = options.functions.filter(Boolean);
		if (this.rawFns.length !== options.functions.length) console.warn(`Some functions passed to serve() are undefined and misconfigured.  Please check your imports.`);
		this.fns = this.rawFns.reduce((acc, fn) => {
			const configs = fn["getConfig"]({
				baseUrl: new URL("https://example.com"),
				appPrefix: this.id
			});
			const fns = configs.reduce((acc$1, { id }, index) => {
				return {
					...acc$1,
					[id]: {
						fn,
						onFailure: Boolean(index)
					}
				};
			}, {});
			configs.forEach(({ id }) => {
				if (acc[id]) throw new Error(`Duplicate function ID "${id}"; please change a function's name or provide an explicit ID to avoid conflicts.`);
			});
			return {
				...acc,
				...fns
			};
		}, {});
		this.inngestRegisterUrl = new URL("/fn/register", this.apiBaseUrl);
		this.signingKey = options.signingKey;
		this.signingKeyFallback = options.signingKeyFallback;
		this._serveHost = options.serveHost || this.env[require_consts.envKeys.InngestServeHost];
		this._servePath = options.servePath || this.env[require_consts.envKeys.InngestServePath];
		this.skipSignatureValidation = options.skipSignatureValidation || false;
		const defaultLogLevel = "info";
		this.logLevel = zod_v3.z.enum(require_types.logLevels).default(defaultLogLevel).catch((ctx) => {
			this.log("warn", `Unknown log level passed: ${String(ctx.input)}; defaulting to ${defaultLogLevel}`);
			return defaultLogLevel;
		}).parse(options.logLevel || this.env[require_consts.envKeys.InngestLogLevel]);
		if (this.logLevel === "debug") {
			/**
			* `debug` is an old library; sometimes its runtime detection doesn't work
			* for newer pairings of framework/runtime.
			*
			* One silly symptom of this is that `Debug()` returns an anonymous
			* function with no extra properties instead of a `Debugger` instance if
			* the wrong code is consumed following a bad detection. This results in
			* the following `.enable()` call failing, so we just try carefully to
			* enable it here.
			*/
			if (debug.default.enable && typeof debug.default.enable === "function") debug.default.enable(`${require_consts.debugPrefix}:*`);
		}
		const defaultStreamingOption = false;
		this.streaming = zod_v3.z.union([zod_v3.z.enum(["allow", "force"]), zod_v3.z.literal(false)]).default(defaultStreamingOption).catch((ctx) => {
			this.log("warn", `Unknown streaming option passed: ${String(ctx.input)}; defaulting to ${String(defaultStreamingOption)}`);
			return defaultStreamingOption;
		}).parse(options.streaming || this.env[require_consts.envKeys.InngestStreaming]);
		this.fetch = options.fetch ? require_env.getFetch(options.fetch) : this.client["fetch"];
	}
	/**
	* Get the API base URL for the Inngest API.
	*
	* This is a getter to encourage checking the environment for the API base URL
	* each time it's accessed, as it may change during execution.
	*/
	get apiBaseUrl() {
		return this._options.baseUrl || this.env[require_consts.envKeys.InngestApiBaseUrl] || this.env[require_consts.envKeys.InngestBaseUrl] || this.client.apiBaseUrl || require_consts.defaultInngestApiBaseUrl;
	}
	/**
	* Get the event API base URL for the Inngest API.
	*
	* This is a getter to encourage checking the environment for the event API
	* base URL each time it's accessed, as it may change during execution.
	*/
	get eventApiBaseUrl() {
		return this._options.baseUrl || this.env[require_consts.envKeys.InngestEventApiBaseUrl] || this.env[require_consts.envKeys.InngestBaseUrl] || this.client.eventBaseUrl || require_consts.defaultInngestEventBaseUrl;
	}
	/**
	* The host used to access the Inngest serve endpoint, e.g.:
	*
	*     "https://myapp.com"
	*
	* By default, the library will try to infer this using request details such
	* as the "Host" header and request path, but sometimes this isn't possible
	* (e.g. when running in a more controlled environments such as AWS Lambda or
	* when dealing with proxies/redirects).
	*
	* Provide the custom hostname here to ensure that the path is reported
	* correctly when registering functions with Inngest.
	*
	* To also provide a custom path, use `servePath`.
	*/
	get serveHost() {
		return this._serveHost || this.env[require_consts.envKeys.InngestServeHost];
	}
	/**
	* The path to the Inngest serve endpoint. e.g.:
	*
	*     "/some/long/path/to/inngest/endpoint"
	*
	* By default, the library will try to infer this using request details such
	* as the "Host" header and request path, but sometimes this isn't possible
	* (e.g. when running in a more controlled environments such as AWS Lambda or
	* when dealing with proxies/redirects).
	*
	* Provide the custom path (excluding the hostname) here to ensure that the
	* path is reported correctly when registering functions with Inngest.
	*
	* To also provide a custom hostname, use `serveHost`.
	*
	* This is a getter to encourage checking the environment for the serve path
	* each time it's accessed, as it may change during execution.
	*/
	get servePath() {
		return this._servePath || this.env[require_consts.envKeys.InngestServePath];
	}
	get hashedEventKey() {
		if (!this.client["eventKey"] || this.client["eventKey"] === require_consts.dummyEventKey) return;
		return require_strings.hashEventKey(this.client["eventKey"]);
	}
	get hashedSigningKey() {
		if (!this.signingKey) return;
		return require_strings.hashSigningKey(this.signingKey);
	}
	get hashedSigningKeyFallback() {
		if (!this.signingKeyFallback) return;
		return require_strings.hashSigningKey(this.signingKeyFallback);
	}
	/**
	* Returns a `boolean` representing whether this handler will stream responses
	* or not. Takes into account the user's preference and the platform's
	* capabilities.
	*/
	async shouldStream(actions) {
		if (await actions.queryStringWithDefaults("testing for probe", require_consts.queryKeys.Probe) !== void 0) return false;
		if (!actions.transformStreamingResponse) return false;
		if (this.streaming === "force") return true;
		return this.streaming === "allow" && require_env.platformSupportsStreaming(this.frameworkName, this.env);
	}
	/**
	* `createHandler` should be used to return a type-equivalent version of the
	* `handler` specified during instantiation.
	*
	* @example
	* ```
	* // my-custom-handler.ts
	* import {
	*   InngestCommHandler,
	*   type ServeHandlerOptions,
	* } from "./components/InngestCommHandler";
	*
	* export const serve = (options: ServeHandlerOptions) => {
	*   const handler = new InngestCommHandler({
	*     frameworkName: "my-custom-handler",
	*     ...options,
	*     handler: (req: Request) => {
	*       return {
	*         body: () => req.json(),
	*         headers: (key) => req.headers.get(key),
	*         method: () => req.method,
	*         url: () => new URL(req.url, `https://${req.headers.get("host") || ""}`),
	*         transformResponse: ({ body, status, headers }) => {
	*           return new Response(body, { status, headers });
	*         },
	*       };
	*     },
	*   });
	*
	*   return handler.createHandler();
	* };
	* ```
	*/
	createHandler() {
		const handler = async (...args) => {
			const timer = new require_ServerTiming.ServerTiming();
			/**
			* Used for testing, allow setting action overrides externally when
			* calling the handler. Always search the final argument.
			*/
			const lastArg = args[args.length - 1];
			const actionOverrides = typeof lastArg === "object" && lastArg !== null && "actionOverrides" in lastArg && typeof lastArg["actionOverrides"] === "object" && lastArg["actionOverrides"] !== null ? lastArg["actionOverrides"] : {};
			/**
			* We purposefully `await` the handler, as it could be either sync or
			* async.
			*/
			const rawActions = {
				...await timer.wrap("handler", () => this.handler(...args)).catch(require_errors.rethrowError("Serve handler failed to run")),
				...actionOverrides
			};
			/**
			* Mapped promisified handlers from userland `serve()` function mixed in
			* with some helpers.
			*/
			const actions = {
				...Object.entries(rawActions).reduce((acc, [key, value]) => {
					if (typeof value !== "function") return acc;
					return {
						...acc,
						[key]: (reason, ...args$1) => {
							const errMessage = [`Failed calling \`${key}\` from serve handler`, reason].filter(Boolean).join(" when ");
							const fn = () => value(...args$1);
							return require_promises.runAsPromise(fn).catch(require_errors.rethrowError(errMessage)).catch((err) => {
								this.log("error", err);
								throw err;
							});
						}
					};
				}, {}),
				queryStringWithDefaults: async (reason, key) => {
					const url = await actions.url(reason);
					return await actions.queryString?.(reason, key, url) || url.searchParams.get(key) || void 0;
				},
				...actionOverrides
			};
			const [env, expectedServerKind] = await Promise.all([actions.env?.("starting to handle request"), actions.headers("checking expected server kind", require_consts.headerKeys.InngestServerKind)]);
			this.env = {
				...require_env.allProcessEnv(),
				...env
			};
			const getInngestHeaders = () => require_env.inngestHeaders({
				env: this.env,
				framework: this.frameworkName,
				client: this.client,
				expectedServerKind: expectedServerKind || void 0,
				extras: { "Server-Timing": timer.getHeader() }
			});
			const assumedMode = require_env.getMode({
				env: this.env,
				client: this.client
			});
			if (assumedMode.isExplicit) this._mode = assumedMode;
			else {
				const serveIsProd = await actions.isProduction?.("starting to handle request");
				if (typeof serveIsProd === "boolean") this._mode = new require_env.Mode({
					type: serveIsProd ? "cloud" : "dev",
					isExplicit: false
				});
				else this._mode = assumedMode;
			}
			this.upsertKeysFromEnv();
			const methodP = actions.method("starting to handle request");
			const headerPromises = [require_consts.headerKeys.TraceParent, require_consts.headerKeys.TraceState].map(async (header) => {
				const value = await actions.headers(`fetching ${header} for forwarding`, header);
				return {
					header,
					value
				};
			});
			const contentLength = await actions.headers("checking signature for request", require_consts.headerKeys.ContentLength).then((value) => {
				if (!value) return;
				return Number.parseInt(value, 10);
			});
			const [signature, method, body] = await Promise.all([
				actions.headers("checking signature for request", require_consts.headerKeys.Signature).then((headerSignature) => {
					return headerSignature ?? void 0;
				}),
				methodP,
				methodP.then((method$1) => {
					if (method$1 === "POST" || method$1 === "PUT") {
						if (!contentLength) return "";
						return actions.body(`checking body for request signing as method is ${method$1}`);
					}
					return "";
				})
			]);
			const signatureValidation = this.validateSignature(signature, body);
			const headersToForwardP = Promise.all(headerPromises).then((fetchedHeaders) => {
				return fetchedHeaders.reduce((acc, { header, value }) => {
					if (value) acc[header] = value;
					return acc;
				}, {});
			});
			const actionRes = timer.wrap("action", () => this.handleAction({
				actions,
				timer,
				getInngestHeaders,
				reqArgs: args,
				signatureValidation,
				body,
				method,
				headers: headersToForwardP
			}));
			/**
			* Prepares an action response by merging returned data to provide
			* trailing information such as `Server-Timing` headers.
			*
			* It should always prioritize the headers returned by the action, as they
			* may contain important information such as `Content-Type`.
			*/
			const prepareActionRes = async (res) => {
				const headers = {
					...getInngestHeaders(),
					...await headersToForwardP,
					...res.headers,
					...res.version === null ? {} : { [require_consts.headerKeys.RequestVersion]: (res.version ?? require_InngestExecution.PREFERRED_EXECUTION_VERSION).toString() }
				};
				let signature$1;
				try {
					signature$1 = await signatureValidation.then((result) => {
						if (!result.success || !result.keyUsed) return;
						return this.getResponseSignature(result.keyUsed, res.body);
					});
				} catch (err) {
					return {
						...res,
						headers,
						body: require_strings.stringify(require_errors.serializeError(err)),
						status: 500
					};
				}
				if (signature$1) headers[require_consts.headerKeys.Signature] = signature$1;
				return {
					...res,
					headers
				};
			};
			if (await this.shouldStream(actions)) {
				if (await actions.method("starting streaming response") === "POST") {
					const { stream, finalize } = await require_stream.createStream();
					/**
					* Errors are handled by `handleAction` here to ensure that an
					* appropriate response is always given.
					*/
					actionRes.then((res) => {
						return finalize(prepareActionRes(res));
					});
					return timer.wrap("res", () => {
						return actions.transformStreamingResponse?.("starting streaming response", {
							status: 201,
							headers: getInngestHeaders(),
							body: stream,
							version: null
						});
					});
				}
			}
			return timer.wrap("res", async () => {
				return actionRes.then(prepareActionRes).then((actionRes$1) => {
					return actions.transformResponse("sending back response", actionRes$1);
				});
			});
		};
		/**
		* Some platforms check (at runtime) the length of the function being used
		* to handle an endpoint. If this is a variadic function, it will fail that
		* check.
		*
		* Therefore, we expect the arguments accepted to be the same length as the
		* `handler` function passed internally.
		*
		* We also set a name to avoid a common useless name in tracing such as
		* `"anonymous"` or `"bound function"`.
		*
		* https://github.com/getsentry/sentry-javascript/issues/3284
		*/
		Object.defineProperties(handler, {
			name: { value: "InngestHandler" },
			length: { value: this.handler.length }
		});
		return handler;
	}
	get mode() {
		return this._mode;
	}
	set mode(m) {
		this._mode = m;
		if (m) this.client["mode"] = m;
	}
	/**
	* Given a set of functions to check if an action is available from the
	* instance's handler, enact any action that is found.
	*
	* This method can fetch varying payloads of data, but ultimately is the place
	* where _decisions_ are made regarding functionality.
	*
	* For example, if we find that we should be viewing the UI, this function
	* will decide whether the UI should be visible based on the payload it has
	* found (e.g. env vars, options, etc).
	*/
	async handleAction({ actions, timer, getInngestHeaders, reqArgs, signatureValidation, body, method, headers }) {
		const isMissingBody = body === void 0;
		try {
			let url = await actions.url("starting to handle request");
			if (method === "POST") {
				if (isMissingBody) {
					this.log("error", "Missing body when executing, possibly due to missing request body middleware");
					return {
						status: 500,
						headers: { "Content-Type": "application/json" },
						body: require_strings.stringify(require_errors.serializeError(/* @__PURE__ */ new Error("Missing request body when executing, possibly due to missing request body middleware"))),
						version: void 0
					};
				}
				const validationResult = await signatureValidation;
				if (!validationResult.success) return {
					status: 401,
					headers: { "Content-Type": "application/json" },
					body: require_strings.stringify(require_errors.serializeError(validationResult.err)),
					version: void 0
				};
				const rawProbe = await actions.queryStringWithDefaults("testing for probe", require_consts.queryKeys.Probe);
				if (rawProbe) {
					const probe$1 = require_enum.enumFromValue(require_consts.probe, rawProbe);
					if (!probe$1) return {
						status: 400,
						headers: { "Content-Type": "application/json" },
						body: require_strings.stringify(require_errors.serializeError(/* @__PURE__ */ new Error(`Unknown probe "${rawProbe}"`))),
						version: void 0
					};
					return { [require_consts.probe.Trust]: () => ({
						status: 200,
						headers: { "Content-Type": "application/json" },
						body: "",
						version: void 0
					}) }[probe$1]();
				}
				const fnId = await actions.queryStringWithDefaults("processing run request", require_consts.queryKeys.FnId);
				if (!fnId) throw new Error("No function ID found in request");
				const stepId = await actions.queryStringWithDefaults("processing run request", require_consts.queryKeys.StepId) || null;
				const { version: version$1, result } = this.runStep({
					functionId: fnId,
					data: body,
					stepId,
					timer,
					reqArgs,
					headers: await headers
				});
				const stepOutput = await result;
				/**
				* Functions can return `undefined`, but we'll always convert this to
				* `null`, as this is appropriately serializable by JSON.
				*/
				const opDataUndefinedToNull = (op) => {
					op.data = require_functions.undefinedToNull(op.data);
					return op;
				};
				const handler = {
					"function-rejected": (result$1) => {
						return {
							status: result$1.retriable ? 500 : 400,
							headers: {
								"Content-Type": "application/json",
								[require_consts.headerKeys.NoRetry]: result$1.retriable ? "false" : "true",
								...typeof result$1.retriable === "string" ? { [require_consts.headerKeys.RetryAfter]: result$1.retriable } : {}
							},
							body: require_strings.stringify(require_functions.undefinedToNull(result$1.error)),
							version: version$1
						};
					},
					"function-resolved": (result$1) => {
						return {
							status: 200,
							headers: { "Content-Type": "application/json" },
							body: require_strings.stringify(require_functions.undefinedToNull(result$1.data)),
							version: version$1
						};
					},
					"step-not-found": (result$1) => {
						return {
							status: 500,
							headers: {
								"Content-Type": "application/json",
								[require_consts.headerKeys.NoRetry]: "false"
							},
							body: require_strings.stringify({ error: `Could not find step "${result$1.step.displayName || result$1.step.id}" to run; timed out` }),
							version: version$1
						};
					},
					"step-ran": (result$1) => {
						const step = opDataUndefinedToNull(result$1.step);
						return {
							status: 206,
							headers: {
								"Content-Type": "application/json",
								...typeof result$1.retriable !== "undefined" ? {
									[require_consts.headerKeys.NoRetry]: result$1.retriable ? "false" : "true",
									...typeof result$1.retriable === "string" ? { [require_consts.headerKeys.RetryAfter]: result$1.retriable } : {}
								} : {}
							},
							body: require_strings.stringify([step]),
							version: version$1
						};
					},
					"steps-found": (result$1) => {
						const steps = result$1.steps.map(opDataUndefinedToNull);
						return {
							status: 206,
							headers: { "Content-Type": "application/json" },
							body: require_strings.stringify(steps),
							version: version$1
						};
					}
				}[stepOutput.type];
				try {
					return await handler(stepOutput);
				} catch (err) {
					this.log("error", "Error handling execution result", err);
					throw err;
				}
			}
			const env = getInngestHeaders()[require_consts.headerKeys.Environment] ?? null;
			if (method === "GET") return {
				status: 200,
				body: require_strings.stringify(await this.introspectionBody({
					actions,
					env,
					signatureValidation,
					url
				})),
				headers: { "Content-Type": "application/json" },
				version: void 0
			};
			if (method === "PUT") {
				const [deployId, inBandSyncRequested] = await Promise.all([actions.queryStringWithDefaults("processing deployment request", require_consts.queryKeys.DeployId).then((deployId$1) => {
					return deployId$1 === "undefined" ? void 0 : deployId$1;
				}), Promise.resolve(require_env.parseAsBoolean(this.env[require_consts.envKeys.InngestAllowInBandSync])).then((allowInBandSync) => {
					if (allowInBandSync !== void 0 && !allowInBandSync) return require_consts.syncKind.OutOfBand;
					return actions.headers("processing deployment request", require_consts.headerKeys.InngestSyncKind);
				}).then((kind) => {
					return kind === require_consts.syncKind.InBand;
				})]);
				if (inBandSyncRequested) {
					if (isMissingBody) {
						this.log("error", "Missing body when syncing, possibly due to missing request body middleware");
						return {
							status: 500,
							headers: { "Content-Type": "application/json" },
							body: require_strings.stringify(require_errors.serializeError(/* @__PURE__ */ new Error("Missing request body when syncing, possibly due to missing request body middleware"))),
							version: void 0
						};
					}
					if (!(await signatureValidation).success) return {
						status: 401,
						body: require_strings.stringify({ code: "sig_verification_failed" }),
						headers: { "Content-Type": "application/json" },
						version: void 0
					};
					const res = require_types.inBandSyncRequestBodySchema.safeParse(body);
					if (!res.success) return {
						status: 400,
						body: require_strings.stringify({
							code: "invalid_request",
							message: res.error.message
						}),
						headers: { "Content-Type": "application/json" },
						version: void 0
					};
					url = this.reqUrl(new URL(res.data.url));
					const respBody = await this.inBandRegisterBody({
						actions,
						deployId,
						env,
						signatureValidation,
						url
					});
					return {
						status: 200,
						body: require_strings.stringify(respBody),
						headers: {
							"Content-Type": "application/json",
							[require_consts.headerKeys.InngestSyncKind]: require_consts.syncKind.InBand
						},
						version: void 0
					};
				}
				const { status, message, modified } = await this.register(this.reqUrl(url), deployId, getInngestHeaders);
				return {
					status,
					body: require_strings.stringify({
						message,
						modified
					}),
					headers: {
						"Content-Type": "application/json",
						[require_consts.headerKeys.InngestSyncKind]: require_consts.syncKind.OutOfBand
					},
					version: void 0
				};
			}
		} catch (err) {
			return {
				status: 500,
				body: require_strings.stringify({
					type: "internal",
					...require_errors.serializeError(err)
				}),
				headers: { "Content-Type": "application/json" },
				version: void 0
			};
		}
		return {
			status: 405,
			body: JSON.stringify({
				message: "No action found; request was likely not POST, PUT, or GET",
				mode: this._mode
			}),
			headers: {},
			version: void 0
		};
	}
	runStep({ functionId, stepId, data, timer, reqArgs, headers }) {
		const fn = this.fns[functionId];
		if (!fn) throw new Error(`Could not find function with ID "${functionId}"`);
		const immediateFnData = require_functions.parseFnData(data);
		let { version: version$1 } = immediateFnData;
		if (version$1 === require_consts.ExecutionVersion.V1 && fn.fn["shouldOptimizeParallelism"]?.()) version$1 = require_consts.ExecutionVersion.V2;
		const result = require_promises.runAsPromise(async () => {
			const anyFnData = await require_functions.fetchAllFnData({
				data: immediateFnData,
				api: this.client["inngestApi"],
				version: version$1
			});
			if (!anyFnData.ok) throw new Error(anyFnData.error);
			const executionOptions = await ((s) => s)({
				[require_consts.ExecutionVersion.V0]: ({ event, events, steps, ctx, version: version$2 }) => {
					const stepState = Object.entries(steps ?? {}).reduce((acc, [id, data$1]) => {
						return {
							...acc,
							[id]: {
								id,
								data: data$1
							}
						};
					}, {});
					return {
						version: version$2,
						partialOptions: {
							client: this.client,
							runId: ctx?.run_id || "",
							data: {
								event,
								events,
								runId: ctx?.run_id || "",
								attempt: ctx?.attempt ?? 0
							},
							stepState,
							requestedRunStep: stepId === "step" ? void 0 : stepId || void 0,
							timer,
							isFailureHandler: fn.onFailure,
							stepCompletionOrder: ctx?.stack?.stack ?? [],
							reqArgs,
							headers
						}
					};
				},
				[require_consts.ExecutionVersion.V1]: ({ event, events, steps, ctx, version: version$2 }) => {
					const stepState = Object.entries(steps ?? {}).reduce((acc, [id, result$1]) => {
						return {
							...acc,
							[id]: result$1.type === "data" ? {
								id,
								data: result$1.data
							} : result$1.type === "input" ? {
								id,
								input: result$1.input
							} : {
								id,
								error: result$1.error
							}
						};
					}, {});
					return {
						version: version$2,
						partialOptions: {
							client: this.client,
							runId: ctx?.run_id || "",
							data: {
								event,
								events,
								runId: ctx?.run_id || "",
								attempt: ctx?.attempt ?? 0,
								maxAttempts: ctx?.max_attempts
							},
							stepState,
							requestedRunStep: stepId === "step" ? void 0 : stepId || void 0,
							timer,
							isFailureHandler: fn.onFailure,
							disableImmediateExecution: ctx?.disable_immediate_execution,
							stepCompletionOrder: ctx?.stack?.stack ?? [],
							reqArgs,
							headers
						}
					};
				},
				[require_consts.ExecutionVersion.V2]: ({ event, events, steps, ctx, version: version$2 }) => {
					const stepState = Object.entries(steps ?? {}).reduce((acc, [id, result$1]) => {
						return {
							...acc,
							[id]: result$1.type === "data" ? {
								id,
								data: result$1.data
							} : result$1.type === "input" ? {
								id,
								input: result$1.input
							} : {
								id,
								error: result$1.error
							}
						};
					}, {});
					return {
						version: version$2,
						partialOptions: {
							client: this.client,
							runId: ctx?.run_id || "",
							data: {
								event,
								events,
								runId: ctx?.run_id || "",
								attempt: ctx?.attempt ?? 0,
								maxAttempts: ctx?.max_attempts
							},
							stepState,
							requestedRunStep: stepId === "step" ? void 0 : stepId || void 0,
							timer,
							isFailureHandler: fn.onFailure,
							disableImmediateExecution: ctx?.disable_immediate_execution,
							stepCompletionOrder: ctx?.stack?.stack ?? [],
							reqArgs,
							headers
						}
					};
				}
			})[version$1](anyFnData.value);
			return fn.fn["createExecution"](executionOptions).start();
		});
		return {
			version: version$1,
			result
		};
	}
	configs(url) {
		const configs = Object.values(this.rawFns).reduce((acc, fn) => [...acc, ...fn["getConfig"]({
			baseUrl: url,
			appPrefix: this.id
		})], []);
		for (const config of configs) {
			const check = require_types.functionConfigSchema.safeParse(config);
			if (!check.success) {
				const errors = check.error.errors.map((err) => err.message).join("; ");
				this.log("warn", `Config invalid for function "${config.id}" : ${errors}`);
			}
		}
		return configs;
	}
	/**
	* Return an Inngest serve endpoint URL given a potential `path` and `host`.
	*
	* Will automatically use the `serveHost` and `servePath` if they have been
	* set when registering.
	*/
	reqUrl(url) {
		let ret = new URL(url);
		const serveHost = this.serveHost || this.env[require_consts.envKeys.InngestServeHost];
		const servePath = this.servePath || this.env[require_consts.envKeys.InngestServePath];
		if (servePath) ret.pathname = servePath;
		if (serveHost) ret = new URL(ret.pathname + ret.search, serveHost);
		return ret;
	}
	registerBody({ url, deployId }) {
		return {
			url: url.href,
			deployType: "ping",
			framework: this.frameworkName,
			appName: this.id,
			functions: this.configs(url),
			sdk: `js:v${require_version.version}`,
			v: "0.1",
			deployId: deployId || void 0,
			capabilities: {
				trust_probe: "v1",
				connect: "v1"
			},
			appVersion: this.client.appVersion
		};
	}
	async inBandRegisterBody({ actions, deployId, env, signatureValidation, url }) {
		const registerBody = this.registerBody({
			deployId,
			url
		});
		const introspectionBody = await this.introspectionBody({
			actions,
			env,
			signatureValidation,
			url
		});
		const body = {
			app_id: this.id,
			appVersion: this.client.appVersion,
			capabilities: registerBody.capabilities,
			env,
			framework: registerBody.framework,
			functions: registerBody.functions,
			inspection: introspectionBody,
			platform: require_env.getPlatformName({
				...require_env.allProcessEnv(),
				...this.env
			}),
			sdk_author: "inngest",
			sdk_language: "",
			sdk_version: "",
			sdk: registerBody.sdk,
			url: registerBody.url
		};
		if (introspectionBody.authentication_succeeded) {
			body.sdk_language = introspectionBody.sdk_language;
			body.sdk_version = introspectionBody.sdk_version;
		}
		return body;
	}
	async introspectionBody({ actions, env, signatureValidation, url }) {
		const registerBody = this.registerBody({
			url: this.reqUrl(url),
			deployId: null
		});
		if (!this._mode) throw new Error("No mode set; cannot introspect without mode");
		let introspection = {
			authentication_succeeded: null,
			extra: { is_mode_explicit: this._mode.isExplicit },
			has_event_key: this.client["eventKeySet"](),
			has_signing_key: Boolean(this.signingKey),
			function_count: registerBody.functions.length,
			mode: this._mode.type,
			schema_version: "2024-05-24"
		};
		if (this._mode.type === "cloud") try {
			if (!(await signatureValidation).success) throw new Error("Signature validation failed");
			introspection = {
				...introspection,
				authentication_succeeded: true,
				api_origin: this.apiBaseUrl,
				app_id: this.id,
				capabilities: {
					trust_probe: "v1",
					connect: "v1"
				},
				env,
				event_api_origin: this.eventApiBaseUrl,
				event_key_hash: this.hashedEventKey ?? null,
				extra: {
					...introspection.extra,
					is_streaming: await this.shouldStream(actions)
				},
				framework: this.frameworkName,
				sdk_language: "js",
				sdk_version: require_version.version,
				serve_origin: this.serveHost ?? null,
				serve_path: this.servePath ?? null,
				signing_key_fallback_hash: this.hashedSigningKeyFallback ?? null,
				signing_key_hash: this.hashedSigningKey ?? null
			};
		} catch {
			introspection = {
				...introspection,
				authentication_succeeded: false
			};
		}
		return introspection;
	}
	async register(url, deployId, getHeaders) {
		const body = this.registerBody({
			url,
			deployId
		});
		let res;
		let registerURL = new URL(this.inngestRegisterUrl.href);
		if (this._mode && this._mode.isInferred && this._mode.isDev) {
			const host = require_env.devServerHost(this.env);
			if (await require_devserver.devServerAvailable(host, this.fetch)) registerURL = require_devserver.devServerUrl(host, "/fn/register");
		} else if (this._mode?.explicitDevUrl) registerURL = require_devserver.devServerUrl(this._mode.explicitDevUrl.href, "/fn/register");
		if (deployId) registerURL.searchParams.set(require_consts.queryKeys.DeployId, deployId);
		try {
			res = await require_net.fetchWithAuthFallback({
				authToken: this.hashedSigningKey,
				authTokenFallback: this.hashedSigningKeyFallback,
				fetch: this.fetch,
				url: registerURL.href,
				options: {
					method: "POST",
					body: require_strings.stringify(body),
					headers: {
						...getHeaders(),
						[require_consts.headerKeys.InngestSyncKind]: require_consts.syncKind.OutOfBand
					},
					redirect: "follow"
				}
			});
		} catch (err) {
			this.log("error", err);
			return {
				status: 500,
				message: `Failed to register${err instanceof Error ? `; ${err.message}` : ""}`,
				modified: false
			};
		}
		const raw = await res.text();
		let data = {};
		try {
			data = JSON.parse(raw);
		} catch (err) {
			this.log("warn", "Couldn't unpack register response:", err);
			let message = "Failed to register";
			if (err instanceof Error) message += `; ${err.message}`;
			message += `; status code: ${res.status}`;
			return {
				status: 500,
				message,
				modified: false
			};
		}
		let status;
		let error;
		let skipped;
		let modified;
		try {
			({status, error, skipped, modified} = registerResSchema.parse(data));
		} catch (err) {
			this.log("warn", "Invalid register response schema:", err);
			let message = "Failed to register";
			if (err instanceof Error) message += `; ${err.message}`;
			message += `; status code: ${res.status}`;
			return {
				status: 500,
				message,
				modified: false
			};
		}
		if (!skipped) this.log("debug", "registered inngest functions:", res.status, res.statusText, data);
		return {
			status,
			message: error,
			modified
		};
	}
	/**
	* Given an environment, upsert any missing keys. This is useful in
	* situations where environment variables are passed directly to handlers or
	* are otherwise difficult to access during initialization.
	*/
	upsertKeysFromEnv() {
		if (this.env[require_consts.envKeys.InngestSigningKey]) {
			if (!this.signingKey) this.signingKey = String(this.env[require_consts.envKeys.InngestSigningKey]);
			this.client["inngestApi"].setSigningKey(this.signingKey);
		}
		if (this.env[require_consts.envKeys.InngestSigningKeyFallback]) {
			if (!this.signingKeyFallback) this.signingKeyFallback = String(this.env[require_consts.envKeys.InngestSigningKeyFallback]);
			this.client["inngestApi"].setSigningKeyFallback(this.signingKeyFallback);
		}
		if (!this.client["eventKeySet"]() && this.env[require_consts.envKeys.InngestEventKey]) this.client.setEventKey(String(this.env[require_consts.envKeys.InngestEventKey]));
		if (this.env[require_consts.envKeys.InngestDevServerUrl]) this.log("warn", `Use of ${require_consts.envKeys.InngestDevServerUrl} has been deprecated in v3; please use ${require_consts.envKeys.InngestBaseUrl} instead. See https://www.inngest.com/docs/sdk/migration`);
	}
	/**
	* Validate the signature of a request and return the signing key used to
	* validate it.
	*/
	async validateSignature(sig, body) {
		try {
			if (this.skipSignatureValidation) return {
				success: true,
				keyUsed: ""
			};
			if (this._mode && !this._mode.isCloud) return {
				success: true,
				keyUsed: ""
			};
			if (!this.signingKey) throw new Error(`No signing key found in client options or ${require_consts.envKeys.InngestSigningKey} env var. Find your keys at https://app.inngest.com/secrets`);
			if (!sig) throw new Error(`No ${require_consts.headerKeys.Signature} provided`);
			return {
				success: true,
				keyUsed: new RequestSignature(sig).verifySignature({
					body,
					allowExpiredSignatures: this.allowExpiredSignatures,
					signingKey: this.signingKey,
					signingKeyFallback: this.signingKeyFallback
				})
			};
		} catch (err) {
			return {
				success: false,
				err
			};
		}
	}
	getResponseSignature(key, body) {
		const now = Date.now();
		const mac = require_net.signDataWithKey(body, key, now.toString());
		return `t=${now}&s=${mac}`;
	}
	/**
	* Log to stdout/stderr if the log level is set to include the given level.
	* The default log level is `"info"`.
	*
	* This is an abstraction over `console.log` and will try to use the correct
	* method for the given log level.  For example, `log("error", "foo")` will
	* call `console.error("foo")`.
	*/
	log(level, ...args) {
		const logLevels$1 = [
			"debug",
			"info",
			"warn",
			"error",
			"fatal",
			"silent"
		];
		const logLevelSetting = logLevels$1.indexOf(this.logLevel);
		if (logLevels$1.indexOf(level) >= logLevelSetting) {
			let logger = console.log;
			if (Object.hasOwn(console, level)) logger = console[level];
			logger(`${require_consts.logPrefix} ${level} -`, ...args);
		}
	}
};
var RequestSignature = class {
	timestamp;
	signature;
	constructor(sig) {
		const params = new URLSearchParams(sig);
		this.timestamp = params.get("t") || "";
		this.signature = params.get("s") || "";
		if (!this.timestamp || !this.signature) throw new Error(`Invalid ${require_consts.headerKeys.Signature} provided`);
	}
	hasExpired(allowExpiredSignatures) {
		if (allowExpiredSignatures) return false;
		return Date.now() - (/* @__PURE__ */ new Date(Number.parseInt(this.timestamp) * 1e3)).valueOf() > 1e3 * 60 * 5;
	}
	#verifySignature({ body, signingKey, allowExpiredSignatures }) {
		if (this.hasExpired(allowExpiredSignatures)) throw new Error("Signature has expired");
		if (require_net.signDataWithKey(body, signingKey, this.timestamp) !== this.signature) throw new Error("Invalid signature");
	}
	verifySignature({ body, signingKey, signingKeyFallback, allowExpiredSignatures }) {
		try {
			this.#verifySignature({
				body,
				signingKey,
				allowExpiredSignatures
			});
			return signingKey;
		} catch (err) {
			if (!signingKeyFallback) throw err;
			this.#verifySignature({
				body,
				signingKey: signingKeyFallback,
				allowExpiredSignatures
			});
			return signingKeyFallback;
		}
	}
};

//#endregion
exports.InngestCommHandler = InngestCommHandler;
//# sourceMappingURL=InngestCommHandler.cjs.map