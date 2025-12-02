import { defaultDevServerHost, defaultInngestApiBaseUrl, defaultInngestEventBaseUrl, dummyEventKey, envKeys, headerKeys, logPrefix } from "../helpers/consts.js";
import { stringify } from "../helpers/strings.js";
import { allProcessEnv, getFetch, getMode, inngestHeaders, processEnv } from "../helpers/env.js";
import { devServerAvailable, devServerUrl } from "../helpers/devserver.js";
import { fixEventKeyMissingSteps, prettyError } from "../helpers/errors.js";
import { sendEventResponseSchema } from "../types.js";
import { retryWithBackoff } from "../helpers/promises.js";
import { InngestMiddleware, getHookStack } from "./InngestMiddleware.js";
import { InngestFunction } from "./InngestFunction.js";
import { InngestApi } from "../api/api.js";
import { createEntropy } from "../helpers/crypto.js";
import { DefaultLogger, ProxyLogger } from "../middleware/logger.js";

//#region src/components/Inngest.ts
/**
* A client used to interact with the Inngest API by sending or reacting to
* events.
*
* To provide event typing, see {@link EventSchemas}.
*
* ```ts
* const inngest = new Inngest({ id: "my-app" });
*
* // or to provide event typing too
* const inngest = new Inngest({
*   id: "my-app",
*   schemas: new EventSchemas().fromRecord<{
*     "app/user.created": {
*       data: { userId: string };
*     };
*   }>(),
* });
* ```
*
* @public
*/
var Inngest = class Inngest {
	get [Symbol.toStringTag]() {
		return Inngest.Tag;
	}
	/**
	* The ID of this instance, most commonly a reference to the application it
	* resides in.
	*
	* The ID of your client should remain the same for its lifetime; if you'd
	* like to change the name of your client as it appears in the Inngest UI,
	* change the `name` property instead.
	*/
	id;
	/**
	* Stores the options so we can remember explicit settings the user has
	* provided.
	*/
	options;
	/**
	* Inngest event key, used to send events to Inngest Cloud.
	*/
	eventKey = "";
	_apiBaseUrl;
	_eventBaseUrl;
	inngestApi;
	/**
	* The absolute URL of the Inngest Cloud API.
	*/
	sendEventUrl = new URL(`e/${this.eventKey}`, defaultInngestEventBaseUrl);
	headers;
	fetch;
	logger;
	localFns = [];
	/**
	* A promise that resolves when the middleware stack has been initialized and
	* the client is ready to be used.
	*/
	middleware;
	/**
	* Whether the client is running in a production environment. This can
	* sometimes be `undefined` if the client has expressed no preference or
	* perhaps environment variables are only available at a later stage in the
	* runtime, for example when receiving a request.
	*
	* An {@link InngestCommHandler} should prioritize this value over all other
	* settings, but should still check for the presence of an environment
	* variable if it is not set.
	*/
	_mode;
	schemas;
	_appVersion;
	get apiBaseUrl() {
		return this._apiBaseUrl;
	}
	get eventBaseUrl() {
		return this._eventBaseUrl;
	}
	get env() {
		return this.headers[headerKeys.Environment] ?? null;
	}
	get appVersion() {
		return this._appVersion;
	}
	/**
	* A client used to interact with the Inngest API by sending or reacting to
	* events.
	*
	* To provide event typing, see {@link EventSchemas}.
	*
	* ```ts
	* const inngest = new Inngest({ name: "My App" });
	*
	* // or to provide event typing too
	* const inngest = new Inngest({
	*   name: "My App",
	*   schemas: new EventSchemas().fromRecord<{
	*     "app/user.created": {
	*       data: { userId: string };
	*     };
	*   }>(),
	* });
	* ```
	*/
	constructor(options) {
		this.options = options;
		const { id, fetch, logger = new DefaultLogger(), middleware, isDev, schemas, appVersion } = this.options;
		if (!id) throw new Error("An `id` must be passed to create an Inngest instance.");
		this.id = id;
		this._mode = getMode({ explicitMode: typeof isDev === "boolean" ? isDev ? "dev" : "cloud" : void 0 });
		this.fetch = getFetch(fetch);
		this.inngestApi = new InngestApi({
			baseUrl: this.apiBaseUrl,
			signingKey: processEnv(envKeys.InngestSigningKey) || "",
			signingKeyFallback: processEnv(envKeys.InngestSigningKeyFallback),
			fetch: this.fetch,
			mode: this.mode
		});
		this.schemas = schemas;
		this.loadModeEnvVars();
		this.logger = logger;
		this.middleware = this.initializeMiddleware([...builtInMiddleware, ...middleware || []]);
		this._appVersion = appVersion;
	}
	/**
	* Returns a `Promise` that resolves when the app is ready and all middleware
	* has been initialized.
	*/
	get ready() {
		return this.middleware.then(() => {});
	}
	/**
	* Set the environment variables for this client. This is useful if you are
	* passed environment variables at runtime instead of as globals and need to
	* update the client with those values as requests come in.
	*/
	setEnvVars(env = allProcessEnv()) {
		this.mode = getMode({
			env,
			client: this
		});
		return this;
	}
	loadModeEnvVars() {
		this._apiBaseUrl = this.options.baseUrl || this.mode["env"][envKeys.InngestApiBaseUrl] || this.mode["env"][envKeys.InngestBaseUrl] || this.mode.getExplicitUrl(defaultInngestApiBaseUrl);
		this._eventBaseUrl = this.options.baseUrl || this.mode["env"][envKeys.InngestEventApiBaseUrl] || this.mode["env"][envKeys.InngestBaseUrl] || this.mode.getExplicitUrl(defaultInngestEventBaseUrl);
		this.setEventKey(this.options.eventKey || this.mode["env"][envKeys.InngestEventKey] || "");
		this.headers = inngestHeaders({
			inngestEnv: this.options.env,
			env: this.mode["env"]
		});
		this.inngestApi["mode"] = this.mode;
		this.inngestApi["apiBaseUrl"] = this._apiBaseUrl;
	}
	/**
	* Initialize all passed middleware, running the `register` function on each
	* in sequence and returning the requested hook registrations.
	*/
	async initializeMiddleware(middleware = [], opts) {
		/**
		* Wait for the prefix stack to run first; do not trigger ours before this
		* is complete.
		*/
		const prefix = await (opts?.prefixStack ?? []);
		const stack = middleware.reduce(async (acc, m) => {
			const prev = await acc;
			const next = await m.init({
				client: this,
				...opts?.registerInput
			});
			return [...prev, next];
		}, Promise.resolve([]));
		return [...prefix, ...await stack];
	}
	get mode() {
		return this._mode;
	}
	set mode(m) {
		this._mode = m;
		this.loadModeEnvVars();
	}
	/**
	* Given a response from Inngest, relay the error to the caller.
	*/
	async getResponseError(response, rawBody, foundErr = "Unknown error") {
		let errorMessage = foundErr;
		if (errorMessage === "Unknown error") switch (response.status) {
			case 401:
				errorMessage = "Event key Not Found";
				break;
			case 400:
				errorMessage = "Cannot process event payload";
				break;
			case 403:
				errorMessage = "Forbidden";
				break;
			case 404:
				errorMessage = "Event key not found";
				break;
			case 406:
				errorMessage = `${JSON.stringify(await rawBody)}`;
				break;
			case 409:
			case 412:
				errorMessage = "Event transformation failed";
				break;
			case 413:
				errorMessage = "Event payload too large";
				break;
			case 500:
				errorMessage = "Internal server error";
				break;
			default:
				try {
					errorMessage = await response.text();
				} catch (_err) {
					errorMessage = `${JSON.stringify(await rawBody)}`;
				}
				break;
		}
		return /* @__PURE__ */ new Error(`Inngest API Error: ${response.status} ${errorMessage}`);
	}
	/**
	* Set the event key for this instance of Inngest. This is useful if for some
	* reason the key is not available at time of instantiation or present in the
	* `INNGEST_EVENT_KEY` environment variable.
	*/
	setEventKey(eventKey) {
		this.eventKey = eventKey || dummyEventKey;
		this.sendEventUrl = new URL(`e/${this.eventKey}`, this.eventBaseUrl || defaultInngestEventBaseUrl);
	}
	eventKeySet() {
		return Boolean(this.eventKey) && this.eventKey !== dummyEventKey;
	}
	/**
	* EXPERIMENTAL: This API is not yet stable and may change in the future
	* without a major version bump.
	*
	* Send a Signal to Inngest.
	*/
	async sendSignal({ signal, data, env }) {
		const headers = { ...env ? { [headerKeys.Environment]: env } : {} };
		return this._sendSignal({
			signal,
			data,
			headers
		});
	}
	async _sendSignal({ signal, data, headers }) {
		const res = await this.inngestApi.sendSignal({
			signal,
			data
		}, {
			...this.headers,
			...headers
		});
		if (res.ok) return res.value;
		throw new Error(`Failed to send signal: ${res.error?.error || "Unknown error"}`);
	}
	/**
	* Send one or many events to Inngest. Takes an entire payload (including
	* name) as each input.
	*
	* ```ts
	* await inngest.send({ name: "app/user.created", data: { id: 123 } });
	* ```
	*
	* Returns a promise that will resolve if the event(s) were sent successfully,
	* else throws with an error explaining what went wrong.
	*
	* If you wish to send an event with custom types (i.e. one that hasn't been
	* generated), make sure to add it when creating your Inngest instance, like
	* so:
	*
	* ```ts
	* const inngest = new Inngest({
	*   name: "My App",
	*   schemas: new EventSchemas().fromRecord<{
	*     "my/event": {
	*       name: "my/event";
	*       data: { bar: string };
	*     };
	*   }>(),
	* });
	* ```
	*/
	async send(payload, options) {
		const headers = { ...options?.env ? { [headerKeys.Environment]: options.env } : {} };
		return this._send({
			payload,
			headers
		});
	}
	/**
	* Internal method for sending an event, used to allow Inngest internals to
	* further customize the request sent to an Inngest Server.
	*/
	async _send({ payload, headers }) {
		const nowMillis = (/* @__PURE__ */ new Date()).getTime();
		let maxAttempts = 5;
		try {
			const entropy = createEntropy(10);
			const entropyBase64 = Buffer.from(entropy).toString("base64");
			headers = {
				...headers,
				[headerKeys.EventIdSeed]: `${nowMillis},${entropyBase64}`
			};
		} catch (err) {
			let message = "Event-sending retries disabled";
			if (err instanceof Error) message += `: ${err.message}`;
			console.debug(message);
			maxAttempts = 1;
		}
		const hooks = await getHookStack(this.middleware, "onSendEvent", void 0, {
			transformInput: (prev, output) => {
				return {
					...prev,
					...output
				};
			},
			transformOutput(prev, output) {
				return { result: {
					...prev.result,
					...output?.result
				} };
			}
		});
		let payloads = Array.isArray(payload) ? payload : payload ? [payload] : [];
		const inputChanges = await hooks.transformInput?.({ payloads: [...payloads] });
		if (inputChanges?.payloads) payloads = [...inputChanges.payloads];
		payloads = payloads.map((p) => {
			return {
				...p,
				id: p.id,
				ts: p.ts || nowMillis,
				data: p.data || {}
			};
		});
		const applyHookToOutput = async (arg) => {
			const hookOutput = await hooks.transformOutput?.(arg);
			return {
				...arg.result,
				...hookOutput?.result
			};
		};
		/**
		* It can be valid for a user to send an empty list of events; if this
		* happens, show a warning that this may not be intended, but don't throw.
		*/
		if (!payloads.length) {
			console.warn(prettyError({
				type: "warn",
				whatHappened: "`inngest.send()` called with no events",
				reassurance: "This is not an error, but you may not have intended to do this.",
				consequences: "The returned promise will resolve, but no events have been sent to Inngest.",
				stack: true
			}));
			return await applyHookToOutput({ result: { ids: [] } });
		}
		let url = this.sendEventUrl.href;
		/**
		* If in prod mode and key is not present, fail now.
		*/
		if (this.mode.isCloud && !this.eventKeySet()) throw new Error(prettyError({
			whatHappened: "Failed to send event",
			consequences: "Your event or events were not sent to Inngest.",
			why: "We couldn't find an event key to use to send events to Inngest.",
			toFixNow: fixEventKeyMissingSteps
		}));
		/**
		* If dev mode has been inferred, try to hit the dev server first to see if
		* it exists. If it does, use it, otherwise fall back to whatever server we
		* have configured.
		*
		* `INNGEST_BASE_URL` is used to set both dev server and prod URLs, so if a
		* user has set this it means they have already chosen a URL to hit.
		*/
		if (this.mode.isDev && this.mode.isInferred && !this.eventBaseUrl) {
			if (await devServerAvailable(defaultDevServerHost, this.fetch)) url = devServerUrl(defaultDevServerHost, `e/${this.eventKey}`).href;
		}
		const body = await retryWithBackoff(async () => {
			let rawBody;
			let body$1;
			const response = await this.fetch(url, {
				method: "POST",
				body: stringify(payloads),
				headers: {
					...this.headers,
					...headers
				}
			});
			try {
				rawBody = await response.json();
				body$1 = await sendEventResponseSchema.parseAsync(rawBody);
			} catch (_err) {
				throw await this.getResponseError(response, rawBody);
			}
			if (body$1.status !== 200 || body$1.error) throw await this.getResponseError(response, rawBody, body$1.error);
			return body$1;
		}, {
			maxAttempts,
			baseDelay: 100
		});
		return await applyHookToOutput({ result: { ids: body.ids } });
	}
	createFunction = (rawOptions, rawTrigger, handler) => {
		const fn = this._createFunction(rawOptions, rawTrigger, handler);
		this.localFns.push(fn);
		return fn;
	};
	get funcs() {
		return this.localFns;
	}
	_createFunction = (rawOptions, rawTrigger, handler) => {
		const options = this.sanitizeOptions(rawOptions);
		const triggers = this.sanitizeTriggers(rawTrigger);
		return new InngestFunction(this, {
			...options,
			triggers
		}, handler);
	};
	/**
	* Runtime-only validation.
	*/
	sanitizeOptions(options) {
		if (Object.hasOwn(options, "fns")) console.warn(`${logPrefix} InngestFunction: \`fns\` option has been deprecated in v3; use \`middleware\` instead. See https://www.inngest.com/docs/sdk/migration`);
		if (typeof options === "string") {
			console.warn(`${logPrefix} InngestFunction: Creating a function with a string as the first argument has been deprecated in v3; pass an object instead. See https://www.inngest.com/docs/sdk/migration`);
			return { id: options };
		}
		return options;
	}
	/**
	* Runtime-only validation.
	*/
	sanitizeTriggers(triggers) {
		if (typeof triggers === "string") {
			console.warn(`${logPrefix} InngestFunction: Creating a function with a string as the second argument has been deprecated in v3; pass an object instead. See https://www.inngest.com/docs/sdk/migration`);
			return [{ event: triggers }];
		}
		if (!Array.isArray(triggers)) return [triggers];
		return triggers;
	}
};
/**
* Default middleware that is included in every client, placed after the user's
* middleware on the client but before function-level middleware.
*
* It is defined here to ensure that comments are included in the generated TS
* definitions. Without this, we infer the stack of built-in middleware without
* comments, losing a lot of value.
*
* If this is moved, please ensure that using this package in another project
* can correctly access comments on mutated input and output.
*
* This return pattern mimics the output of a `satisfies` suffix; it's used as
* we support versions of TypeScript prior to the introduction of `satisfies`.
*/
const builtInMiddleware = ((m) => m)([new InngestMiddleware({
	name: "Inngest: Logger",
	init({ client }) {
		return { onFunctionRun(arg) {
			const { ctx } = arg;
			const metadata = {
				runID: ctx.runId,
				eventName: ctx.event.name,
				functionName: arg.fn.name
			};
			let providedLogger = client["logger"];
			try {
				if ("child" in providedLogger) providedLogger = providedLogger.child(metadata);
			} catch (err) {
				console.error("failed to create \"childLogger\" with error: ", err);
			}
			const logger = new ProxyLogger(providedLogger);
			return {
				transformInput() {
					return { ctx: { logger } };
				},
				beforeExecution() {
					logger.enable();
				},
				transformOutput({ result: { error } }) {
					if (error) logger.error(error);
				},
				async beforeResponse() {
					await logger.flush();
				}
			};
		} };
	}
})]);
(function(_Inngest) {
	_Inngest.Tag = "Inngest.App";
})(Inngest || (Inngest = {}));

//#endregion
export { Inngest };
//# sourceMappingURL=Inngest.js.map