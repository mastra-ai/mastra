import { defaultDevServerHost, defaultInngestApiBaseUrl } from "../../../helpers/consts.js";
import { devServerHost } from "../../../helpers/env.js";
import { devServerAvailable } from "../../../helpers/devserver.js";
import { getAsyncCtx } from "../als.js";
import { clientProcessorMap } from "./access.js";
import { Attribute, TraceStateKey, debugPrefix } from "./consts.js";
import debug from "debug";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { detectResourcesSync, envDetectorSync, hostDetectorSync, osDetectorSync, processDetectorSync, serviceInstanceIdDetectorSync } from "@opentelemetry/resources";

//#region src/components/execution/otel/processor.ts
const processorDebug = debug(`${debugPrefix}:InngestSpanProcessor`);
/**
* A set of resource attributes that are used to identify the Inngest app and
*  the function that is being executed. This is used to store the resource
* attributes for the spans that are exported to the Inngest endpoint, and cache
*  them for later use.
*/
let _resourceAttributes;
/**
* An OTel span processor that is used to export spans to the Inngest endpoint.
* This is used to track spans that are created within an Inngest run and export
* them to the Inngest endpoint for tracing.
*
* It's careful to only pick relevant spans to export and will not send any
* irrelevant spans to the Inngest endpoint.
*
* THIS IS THE INTERNAL IMPLEMENTATION OF THE SPAN PROCESSOR AND SHOULD NOT BE
* USED BY USERS DIRECTLY. USE THE {@link PublicInngestSpanProcessor} CLASS
* INSTEAD.
*/
var InngestSpanProcessor = class InngestSpanProcessor {
	/**
	* An OTel span processor that is used to export spans to the Inngest endpoint.
	* This is used to track spans that are created within an Inngest run and export
	* them to the Inngest endpoint for tracing.
	*
	* It's careful to only pick relevant spans to export and will not send any
	* irrelevant spans to the Inngest endpoint.
	*/
	constructor(app) {
		if (app) clientProcessorMap.set(app, this);
	}
	/**
	* A `BatchSpanProcessor` that is used to export spans to the Inngest
	* endpoint. This is created lazily to avoid creating it until the Inngest App
	* has been initialized and has had a chance to receive environment variables,
	* which may be from an incoming request.
	*/
	#batcher;
	/**
	* A set of spans used to track spans that we care about, so that we can
	* export them to the OTel endpoint.
	*
	* If a span falls out of reference, it will be removed from this set as we'll
	* never get a chance to export it or remove it anyway.
	*/
	#spansToExport = /* @__PURE__ */ new WeakSet();
	/**
	* A map of span IDs to their parent state, which includes a block of
	* information that can be used and pushed back to the Inngest endpoint to
	* ingest spans.
	*/
	#traceParents = /* @__PURE__ */ new Map();
	/**
	* A registry used to clean up items from the `traceParents` map when spans
	* fall out of reference. This is used to avoid memory leaks in the case where
	* a span is not exported, remains unended, and is left in memory before being
	* GC'd.
	*/
	#spanCleanup = new FinalizationRegistry((spanId) => {
		if (spanId) this.#traceParents.delete(spanId);
	});
	/**
	* In order to only capture a subset of spans, we need to declare the initial
	* span that we care about and then export its children.
	*
	* Call this method (ideally just before execution starts) with that initial
	* span to trigger capturing all following children as well as initialize the
	* batcher.
	*/
	declareStartingSpan({ span, runId, traceparent, tracestate }) {
		this.ensureBatcherInitialized();
		if (!traceparent) return processorDebug("no traceparent found for span", span.spanContext().spanId, "so skipping it");
		let appId;
		let functionId;
		let traceRef;
		if (tracestate) try {
			const entries = Object.fromEntries(tracestate.split(",").map((kv) => kv.split("=")));
			appId = entries[TraceStateKey.AppId];
			functionId = entries[TraceStateKey.FunctionId];
			traceRef = entries[TraceStateKey.TraceRef];
		} catch (err) {
			processorDebug("failed to parse tracestate", tracestate, "so skipping it;", err);
		}
		processorDebug.extend("declareStartingSpan")("declaring:", span.spanContext().spanId, "for traceparent", traceparent);
		span.setAttributes(InngestSpanProcessor.resourceAttributes.attributes);
		this.trackSpan({
			appId,
			functionId,
			runId,
			traceparent,
			traceRef
		}, span);
	}
	/**
	* A getter for retrieving resource attributes for the current process. This
	* is used to set the resource attributes for the spans that are exported to
	* the Inngest endpoint, and cache them for later use.
	*/
	static get resourceAttributes() {
		if (!_resourceAttributes) _resourceAttributes = detectResourcesSync({ detectors: [
			osDetectorSync,
			envDetectorSync,
			hostDetectorSync,
			processDetectorSync,
			serviceInstanceIdDetectorSync
		] });
		return _resourceAttributes;
	}
	/**
	* The batcher is a singleton that is used to export spans to the OTel
	* endpoint. It is created lazily to avoid creating it until the Inngest App
	* has been initialized and has had a chance to receive environment variables,
	* which may be from an incoming request.
	*
	* The batcher is only referenced once we've found a span we're interested in,
	* so this should always have everything it needs on the app by then.
	*/
	ensureBatcherInitialized() {
		if (!this.#batcher) this.#batcher = new Promise(async (resolve, reject) => {
			try {
				const store = await getAsyncCtx();
				if (!store) throw new Error("No async context found; cannot create batcher to export traces");
				const app = store.app;
				let url;
				const path = "/v1/traces/userland";
				if (app.apiBaseUrl) url = new URL(path, app.apiBaseUrl);
				else {
					url = new URL(path, defaultInngestApiBaseUrl);
					if (app["mode"] && app["mode"].isDev && app["mode"].isInferred) {
						const devHost = devServerHost() || defaultDevServerHost;
						if (await devServerAvailable(devHost, app["fetch"])) url = new URL(path, devHost);
					} else if (app["mode"]?.explicitDevUrl) url = new URL(path, app["mode"].explicitDevUrl.href);
				}
				processorDebug("batcher lazily accessed; creating new batcher with URL", url);
				const exporter = new OTLPTraceExporter({
					url: url.href,
					headers: { Authorization: `Bearer ${app["inngestApi"]["signingKey"]}` }
				});
				resolve(new BatchSpanProcessor(exporter));
			} catch (err) {
				reject(err);
			}
		});
		return this.#batcher;
	}
	/**
	* Mark a span as being tracked by this processor, meaning it will be exported
	* to the Inggest endpoint when it ends.
	*/
	trackSpan(parentState, span) {
		const spanId = span.spanContext().spanId;
		this.#spanCleanup.register(span, spanId, span);
		this.#spansToExport.add(span);
		this.#traceParents.set(spanId, parentState);
		span.setAttribute(Attribute.InngestTraceparent, parentState.traceparent);
		span.setAttribute(Attribute.InngestRunId, parentState.runId);
		if (parentState.appId) {
			span.setAttribute(Attribute.InngestAppId1, parentState.appId);
			span.setAttribute(Attribute.InngestAppId2, parentState.appId);
		}
		if (parentState.functionId) span.setAttribute(Attribute.InngestFunctionId, parentState.functionId);
		if (parentState.traceRef) span.setAttribute(Attribute.InngestTraceRef, parentState.traceRef);
	}
	/**
	* Clean up any references to a span that has ended. This is used to avoid
	* memory leaks in the case where a span is not exported, remains unended, and
	* is left in memory before being GC'd.
	*/
	cleanupSpan(span) {
		const spanId = span.spanContext().spanId;
		this.#spanCleanup.unregister(span);
		this.#spansToExport.delete(span);
		this.#traceParents.delete(spanId);
	}
	/**
	* An implementation of the `onStart` method from the `SpanProcessor`
	* interface. This is called when a span is started, and is used to track
	* spans that are children of spans we care about.
	*/
	onStart(span) {
		const debug$1 = processorDebug.extend("onStart");
		const spanId = span.spanContext().spanId;
		const parentSpanId = span.parentSpanId;
		if (!parentSpanId) {
			debug$1("no parent span ID for", spanId, "so skipping it");
			return;
		}
		const parentState = this.#traceParents.get(parentSpanId);
		if (parentState) {
			debug$1("found traceparent", parentState, "in span ID", parentSpanId, "so adding", spanId);
			this.trackSpan(parentState, span);
		}
	}
	/**
	* An implementation of the `onEnd` method from the `SpanProcessor` interface.
	* This is called when a span ends, and is used to export spans to the Inngest
	* endpoint.
	*/
	onEnd(span) {
		const debug$1 = processorDebug.extend("onEnd");
		const spanId = span.spanContext().spanId;
		try {
			if (this.#spansToExport.has(span)) {
				if (!this.#batcher) return debug$1("batcher not initialized, so failed exporting span", spanId);
				debug$1("exporting span", spanId);
				this.#batcher.then((batcher) => batcher.onEnd(span));
				return;
			}
			debug$1("not exporting span", spanId, "as we don't care about it");
		} finally {
			this.cleanupSpan(span);
		}
	}
	/**
	* An implementation of the `forceFlush` method from the `SpanProcessor`
	* interface. This is called to force the processor to flush any spans that
	* are currently in the batcher. This is used to ensure that spans are
	* exported to the Inngest endpoint before the process exits.
	*
	* Notably, we call this in the `beforeResponse` middleware hook to ensure
	* that spans for a run as exported as soon as possible and before the
	* serverless process is killed.
	*/
	async forceFlush() {
		const flushDebug = processorDebug.extend("forceFlush");
		flushDebug("force flushing batcher");
		return this.#batcher?.then((batcher) => batcher.forceFlush()).catch((err) => {
			flushDebug("error flushing batcher", err, "ignoring");
		});
	}
	async shutdown() {
		processorDebug.extend("shutdown")("shutting down batcher");
		return this.#batcher?.then((batcher) => batcher.shutdown());
	}
};
/**
* An OTel span processor that is used to export spans to the Inngest endpoint.
* This is used to track spans that are created within an Inngest run and export
* them to the Inngest endpoint for tracing.
*
* It's careful to only pick relevant spans to export and will not send any
* irrelevant spans to the Inngest endpoint.
*/
var PublicInngestSpanProcessor = class extends InngestSpanProcessor {
	constructor(app) {
		super(app);
	}
};

//#endregion
export { InngestSpanProcessor, PublicInngestSpanProcessor };
//# sourceMappingURL=processor.js.map