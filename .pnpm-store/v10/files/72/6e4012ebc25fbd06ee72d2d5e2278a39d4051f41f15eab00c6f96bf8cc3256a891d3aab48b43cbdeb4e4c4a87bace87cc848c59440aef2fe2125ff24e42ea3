import { version } from "../../../version.js";
import { InngestMiddleware } from "../../InngestMiddleware.js";
import { clientProcessorMap } from "./access.js";
import { debugPrefix } from "./consts.js";
import { createProvider, extendProvider } from "./util.js";
import debug from "debug";
import { DiagLogLevel, diag, trace } from "@opentelemetry/api";

//#region src/components/execution/otel/middleware.ts
const debug$1 = debug(`${debugPrefix}:middleware`);
var InngestOtelDiagLogger = class {
	#logger = debug(`${debugPrefix}:diag`);
	debug = this.#logger;
	error = this.#logger;
	info = this.#logger;
	verbose = this.#logger;
	warn = this.#logger;
};
/**
* Middleware the captures and exports spans relevant to Inngest runs using
* OTel.
*
* This can be used to attach additional spans and data to the existing traces
* in your Inngest dashboard (or Dev Server).
*/
const otelMiddleware = ({ behaviour = "auto", instrumentations, logLevel = DiagLogLevel.ERROR } = {}) => {
	debug$1("behaviour:", behaviour);
	let processor;
	switch (behaviour) {
		case "auto": {
			const extended = extendProvider(behaviour);
			if (extended.success) {
				debug$1("extended existing provider");
				processor = extended.processor;
				break;
			}
			const created = createProvider(behaviour, instrumentations);
			if (created.success) {
				debug$1("created new provider");
				processor = created.processor;
				break;
			}
			console.warn("no provider found to extend and unable to create one");
			break;
		}
		case "createProvider": {
			const created = createProvider(behaviour, instrumentations);
			if (created.success) {
				debug$1("created new provider");
				processor = created.processor;
				break;
			}
			console.warn("unable to create provider, OTel middleware will not work");
			break;
		}
		case "extendProvider": {
			const extended = extendProvider(behaviour);
			if (extended.success) {
				debug$1("extended existing provider");
				processor = extended.processor;
				break;
			}
			console.warn("unable to extend provider, OTel middleware will not work. Either allow the middleware to create a provider by setting `behaviour: \"createProvider\"` or `behaviour: \"auto\"`, or make sure that the provider is created and imported before the middleware is used.");
			break;
		}
		case "off": break;
		default: console.warn(`unknown behaviour ${JSON.stringify(behaviour)}, defaulting to "off"`);
	}
	return new InngestMiddleware({
		name: "Inngest: OTel",
		init({ client }) {
			debug$1("set otel diagLogger:", diag.setLogger(new InngestOtelDiagLogger(), logLevel));
			if (processor) clientProcessorMap.set(client, processor);
			return { onFunctionRun() {
				return {
					transformInput() {
						return { ctx: { tracer: trace.getTracer("inngest", version) } };
					},
					async beforeResponse() {
						await processor?.forceFlush();
					}
				};
			} };
		}
	});
};

//#endregion
export { otelMiddleware };
//# sourceMappingURL=middleware.js.map