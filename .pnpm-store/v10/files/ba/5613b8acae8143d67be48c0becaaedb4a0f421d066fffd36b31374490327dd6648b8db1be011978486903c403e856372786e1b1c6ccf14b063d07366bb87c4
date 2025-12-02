const require_rolldown_runtime = require('../../../_virtual/rolldown_runtime.cjs');
const require_version = require('../../../version.cjs');
const require_InngestMiddleware = require('../../InngestMiddleware.cjs');
const require_access = require('./access.cjs');
const require_consts = require('./consts.cjs');
const require_util = require('./util.cjs');
let debug = require("debug");
debug = require_rolldown_runtime.__toESM(debug);
let __opentelemetry_api = require("@opentelemetry/api");
__opentelemetry_api = require_rolldown_runtime.__toESM(__opentelemetry_api);

//#region src/components/execution/otel/middleware.ts
const debug$1 = (0, debug.default)(`${require_consts.debugPrefix}:middleware`);
var InngestOtelDiagLogger = class {
	#logger = (0, debug.default)(`${require_consts.debugPrefix}:diag`);
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
const otelMiddleware = ({ behaviour = "auto", instrumentations, logLevel = __opentelemetry_api.DiagLogLevel.ERROR } = {}) => {
	debug$1("behaviour:", behaviour);
	let processor;
	switch (behaviour) {
		case "auto": {
			const extended = require_util.extendProvider(behaviour);
			if (extended.success) {
				debug$1("extended existing provider");
				processor = extended.processor;
				break;
			}
			const created = require_util.createProvider(behaviour, instrumentations);
			if (created.success) {
				debug$1("created new provider");
				processor = created.processor;
				break;
			}
			console.warn("no provider found to extend and unable to create one");
			break;
		}
		case "createProvider": {
			const created = require_util.createProvider(behaviour, instrumentations);
			if (created.success) {
				debug$1("created new provider");
				processor = created.processor;
				break;
			}
			console.warn("unable to create provider, OTel middleware will not work");
			break;
		}
		case "extendProvider": {
			const extended = require_util.extendProvider(behaviour);
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
	return new require_InngestMiddleware.InngestMiddleware({
		name: "Inngest: OTel",
		init({ client }) {
			debug$1("set otel diagLogger:", __opentelemetry_api.diag.setLogger(new InngestOtelDiagLogger(), logLevel));
			if (processor) require_access.clientProcessorMap.set(client, processor);
			return { onFunctionRun() {
				return {
					transformInput() {
						return { ctx: { tracer: __opentelemetry_api.trace.getTracer("inngest", require_version.version) } };
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
exports.otelMiddleware = otelMiddleware;
//# sourceMappingURL=middleware.cjs.map