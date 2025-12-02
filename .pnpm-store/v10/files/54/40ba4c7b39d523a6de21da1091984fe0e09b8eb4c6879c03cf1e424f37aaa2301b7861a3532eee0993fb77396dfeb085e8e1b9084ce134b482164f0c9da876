const require_rolldown_runtime = require('../../../_virtual/rolldown_runtime.cjs');
const require_processor = require('./processor.cjs');
let __opentelemetry_api = require("@opentelemetry/api");
__opentelemetry_api = require_rolldown_runtime.__toESM(__opentelemetry_api);
let __opentelemetry_auto_instrumentations_node = require("@opentelemetry/auto-instrumentations-node");
__opentelemetry_auto_instrumentations_node = require_rolldown_runtime.__toESM(__opentelemetry_auto_instrumentations_node);
let __opentelemetry_context_async_hooks = require("@opentelemetry/context-async-hooks");
__opentelemetry_context_async_hooks = require_rolldown_runtime.__toESM(__opentelemetry_context_async_hooks);
let __opentelemetry_instrumentation = require("@opentelemetry/instrumentation");
__opentelemetry_instrumentation = require_rolldown_runtime.__toESM(__opentelemetry_instrumentation);
let __opentelemetry_sdk_trace_base = require("@opentelemetry/sdk-trace-base");
__opentelemetry_sdk_trace_base = require_rolldown_runtime.__toESM(__opentelemetry_sdk_trace_base);

//#region src/components/execution/otel/util.ts
const createProvider = (_behaviour, instrumentations = []) => {
	const processor = new require_processor.InngestSpanProcessor();
	const p = new __opentelemetry_sdk_trace_base.BasicTracerProvider({ spanProcessors: [processor] });
	const instrList = [...instrumentations, ...(0, __opentelemetry_auto_instrumentations_node.getNodeAutoInstrumentations)()];
	(0, __opentelemetry_instrumentation.registerInstrumentations)({ instrumentations: instrList });
	p.register({ contextManager: new __opentelemetry_context_async_hooks.AsyncHooksContextManager().enable() });
	return {
		success: true,
		processor
	};
};
/**
* Attempts to extend the existing OTel provider with our processor. Returns true
* if the provider was extended, false if it was not.
*/
const extendProvider = (behaviour) => {
	const existingProvider = __opentelemetry_api.trace.getTracerProvider();
	if (!existingProvider) {
		if (behaviour !== "auto") console.warn("No existing OTel provider found and behaviour is \"extendProvider\". Inngest's OTel middleware will not work. Either allow the middleware to create a provider by setting `behaviour: \"createProvider\"` or `behaviour: \"auto\"`, or make sure that the provider is created and imported before the middleware is used.");
		return { success: false };
	}
	if (!("addSpanProcessor" in existingProvider) || typeof existingProvider.addSpanProcessor !== "function") {
		if (behaviour !== "auto") console.warn("Existing OTel provider is not a BasicTracerProvider. Inngest's OTel middleware will not work, as it can only extend an existing processor if it's a BasicTracerProvider.");
		return { success: false };
	}
	const processor = new require_processor.InngestSpanProcessor();
	existingProvider.addSpanProcessor(processor);
	return {
		success: true,
		processor
	};
};

//#endregion
exports.createProvider = createProvider;
exports.extendProvider = extendProvider;
//# sourceMappingURL=util.cjs.map