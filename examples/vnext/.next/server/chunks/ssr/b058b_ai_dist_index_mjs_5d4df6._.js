module.exports = {

"[project]/node_modules/.pnpm/ai@4.0.13_react@19.0.0-rc-66855b96-20241106_zod@3.23.7/node_modules/ai/dist/index.mjs [app-rsc] (ecmascript) <locals>": ((__turbopack_context__) => {
"use strict";

var { r: __turbopack_require__, f: __turbopack_module_context__, i: __turbopack_import__, s: __turbopack_esm__, v: __turbopack_export_value__, n: __turbopack_export_namespace__, c: __turbopack_cache__, M: __turbopack_modules__, l: __turbopack_load__, j: __turbopack_dynamic__, P: __turbopack_resolve_absolute_path__, U: __turbopack_relative_url__, R: __turbopack_resolve_module_id_path__, b: __turbopack_worker_blob_url__, g: global, __dirname, x: __turbopack_external_require__, y: __turbopack_external_import__, z: require } = __turbopack_context__;
{
__turbopack_esm__({
    "AssistantResponse": (()=>AssistantResponse),
    "DownloadError": (()=>DownloadError),
    "InvalidArgumentError": (()=>InvalidArgumentError),
    "InvalidDataContentError": (()=>InvalidDataContentError),
    "InvalidMessageRoleError": (()=>InvalidMessageRoleError),
    "InvalidToolArgumentsError": (()=>InvalidToolArgumentsError),
    "LangChainAdapter": (()=>langchain_adapter_exports),
    "LlamaIndexAdapter": (()=>llamaindex_adapter_exports),
    "MessageConversionError": (()=>MessageConversionError),
    "NoObjectGeneratedError": (()=>NoObjectGeneratedError),
    "NoSuchProviderError": (()=>NoSuchProviderError),
    "NoSuchToolError": (()=>NoSuchToolError),
    "Output": (()=>output_exports),
    "RetryError": (()=>RetryError),
    "StreamData": (()=>StreamData),
    "ToolCallRepairError": (()=>ToolCallRepairError),
    "ToolExecutionError": (()=>ToolExecutionError),
    "convertToCoreMessages": (()=>convertToCoreMessages),
    "cosineSimilarity": (()=>cosineSimilarity),
    "createDataStream": (()=>createDataStream),
    "createDataStreamResponse": (()=>createDataStreamResponse),
    "embed": (()=>embed),
    "embedMany": (()=>embedMany),
    "experimental_createProviderRegistry": (()=>experimental_createProviderRegistry),
    "experimental_customProvider": (()=>experimental_customProvider),
    "experimental_wrapLanguageModel": (()=>experimental_wrapLanguageModel),
    "generateObject": (()=>generateObject),
    "generateText": (()=>generateText),
    "pipeDataStreamToResponse": (()=>pipeDataStreamToResponse),
    "streamObject": (()=>streamObject),
    "streamText": (()=>streamText),
    "tool": (()=>tool)
});
// streams/stream-data.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_import__("[project]/node_modules/.pnpm/@ai-sdk+ui-utils@1.0.4_zod@3.23.7/node_modules/@ai-sdk/ui-utils/dist/index.mjs [app-rsc] (ecmascript) <locals>");
// errors/invalid-argument-error.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@ai-sdk+provider@1.0.1/node_modules/@ai-sdk/provider/dist/index.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/@ai-sdk+provider-utils@2.0.3_zod@3.23.7/node_modules/@ai-sdk/provider-utils/dist/index.mjs [app-rsc] (ecmascript)");
// core/telemetry/get-tracer.ts
var __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__ = __turbopack_import__("[externals]/ [external] (@opentelemetry/api, cjs)");
// core/prompt/data-content.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_import__("[project]/node_modules/.pnpm/zod@3.23.7/node_modules/zod/lib/index.mjs [app-rsc] (ecmascript)");
var __defProp = Object.defineProperty;
var __export = (target, all)=>{
    for(var name13 in all)__defProp(target, name13, {
        get: all[name13],
        enumerable: true
    });
};
;
;
;
;
function createDataStream({ execute, onError = ()=>"An error occurred." }) {
    let controller;
    const ongoingStreamPromises = [];
    const stream = new ReadableStream({
        start (controllerArg) {
            controller = controllerArg;
        }
    });
    try {
        const result = execute({
            writeData (data) {
                controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("data", [
                    data
                ]));
            },
            writeMessageAnnotation (annotation) {
                controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("message_annotations", [
                    annotation
                ]));
            },
            merge (streamArg) {
                ongoingStreamPromises.push((async ()=>{
                    const reader = streamArg.getReader();
                    while(true){
                        const { done, value } = await reader.read();
                        if (done) break;
                        controller.enqueue(value);
                    }
                })().catch((error)=>{
                    controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("error", onError(error)));
                }));
            },
            onError
        });
        if (result) {
            ongoingStreamPromises.push(result.catch((error)=>{
                controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("error", onError(error)));
            }));
        }
    } catch (error) {
        controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("error", onError(error)));
    }
    const waitForStreams = new Promise(async (resolve)=>{
        while(ongoingStreamPromises.length > 0){
            await ongoingStreamPromises.shift();
        }
        resolve();
    });
    waitForStreams.finally(()=>{
        controller.close();
    });
    return stream;
}
// core/util/prepare-response-headers.ts
function prepareResponseHeaders(headers, { contentType, dataStreamVersion }) {
    const responseHeaders = new Headers(headers != null ? headers : {});
    if (!responseHeaders.has("Content-Type")) {
        responseHeaders.set("Content-Type", contentType);
    }
    if (dataStreamVersion !== void 0) {
        responseHeaders.set("X-Vercel-AI-Data-Stream", dataStreamVersion);
    }
    return responseHeaders;
}
// core/data-stream/create-data-stream-response.ts
function createDataStreamResponse({ status, statusText, headers, execute, onError }) {
    return new Response(createDataStream({
        execute,
        onError
    }).pipeThrough(new TextEncoderStream()), {
        status,
        statusText,
        headers: prepareResponseHeaders(headers, {
            contentType: "text/plain; charset=utf-8",
            dataStreamVersion: "v1"
        })
    });
}
// core/util/prepare-outgoing-http-headers.ts
function prepareOutgoingHttpHeaders(headers, { contentType, dataStreamVersion }) {
    const outgoingHeaders = {};
    if (headers != null) {
        for (const [key, value] of Object.entries(headers)){
            outgoingHeaders[key] = value;
        }
    }
    if (outgoingHeaders["Content-Type"] == null) {
        outgoingHeaders["Content-Type"] = contentType;
    }
    if (dataStreamVersion !== void 0) {
        outgoingHeaders["X-Vercel-AI-Data-Stream"] = dataStreamVersion;
    }
    return outgoingHeaders;
}
// core/util/write-to-server-response.ts
function writeToServerResponse({ response, status, statusText, headers, stream }) {
    response.writeHead(status != null ? status : 200, statusText, headers);
    const reader = stream.getReader();
    const read = async ()=>{
        try {
            while(true){
                const { done, value } = await reader.read();
                if (done) break;
                response.write(value);
            }
        } catch (error) {
            throw error;
        } finally{
            response.end();
        }
    };
    read();
}
// core/data-stream/pipe-data-stream-to-response.ts
function pipeDataStreamToResponse(response, { status, statusText, headers, execute, onError }) {
    writeToServerResponse({
        response,
        status,
        statusText,
        headers: prepareOutgoingHttpHeaders(headers, {
            contentType: "text/plain; charset=utf-8",
            dataStreamVersion: "v1"
        }),
        stream: createDataStream({
            execute,
            onError
        }).pipeThrough(new TextEncoderStream())
    });
}
;
var name = "AI_InvalidArgumentError";
var marker = `vercel.ai.error.${name}`;
var symbol = Symbol.for(marker);
var _a;
var InvalidArgumentError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ parameter, value, message }){
        super({
            name,
            message: `Invalid argument for parameter ${parameter}: ${message}`
        });
        this[_a] = true;
        this.parameter = parameter;
        this.value = value;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker);
    }
};
_a = symbol;
;
;
// util/delay.ts
async function delay(delayInMs) {
    return delayInMs === void 0 ? Promise.resolve() : new Promise((resolve)=>setTimeout(resolve, delayInMs));
}
;
var name2 = "AI_RetryError";
var marker2 = `vercel.ai.error.${name2}`;
var symbol2 = Symbol.for(marker2);
var _a2;
var RetryError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ message, reason, errors }){
        super({
            name: name2,
            message
        });
        this[_a2] = true;
        this.reason = reason;
        this.errors = errors;
        this.lastError = errors[errors.length - 1];
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker2);
    }
};
_a2 = symbol2;
// util/retry-with-exponential-backoff.ts
var retryWithExponentialBackoff = ({ maxRetries = 2, initialDelayInMs = 2e3, backoffFactor = 2 } = {})=>async (f)=>_retryWithExponentialBackoff(f, {
            maxRetries,
            delayInMs: initialDelayInMs,
            backoffFactor
        });
async function _retryWithExponentialBackoff(f, { maxRetries, delayInMs, backoffFactor }, errors = []) {
    try {
        return await f();
    } catch (error) {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isAbortError"])(error)) {
            throw error;
        }
        if (maxRetries === 0) {
            throw error;
        }
        const errorMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getErrorMessage"])(error);
        const newErrors = [
            ...errors,
            error
        ];
        const tryNumber = newErrors.length;
        if (tryNumber > maxRetries) {
            throw new RetryError({
                message: `Failed after ${tryNumber} attempts. Last error: ${errorMessage}`,
                reason: "maxRetriesExceeded",
                errors: newErrors
            });
        }
        if (error instanceof Error && __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["APICallError"].isInstance(error) && error.isRetryable === true && tryNumber <= maxRetries) {
            await delay(delayInMs);
            return _retryWithExponentialBackoff(f, {
                maxRetries,
                delayInMs: backoffFactor * delayInMs,
                backoffFactor
            }, newErrors);
        }
        if (tryNumber === 1) {
            throw error;
        }
        throw new RetryError({
            message: `Failed after ${tryNumber} attempts with non-retryable error: '${errorMessage}'`,
            reason: "errorNotRetryable",
            errors: newErrors
        });
    }
}
// core/prompt/prepare-retries.ts
function prepareRetries({ maxRetries }) {
    if (maxRetries != null) {
        if (!Number.isInteger(maxRetries)) {
            throw new InvalidArgumentError({
                parameter: "maxRetries",
                value: maxRetries,
                message: "maxRetries must be an integer"
            });
        }
        if (maxRetries < 0) {
            throw new InvalidArgumentError({
                parameter: "maxRetries",
                value: maxRetries,
                message: "maxRetries must be >= 0"
            });
        }
    }
    const maxRetriesResult = maxRetries != null ? maxRetries : 2;
    return {
        maxRetries: maxRetriesResult,
        retry: retryWithExponentialBackoff({
            maxRetries: maxRetriesResult
        })
    };
}
// core/telemetry/assemble-operation-name.ts
function assembleOperationName({ operationId, telemetry }) {
    return {
        // standardized operation and resource name:
        "operation.name": `${operationId}${(telemetry == null ? void 0 : telemetry.functionId) != null ? ` ${telemetry.functionId}` : ""}`,
        "resource.name": telemetry == null ? void 0 : telemetry.functionId,
        // detailed, AI SDK specific data:
        "ai.operationId": operationId,
        "ai.telemetry.functionId": telemetry == null ? void 0 : telemetry.functionId
    };
}
// core/telemetry/get-base-telemetry-attributes.ts
function getBaseTelemetryAttributes({ model, settings, telemetry, headers }) {
    var _a13;
    return {
        "ai.model.provider": model.provider,
        "ai.model.id": model.modelId,
        // settings:
        ...Object.entries(settings).reduce((attributes, [key, value])=>{
            attributes[`ai.settings.${key}`] = value;
            return attributes;
        }, {}),
        // add metadata as attributes:
        ...Object.entries((_a13 = telemetry == null ? void 0 : telemetry.metadata) != null ? _a13 : {}).reduce((attributes, [key, value])=>{
            attributes[`ai.telemetry.metadata.${key}`] = value;
            return attributes;
        }, {}),
        // request headers
        ...Object.entries(headers != null ? headers : {}).reduce((attributes, [key, value])=>{
            if (value !== void 0) {
                attributes[`ai.request.headers.${key}`] = value;
            }
            return attributes;
        }, {})
    };
}
;
// core/telemetry/noop-tracer.ts
var noopTracer = {
    startSpan () {
        return noopSpan;
    },
    startActiveSpan (name13, arg1, arg2, arg3) {
        if (typeof arg1 === "function") {
            return arg1(noopSpan);
        }
        if (typeof arg2 === "function") {
            return arg2(noopSpan);
        }
        if (typeof arg3 === "function") {
            return arg3(noopSpan);
        }
    }
};
var noopSpan = {
    spanContext () {
        return noopSpanContext;
    },
    setAttribute () {
        return this;
    },
    setAttributes () {
        return this;
    },
    addEvent () {
        return this;
    },
    addLink () {
        return this;
    },
    addLinks () {
        return this;
    },
    setStatus () {
        return this;
    },
    updateName () {
        return this;
    },
    end () {
        return this;
    },
    isRecording () {
        return false;
    },
    recordException () {
        return this;
    }
};
var noopSpanContext = {
    traceId: "",
    spanId: "",
    traceFlags: 0
};
// core/telemetry/get-tracer.ts
function getTracer({ isEnabled = false, tracer } = {}) {
    if (!isEnabled) {
        return noopTracer;
    }
    if (tracer) {
        return tracer;
    }
    return __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["trace"].getTracer("ai");
}
;
function recordSpan({ name: name13, tracer, attributes, fn, endWhenDone = true }) {
    return tracer.startActiveSpan(name13, {
        attributes
    }, async (span)=>{
        try {
            const result = await fn(span);
            if (endWhenDone) {
                span.end();
            }
            return result;
        } catch (error) {
            try {
                if (error instanceof Error) {
                    span.recordException({
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    });
                    span.setStatus({
                        code: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["SpanStatusCode"].ERROR,
                        message: error.message
                    });
                } else {
                    span.setStatus({
                        code: __TURBOPACK__imported__module__$5b$externals$5d2f$__$5b$external$5d$__$2840$opentelemetry$2f$api$2c$__cjs$29$__["SpanStatusCode"].ERROR
                    });
                }
            } finally{
                span.end();
            }
            throw error;
        }
    });
}
// core/telemetry/select-telemetry-attributes.ts
function selectTelemetryAttributes({ telemetry, attributes }) {
    if ((telemetry == null ? void 0 : telemetry.isEnabled) !== true) {
        return {};
    }
    return Object.entries(attributes).reduce((attributes2, [key, value])=>{
        if (value === void 0) {
            return attributes2;
        }
        if (typeof value === "object" && "input" in value && typeof value.input === "function") {
            if ((telemetry == null ? void 0 : telemetry.recordInputs) === false) {
                return attributes2;
            }
            const result = value.input();
            return result === void 0 ? attributes2 : {
                ...attributes2,
                [key]: result
            };
        }
        if (typeof value === "object" && "output" in value && typeof value.output === "function") {
            if ((telemetry == null ? void 0 : telemetry.recordOutputs) === false) {
                return attributes2;
            }
            const result = value.output();
            return result === void 0 ? attributes2 : {
                ...attributes2,
                [key]: result
            };
        }
        return {
            ...attributes2,
            [key]: value
        };
    }, {});
}
// core/embed/embed.ts
async function embed({ model, value, maxRetries: maxRetriesArg, abortSignal, headers, experimental_telemetry: telemetry }) {
    const { maxRetries, retry } = prepareRetries({
        maxRetries: maxRetriesArg
    });
    const baseTelemetryAttributes = getBaseTelemetryAttributes({
        model,
        telemetry,
        headers,
        settings: {
            maxRetries
        }
    });
    const tracer = getTracer(telemetry);
    return recordSpan({
        name: "ai.embed",
        attributes: selectTelemetryAttributes({
            telemetry,
            attributes: {
                ...assembleOperationName({
                    operationId: "ai.embed",
                    telemetry
                }),
                ...baseTelemetryAttributes,
                "ai.value": {
                    input: ()=>JSON.stringify(value)
                }
            }
        }),
        tracer,
        fn: async (span)=>{
            const { embedding, usage, rawResponse } = await retry(()=>// nested spans to align with the embedMany telemetry data:
                recordSpan({
                    name: "ai.embed.doEmbed",
                    attributes: selectTelemetryAttributes({
                        telemetry,
                        attributes: {
                            ...assembleOperationName({
                                operationId: "ai.embed.doEmbed",
                                telemetry
                            }),
                            ...baseTelemetryAttributes,
                            // specific settings that only make sense on the outer level:
                            "ai.values": {
                                input: ()=>[
                                        JSON.stringify(value)
                                    ]
                            }
                        }
                    }),
                    tracer,
                    fn: async (doEmbedSpan)=>{
                        var _a13;
                        const modelResponse = await model.doEmbed({
                            values: [
                                value
                            ],
                            abortSignal,
                            headers
                        });
                        const embedding2 = modelResponse.embeddings[0];
                        const usage2 = (_a13 = modelResponse.usage) != null ? _a13 : {
                            tokens: NaN
                        };
                        doEmbedSpan.setAttributes(selectTelemetryAttributes({
                            telemetry,
                            attributes: {
                                "ai.embeddings": {
                                    output: ()=>modelResponse.embeddings.map((embedding3)=>JSON.stringify(embedding3))
                                },
                                "ai.usage.tokens": usage2.tokens
                            }
                        }));
                        return {
                            embedding: embedding2,
                            usage: usage2,
                            rawResponse: modelResponse.rawResponse
                        };
                    }
                }));
            span.setAttributes(selectTelemetryAttributes({
                telemetry,
                attributes: {
                    "ai.embedding": {
                        output: ()=>JSON.stringify(embedding)
                    },
                    "ai.usage.tokens": usage.tokens
                }
            }));
            return new DefaultEmbedResult({
                value,
                embedding,
                usage,
                rawResponse
            });
        }
    });
}
var DefaultEmbedResult = class {
    constructor(options){
        this.value = options.value;
        this.embedding = options.embedding;
        this.usage = options.usage;
        this.rawResponse = options.rawResponse;
    }
};
// core/util/split-array.ts
function splitArray(array, chunkSize) {
    if (chunkSize <= 0) {
        throw new Error("chunkSize must be greater than 0");
    }
    const result = [];
    for(let i = 0; i < array.length; i += chunkSize){
        result.push(array.slice(i, i + chunkSize));
    }
    return result;
}
// core/embed/embed-many.ts
async function embedMany({ model, values, maxRetries: maxRetriesArg, abortSignal, headers, experimental_telemetry: telemetry }) {
    const { maxRetries, retry } = prepareRetries({
        maxRetries: maxRetriesArg
    });
    const baseTelemetryAttributes = getBaseTelemetryAttributes({
        model,
        telemetry,
        headers,
        settings: {
            maxRetries
        }
    });
    const tracer = getTracer(telemetry);
    return recordSpan({
        name: "ai.embedMany",
        attributes: selectTelemetryAttributes({
            telemetry,
            attributes: {
                ...assembleOperationName({
                    operationId: "ai.embedMany",
                    telemetry
                }),
                ...baseTelemetryAttributes,
                // specific settings that only make sense on the outer level:
                "ai.values": {
                    input: ()=>values.map((value)=>JSON.stringify(value))
                }
            }
        }),
        tracer,
        fn: async (span)=>{
            const maxEmbeddingsPerCall = model.maxEmbeddingsPerCall;
            if (maxEmbeddingsPerCall == null) {
                const { embeddings: embeddings2, usage } = await retry(()=>{
                    return recordSpan({
                        name: "ai.embedMany.doEmbed",
                        attributes: selectTelemetryAttributes({
                            telemetry,
                            attributes: {
                                ...assembleOperationName({
                                    operationId: "ai.embedMany.doEmbed",
                                    telemetry
                                }),
                                ...baseTelemetryAttributes,
                                // specific settings that only make sense on the outer level:
                                "ai.values": {
                                    input: ()=>values.map((value)=>JSON.stringify(value))
                                }
                            }
                        }),
                        tracer,
                        fn: async (doEmbedSpan)=>{
                            var _a13;
                            const modelResponse = await model.doEmbed({
                                values,
                                abortSignal,
                                headers
                            });
                            const embeddings3 = modelResponse.embeddings;
                            const usage2 = (_a13 = modelResponse.usage) != null ? _a13 : {
                                tokens: NaN
                            };
                            doEmbedSpan.setAttributes(selectTelemetryAttributes({
                                telemetry,
                                attributes: {
                                    "ai.embeddings": {
                                        output: ()=>embeddings3.map((embedding)=>JSON.stringify(embedding))
                                    },
                                    "ai.usage.tokens": usage2.tokens
                                }
                            }));
                            return {
                                embeddings: embeddings3,
                                usage: usage2
                            };
                        }
                    });
                });
                span.setAttributes(selectTelemetryAttributes({
                    telemetry,
                    attributes: {
                        "ai.embeddings": {
                            output: ()=>embeddings2.map((embedding)=>JSON.stringify(embedding))
                        },
                        "ai.usage.tokens": usage.tokens
                    }
                }));
                return new DefaultEmbedManyResult({
                    values,
                    embeddings: embeddings2,
                    usage
                });
            }
            const valueChunks = splitArray(values, maxEmbeddingsPerCall);
            const embeddings = [];
            let tokens = 0;
            for (const chunk of valueChunks){
                const { embeddings: responseEmbeddings, usage } = await retry(()=>{
                    return recordSpan({
                        name: "ai.embedMany.doEmbed",
                        attributes: selectTelemetryAttributes({
                            telemetry,
                            attributes: {
                                ...assembleOperationName({
                                    operationId: "ai.embedMany.doEmbed",
                                    telemetry
                                }),
                                ...baseTelemetryAttributes,
                                // specific settings that only make sense on the outer level:
                                "ai.values": {
                                    input: ()=>chunk.map((value)=>JSON.stringify(value))
                                }
                            }
                        }),
                        tracer,
                        fn: async (doEmbedSpan)=>{
                            var _a13;
                            const modelResponse = await model.doEmbed({
                                values: chunk,
                                abortSignal,
                                headers
                            });
                            const embeddings2 = modelResponse.embeddings;
                            const usage2 = (_a13 = modelResponse.usage) != null ? _a13 : {
                                tokens: NaN
                            };
                            doEmbedSpan.setAttributes(selectTelemetryAttributes({
                                telemetry,
                                attributes: {
                                    "ai.embeddings": {
                                        output: ()=>embeddings2.map((embedding)=>JSON.stringify(embedding))
                                    },
                                    "ai.usage.tokens": usage2.tokens
                                }
                            }));
                            return {
                                embeddings: embeddings2,
                                usage: usage2
                            };
                        }
                    });
                });
                embeddings.push(...responseEmbeddings);
                tokens += usage.tokens;
            }
            span.setAttributes(selectTelemetryAttributes({
                telemetry,
                attributes: {
                    "ai.embeddings": {
                        output: ()=>embeddings.map((embedding)=>JSON.stringify(embedding))
                    },
                    "ai.usage.tokens": tokens
                }
            }));
            return new DefaultEmbedManyResult({
                values,
                embeddings,
                usage: {
                    tokens
                }
            });
        }
    });
}
var DefaultEmbedManyResult = class {
    constructor(options){
        this.values = options.values;
        this.embeddings = options.embeddings;
        this.usage = options.usage;
    }
};
;
;
var name3 = "AI_DownloadError";
var marker3 = `vercel.ai.error.${name3}`;
var symbol3 = Symbol.for(marker3);
var _a3;
var DownloadError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ url, statusCode, statusText, cause, message = cause == null ? `Failed to download ${url}: ${statusCode} ${statusText}` : `Failed to download ${url}: ${cause}` }){
        super({
            name: name3,
            message,
            cause
        });
        this[_a3] = true;
        this.url = url;
        this.statusCode = statusCode;
        this.statusText = statusText;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker3);
    }
};
_a3 = symbol3;
// util/download.ts
async function download({ url, fetchImplementation = fetch }) {
    var _a13;
    const urlText = url.toString();
    try {
        const response = await fetchImplementation(urlText);
        if (!response.ok) {
            throw new DownloadError({
                url: urlText,
                statusCode: response.status,
                statusText: response.statusText
            });
        }
        return {
            data: new Uint8Array(await response.arrayBuffer()),
            mimeType: (_a13 = response.headers.get("content-type")) != null ? _a13 : void 0
        };
    } catch (error) {
        if (DownloadError.isInstance(error)) {
            throw error;
        }
        throw new DownloadError({
            url: urlText,
            cause: error
        });
    }
}
// core/util/detect-image-mimetype.ts
var mimeTypeSignatures = [
    {
        mimeType: "image/gif",
        bytes: [
            71,
            73,
            70
        ]
    },
    {
        mimeType: "image/png",
        bytes: [
            137,
            80,
            78,
            71
        ]
    },
    {
        mimeType: "image/jpeg",
        bytes: [
            255,
            216
        ]
    },
    {
        mimeType: "image/webp",
        bytes: [
            82,
            73,
            70,
            70
        ]
    }
];
function detectImageMimeType(image) {
    for (const { bytes, mimeType } of mimeTypeSignatures){
        if (image.length >= bytes.length && bytes.every((byte, index)=>image[index] === byte)) {
            return mimeType;
        }
    }
    return void 0;
}
;
;
var name4 = "AI_InvalidDataContentError";
var marker4 = `vercel.ai.error.${name4}`;
var symbol4 = Symbol.for(marker4);
var _a4;
var InvalidDataContentError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ content, cause, message = `Invalid data content. Expected a base64 string, Uint8Array, ArrayBuffer, or Buffer, but got ${typeof content}.` }){
        super({
            name: name4,
            message,
            cause
        });
        this[_a4] = true;
        this.content = content;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker4);
    }
};
_a4 = symbol4;
;
var dataContentSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].instanceof(Uint8Array),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].instanceof(ArrayBuffer),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].custom(// Buffer might not be available in some environments such as CloudFlare:
    (value)=>{
        var _a13, _b;
        return (_b = (_a13 = globalThis.Buffer) == null ? void 0 : _a13.isBuffer(value)) != null ? _b : false;
    }, {
        message: "Must be a Buffer"
    })
]);
function convertDataContentToBase64String(content) {
    if (typeof content === "string") {
        return content;
    }
    if (content instanceof ArrayBuffer) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["convertUint8ArrayToBase64"])(new Uint8Array(content));
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["convertUint8ArrayToBase64"])(content);
}
function convertDataContentToUint8Array(content) {
    if (content instanceof Uint8Array) {
        return content;
    }
    if (typeof content === "string") {
        try {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["convertBase64ToUint8Array"])(content);
        } catch (error) {
            throw new InvalidDataContentError({
                message: "Invalid data content. Content string is not a base64-encoded media.",
                content,
                cause: error
            });
        }
    }
    if (content instanceof ArrayBuffer) {
        return new Uint8Array(content);
    }
    throw new InvalidDataContentError({
        content
    });
}
function convertUint8ArrayToText(uint8Array) {
    try {
        return new TextDecoder().decode(uint8Array);
    } catch (error) {
        throw new Error("Error decoding Uint8Array to text");
    }
}
;
var name5 = "AI_InvalidMessageRoleError";
var marker5 = `vercel.ai.error.${name5}`;
var symbol5 = Symbol.for(marker5);
var _a5;
var InvalidMessageRoleError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ role, message = `Invalid message role: '${role}'. Must be one of: "system", "user", "assistant", "tool".` }){
        super({
            name: name5,
            message
        });
        this[_a5] = true;
        this.role = role;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker5);
    }
};
_a5 = symbol5;
// core/prompt/split-data-url.ts
function splitDataUrl(dataUrl) {
    try {
        const [header, base64Content] = dataUrl.split(",");
        return {
            mimeType: header.split(";")[0].split(":")[1],
            base64Content
        };
    } catch (error) {
        return {
            mimeType: void 0,
            base64Content: void 0
        };
    }
}
// core/prompt/convert-to-language-model-prompt.ts
async function convertToLanguageModelPrompt({ prompt, modelSupportsImageUrls = true, modelSupportsUrl = ()=>false, downloadImplementation = download }) {
    const downloadedAssets = await downloadAssets(prompt.messages, downloadImplementation, modelSupportsImageUrls, modelSupportsUrl);
    return [
        ...prompt.system != null ? [
            {
                role: "system",
                content: prompt.system
            }
        ] : [],
        ...prompt.messages.map((message)=>convertToLanguageModelMessage(message, downloadedAssets))
    ];
}
function convertToLanguageModelMessage(message, downloadedAssets) {
    const role = message.role;
    switch(role){
        case "system":
            {
                return {
                    role: "system",
                    content: message.content,
                    providerMetadata: message.experimental_providerMetadata
                };
            }
        case "user":
            {
                if (typeof message.content === "string") {
                    return {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: message.content
                            }
                        ],
                        providerMetadata: message.experimental_providerMetadata
                    };
                }
                return {
                    role: "user",
                    content: message.content.map((part)=>convertPartToLanguageModelPart(part, downloadedAssets)).filter((part)=>part.type !== "text" || part.text !== ""),
                    providerMetadata: message.experimental_providerMetadata
                };
            }
        case "assistant":
            {
                if (typeof message.content === "string") {
                    return {
                        role: "assistant",
                        content: [
                            {
                                type: "text",
                                text: message.content
                            }
                        ],
                        providerMetadata: message.experimental_providerMetadata
                    };
                }
                return {
                    role: "assistant",
                    content: message.content.filter(// remove empty text parts:
                    (part)=>part.type !== "text" || part.text !== "").map((part)=>{
                        const { experimental_providerMetadata, ...rest } = part;
                        return {
                            ...rest,
                            providerMetadata: experimental_providerMetadata
                        };
                    }),
                    providerMetadata: message.experimental_providerMetadata
                };
            }
        case "tool":
            {
                return {
                    role: "tool",
                    content: message.content.map((part)=>({
                            type: "tool-result",
                            toolCallId: part.toolCallId,
                            toolName: part.toolName,
                            result: part.result,
                            content: part.experimental_content,
                            isError: part.isError,
                            providerMetadata: part.experimental_providerMetadata
                        })),
                    providerMetadata: message.experimental_providerMetadata
                };
            }
        default:
            {
                const _exhaustiveCheck = role;
                throw new InvalidMessageRoleError({
                    role: _exhaustiveCheck
                });
            }
    }
}
async function downloadAssets(messages, downloadImplementation, modelSupportsImageUrls, modelSupportsUrl) {
    const urls = messages.filter((message)=>message.role === "user").map((message)=>message.content).filter((content)=>Array.isArray(content)).flat().filter((part)=>part.type === "image" || part.type === "file").filter((part)=>!(part.type === "image" && modelSupportsImageUrls === true)).map((part)=>part.type === "image" ? part.image : part.data).map((part)=>// support string urls:
        typeof part === "string" && (part.startsWith("http:") || part.startsWith("https:")) ? new URL(part) : part).filter((image)=>image instanceof URL).filter((url)=>!modelSupportsUrl(url));
    const downloadedImages = await Promise.all(urls.map(async (url)=>({
            url,
            data: await downloadImplementation({
                url
            })
        })));
    return Object.fromEntries(downloadedImages.map(({ url, data })=>[
            url.toString(),
            data
        ]));
}
function convertPartToLanguageModelPart(part, downloadedAssets) {
    if (part.type === "text") {
        return {
            type: "text",
            text: part.text,
            providerMetadata: part.experimental_providerMetadata
        };
    }
    let mimeType = part.mimeType;
    let data;
    let content;
    let normalizedData;
    const type = part.type;
    switch(type){
        case "image":
            data = part.image;
            break;
        case "file":
            data = part.data;
            break;
        default:
            throw new Error(`Unsupported part type: ${type}`);
    }
    try {
        content = typeof data === "string" ? new URL(data) : data;
    } catch (error) {
        content = data;
    }
    if (content instanceof URL) {
        if (content.protocol === "data:") {
            const { mimeType: dataUrlMimeType, base64Content } = splitDataUrl(content.toString());
            if (dataUrlMimeType == null || base64Content == null) {
                throw new Error(`Invalid data URL format in part ${type}`);
            }
            mimeType = dataUrlMimeType;
            normalizedData = convertDataContentToUint8Array(base64Content);
        } else {
            const downloadedFile = downloadedAssets[content.toString()];
            if (downloadedFile) {
                normalizedData = downloadedFile.data;
                mimeType != null ? mimeType : mimeType = downloadedFile.mimeType;
            } else {
                normalizedData = content;
            }
        }
    } else {
        normalizedData = convertDataContentToUint8Array(content);
    }
    switch(type){
        case "image":
            if (mimeType == null && normalizedData instanceof Uint8Array) {
                mimeType = detectImageMimeType(normalizedData);
            }
            return {
                type: "image",
                image: normalizedData,
                mimeType,
                providerMetadata: part.experimental_providerMetadata
            };
        case "file":
            if (mimeType == null) {
                throw new Error(`Mime type is missing for file part`);
            }
            return {
                type: "file",
                data: normalizedData instanceof Uint8Array ? convertDataContentToBase64String(normalizedData) : normalizedData,
                mimeType,
                providerMetadata: part.experimental_providerMetadata
            };
    }
}
// core/prompt/prepare-call-settings.ts
function prepareCallSettings({ maxTokens, temperature, topP, topK, presencePenalty, frequencyPenalty, stopSequences, seed }) {
    if (maxTokens != null) {
        if (!Number.isInteger(maxTokens)) {
            throw new InvalidArgumentError({
                parameter: "maxTokens",
                value: maxTokens,
                message: "maxTokens must be an integer"
            });
        }
        if (maxTokens < 1) {
            throw new InvalidArgumentError({
                parameter: "maxTokens",
                value: maxTokens,
                message: "maxTokens must be >= 1"
            });
        }
    }
    if (temperature != null) {
        if (typeof temperature !== "number") {
            throw new InvalidArgumentError({
                parameter: "temperature",
                value: temperature,
                message: "temperature must be a number"
            });
        }
    }
    if (topP != null) {
        if (typeof topP !== "number") {
            throw new InvalidArgumentError({
                parameter: "topP",
                value: topP,
                message: "topP must be a number"
            });
        }
    }
    if (topK != null) {
        if (typeof topK !== "number") {
            throw new InvalidArgumentError({
                parameter: "topK",
                value: topK,
                message: "topK must be a number"
            });
        }
    }
    if (presencePenalty != null) {
        if (typeof presencePenalty !== "number") {
            throw new InvalidArgumentError({
                parameter: "presencePenalty",
                value: presencePenalty,
                message: "presencePenalty must be a number"
            });
        }
    }
    if (frequencyPenalty != null) {
        if (typeof frequencyPenalty !== "number") {
            throw new InvalidArgumentError({
                parameter: "frequencyPenalty",
                value: frequencyPenalty,
                message: "frequencyPenalty must be a number"
            });
        }
    }
    if (seed != null) {
        if (!Number.isInteger(seed)) {
            throw new InvalidArgumentError({
                parameter: "seed",
                value: seed,
                message: "seed must be an integer"
            });
        }
    }
    return {
        maxTokens,
        temperature: temperature != null ? temperature : 0,
        topP,
        topK,
        presencePenalty,
        frequencyPenalty,
        stopSequences: stopSequences != null && stopSequences.length > 0 ? stopSequences : void 0,
        seed
    };
}
;
;
;
;
;
;
var jsonValueSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].lazy(()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].null(),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].number(),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].boolean(),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].record(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(), jsonValueSchema),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(jsonValueSchema)
    ]));
// core/types/provider-metadata.ts
var providerMetadataSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].record(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(), __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].record(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(), jsonValueSchema));
;
;
var toolResultContentSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("text"),
        text: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string()
    }),
    __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
        type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("image"),
        data: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
        mimeType: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional()
    })
]));
// core/prompt/content-part.ts
var textPartSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("text"),
    text: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    experimental_providerMetadata: providerMetadataSchema.optional()
});
var imagePartSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("image"),
    image: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
        dataContentSchema,
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].instanceof(URL)
    ]),
    mimeType: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string().optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
});
var filePartSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("file"),
    data: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
        dataContentSchema,
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].instanceof(URL)
    ]),
    mimeType: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    experimental_providerMetadata: providerMetadataSchema.optional()
});
var toolCallPartSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("tool-call"),
    toolCallId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    toolName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    args: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].unknown()
});
var toolResultPartSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    type: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("tool-result"),
    toolCallId: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    toolName: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    result: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].unknown(),
    content: toolResultContentSchema.optional(),
    isError: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].boolean().optional(),
    experimental_providerMetadata: providerMetadataSchema.optional()
});
// core/prompt/message.ts
var coreSystemMessageSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    role: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("system"),
    content: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
    experimental_providerMetadata: providerMetadataSchema.optional()
});
var coreUserMessageSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    role: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("user"),
    content: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
            textPartSchema,
            imagePartSchema,
            filePartSchema
        ]))
    ]),
    experimental_providerMetadata: providerMetadataSchema.optional()
});
var coreAssistantMessageSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    role: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("assistant"),
    content: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].string(),
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
            textPartSchema,
            toolCallPartSchema
        ]))
    ]),
    experimental_providerMetadata: providerMetadataSchema.optional()
});
var coreToolMessageSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].object({
    role: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].literal("tool"),
    content: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(toolResultPartSchema),
    experimental_providerMetadata: providerMetadataSchema.optional()
});
var coreMessageSchema = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].union([
    coreSystemMessageSchema,
    coreUserMessageSchema,
    coreAssistantMessageSchema,
    coreToolMessageSchema
]);
// core/prompt/detect-prompt-type.ts
function detectPromptType(prompt) {
    if (!Array.isArray(prompt)) {
        return "other";
    }
    if (prompt.length === 0) {
        return "messages";
    }
    const characteristics = prompt.map(detectSingleMessageCharacteristics);
    if (characteristics.some((c)=>c === "has-ui-specific-parts")) {
        return "ui-messages";
    } else if (characteristics.every((c)=>c === "has-core-specific-parts" || c === "message")) {
        return "messages";
    } else {
        return "other";
    }
}
function detectSingleMessageCharacteristics(message) {
    if (typeof message === "object" && message !== null && (message.role === "function" || // UI-only role
    message.role === "data" || // UI-only role
    "toolInvocations" in message || // UI-specific field
    "experimental_attachments" in message)) {
        return "has-ui-specific-parts";
    } else if (typeof message === "object" && message !== null && "content" in message && (Array.isArray(message.content) || // Core messages can have array content
    "experimental_providerMetadata" in message)) {
        return "has-core-specific-parts";
    } else if (typeof message === "object" && message !== null && "role" in message && "content" in message && typeof message.content === "string" && [
        "system",
        "user",
        "assistant",
        "tool"
    ].includes(message.role)) {
        return "message";
    } else {
        return "other";
    }
}
// core/prompt/attachments-to-parts.ts
function attachmentsToParts(attachments) {
    var _a13, _b, _c;
    const parts = [];
    for (const attachment of attachments){
        let url;
        try {
            url = new URL(attachment.url);
        } catch (error) {
            throw new Error(`Invalid URL: ${attachment.url}`);
        }
        switch(url.protocol){
            case "http:":
            case "https:":
                {
                    if ((_a13 = attachment.contentType) == null ? void 0 : _a13.startsWith("image/")) {
                        parts.push({
                            type: "image",
                            image: url
                        });
                    } else {
                        if (!attachment.contentType) {
                            throw new Error("If the attachment is not an image, it must specify a content type");
                        }
                        parts.push({
                            type: "file",
                            data: url,
                            mimeType: attachment.contentType
                        });
                    }
                    break;
                }
            case "data:":
                {
                    let header;
                    let base64Content;
                    let mimeType;
                    try {
                        [header, base64Content] = attachment.url.split(",");
                        mimeType = header.split(";")[0].split(":")[1];
                    } catch (error) {
                        throw new Error(`Error processing data URL: ${attachment.url}`);
                    }
                    if (mimeType == null || base64Content == null) {
                        throw new Error(`Invalid data URL format: ${attachment.url}`);
                    }
                    if ((_b = attachment.contentType) == null ? void 0 : _b.startsWith("image/")) {
                        parts.push({
                            type: "image",
                            image: convertDataContentToUint8Array(base64Content)
                        });
                    } else if ((_c = attachment.contentType) == null ? void 0 : _c.startsWith("text/")) {
                        parts.push({
                            type: "text",
                            text: convertUint8ArrayToText(convertDataContentToUint8Array(base64Content))
                        });
                    } else {
                        if (!attachment.contentType) {
                            throw new Error("If the attachment is not an image or text, it must specify a content type");
                        }
                        parts.push({
                            type: "file",
                            data: base64Content,
                            mimeType: attachment.contentType
                        });
                    }
                    break;
                }
            default:
                {
                    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
                }
        }
    }
    return parts;
}
;
var name6 = "AI_MessageConversionError";
var marker6 = `vercel.ai.error.${name6}`;
var symbol6 = Symbol.for(marker6);
var _a6;
var MessageConversionError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ originalMessage, message }){
        super({
            name: name6,
            message
        });
        this[_a6] = true;
        this.originalMessage = originalMessage;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker6);
    }
};
_a6 = symbol6;
// core/prompt/convert-to-core-messages.ts
function convertToCoreMessages(messages, options) {
    var _a13;
    const tools = (_a13 = options == null ? void 0 : options.tools) != null ? _a13 : {};
    const coreMessages = [];
    for (const message of messages){
        const { role, content, toolInvocations, experimental_attachments } = message;
        switch(role){
            case "system":
                {
                    coreMessages.push({
                        role: "system",
                        content
                    });
                    break;
                }
            case "user":
                {
                    coreMessages.push({
                        role: "user",
                        content: experimental_attachments ? [
                            {
                                type: "text",
                                text: content
                            },
                            ...attachmentsToParts(experimental_attachments)
                        ] : content
                    });
                    break;
                }
            case "assistant":
                {
                    if (toolInvocations == null) {
                        coreMessages.push({
                            role: "assistant",
                            content
                        });
                        break;
                    }
                    coreMessages.push({
                        role: "assistant",
                        content: [
                            {
                                type: "text",
                                text: content
                            },
                            ...toolInvocations.map(({ toolCallId, toolName, args })=>({
                                    type: "tool-call",
                                    toolCallId,
                                    toolName,
                                    args
                                }))
                        ]
                    });
                    coreMessages.push({
                        role: "tool",
                        content: toolInvocations.map((toolInvocation)=>{
                            if (!("result" in toolInvocation)) {
                                throw new MessageConversionError({
                                    originalMessage: message,
                                    message: "ToolInvocation must have a result: " + JSON.stringify(toolInvocation)
                                });
                            }
                            const { toolCallId, toolName, result } = toolInvocation;
                            const tool2 = tools[toolName];
                            return (tool2 == null ? void 0 : tool2.experimental_toToolResultContent) != null ? {
                                type: "tool-result",
                                toolCallId,
                                toolName,
                                result: tool2.experimental_toToolResultContent(result),
                                experimental_content: tool2.experimental_toToolResultContent(result)
                            } : {
                                type: "tool-result",
                                toolCallId,
                                toolName,
                                result
                            };
                        })
                    });
                    break;
                }
            case "data":
                {
                    break;
                }
            default:
                {
                    const _exhaustiveCheck = role;
                    throw new MessageConversionError({
                        originalMessage: message,
                        message: `Unsupported role: ${_exhaustiveCheck}`
                    });
                }
        }
    }
    return coreMessages;
}
// core/prompt/standardize-prompt.ts
function standardizePrompt({ prompt, tools }) {
    if (prompt.prompt == null && prompt.messages == null) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InvalidPromptError"]({
            prompt,
            message: "prompt or messages must be defined"
        });
    }
    if (prompt.prompt != null && prompt.messages != null) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InvalidPromptError"]({
            prompt,
            message: "prompt and messages cannot be defined at the same time"
        });
    }
    if (prompt.system != null && typeof prompt.system !== "string") {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InvalidPromptError"]({
            prompt,
            message: "system must be a string"
        });
    }
    if (prompt.prompt != null) {
        if (typeof prompt.prompt !== "string") {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InvalidPromptError"]({
                prompt,
                message: "prompt must be a string"
            });
        }
        return {
            type: "prompt",
            system: prompt.system,
            messages: [
                {
                    role: "user",
                    content: prompt.prompt
                }
            ]
        };
    }
    if (prompt.messages != null) {
        const promptType = detectPromptType(prompt.messages);
        if (promptType === "other") {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InvalidPromptError"]({
                prompt,
                message: "messages must be an array of CoreMessage or UIMessage"
            });
        }
        const messages = promptType === "ui-messages" ? convertToCoreMessages(prompt.messages, {
            tools
        }) : prompt.messages;
        const validationResult = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["safeValidateTypes"])({
            value: messages,
            schema: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$zod$40$3$2e$23$2e$7$2f$node_modules$2f$zod$2f$lib$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["z"].array(coreMessageSchema)
        });
        if (!validationResult.success) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["InvalidPromptError"]({
                prompt,
                message: "messages must be an array of CoreMessage or UIMessage",
                cause: validationResult.error
            });
        }
        return {
            type: "messages",
            messages,
            system: prompt.system
        };
    }
    throw new Error("unreachable");
}
// core/types/usage.ts
function calculateLanguageModelUsage({ promptTokens, completionTokens }) {
    return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
    };
}
// core/generate-object/inject-json-instruction.ts
var DEFAULT_SCHEMA_PREFIX = "JSON schema:";
var DEFAULT_SCHEMA_SUFFIX = "You MUST answer with a JSON object that matches the JSON schema above.";
var DEFAULT_GENERIC_SUFFIX = "You MUST answer with JSON.";
function injectJsonInstruction({ prompt, schema, schemaPrefix = schema != null ? DEFAULT_SCHEMA_PREFIX : void 0, schemaSuffix = schema != null ? DEFAULT_SCHEMA_SUFFIX : DEFAULT_GENERIC_SUFFIX }) {
    return [
        prompt != null && prompt.length > 0 ? prompt : void 0,
        prompt != null && prompt.length > 0 ? "" : void 0,
        // add a newline if prompt is not null
        schemaPrefix,
        schema != null ? JSON.stringify(schema) : void 0,
        schemaSuffix
    ].filter((line)=>line != null).join("\n");
}
;
var name7 = "AI_NoObjectGeneratedError";
var marker7 = `vercel.ai.error.${name7}`;
var symbol7 = Symbol.for(marker7);
var _a7;
var NoObjectGeneratedError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    // used in isInstance
    constructor({ message = "No object generated." } = {}){
        super({
            name: name7,
            message
        });
        this[_a7] = true;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker7);
    }
};
_a7 = symbol7;
;
;
;
// core/util/async-iterable-stream.ts
function createAsyncIterableStream(source, transformer) {
    const transformedStream = source.pipeThrough(new TransformStream(transformer));
    transformedStream[Symbol.asyncIterator] = ()=>{
        const reader = transformedStream.getReader();
        return {
            async next () {
                const { done, value } = await reader.read();
                return done ? {
                    done: true,
                    value: void 0
                } : {
                    done: false,
                    value
                };
            }
        };
    };
    return transformedStream;
}
// core/generate-object/output-strategy.ts
var noSchemaOutputStrategy = {
    type: "no-schema",
    jsonSchema: void 0,
    validatePartialResult ({ value, textDelta }) {
        return {
            success: true,
            value: {
                partial: value,
                textDelta
            }
        };
    },
    validateFinalResult (value) {
        return value === void 0 ? {
            success: false,
            error: new NoObjectGeneratedError()
        } : {
            success: true,
            value
        };
    },
    createElementStream () {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["UnsupportedFunctionalityError"]({
            functionality: "element streams in no-schema mode"
        });
    }
};
var objectOutputStrategy = (schema)=>({
        type: "object",
        jsonSchema: schema.jsonSchema,
        validatePartialResult ({ value, textDelta }) {
            return {
                success: true,
                value: {
                    // Note: currently no validation of partial results:
                    partial: value,
                    textDelta
                }
            };
        },
        validateFinalResult (value) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["safeValidateTypes"])({
                value,
                schema
            });
        },
        createElementStream () {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["UnsupportedFunctionalityError"]({
                functionality: "element streams in object mode"
            });
        }
    });
var arrayOutputStrategy = (schema)=>{
    const { $schema, ...itemSchema } = schema.jsonSchema;
    return {
        type: "enum",
        // wrap in object that contains array of elements, since most LLMs will not
        // be able to generate an array directly:
        // possible future optimization: use arrays directly when model supports grammar-guided generation
        jsonSchema: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
                elements: {
                    type: "array",
                    items: itemSchema
                }
            },
            required: [
                "elements"
            ],
            additionalProperties: false
        },
        validatePartialResult ({ value, latestObject, isFirstDelta, isFinalDelta }) {
            var _a13;
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isJSONObject"])(value) || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isJSONArray"])(value.elements)) {
                return {
                    success: false,
                    error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TypeValidationError"]({
                        value,
                        cause: "value must be an object that contains an array of elements"
                    })
                };
            }
            const inputArray = value.elements;
            const resultArray = [];
            for(let i = 0; i < inputArray.length; i++){
                const element = inputArray[i];
                const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["safeValidateTypes"])({
                    value: element,
                    schema
                });
                if (i === inputArray.length - 1 && !isFinalDelta) {
                    continue;
                }
                if (!result.success) {
                    return result;
                }
                resultArray.push(result.value);
            }
            const publishedElementCount = (_a13 = latestObject == null ? void 0 : latestObject.length) != null ? _a13 : 0;
            let textDelta = "";
            if (isFirstDelta) {
                textDelta += "[";
            }
            if (publishedElementCount > 0) {
                textDelta += ",";
            }
            textDelta += resultArray.slice(publishedElementCount).map((element)=>JSON.stringify(element)).join(",");
            if (isFinalDelta) {
                textDelta += "]";
            }
            return {
                success: true,
                value: {
                    partial: resultArray,
                    textDelta
                }
            };
        },
        validateFinalResult (value) {
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isJSONObject"])(value) || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isJSONArray"])(value.elements)) {
                return {
                    success: false,
                    error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TypeValidationError"]({
                        value,
                        cause: "value must be an object that contains an array of elements"
                    })
                };
            }
            const inputArray = value.elements;
            for (const element of inputArray){
                const result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["safeValidateTypes"])({
                    value: element,
                    schema
                });
                if (!result.success) {
                    return result;
                }
            }
            return {
                success: true,
                value: inputArray
            };
        },
        createElementStream (originalStream) {
            let publishedElements = 0;
            return createAsyncIterableStream(originalStream, {
                transform (chunk, controller) {
                    switch(chunk.type){
                        case "object":
                            {
                                const array = chunk.object;
                                for(; publishedElements < array.length; publishedElements++){
                                    controller.enqueue(array[publishedElements]);
                                }
                                break;
                            }
                        case "text-delta":
                        case "finish":
                            break;
                        case "error":
                            controller.error(chunk.error);
                            break;
                        default:
                            {
                                const _exhaustiveCheck = chunk;
                                throw new Error(`Unsupported chunk type: ${_exhaustiveCheck}`);
                            }
                    }
                }
            });
        }
    };
};
var enumOutputStrategy = (enumValues)=>{
    return {
        type: "enum",
        // wrap in object that contains result, since most LLMs will not
        // be able to generate an enum value directly:
        // possible future optimization: use enums directly when model supports top-level enums
        jsonSchema: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
                result: {
                    type: "string",
                    enum: enumValues
                }
            },
            required: [
                "result"
            ],
            additionalProperties: false
        },
        validateFinalResult (value) {
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isJSONObject"])(value) || typeof value.result !== "string") {
                return {
                    success: false,
                    error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TypeValidationError"]({
                        value,
                        cause: 'value must be an object that contains a string in the "result" property.'
                    })
                };
            }
            const result = value.result;
            return enumValues.includes(result) ? {
                success: true,
                value: result
            } : {
                success: false,
                error: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["TypeValidationError"]({
                    value,
                    cause: "value must be a string in the enum"
                })
            };
        },
        validatePartialResult () {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["UnsupportedFunctionalityError"]({
                functionality: "partial results in enum mode"
            });
        },
        createElementStream () {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["UnsupportedFunctionalityError"]({
                functionality: "element streams in enum mode"
            });
        }
    };
};
function getOutputStrategy({ output, schema, enumValues }) {
    switch(output){
        case "object":
            return objectOutputStrategy((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["asSchema"])(schema));
        case "array":
            return arrayOutputStrategy((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["asSchema"])(schema));
        case "enum":
            return enumOutputStrategy(enumValues);
        case "no-schema":
            return noSchemaOutputStrategy;
        default:
            {
                const _exhaustiveCheck = output;
                throw new Error(`Unsupported output: ${_exhaustiveCheck}`);
            }
    }
}
// core/generate-object/validate-object-generation-input.ts
function validateObjectGenerationInput({ output, mode, schema, schemaName, schemaDescription, enumValues }) {
    if (output != null && output !== "object" && output !== "array" && output !== "enum" && output !== "no-schema") {
        throw new InvalidArgumentError({
            parameter: "output",
            value: output,
            message: "Invalid output type."
        });
    }
    if (output === "no-schema") {
        if (mode === "auto" || mode === "tool") {
            throw new InvalidArgumentError({
                parameter: "mode",
                value: mode,
                message: 'Mode must be "json" for no-schema output.'
            });
        }
        if (schema != null) {
            throw new InvalidArgumentError({
                parameter: "schema",
                value: schema,
                message: "Schema is not supported for no-schema output."
            });
        }
        if (schemaDescription != null) {
            throw new InvalidArgumentError({
                parameter: "schemaDescription",
                value: schemaDescription,
                message: "Schema description is not supported for no-schema output."
            });
        }
        if (schemaName != null) {
            throw new InvalidArgumentError({
                parameter: "schemaName",
                value: schemaName,
                message: "Schema name is not supported for no-schema output."
            });
        }
        if (enumValues != null) {
            throw new InvalidArgumentError({
                parameter: "enumValues",
                value: enumValues,
                message: "Enum values are not supported for no-schema output."
            });
        }
    }
    if (output === "object") {
        if (schema == null) {
            throw new InvalidArgumentError({
                parameter: "schema",
                value: schema,
                message: "Schema is required for object output."
            });
        }
        if (enumValues != null) {
            throw new InvalidArgumentError({
                parameter: "enumValues",
                value: enumValues,
                message: "Enum values are not supported for object output."
            });
        }
    }
    if (output === "array") {
        if (schema == null) {
            throw new InvalidArgumentError({
                parameter: "schema",
                value: schema,
                message: "Element schema is required for array output."
            });
        }
        if (enumValues != null) {
            throw new InvalidArgumentError({
                parameter: "enumValues",
                value: enumValues,
                message: "Enum values are not supported for array output."
            });
        }
    }
    if (output === "enum") {
        if (schema != null) {
            throw new InvalidArgumentError({
                parameter: "schema",
                value: schema,
                message: "Schema is not supported for enum output."
            });
        }
        if (schemaDescription != null) {
            throw new InvalidArgumentError({
                parameter: "schemaDescription",
                value: schemaDescription,
                message: "Schema description is not supported for enum output."
            });
        }
        if (schemaName != null) {
            throw new InvalidArgumentError({
                parameter: "schemaName",
                value: schemaName,
                message: "Schema name is not supported for enum output."
            });
        }
        if (enumValues == null) {
            throw new InvalidArgumentError({
                parameter: "enumValues",
                value: enumValues,
                message: "Enum values are required for enum output."
            });
        }
        for (const value of enumValues){
            if (typeof value !== "string") {
                throw new InvalidArgumentError({
                    parameter: "enumValues",
                    value,
                    message: "Enum values must be strings."
                });
            }
        }
    }
}
// core/generate-object/generate-object.ts
var originalGenerateId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createIdGenerator"])({
    prefix: "aiobj",
    size: 24
});
async function generateObject({ model, enum: enumValues, // rename bc enum is reserved by typescript
schema: inputSchema, schemaName, schemaDescription, mode, output = "object", system, prompt, messages, maxRetries: maxRetriesArg, abortSignal, headers, experimental_telemetry: telemetry, experimental_providerMetadata: providerMetadata, _internal: { generateId: generateId3 = originalGenerateId, currentDate = ()=>/* @__PURE__ */ new Date() } = {}, ...settings }) {
    validateObjectGenerationInput({
        output,
        mode,
        schema: inputSchema,
        schemaName,
        schemaDescription,
        enumValues
    });
    const { maxRetries, retry } = prepareRetries({
        maxRetries: maxRetriesArg
    });
    const outputStrategy = getOutputStrategy({
        output,
        schema: inputSchema,
        enumValues
    });
    if (outputStrategy.type === "no-schema" && mode === void 0) {
        mode = "json";
    }
    const baseTelemetryAttributes = getBaseTelemetryAttributes({
        model,
        telemetry,
        headers,
        settings: {
            ...settings,
            maxRetries
        }
    });
    const tracer = getTracer(telemetry);
    return recordSpan({
        name: "ai.generateObject",
        attributes: selectTelemetryAttributes({
            telemetry,
            attributes: {
                ...assembleOperationName({
                    operationId: "ai.generateObject",
                    telemetry
                }),
                ...baseTelemetryAttributes,
                // specific settings that only make sense on the outer level:
                "ai.prompt": {
                    input: ()=>JSON.stringify({
                            system,
                            prompt,
                            messages
                        })
                },
                "ai.schema": outputStrategy.jsonSchema != null ? {
                    input: ()=>JSON.stringify(outputStrategy.jsonSchema)
                } : void 0,
                "ai.schema.name": schemaName,
                "ai.schema.description": schemaDescription,
                "ai.settings.output": outputStrategy.type,
                "ai.settings.mode": mode
            }
        }),
        tracer,
        fn: async (span)=>{
            var _a13, _b;
            if (mode === "auto" || mode == null) {
                mode = model.defaultObjectGenerationMode;
            }
            let result;
            let finishReason;
            let usage;
            let warnings;
            let rawResponse;
            let response;
            let request;
            let logprobs;
            let resultProviderMetadata;
            switch(mode){
                case "json":
                    {
                        const standardizedPrompt = standardizePrompt({
                            prompt: {
                                system: outputStrategy.jsonSchema == null ? injectJsonInstruction({
                                    prompt: system
                                }) : model.supportsStructuredOutputs ? system : injectJsonInstruction({
                                    prompt: system,
                                    schema: outputStrategy.jsonSchema
                                }),
                                prompt,
                                messages
                            },
                            tools: void 0
                        });
                        const promptMessages = await convertToLanguageModelPrompt({
                            prompt: standardizedPrompt,
                            modelSupportsImageUrls: model.supportsImageUrls,
                            modelSupportsUrl: model.supportsUrl
                        });
                        const generateResult = await retry(()=>recordSpan({
                                name: "ai.generateObject.doGenerate",
                                attributes: selectTelemetryAttributes({
                                    telemetry,
                                    attributes: {
                                        ...assembleOperationName({
                                            operationId: "ai.generateObject.doGenerate",
                                            telemetry
                                        }),
                                        ...baseTelemetryAttributes,
                                        "ai.prompt.format": {
                                            input: ()=>standardizedPrompt.type
                                        },
                                        "ai.prompt.messages": {
                                            input: ()=>JSON.stringify(promptMessages)
                                        },
                                        "ai.settings.mode": mode,
                                        // standardized gen-ai llm span attributes:
                                        "gen_ai.system": model.provider,
                                        "gen_ai.request.model": model.modelId,
                                        "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                                        "gen_ai.request.max_tokens": settings.maxTokens,
                                        "gen_ai.request.presence_penalty": settings.presencePenalty,
                                        "gen_ai.request.temperature": settings.temperature,
                                        "gen_ai.request.top_k": settings.topK,
                                        "gen_ai.request.top_p": settings.topP
                                    }
                                }),
                                tracer,
                                fn: async (span2)=>{
                                    var _a14, _b2, _c, _d, _e, _f;
                                    const result2 = await model.doGenerate({
                                        mode: {
                                            type: "object-json",
                                            schema: outputStrategy.jsonSchema,
                                            name: schemaName,
                                            description: schemaDescription
                                        },
                                        ...prepareCallSettings(settings),
                                        inputFormat: standardizedPrompt.type,
                                        prompt: promptMessages,
                                        providerMetadata,
                                        abortSignal,
                                        headers
                                    });
                                    if (result2.text === void 0) {
                                        throw new NoObjectGeneratedError();
                                    }
                                    const responseData = {
                                        id: (_b2 = (_a14 = result2.response) == null ? void 0 : _a14.id) != null ? _b2 : generateId3(),
                                        timestamp: (_d = (_c = result2.response) == null ? void 0 : _c.timestamp) != null ? _d : currentDate(),
                                        modelId: (_f = (_e = result2.response) == null ? void 0 : _e.modelId) != null ? _f : model.modelId
                                    };
                                    span2.setAttributes(selectTelemetryAttributes({
                                        telemetry,
                                        attributes: {
                                            "ai.response.finishReason": result2.finishReason,
                                            "ai.response.object": {
                                                output: ()=>result2.text
                                            },
                                            "ai.response.id": responseData.id,
                                            "ai.response.model": responseData.modelId,
                                            "ai.response.timestamp": responseData.timestamp.toISOString(),
                                            "ai.usage.promptTokens": result2.usage.promptTokens,
                                            "ai.usage.completionTokens": result2.usage.completionTokens,
                                            // standardized gen-ai llm span attributes:
                                            "gen_ai.response.finish_reasons": [
                                                result2.finishReason
                                            ],
                                            "gen_ai.response.id": responseData.id,
                                            "gen_ai.response.model": responseData.modelId,
                                            "gen_ai.usage.prompt_tokens": result2.usage.promptTokens,
                                            "gen_ai.usage.completion_tokens": result2.usage.completionTokens
                                        }
                                    }));
                                    return {
                                        ...result2,
                                        objectText: result2.text,
                                        responseData
                                    };
                                }
                            }));
                        result = generateResult.objectText;
                        finishReason = generateResult.finishReason;
                        usage = generateResult.usage;
                        warnings = generateResult.warnings;
                        rawResponse = generateResult.rawResponse;
                        logprobs = generateResult.logprobs;
                        resultProviderMetadata = generateResult.providerMetadata;
                        request = (_a13 = generateResult.request) != null ? _a13 : {};
                        response = generateResult.responseData;
                        break;
                    }
                case "tool":
                    {
                        const standardizedPrompt = standardizePrompt({
                            prompt: {
                                system,
                                prompt,
                                messages
                            },
                            tools: void 0
                        });
                        const promptMessages = await convertToLanguageModelPrompt({
                            prompt: standardizedPrompt,
                            modelSupportsImageUrls: model.supportsImageUrls,
                            modelSupportsUrl: model.supportsUrl
                        });
                        const inputFormat = standardizedPrompt.type;
                        const generateResult = await retry(()=>recordSpan({
                                name: "ai.generateObject.doGenerate",
                                attributes: selectTelemetryAttributes({
                                    telemetry,
                                    attributes: {
                                        ...assembleOperationName({
                                            operationId: "ai.generateObject.doGenerate",
                                            telemetry
                                        }),
                                        ...baseTelemetryAttributes,
                                        "ai.prompt.format": {
                                            input: ()=>inputFormat
                                        },
                                        "ai.prompt.messages": {
                                            input: ()=>JSON.stringify(promptMessages)
                                        },
                                        "ai.settings.mode": mode,
                                        // standardized gen-ai llm span attributes:
                                        "gen_ai.system": model.provider,
                                        "gen_ai.request.model": model.modelId,
                                        "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                                        "gen_ai.request.max_tokens": settings.maxTokens,
                                        "gen_ai.request.presence_penalty": settings.presencePenalty,
                                        "gen_ai.request.temperature": settings.temperature,
                                        "gen_ai.request.top_k": settings.topK,
                                        "gen_ai.request.top_p": settings.topP
                                    }
                                }),
                                tracer,
                                fn: async (span2)=>{
                                    var _a14, _b2, _c, _d, _e, _f, _g, _h;
                                    const result2 = await model.doGenerate({
                                        mode: {
                                            type: "object-tool",
                                            tool: {
                                                type: "function",
                                                name: schemaName != null ? schemaName : "json",
                                                description: schemaDescription != null ? schemaDescription : "Respond with a JSON object.",
                                                parameters: outputStrategy.jsonSchema
                                            }
                                        },
                                        ...prepareCallSettings(settings),
                                        inputFormat,
                                        prompt: promptMessages,
                                        providerMetadata,
                                        abortSignal,
                                        headers
                                    });
                                    const objectText = (_b2 = (_a14 = result2.toolCalls) == null ? void 0 : _a14[0]) == null ? void 0 : _b2.args;
                                    if (objectText === void 0) {
                                        throw new NoObjectGeneratedError();
                                    }
                                    const responseData = {
                                        id: (_d = (_c = result2.response) == null ? void 0 : _c.id) != null ? _d : generateId3(),
                                        timestamp: (_f = (_e = result2.response) == null ? void 0 : _e.timestamp) != null ? _f : currentDate(),
                                        modelId: (_h = (_g = result2.response) == null ? void 0 : _g.modelId) != null ? _h : model.modelId
                                    };
                                    span2.setAttributes(selectTelemetryAttributes({
                                        telemetry,
                                        attributes: {
                                            "ai.response.finishReason": result2.finishReason,
                                            "ai.response.object": {
                                                output: ()=>objectText
                                            },
                                            "ai.response.id": responseData.id,
                                            "ai.response.model": responseData.modelId,
                                            "ai.response.timestamp": responseData.timestamp.toISOString(),
                                            "ai.usage.promptTokens": result2.usage.promptTokens,
                                            "ai.usage.completionTokens": result2.usage.completionTokens,
                                            // standardized gen-ai llm span attributes:
                                            "gen_ai.response.finish_reasons": [
                                                result2.finishReason
                                            ],
                                            "gen_ai.response.id": responseData.id,
                                            "gen_ai.response.model": responseData.modelId,
                                            "gen_ai.usage.input_tokens": result2.usage.promptTokens,
                                            "gen_ai.usage.output_tokens": result2.usage.completionTokens
                                        }
                                    }));
                                    return {
                                        ...result2,
                                        objectText,
                                        responseData
                                    };
                                }
                            }));
                        result = generateResult.objectText;
                        finishReason = generateResult.finishReason;
                        usage = generateResult.usage;
                        warnings = generateResult.warnings;
                        rawResponse = generateResult.rawResponse;
                        logprobs = generateResult.logprobs;
                        resultProviderMetadata = generateResult.providerMetadata;
                        request = (_b = generateResult.request) != null ? _b : {};
                        response = generateResult.responseData;
                        break;
                    }
                case void 0:
                    {
                        throw new Error("Model does not have a default object generation mode.");
                    }
                default:
                    {
                        const _exhaustiveCheck = mode;
                        throw new Error(`Unsupported mode: ${_exhaustiveCheck}`);
                    }
            }
            const parseResult = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["safeParseJSON"])({
                text: result
            });
            if (!parseResult.success) {
                throw parseResult.error;
            }
            const validationResult = outputStrategy.validateFinalResult(parseResult.value);
            if (!validationResult.success) {
                throw validationResult.error;
            }
            span.setAttributes(selectTelemetryAttributes({
                telemetry,
                attributes: {
                    "ai.response.finishReason": finishReason,
                    "ai.response.object": {
                        output: ()=>JSON.stringify(validationResult.value)
                    },
                    "ai.usage.promptTokens": usage.promptTokens,
                    "ai.usage.completionTokens": usage.completionTokens
                }
            }));
            return new DefaultGenerateObjectResult({
                object: validationResult.value,
                finishReason,
                usage: calculateLanguageModelUsage(usage),
                warnings,
                request,
                response: {
                    ...response,
                    headers: rawResponse == null ? void 0 : rawResponse.headers
                },
                logprobs,
                providerMetadata: resultProviderMetadata
            });
        }
    });
}
var DefaultGenerateObjectResult = class {
    constructor(options){
        this.object = options.object;
        this.finishReason = options.finishReason;
        this.usage = options.usage;
        this.warnings = options.warnings;
        this.experimental_providerMetadata = options.providerMetadata;
        this.response = options.response;
        this.request = options.request;
        this.logprobs = options.logprobs;
    }
    toJsonResponse(init) {
        var _a13;
        return new Response(JSON.stringify(this.object), {
            status: (_a13 = init == null ? void 0 : init.status) != null ? _a13 : 200,
            headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
                contentType: "application/json; charset=utf-8"
            })
        });
    }
};
;
;
// util/delayed-promise.ts
var DelayedPromise = class {
    constructor(){
        this.status = {
            type: "pending"
        };
        this._resolve = void 0;
        this._reject = void 0;
    }
    get value() {
        if (this.promise) {
            return this.promise;
        }
        this.promise = new Promise((resolve, reject)=>{
            if (this.status.type === "resolved") {
                resolve(this.status.value);
            } else if (this.status.type === "rejected") {
                reject(this.status.error);
            }
            this._resolve = resolve;
            this._reject = reject;
        });
        return this.promise;
    }
    resolve(value) {
        var _a13;
        this.status = {
            type: "resolved",
            value
        };
        if (this.promise) {
            (_a13 = this._resolve) == null ? void 0 : _a13.call(this, value);
        }
    }
    reject(error) {
        var _a13;
        this.status = {
            type: "rejected",
            error
        };
        if (this.promise) {
            (_a13 = this._reject) == null ? void 0 : _a13.call(this, error);
        }
    }
};
// util/create-resolvable-promise.ts
function createResolvablePromise() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej)=>{
        resolve = res;
        reject = rej;
    });
    return {
        promise,
        resolve,
        reject
    };
}
// core/util/create-stitchable-stream.ts
function createStitchableStream() {
    let innerStreamReaders = [];
    let controller = null;
    let isClosed = false;
    let waitForNewStream = createResolvablePromise();
    const processPull = async ()=>{
        if (isClosed && innerStreamReaders.length === 0) {
            controller == null ? void 0 : controller.close();
            return;
        }
        if (innerStreamReaders.length === 0) {
            waitForNewStream = createResolvablePromise();
            await waitForNewStream.promise;
            return processPull();
        }
        try {
            const { value, done } = await innerStreamReaders[0].read();
            if (done) {
                innerStreamReaders.shift();
                if (innerStreamReaders.length > 0) {
                    await processPull();
                } else if (isClosed) {
                    controller == null ? void 0 : controller.close();
                }
            } else {
                controller == null ? void 0 : controller.enqueue(value);
            }
        } catch (error) {
            controller == null ? void 0 : controller.error(error);
            innerStreamReaders.shift();
            if (isClosed && innerStreamReaders.length === 0) {
                controller == null ? void 0 : controller.close();
            }
        }
    };
    return {
        stream: new ReadableStream({
            start (controllerParam) {
                controller = controllerParam;
            },
            pull: processPull,
            async cancel () {
                for (const reader of innerStreamReaders){
                    await reader.cancel();
                }
                innerStreamReaders = [];
                isClosed = true;
            }
        }),
        addStream: (innerStream)=>{
            if (isClosed) {
                throw new Error("Cannot add inner stream: outer stream is closed");
            }
            innerStreamReaders.push(innerStream.getReader());
            waitForNewStream.resolve();
        },
        close: ()=>{
            isClosed = true;
            waitForNewStream.resolve();
            if (innerStreamReaders.length === 0) {
                controller == null ? void 0 : controller.close();
            }
        }
    };
}
// core/util/now.ts
function now() {
    var _a13, _b;
    return (_b = (_a13 = globalThis == null ? void 0 : globalThis.performance) == null ? void 0 : _a13.now()) != null ? _b : Date.now();
}
// core/generate-object/stream-object.ts
var originalGenerateId2 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createIdGenerator"])({
    prefix: "aiobj",
    size: 24
});
function streamObject({ model, schema: inputSchema, schemaName, schemaDescription, mode, output = "object", system, prompt, messages, maxRetries, abortSignal, headers, experimental_telemetry: telemetry, experimental_providerMetadata: providerMetadata, onFinish, _internal: { generateId: generateId3 = originalGenerateId2, currentDate = ()=>/* @__PURE__ */ new Date(), now: now2 = now } = {}, ...settings }) {
    validateObjectGenerationInput({
        output,
        mode,
        schema: inputSchema,
        schemaName,
        schemaDescription
    });
    const outputStrategy = getOutputStrategy({
        output,
        schema: inputSchema
    });
    if (outputStrategy.type === "no-schema" && mode === void 0) {
        mode = "json";
    }
    return new DefaultStreamObjectResult({
        model,
        telemetry,
        headers,
        settings,
        maxRetries,
        abortSignal,
        outputStrategy,
        system,
        prompt,
        messages,
        schemaName,
        schemaDescription,
        inputProviderMetadata: providerMetadata,
        mode,
        onFinish,
        generateId: generateId3,
        currentDate,
        now: now2
    });
}
var DefaultStreamObjectResult = class {
    constructor({ model, headers, telemetry, settings, maxRetries: maxRetriesArg, abortSignal, outputStrategy, system, prompt, messages, schemaName, schemaDescription, inputProviderMetadata, mode, onFinish, generateId: generateId3, currentDate, now: now2 }){
        this.objectPromise = new DelayedPromise();
        this.usagePromise = new DelayedPromise();
        this.providerMetadataPromise = new DelayedPromise();
        this.warningsPromise = new DelayedPromise();
        this.requestPromise = new DelayedPromise();
        this.responsePromise = new DelayedPromise();
        this.stitchableStream = createStitchableStream();
        const { maxRetries, retry } = prepareRetries({
            maxRetries: maxRetriesArg
        });
        const baseTelemetryAttributes = getBaseTelemetryAttributes({
            model,
            telemetry,
            headers,
            settings: {
                ...settings,
                maxRetries
            }
        });
        const tracer = getTracer(telemetry);
        const self = this;
        recordSpan({
            name: "ai.streamObject",
            attributes: selectTelemetryAttributes({
                telemetry,
                attributes: {
                    ...assembleOperationName({
                        operationId: "ai.streamObject",
                        telemetry
                    }),
                    ...baseTelemetryAttributes,
                    // specific settings that only make sense on the outer level:
                    "ai.prompt": {
                        input: ()=>JSON.stringify({
                                system,
                                prompt,
                                messages
                            })
                    },
                    "ai.schema": outputStrategy.jsonSchema != null ? {
                        input: ()=>JSON.stringify(outputStrategy.jsonSchema)
                    } : void 0,
                    "ai.schema.name": schemaName,
                    "ai.schema.description": schemaDescription,
                    "ai.settings.output": outputStrategy.type,
                    "ai.settings.mode": mode
                }
            }),
            tracer,
            endWhenDone: false,
            fn: async (rootSpan)=>{
                if (mode === "auto" || mode == null) {
                    mode = model.defaultObjectGenerationMode;
                }
                let callOptions;
                let transformer;
                switch(mode){
                    case "json":
                        {
                            const standardizedPrompt = standardizePrompt({
                                prompt: {
                                    system: outputStrategy.jsonSchema == null ? injectJsonInstruction({
                                        prompt: system
                                    }) : model.supportsStructuredOutputs ? system : injectJsonInstruction({
                                        prompt: system,
                                        schema: outputStrategy.jsonSchema
                                    }),
                                    prompt,
                                    messages
                                },
                                tools: void 0
                            });
                            callOptions = {
                                mode: {
                                    type: "object-json",
                                    schema: outputStrategy.jsonSchema,
                                    name: schemaName,
                                    description: schemaDescription
                                },
                                ...prepareCallSettings(settings),
                                inputFormat: standardizedPrompt.type,
                                prompt: await convertToLanguageModelPrompt({
                                    prompt: standardizedPrompt,
                                    modelSupportsImageUrls: model.supportsImageUrls,
                                    modelSupportsUrl: model.supportsUrl
                                }),
                                providerMetadata: inputProviderMetadata,
                                abortSignal,
                                headers
                            };
                            transformer = {
                                transform: (chunk, controller)=>{
                                    switch(chunk.type){
                                        case "text-delta":
                                            controller.enqueue(chunk.textDelta);
                                            break;
                                        case "response-metadata":
                                        case "finish":
                                        case "error":
                                            controller.enqueue(chunk);
                                            break;
                                    }
                                }
                            };
                            break;
                        }
                    case "tool":
                        {
                            const standardizedPrompt = standardizePrompt({
                                prompt: {
                                    system,
                                    prompt,
                                    messages
                                },
                                tools: void 0
                            });
                            callOptions = {
                                mode: {
                                    type: "object-tool",
                                    tool: {
                                        type: "function",
                                        name: schemaName != null ? schemaName : "json",
                                        description: schemaDescription != null ? schemaDescription : "Respond with a JSON object.",
                                        parameters: outputStrategy.jsonSchema
                                    }
                                },
                                ...prepareCallSettings(settings),
                                inputFormat: standardizedPrompt.type,
                                prompt: await convertToLanguageModelPrompt({
                                    prompt: standardizedPrompt,
                                    modelSupportsImageUrls: model.supportsImageUrls,
                                    modelSupportsUrl: model.supportsUrl
                                }),
                                providerMetadata: inputProviderMetadata,
                                abortSignal,
                                headers
                            };
                            transformer = {
                                transform (chunk, controller) {
                                    switch(chunk.type){
                                        case "tool-call-delta":
                                            controller.enqueue(chunk.argsTextDelta);
                                            break;
                                        case "response-metadata":
                                        case "finish":
                                        case "error":
                                            controller.enqueue(chunk);
                                            break;
                                    }
                                }
                            };
                            break;
                        }
                    case void 0:
                        {
                            throw new Error("Model does not have a default object generation mode.");
                        }
                    default:
                        {
                            const _exhaustiveCheck = mode;
                            throw new Error(`Unsupported mode: ${_exhaustiveCheck}`);
                        }
                }
                const { result: { stream, warnings, rawResponse, request }, doStreamSpan, startTimestampMs } = await retry(()=>recordSpan({
                        name: "ai.streamObject.doStream",
                        attributes: selectTelemetryAttributes({
                            telemetry,
                            attributes: {
                                ...assembleOperationName({
                                    operationId: "ai.streamObject.doStream",
                                    telemetry
                                }),
                                ...baseTelemetryAttributes,
                                "ai.prompt.format": {
                                    input: ()=>callOptions.inputFormat
                                },
                                "ai.prompt.messages": {
                                    input: ()=>JSON.stringify(callOptions.prompt)
                                },
                                "ai.settings.mode": mode,
                                // standardized gen-ai llm span attributes:
                                "gen_ai.system": model.provider,
                                "gen_ai.request.model": model.modelId,
                                "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                                "gen_ai.request.max_tokens": settings.maxTokens,
                                "gen_ai.request.presence_penalty": settings.presencePenalty,
                                "gen_ai.request.temperature": settings.temperature,
                                "gen_ai.request.top_k": settings.topK,
                                "gen_ai.request.top_p": settings.topP
                            }
                        }),
                        tracer,
                        endWhenDone: false,
                        fn: async (doStreamSpan2)=>({
                                startTimestampMs: now2(),
                                doStreamSpan: doStreamSpan2,
                                result: await model.doStream(callOptions)
                            })
                    }));
                self.requestPromise.resolve(request != null ? request : {});
                let usage;
                let finishReason;
                let providerMetadata;
                let object2;
                let error;
                let accumulatedText = "";
                let textDelta = "";
                let response = {
                    id: generateId3(),
                    timestamp: currentDate(),
                    modelId: model.modelId
                };
                let latestObjectJson = void 0;
                let latestObject = void 0;
                let isFirstChunk = true;
                let isFirstDelta = true;
                const transformedStream = stream.pipeThrough(new TransformStream(transformer)).pipeThrough(new TransformStream({
                    async transform (chunk, controller) {
                        var _a13, _b, _c;
                        if (isFirstChunk) {
                            const msToFirstChunk = now2() - startTimestampMs;
                            isFirstChunk = false;
                            doStreamSpan.addEvent("ai.stream.firstChunk", {
                                "ai.stream.msToFirstChunk": msToFirstChunk
                            });
                            doStreamSpan.setAttributes({
                                "ai.stream.msToFirstChunk": msToFirstChunk
                            });
                        }
                        if (typeof chunk === "string") {
                            accumulatedText += chunk;
                            textDelta += chunk;
                            const { value: currentObjectJson, state: parseState } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["parsePartialJson"])(accumulatedText);
                            if (currentObjectJson !== void 0 && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isDeepEqualData"])(latestObjectJson, currentObjectJson)) {
                                const validationResult = outputStrategy.validatePartialResult({
                                    value: currentObjectJson,
                                    textDelta,
                                    latestObject,
                                    isFirstDelta,
                                    isFinalDelta: parseState === "successful-parse"
                                });
                                if (validationResult.success && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isDeepEqualData"])(latestObject, validationResult.value.partial)) {
                                    latestObjectJson = currentObjectJson;
                                    latestObject = validationResult.value.partial;
                                    controller.enqueue({
                                        type: "object",
                                        object: latestObject
                                    });
                                    controller.enqueue({
                                        type: "text-delta",
                                        textDelta: validationResult.value.textDelta
                                    });
                                    textDelta = "";
                                    isFirstDelta = false;
                                }
                            }
                            return;
                        }
                        switch(chunk.type){
                            case "response-metadata":
                                {
                                    response = {
                                        id: (_a13 = chunk.id) != null ? _a13 : response.id,
                                        timestamp: (_b = chunk.timestamp) != null ? _b : response.timestamp,
                                        modelId: (_c = chunk.modelId) != null ? _c : response.modelId
                                    };
                                    break;
                                }
                            case "finish":
                                {
                                    if (textDelta !== "") {
                                        controller.enqueue({
                                            type: "text-delta",
                                            textDelta
                                        });
                                    }
                                    finishReason = chunk.finishReason;
                                    usage = calculateLanguageModelUsage(chunk.usage);
                                    providerMetadata = chunk.providerMetadata;
                                    controller.enqueue({
                                        ...chunk,
                                        usage,
                                        response
                                    });
                                    self.usagePromise.resolve(usage);
                                    self.providerMetadataPromise.resolve(providerMetadata);
                                    self.responsePromise.resolve({
                                        ...response,
                                        headers: rawResponse == null ? void 0 : rawResponse.headers
                                    });
                                    const validationResult = outputStrategy.validateFinalResult(latestObjectJson);
                                    if (validationResult.success) {
                                        object2 = validationResult.value;
                                        self.objectPromise.resolve(object2);
                                    } else {
                                        error = validationResult.error;
                                        self.objectPromise.reject(error);
                                    }
                                    break;
                                }
                            default:
                                {
                                    controller.enqueue(chunk);
                                    break;
                                }
                        }
                    },
                    // invoke onFinish callback and resolve toolResults promise when the stream is about to close:
                    async flush (controller) {
                        try {
                            const finalUsage = usage != null ? usage : {
                                promptTokens: NaN,
                                completionTokens: NaN,
                                totalTokens: NaN
                            };
                            doStreamSpan.setAttributes(selectTelemetryAttributes({
                                telemetry,
                                attributes: {
                                    "ai.response.finishReason": finishReason,
                                    "ai.response.object": {
                                        output: ()=>JSON.stringify(object2)
                                    },
                                    "ai.response.id": response.id,
                                    "ai.response.model": response.modelId,
                                    "ai.response.timestamp": response.timestamp.toISOString(),
                                    "ai.usage.promptTokens": finalUsage.promptTokens,
                                    "ai.usage.completionTokens": finalUsage.completionTokens,
                                    // standardized gen-ai llm span attributes:
                                    "gen_ai.response.finish_reasons": [
                                        finishReason
                                    ],
                                    "gen_ai.response.id": response.id,
                                    "gen_ai.response.model": response.modelId,
                                    "gen_ai.usage.input_tokens": finalUsage.promptTokens,
                                    "gen_ai.usage.output_tokens": finalUsage.completionTokens
                                }
                            }));
                            doStreamSpan.end();
                            rootSpan.setAttributes(selectTelemetryAttributes({
                                telemetry,
                                attributes: {
                                    "ai.usage.promptTokens": finalUsage.promptTokens,
                                    "ai.usage.completionTokens": finalUsage.completionTokens,
                                    "ai.response.object": {
                                        output: ()=>JSON.stringify(object2)
                                    }
                                }
                            }));
                            await (onFinish == null ? void 0 : onFinish({
                                usage: finalUsage,
                                object: object2,
                                error,
                                response: {
                                    ...response,
                                    headers: rawResponse == null ? void 0 : rawResponse.headers
                                },
                                warnings,
                                experimental_providerMetadata: providerMetadata
                            }));
                        } catch (error2) {
                            controller.error(error2);
                        } finally{
                            rootSpan.end();
                        }
                    }
                }));
                self.stitchableStream.addStream(transformedStream);
            }
        }).catch((error)=>{
            self.stitchableStream.addStream(new ReadableStream({
                start (controller) {
                    controller.error(error);
                }
            }));
        }).finally(()=>{
            self.stitchableStream.close();
        });
        this.outputStrategy = outputStrategy;
    }
    get object() {
        return this.objectPromise.value;
    }
    get usage() {
        return this.usagePromise.value;
    }
    get experimental_providerMetadata() {
        return this.providerMetadataPromise.value;
    }
    get warnings() {
        return this.warningsPromise.value;
    }
    get request() {
        return this.requestPromise.value;
    }
    get response() {
        return this.responsePromise.value;
    }
    get partialObjectStream() {
        return createAsyncIterableStream(this.stitchableStream.stream, {
            transform (chunk, controller) {
                switch(chunk.type){
                    case "object":
                        controller.enqueue(chunk.object);
                        break;
                    case "text-delta":
                    case "finish":
                        break;
                    case "error":
                        controller.error(chunk.error);
                        break;
                    default:
                        {
                            const _exhaustiveCheck = chunk;
                            throw new Error(`Unsupported chunk type: ${_exhaustiveCheck}`);
                        }
                }
            }
        });
    }
    get elementStream() {
        return this.outputStrategy.createElementStream(this.stitchableStream.stream);
    }
    get textStream() {
        return createAsyncIterableStream(this.stitchableStream.stream, {
            transform (chunk, controller) {
                switch(chunk.type){
                    case "text-delta":
                        controller.enqueue(chunk.textDelta);
                        break;
                    case "object":
                    case "finish":
                        break;
                    case "error":
                        controller.error(chunk.error);
                        break;
                    default:
                        {
                            const _exhaustiveCheck = chunk;
                            throw new Error(`Unsupported chunk type: ${_exhaustiveCheck}`);
                        }
                }
            }
        });
    }
    get fullStream() {
        return createAsyncIterableStream(this.stitchableStream.stream, {
            transform (chunk, controller) {
                controller.enqueue(chunk);
            }
        });
    }
    pipeTextStreamToResponse(response, init) {
        writeToServerResponse({
            response,
            status: init == null ? void 0 : init.status,
            statusText: init == null ? void 0 : init.statusText,
            headers: prepareOutgoingHttpHeaders(init == null ? void 0 : init.headers, {
                contentType: "text/plain; charset=utf-8"
            }),
            stream: this.textStream.pipeThrough(new TextEncoderStream())
        });
    }
    toTextStreamResponse(init) {
        var _a13;
        return new Response(this.textStream.pipeThrough(new TextEncoderStream()), {
            status: (_a13 = init == null ? void 0 : init.status) != null ? _a13 : 200,
            headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
                contentType: "text/plain; charset=utf-8"
            })
        });
    }
};
;
;
;
var name8 = "AI_InvalidToolArgumentsError";
var marker8 = `vercel.ai.error.${name8}`;
var symbol8 = Symbol.for(marker8);
var _a8;
var InvalidToolArgumentsError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ toolArgs, toolName, cause, message = `Invalid arguments for tool ${toolName}: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getErrorMessage"])(cause)}` }){
        super({
            name: name8,
            message,
            cause
        });
        this[_a8] = true;
        this.toolArgs = toolArgs;
        this.toolName = toolName;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker8);
    }
};
_a8 = symbol8;
;
var name9 = "AI_NoSuchToolError";
var marker9 = `vercel.ai.error.${name9}`;
var symbol9 = Symbol.for(marker9);
var _a9;
var NoSuchToolError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ toolName, availableTools = void 0, message = `Model tried to call unavailable tool '${toolName}'. ${availableTools === void 0 ? "No tools are available." : `Available tools: ${availableTools.join(", ")}.`}` }){
        super({
            name: name9,
            message
        });
        this[_a9] = true;
        this.toolName = toolName;
        this.availableTools = availableTools;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker9);
    }
};
_a9 = symbol9;
;
var name10 = "AI_ToolCallRepairError";
var marker10 = `vercel.ai.error.${name10}`;
var symbol10 = Symbol.for(marker10);
var _a10;
var ToolCallRepairError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ cause, originalError, message = `Error repairing tool call: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getErrorMessage"])(cause)}` }){
        super({
            name: name10,
            message,
            cause
        });
        this[_a10] = true;
        this.originalError = originalError;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker10);
    }
};
_a10 = symbol10;
;
var name11 = "AI_ToolExecutionError";
var marker11 = `vercel.ai.error.${name11}`;
var symbol11 = Symbol.for(marker11);
var _a11;
var ToolExecutionError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"] {
    constructor({ toolArgs, toolName, cause, message = `Error executing tool ${toolName}: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getErrorMessage"])(cause)}` }){
        super({
            name: name11,
            message,
            cause
        });
        this[_a11] = true;
        this.toolArgs = toolArgs;
        this.toolName = toolName;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker11);
    }
};
_a11 = symbol11;
;
// core/util/is-non-empty-object.ts
function isNonEmptyObject(object2) {
    return object2 != null && Object.keys(object2).length > 0;
}
// core/prompt/prepare-tools-and-tool-choice.ts
function prepareToolsAndToolChoice({ tools, toolChoice, activeTools }) {
    if (!isNonEmptyObject(tools)) {
        return {
            tools: void 0,
            toolChoice: void 0
        };
    }
    const filteredTools = activeTools != null ? Object.entries(tools).filter(([name13])=>activeTools.includes(name13)) : Object.entries(tools);
    return {
        tools: filteredTools.map(([name13, tool2])=>{
            const toolType = tool2.type;
            switch(toolType){
                case void 0:
                case "function":
                    return {
                        type: "function",
                        name: name13,
                        description: tool2.description,
                        parameters: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["asSchema"])(tool2.parameters).jsonSchema
                    };
                case "provider-defined":
                    return {
                        type: "provider-defined",
                        name: name13,
                        id: tool2.id,
                        args: tool2.args
                    };
                default:
                    {
                        const exhaustiveCheck = toolType;
                        throw new Error(`Unsupported tool type: ${exhaustiveCheck}`);
                    }
            }
        }),
        toolChoice: toolChoice == null ? {
            type: "auto"
        } : typeof toolChoice === "string" ? {
            type: toolChoice
        } : {
            type: "tool",
            toolName: toolChoice.toolName
        }
    };
}
// core/util/split-on-last-whitespace.ts
var lastWhitespaceRegexp = /^([\s\S]*?)(\s+)(\S*)$/;
function splitOnLastWhitespace(text2) {
    const match = text2.match(lastWhitespaceRegexp);
    return match ? {
        prefix: match[1],
        whitespace: match[2],
        suffix: match[3]
    } : void 0;
}
// core/util/remove-text-after-last-whitespace.ts
function removeTextAfterLastWhitespace(text2) {
    const match = splitOnLastWhitespace(text2);
    return match ? match.prefix + match.whitespace : text2;
}
;
;
async function parseToolCall({ toolCall, tools, repairToolCall, system, messages }) {
    if (tools == null) {
        throw new NoSuchToolError({
            toolName: toolCall.toolName
        });
    }
    try {
        return await doParseToolCall({
            toolCall,
            tools
        });
    } catch (error) {
        if (repairToolCall == null || !(NoSuchToolError.isInstance(error) || InvalidToolArgumentsError.isInstance(error))) {
            throw error;
        }
        let repairedToolCall = null;
        try {
            repairedToolCall = await repairToolCall({
                toolCall,
                tools,
                parameterSchema: ({ toolName })=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["asSchema"])(tools[toolName].parameters).jsonSchema,
                system,
                messages,
                error
            });
        } catch (repairError) {
            throw new ToolCallRepairError({
                cause: repairError,
                originalError: error
            });
        }
        if (repairedToolCall == null) {
            throw error;
        }
        return await doParseToolCall({
            toolCall: repairedToolCall,
            tools
        });
    }
}
async function doParseToolCall({ toolCall, tools }) {
    const toolName = toolCall.toolName;
    const tool2 = tools[toolName];
    if (tool2 == null) {
        throw new NoSuchToolError({
            toolName: toolCall.toolName,
            availableTools: Object.keys(tools)
        });
    }
    const schema = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["asSchema"])(tool2.parameters);
    const parseResult = toolCall.args.trim() === "" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["safeValidateTypes"])({
        value: {},
        schema
    }) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["safeParseJSON"])({
        text: toolCall.args,
        schema
    });
    if (parseResult.success === false) {
        throw new InvalidToolArgumentsError({
            toolName,
            toolArgs: toolCall.args,
            cause: parseResult.error
        });
    }
    return {
        type: "tool-call",
        toolCallId: toolCall.toolCallId,
        toolName,
        args: parseResult.value
    };
}
// core/generate-text/to-response-messages.ts
function toResponseMessages({ text: text2 = "", tools, toolCalls, toolResults }) {
    const responseMessages = [];
    responseMessages.push({
        role: "assistant",
        content: [
            {
                type: "text",
                text: text2
            },
            ...toolCalls
        ]
    });
    if (toolResults.length > 0) {
        responseMessages.push({
            role: "tool",
            content: toolResults.map((toolResult)=>{
                const tool2 = tools[toolResult.toolName];
                return (tool2 == null ? void 0 : tool2.experimental_toToolResultContent) != null ? {
                    type: "tool-result",
                    toolCallId: toolResult.toolCallId,
                    toolName: toolResult.toolName,
                    result: tool2.experimental_toToolResultContent(toolResult.result),
                    experimental_content: tool2.experimental_toToolResultContent(toolResult.result)
                } : {
                    type: "tool-result",
                    toolCallId: toolResult.toolCallId,
                    toolName: toolResult.toolName,
                    result: toolResult.result
                };
            })
        });
    }
    return responseMessages;
}
// core/generate-text/generate-text.ts
var originalGenerateId3 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createIdGenerator"])({
    prefix: "aitxt",
    size: 24
});
async function generateText({ model, tools, toolChoice, system, prompt, messages, maxRetries: maxRetriesArg, abortSignal, headers, maxSteps = 1, experimental_output: output, experimental_continueSteps: continueSteps = false, experimental_telemetry: telemetry, experimental_providerMetadata: providerMetadata, experimental_activeTools: activeTools, experimental_repairToolCall: repairToolCall, _internal: { generateId: generateId3 = originalGenerateId3, currentDate = ()=>/* @__PURE__ */ new Date() } = {}, onStepFinish, ...settings }) {
    var _a13;
    if (maxSteps < 1) {
        throw new InvalidArgumentError({
            parameter: "maxSteps",
            value: maxSteps,
            message: "maxSteps must be at least 1"
        });
    }
    const { maxRetries, retry } = prepareRetries({
        maxRetries: maxRetriesArg
    });
    const baseTelemetryAttributes = getBaseTelemetryAttributes({
        model,
        telemetry,
        headers,
        settings: {
            ...settings,
            maxRetries
        }
    });
    const initialPrompt = standardizePrompt({
        prompt: {
            system: (_a13 = output == null ? void 0 : output.injectIntoSystemPrompt({
                system,
                model
            })) != null ? _a13 : system,
            prompt,
            messages
        },
        tools
    });
    const tracer = getTracer(telemetry);
    return recordSpan({
        name: "ai.generateText",
        attributes: selectTelemetryAttributes({
            telemetry,
            attributes: {
                ...assembleOperationName({
                    operationId: "ai.generateText",
                    telemetry
                }),
                ...baseTelemetryAttributes,
                // specific settings that only make sense on the outer level:
                "ai.prompt": {
                    input: ()=>JSON.stringify({
                            system,
                            prompt,
                            messages
                        })
                },
                "ai.settings.maxSteps": maxSteps
            }
        }),
        tracer,
        fn: async (span)=>{
            var _a14, _b, _c, _d, _e, _f;
            const mode = {
                type: "regular",
                ...prepareToolsAndToolChoice({
                    tools,
                    toolChoice,
                    activeTools
                })
            };
            const callSettings = prepareCallSettings(settings);
            let currentModelResponse;
            let currentToolCalls = [];
            let currentToolResults = [];
            let stepCount = 0;
            const responseMessages = [];
            let text2 = "";
            const steps = [];
            const usage = {
                completionTokens: 0,
                promptTokens: 0,
                totalTokens: 0
            };
            let stepType = "initial";
            do {
                const promptFormat = stepCount === 0 ? initialPrompt.type : "messages";
                const stepInputMessages = [
                    ...initialPrompt.messages,
                    ...responseMessages
                ];
                const promptMessages = await convertToLanguageModelPrompt({
                    prompt: {
                        type: promptFormat,
                        system: initialPrompt.system,
                        messages: stepInputMessages
                    },
                    modelSupportsImageUrls: model.supportsImageUrls,
                    modelSupportsUrl: model.supportsUrl
                });
                currentModelResponse = await retry(()=>recordSpan({
                        name: "ai.generateText.doGenerate",
                        attributes: selectTelemetryAttributes({
                            telemetry,
                            attributes: {
                                ...assembleOperationName({
                                    operationId: "ai.generateText.doGenerate",
                                    telemetry
                                }),
                                ...baseTelemetryAttributes,
                                "ai.prompt.format": {
                                    input: ()=>promptFormat
                                },
                                "ai.prompt.messages": {
                                    input: ()=>JSON.stringify(promptMessages)
                                },
                                "ai.prompt.tools": {
                                    // convert the language model level tools:
                                    input: ()=>{
                                        var _a15;
                                        return (_a15 = mode.tools) == null ? void 0 : _a15.map((tool2)=>JSON.stringify(tool2));
                                    }
                                },
                                "ai.prompt.toolChoice": {
                                    input: ()=>mode.toolChoice != null ? JSON.stringify(mode.toolChoice) : void 0
                                },
                                // standardized gen-ai llm span attributes:
                                "gen_ai.system": model.provider,
                                "gen_ai.request.model": model.modelId,
                                "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                                "gen_ai.request.max_tokens": settings.maxTokens,
                                "gen_ai.request.presence_penalty": settings.presencePenalty,
                                "gen_ai.request.stop_sequences": settings.stopSequences,
                                "gen_ai.request.temperature": settings.temperature,
                                "gen_ai.request.top_k": settings.topK,
                                "gen_ai.request.top_p": settings.topP
                            }
                        }),
                        tracer,
                        fn: async (span2)=>{
                            var _a15, _b2, _c2, _d2, _e2, _f2;
                            const result = await model.doGenerate({
                                mode,
                                ...callSettings,
                                inputFormat: promptFormat,
                                responseFormat: output == null ? void 0 : output.responseFormat({
                                    model
                                }),
                                prompt: promptMessages,
                                providerMetadata,
                                abortSignal,
                                headers
                            });
                            const responseData = {
                                id: (_b2 = (_a15 = result.response) == null ? void 0 : _a15.id) != null ? _b2 : generateId3(),
                                timestamp: (_d2 = (_c2 = result.response) == null ? void 0 : _c2.timestamp) != null ? _d2 : currentDate(),
                                modelId: (_f2 = (_e2 = result.response) == null ? void 0 : _e2.modelId) != null ? _f2 : model.modelId
                            };
                            span2.setAttributes(selectTelemetryAttributes({
                                telemetry,
                                attributes: {
                                    "ai.response.finishReason": result.finishReason,
                                    "ai.response.text": {
                                        output: ()=>result.text
                                    },
                                    "ai.response.toolCalls": {
                                        output: ()=>JSON.stringify(result.toolCalls)
                                    },
                                    "ai.response.id": responseData.id,
                                    "ai.response.model": responseData.modelId,
                                    "ai.response.timestamp": responseData.timestamp.toISOString(),
                                    "ai.usage.promptTokens": result.usage.promptTokens,
                                    "ai.usage.completionTokens": result.usage.completionTokens,
                                    // standardized gen-ai llm span attributes:
                                    "gen_ai.response.finish_reasons": [
                                        result.finishReason
                                    ],
                                    "gen_ai.response.id": responseData.id,
                                    "gen_ai.response.model": responseData.modelId,
                                    "gen_ai.usage.input_tokens": result.usage.promptTokens,
                                    "gen_ai.usage.output_tokens": result.usage.completionTokens
                                }
                            }));
                            return {
                                ...result,
                                response: responseData
                            };
                        }
                    }));
                currentToolCalls = await Promise.all(((_a14 = currentModelResponse.toolCalls) != null ? _a14 : []).map((toolCall)=>parseToolCall({
                        toolCall,
                        tools,
                        repairToolCall,
                        system,
                        messages: stepInputMessages
                    })));
                currentToolResults = tools == null ? [] : await executeTools({
                    toolCalls: currentToolCalls,
                    tools,
                    tracer,
                    telemetry,
                    messages: stepInputMessages,
                    abortSignal
                });
                const currentUsage = calculateLanguageModelUsage(currentModelResponse.usage);
                usage.completionTokens += currentUsage.completionTokens;
                usage.promptTokens += currentUsage.promptTokens;
                usage.totalTokens += currentUsage.totalTokens;
                let nextStepType = "done";
                if (++stepCount < maxSteps) {
                    if (continueSteps && currentModelResponse.finishReason === "length" && // only use continue when there are no tool calls:
                    currentToolCalls.length === 0) {
                        nextStepType = "continue";
                    } else if (// there are tool calls:
                    currentToolCalls.length > 0 && // all current tool calls have results:
                    currentToolResults.length === currentToolCalls.length) {
                        nextStepType = "tool-result";
                    }
                }
                const originalText = (_b = currentModelResponse.text) != null ? _b : "";
                const stepTextLeadingWhitespaceTrimmed = stepType === "continue" && // only for continue steps
                text2.trimEnd() !== text2 ? originalText.trimStart() : originalText;
                const stepText = nextStepType === "continue" ? removeTextAfterLastWhitespace(stepTextLeadingWhitespaceTrimmed) : stepTextLeadingWhitespaceTrimmed;
                text2 = nextStepType === "continue" || stepType === "continue" ? text2 + stepText : stepText;
                if (stepType === "continue") {
                    const lastMessage = responseMessages[responseMessages.length - 1];
                    if (typeof lastMessage.content === "string") {
                        lastMessage.content += stepText;
                    } else {
                        lastMessage.content.push({
                            text: stepText,
                            type: "text"
                        });
                    }
                } else {
                    responseMessages.push(...toResponseMessages({
                        text: text2,
                        tools: tools != null ? tools : {},
                        toolCalls: currentToolCalls,
                        toolResults: currentToolResults
                    }));
                }
                const currentStepResult = {
                    stepType,
                    text: stepText,
                    toolCalls: currentToolCalls,
                    toolResults: currentToolResults,
                    finishReason: currentModelResponse.finishReason,
                    usage: currentUsage,
                    warnings: currentModelResponse.warnings,
                    logprobs: currentModelResponse.logprobs,
                    request: (_c = currentModelResponse.request) != null ? _c : {},
                    response: {
                        ...currentModelResponse.response,
                        headers: (_d = currentModelResponse.rawResponse) == null ? void 0 : _d.headers,
                        // deep clone msgs to avoid mutating past messages in multi-step:
                        messages: JSON.parse(JSON.stringify(responseMessages))
                    },
                    experimental_providerMetadata: currentModelResponse.providerMetadata,
                    isContinued: nextStepType === "continue"
                };
                steps.push(currentStepResult);
                await (onStepFinish == null ? void 0 : onStepFinish(currentStepResult));
                stepType = nextStepType;
            }while (stepType !== "done")
            span.setAttributes(selectTelemetryAttributes({
                telemetry,
                attributes: {
                    "ai.response.finishReason": currentModelResponse.finishReason,
                    "ai.response.text": {
                        output: ()=>currentModelResponse.text
                    },
                    "ai.response.toolCalls": {
                        output: ()=>JSON.stringify(currentModelResponse.toolCalls)
                    },
                    "ai.usage.promptTokens": currentModelResponse.usage.promptTokens,
                    "ai.usage.completionTokens": currentModelResponse.usage.completionTokens
                }
            }));
            return new DefaultGenerateTextResult({
                text: text2,
                output: output == null ? void 0 : output.parseOutput({
                    text: text2
                }),
                toolCalls: currentToolCalls,
                toolResults: currentToolResults,
                finishReason: currentModelResponse.finishReason,
                usage,
                warnings: currentModelResponse.warnings,
                request: (_e = currentModelResponse.request) != null ? _e : {},
                response: {
                    ...currentModelResponse.response,
                    headers: (_f = currentModelResponse.rawResponse) == null ? void 0 : _f.headers,
                    messages: responseMessages
                },
                logprobs: currentModelResponse.logprobs,
                steps,
                providerMetadata: currentModelResponse.providerMetadata
            });
        }
    });
}
async function executeTools({ toolCalls, tools, tracer, telemetry, messages, abortSignal }) {
    const toolResults = await Promise.all(toolCalls.map(async ({ toolCallId, toolName, args })=>{
        const tool2 = tools[toolName];
        if ((tool2 == null ? void 0 : tool2.execute) == null) {
            return void 0;
        }
        const result = await recordSpan({
            name: "ai.toolCall",
            attributes: selectTelemetryAttributes({
                telemetry,
                attributes: {
                    ...assembleOperationName({
                        operationId: "ai.toolCall",
                        telemetry
                    }),
                    "ai.toolCall.name": toolName,
                    "ai.toolCall.id": toolCallId,
                    "ai.toolCall.args": {
                        output: ()=>JSON.stringify(args)
                    }
                }
            }),
            tracer,
            fn: async (span)=>{
                try {
                    const result2 = await tool2.execute(args, {
                        toolCallId,
                        messages,
                        abortSignal
                    });
                    try {
                        span.setAttributes(selectTelemetryAttributes({
                            telemetry,
                            attributes: {
                                "ai.toolCall.result": {
                                    output: ()=>JSON.stringify(result2)
                                }
                            }
                        }));
                    } catch (ignored) {}
                    return result2;
                } catch (error) {
                    throw new ToolExecutionError({
                        toolName,
                        toolArgs: args,
                        cause: error
                    });
                }
            }
        });
        return {
            toolCallId,
            toolName,
            args,
            result
        };
    }));
    return toolResults.filter((result)=>result != null);
}
var DefaultGenerateTextResult = class {
    constructor(options){
        this.text = options.text;
        this.toolCalls = options.toolCalls;
        this.toolResults = options.toolResults;
        this.finishReason = options.finishReason;
        this.usage = options.usage;
        this.warnings = options.warnings;
        this.request = options.request;
        this.response = options.response;
        this.steps = options.steps;
        this.experimental_providerMetadata = options.providerMetadata;
        this.logprobs = options.logprobs;
        this.experimental_output = options.output;
    }
};
// core/generate-text/output.ts
var output_exports = {};
__export(output_exports, {
    object: ()=>object,
    text: ()=>text
});
;
;
var text = ()=>({
        type: "text",
        responseFormat: ()=>({
                type: "text"
            }),
        injectIntoSystemPrompt ({ system }) {
            return system;
        },
        parseOutput ({ text: text2 }) {
            return text2;
        }
    });
var object = ({ schema: inputSchema })=>{
    const schema = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["asSchema"])(inputSchema);
    return {
        type: "object",
        responseFormat: ({ model })=>({
                type: "json",
                schema: model.supportsStructuredOutputs ? schema.jsonSchema : void 0
            }),
        injectIntoSystemPrompt ({ system, model }) {
            return model.supportsStructuredOutputs ? system : injectJsonInstruction({
                prompt: system,
                schema: schema.jsonSchema
            });
        },
        parseOutput ({ text: text2 }) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["parseJSON"])({
                text: text2,
                schema
            });
        }
    };
};
;
;
// core/util/merge-streams.ts
function mergeStreams(stream1, stream2) {
    const reader1 = stream1.getReader();
    const reader2 = stream2.getReader();
    let lastRead1 = void 0;
    let lastRead2 = void 0;
    let stream1Done = false;
    let stream2Done = false;
    async function readStream1(controller) {
        try {
            if (lastRead1 == null) {
                lastRead1 = reader1.read();
            }
            const result = await lastRead1;
            lastRead1 = void 0;
            if (!result.done) {
                controller.enqueue(result.value);
            } else {
                controller.close();
            }
        } catch (error) {
            controller.error(error);
        }
    }
    async function readStream2(controller) {
        try {
            if (lastRead2 == null) {
                lastRead2 = reader2.read();
            }
            const result = await lastRead2;
            lastRead2 = void 0;
            if (!result.done) {
                controller.enqueue(result.value);
            } else {
                controller.close();
            }
        } catch (error) {
            controller.error(error);
        }
    }
    return new ReadableStream({
        async pull (controller) {
            try {
                if (stream1Done) {
                    await readStream2(controller);
                    return;
                }
                if (stream2Done) {
                    await readStream1(controller);
                    return;
                }
                if (lastRead1 == null) {
                    lastRead1 = reader1.read();
                }
                if (lastRead2 == null) {
                    lastRead2 = reader2.read();
                }
                const { result, reader } = await Promise.race([
                    lastRead1.then((result2)=>({
                            result: result2,
                            reader: reader1
                        })),
                    lastRead2.then((result2)=>({
                            result: result2,
                            reader: reader2
                        }))
                ]);
                if (!result.done) {
                    controller.enqueue(result.value);
                }
                if (reader === reader1) {
                    lastRead1 = void 0;
                    if (result.done) {
                        await readStream2(controller);
                        stream1Done = true;
                    }
                } else {
                    lastRead2 = void 0;
                    if (result.done) {
                        stream2Done = true;
                        await readStream1(controller);
                    }
                }
            } catch (error) {
                controller.error(error);
            }
        },
        cancel () {
            reader1.cancel();
            reader2.cancel();
        }
    });
}
;
function runToolsTransformation({ tools, generatorStream, toolCallStreaming, tracer, telemetry, system, messages, abortSignal, repairToolCall }) {
    let toolResultsStreamController = null;
    const toolResultsStream = new ReadableStream({
        start (controller) {
            toolResultsStreamController = controller;
        }
    });
    const activeToolCalls = {};
    const outstandingToolResults = /* @__PURE__ */ new Set();
    let canClose = false;
    let finishChunk = void 0;
    function attemptClose() {
        if (canClose && outstandingToolResults.size === 0) {
            if (finishChunk != null) {
                toolResultsStreamController.enqueue(finishChunk);
            }
            toolResultsStreamController.close();
        }
    }
    const forwardStream = new TransformStream({
        async transform (chunk, controller) {
            const chunkType = chunk.type;
            switch(chunkType){
                case "text-delta":
                case "response-metadata":
                case "error":
                    {
                        controller.enqueue(chunk);
                        break;
                    }
                case "tool-call-delta":
                    {
                        if (toolCallStreaming) {
                            if (!activeToolCalls[chunk.toolCallId]) {
                                controller.enqueue({
                                    type: "tool-call-streaming-start",
                                    toolCallId: chunk.toolCallId,
                                    toolName: chunk.toolName
                                });
                                activeToolCalls[chunk.toolCallId] = true;
                            }
                            controller.enqueue({
                                type: "tool-call-delta",
                                toolCallId: chunk.toolCallId,
                                toolName: chunk.toolName,
                                argsTextDelta: chunk.argsTextDelta
                            });
                        }
                        break;
                    }
                case "tool-call":
                    {
                        const toolName = chunk.toolName;
                        if (tools == null) {
                            toolResultsStreamController.enqueue({
                                type: "error",
                                error: new NoSuchToolError({
                                    toolName: chunk.toolName
                                })
                            });
                            break;
                        }
                        const tool2 = tools[toolName];
                        if (tool2 == null) {
                            toolResultsStreamController.enqueue({
                                type: "error",
                                error: new NoSuchToolError({
                                    toolName: chunk.toolName,
                                    availableTools: Object.keys(tools)
                                })
                            });
                            break;
                        }
                        try {
                            const toolCall = await parseToolCall({
                                toolCall: chunk,
                                tools,
                                repairToolCall,
                                system,
                                messages
                            });
                            controller.enqueue(toolCall);
                            if (tool2.execute != null) {
                                const toolExecutionId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["generateId"])();
                                outstandingToolResults.add(toolExecutionId);
                                recordSpan({
                                    name: "ai.toolCall",
                                    attributes: selectTelemetryAttributes({
                                        telemetry,
                                        attributes: {
                                            ...assembleOperationName({
                                                operationId: "ai.toolCall",
                                                telemetry
                                            }),
                                            "ai.toolCall.name": toolCall.toolName,
                                            "ai.toolCall.id": toolCall.toolCallId,
                                            "ai.toolCall.args": {
                                                output: ()=>JSON.stringify(toolCall.args)
                                            }
                                        }
                                    }),
                                    tracer,
                                    fn: async (span)=>tool2.execute(toolCall.args, {
                                            toolCallId: toolCall.toolCallId,
                                            messages,
                                            abortSignal
                                        }).then((result)=>{
                                            toolResultsStreamController.enqueue({
                                                ...toolCall,
                                                type: "tool-result",
                                                result
                                            });
                                            outstandingToolResults.delete(toolExecutionId);
                                            attemptClose();
                                            try {
                                                span.setAttributes(selectTelemetryAttributes({
                                                    telemetry,
                                                    attributes: {
                                                        "ai.toolCall.result": {
                                                            output: ()=>JSON.stringify(result)
                                                        }
                                                    }
                                                }));
                                            } catch (ignored) {}
                                        }, (error)=>{
                                            toolResultsStreamController.enqueue({
                                                type: "error",
                                                error: new ToolExecutionError({
                                                    toolName: toolCall.toolName,
                                                    toolArgs: toolCall.args,
                                                    cause: error
                                                })
                                            });
                                            outstandingToolResults.delete(toolExecutionId);
                                            attemptClose();
                                        })
                                });
                            }
                        } catch (error) {
                            toolResultsStreamController.enqueue({
                                type: "error",
                                error
                            });
                        }
                        break;
                    }
                case "finish":
                    {
                        finishChunk = {
                            type: "finish",
                            finishReason: chunk.finishReason,
                            logprobs: chunk.logprobs,
                            usage: calculateLanguageModelUsage(chunk.usage),
                            experimental_providerMetadata: chunk.providerMetadata
                        };
                        break;
                    }
                default:
                    {
                        const _exhaustiveCheck = chunkType;
                        throw new Error(`Unhandled chunk type: ${_exhaustiveCheck}`);
                    }
            }
        },
        flush () {
            canClose = true;
            attemptClose();
        }
    });
    return new ReadableStream({
        async start (controller) {
            return Promise.all([
                generatorStream.pipeThrough(forwardStream).pipeTo(new WritableStream({
                    write (chunk) {
                        controller.enqueue(chunk);
                    },
                    close () {}
                })),
                toolResultsStream.pipeTo(new WritableStream({
                    write (chunk) {
                        controller.enqueue(chunk);
                    },
                    close () {
                        controller.close();
                    }
                }))
            ]);
        }
    });
}
// core/generate-text/stream-text.ts
var originalGenerateId4 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createIdGenerator"])({
    prefix: "aitxt",
    size: 24
});
function streamText({ model, tools, toolChoice, system, prompt, messages, maxRetries, abortSignal, headers, maxSteps = 1, experimental_continueSteps: continueSteps = false, experimental_telemetry: telemetry, experimental_providerMetadata: providerMetadata, experimental_toolCallStreaming: toolCallStreaming = false, experimental_activeTools: activeTools, experimental_repairToolCall: repairToolCall, onChunk, onFinish, onStepFinish, _internal: { now: now2 = now, generateId: generateId3 = originalGenerateId4, currentDate = ()=>/* @__PURE__ */ new Date() } = {}, ...settings }) {
    return new DefaultStreamTextResult({
        model,
        telemetry,
        headers,
        settings,
        maxRetries,
        abortSignal,
        system,
        prompt,
        messages,
        tools,
        toolChoice,
        toolCallStreaming,
        activeTools,
        repairToolCall,
        maxSteps,
        continueSteps,
        providerMetadata,
        onChunk,
        onFinish,
        onStepFinish,
        now: now2,
        currentDate,
        generateId: generateId3
    });
}
var DefaultStreamTextResult = class {
    constructor({ model, telemetry, headers, settings, maxRetries: maxRetriesArg, abortSignal, system, prompt, messages, tools, toolChoice, toolCallStreaming, activeTools, repairToolCall, maxSteps, continueSteps, providerMetadata, onChunk, onFinish, onStepFinish, now: now2, currentDate, generateId: generateId3 }){
        this.warningsPromise = new DelayedPromise();
        this.usagePromise = new DelayedPromise();
        this.finishReasonPromise = new DelayedPromise();
        this.providerMetadataPromise = new DelayedPromise();
        this.textPromise = new DelayedPromise();
        this.toolCallsPromise = new DelayedPromise();
        this.toolResultsPromise = new DelayedPromise();
        this.requestPromise = new DelayedPromise();
        this.responsePromise = new DelayedPromise();
        this.stepsPromise = new DelayedPromise();
        this.stitchableStream = createStitchableStream();
        if (maxSteps < 1) {
            throw new InvalidArgumentError({
                parameter: "maxSteps",
                value: maxSteps,
                message: "maxSteps must be at least 1"
            });
        }
        const { maxRetries, retry } = prepareRetries({
            maxRetries: maxRetriesArg
        });
        const tracer = getTracer(telemetry);
        const baseTelemetryAttributes = getBaseTelemetryAttributes({
            model,
            telemetry,
            headers,
            settings: {
                ...settings,
                maxRetries
            }
        });
        const initialPrompt = standardizePrompt({
            prompt: {
                system,
                prompt,
                messages
            },
            tools
        });
        const self = this;
        recordSpan({
            name: "ai.streamText",
            attributes: selectTelemetryAttributes({
                telemetry,
                attributes: {
                    ...assembleOperationName({
                        operationId: "ai.streamText",
                        telemetry
                    }),
                    ...baseTelemetryAttributes,
                    // specific settings that only make sense on the outer level:
                    "ai.prompt": {
                        input: ()=>JSON.stringify({
                                system,
                                prompt,
                                messages
                            })
                    },
                    "ai.settings.maxSteps": maxSteps
                }
            }),
            tracer,
            endWhenDone: false,
            fn: async (rootSpan)=>{
                const stepResults = [];
                async function streamStep({ currentStep, responseMessages, usage, stepType, previousStepText, hasLeadingWhitespace }) {
                    const promptFormat = responseMessages.length === 0 ? initialPrompt.type : "messages";
                    const stepInputMessages = [
                        ...initialPrompt.messages,
                        ...responseMessages
                    ];
                    const promptMessages = await convertToLanguageModelPrompt({
                        prompt: {
                            type: promptFormat,
                            system: initialPrompt.system,
                            messages: stepInputMessages
                        },
                        modelSupportsImageUrls: model.supportsImageUrls,
                        modelSupportsUrl: model.supportsUrl
                    });
                    const mode = {
                        type: "regular",
                        ...prepareToolsAndToolChoice({
                            tools,
                            toolChoice,
                            activeTools
                        })
                    };
                    const { result: { stream, warnings, rawResponse, request }, doStreamSpan, startTimestampMs } = await retry(()=>recordSpan({
                            name: "ai.streamText.doStream",
                            attributes: selectTelemetryAttributes({
                                telemetry,
                                attributes: {
                                    ...assembleOperationName({
                                        operationId: "ai.streamText.doStream",
                                        telemetry
                                    }),
                                    ...baseTelemetryAttributes,
                                    "ai.prompt.format": {
                                        input: ()=>promptFormat
                                    },
                                    "ai.prompt.messages": {
                                        input: ()=>JSON.stringify(promptMessages)
                                    },
                                    "ai.prompt.tools": {
                                        // convert the language model level tools:
                                        input: ()=>{
                                            var _a13;
                                            return (_a13 = mode.tools) == null ? void 0 : _a13.map((tool2)=>JSON.stringify(tool2));
                                        }
                                    },
                                    "ai.prompt.toolChoice": {
                                        input: ()=>mode.toolChoice != null ? JSON.stringify(mode.toolChoice) : void 0
                                    },
                                    // standardized gen-ai llm span attributes:
                                    "gen_ai.system": model.provider,
                                    "gen_ai.request.model": model.modelId,
                                    "gen_ai.request.frequency_penalty": settings.frequencyPenalty,
                                    "gen_ai.request.max_tokens": settings.maxTokens,
                                    "gen_ai.request.presence_penalty": settings.presencePenalty,
                                    "gen_ai.request.stop_sequences": settings.stopSequences,
                                    "gen_ai.request.temperature": settings.temperature,
                                    "gen_ai.request.top_k": settings.topK,
                                    "gen_ai.request.top_p": settings.topP
                                }
                            }),
                            tracer,
                            endWhenDone: false,
                            fn: async (doStreamSpan2)=>({
                                    startTimestampMs: now2(),
                                    // get before the call
                                    doStreamSpan: doStreamSpan2,
                                    result: await model.doStream({
                                        mode,
                                        ...prepareCallSettings(settings),
                                        inputFormat: promptFormat,
                                        prompt: promptMessages,
                                        providerMetadata,
                                        abortSignal,
                                        headers
                                    })
                                })
                        }));
                    const transformedStream = runToolsTransformation({
                        tools,
                        generatorStream: stream,
                        toolCallStreaming,
                        tracer,
                        telemetry,
                        system,
                        messages: stepInputMessages,
                        repairToolCall,
                        abortSignal
                    });
                    const stepRequest = request != null ? request : {};
                    const stepToolCalls = [];
                    const stepToolResults = [];
                    let stepFinishReason = "unknown";
                    let stepUsage = {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0
                    };
                    let stepProviderMetadata;
                    let stepFirstChunk = true;
                    let stepText = "";
                    let fullStepText = stepType === "continue" ? previousStepText : "";
                    let stepLogProbs;
                    let stepResponse = {
                        id: generateId3(),
                        timestamp: currentDate(),
                        modelId: model.modelId
                    };
                    let chunkBuffer = "";
                    let chunkTextPublished = false;
                    let inWhitespacePrefix = true;
                    let hasWhitespaceSuffix = false;
                    async function publishTextChunk({ controller, chunk }) {
                        controller.enqueue(chunk);
                        stepText += chunk.textDelta;
                        fullStepText += chunk.textDelta;
                        chunkTextPublished = true;
                        hasWhitespaceSuffix = chunk.textDelta.trimEnd() !== chunk.textDelta;
                        await (onChunk == null ? void 0 : onChunk({
                            chunk
                        }));
                    }
                    self.stitchableStream.addStream(transformedStream.pipeThrough(new TransformStream({
                        async transform (chunk, controller) {
                            var _a13, _b, _c;
                            if (stepFirstChunk) {
                                const msToFirstChunk = now2() - startTimestampMs;
                                stepFirstChunk = false;
                                doStreamSpan.addEvent("ai.stream.firstChunk", {
                                    "ai.response.msToFirstChunk": msToFirstChunk
                                });
                                doStreamSpan.setAttributes({
                                    "ai.response.msToFirstChunk": msToFirstChunk
                                });
                            }
                            if (chunk.type === "text-delta" && chunk.textDelta.length === 0) {
                                return;
                            }
                            const chunkType = chunk.type;
                            switch(chunkType){
                                case "text-delta":
                                    {
                                        if (continueSteps) {
                                            const trimmedChunkText = inWhitespacePrefix && hasLeadingWhitespace ? chunk.textDelta.trimStart() : chunk.textDelta;
                                            if (trimmedChunkText.length === 0) {
                                                break;
                                            }
                                            inWhitespacePrefix = false;
                                            chunkBuffer += trimmedChunkText;
                                            const split = splitOnLastWhitespace(chunkBuffer);
                                            if (split != null) {
                                                chunkBuffer = split.suffix;
                                                await publishTextChunk({
                                                    controller,
                                                    chunk: {
                                                        type: "text-delta",
                                                        textDelta: split.prefix + split.whitespace
                                                    }
                                                });
                                            }
                                        } else {
                                            await publishTextChunk({
                                                controller,
                                                chunk
                                            });
                                        }
                                        break;
                                    }
                                case "tool-call":
                                    {
                                        controller.enqueue(chunk);
                                        stepToolCalls.push(chunk);
                                        await (onChunk == null ? void 0 : onChunk({
                                            chunk
                                        }));
                                        break;
                                    }
                                case "tool-result":
                                    {
                                        controller.enqueue(chunk);
                                        stepToolResults.push(chunk);
                                        await (onChunk == null ? void 0 : onChunk({
                                            chunk
                                        }));
                                        break;
                                    }
                                case "response-metadata":
                                    {
                                        stepResponse = {
                                            id: (_a13 = chunk.id) != null ? _a13 : stepResponse.id,
                                            timestamp: (_b = chunk.timestamp) != null ? _b : stepResponse.timestamp,
                                            modelId: (_c = chunk.modelId) != null ? _c : stepResponse.modelId
                                        };
                                        break;
                                    }
                                case "finish":
                                    {
                                        stepUsage = chunk.usage;
                                        stepFinishReason = chunk.finishReason;
                                        stepProviderMetadata = chunk.experimental_providerMetadata;
                                        stepLogProbs = chunk.logprobs;
                                        const msToFinish = now2() - startTimestampMs;
                                        doStreamSpan.addEvent("ai.stream.finish");
                                        doStreamSpan.setAttributes({
                                            "ai.response.msToFinish": msToFinish,
                                            "ai.response.avgCompletionTokensPerSecond": 1e3 * stepUsage.completionTokens / msToFinish
                                        });
                                        break;
                                    }
                                case "tool-call-streaming-start":
                                case "tool-call-delta":
                                    {
                                        controller.enqueue(chunk);
                                        await (onChunk == null ? void 0 : onChunk({
                                            chunk
                                        }));
                                        break;
                                    }
                                case "error":
                                    {
                                        controller.enqueue(chunk);
                                        stepFinishReason = "error";
                                        break;
                                    }
                                default:
                                    {
                                        const exhaustiveCheck = chunkType;
                                        throw new Error(`Unknown chunk type: ${exhaustiveCheck}`);
                                    }
                            }
                        },
                        // invoke onFinish callback and resolve toolResults promise when the stream is about to close:
                        async flush (controller) {
                            const stepToolCallsJson = stepToolCalls.length > 0 ? JSON.stringify(stepToolCalls) : void 0;
                            let nextStepType = "done";
                            if (currentStep + 1 < maxSteps) {
                                if (continueSteps && stepFinishReason === "length" && // only use continue when there are no tool calls:
                                stepToolCalls.length === 0) {
                                    nextStepType = "continue";
                                } else if (// there are tool calls:
                                stepToolCalls.length > 0 && // all current tool calls have results:
                                stepToolResults.length === stepToolCalls.length) {
                                    nextStepType = "tool-result";
                                }
                            }
                            if (continueSteps && chunkBuffer.length > 0 && (nextStepType !== "continue" || // when the next step is a regular step, publish the buffer
                            stepType === "continue" && !chunkTextPublished)) {
                                await publishTextChunk({
                                    controller,
                                    chunk: {
                                        type: "text-delta",
                                        textDelta: chunkBuffer
                                    }
                                });
                                chunkBuffer = "";
                            }
                            try {
                                doStreamSpan.setAttributes(selectTelemetryAttributes({
                                    telemetry,
                                    attributes: {
                                        "ai.response.finishReason": stepFinishReason,
                                        "ai.response.text": {
                                            output: ()=>stepText
                                        },
                                        "ai.response.toolCalls": {
                                            output: ()=>stepToolCallsJson
                                        },
                                        "ai.response.id": stepResponse.id,
                                        "ai.response.model": stepResponse.modelId,
                                        "ai.response.timestamp": stepResponse.timestamp.toISOString(),
                                        "ai.usage.promptTokens": stepUsage.promptTokens,
                                        "ai.usage.completionTokens": stepUsage.completionTokens,
                                        // standardized gen-ai llm span attributes:
                                        "gen_ai.response.finish_reasons": [
                                            stepFinishReason
                                        ],
                                        "gen_ai.response.id": stepResponse.id,
                                        "gen_ai.response.model": stepResponse.modelId,
                                        "gen_ai.usage.input_tokens": stepUsage.promptTokens,
                                        "gen_ai.usage.output_tokens": stepUsage.completionTokens
                                    }
                                }));
                            } catch (error) {} finally{
                                doStreamSpan.end();
                            }
                            controller.enqueue({
                                type: "step-finish",
                                finishReason: stepFinishReason,
                                usage: stepUsage,
                                experimental_providerMetadata: stepProviderMetadata,
                                logprobs: stepLogProbs,
                                response: {
                                    ...stepResponse
                                },
                                isContinued: nextStepType === "continue"
                            });
                            if (stepType === "continue") {
                                const lastMessage = responseMessages[responseMessages.length - 1];
                                if (typeof lastMessage.content === "string") {
                                    lastMessage.content += stepText;
                                } else {
                                    lastMessage.content.push({
                                        text: stepText,
                                        type: "text"
                                    });
                                }
                            } else {
                                responseMessages.push(...toResponseMessages({
                                    text: stepText,
                                    tools: tools != null ? tools : {},
                                    toolCalls: stepToolCalls,
                                    toolResults: stepToolResults
                                }));
                            }
                            const currentStepResult = {
                                stepType,
                                text: stepText,
                                toolCalls: stepToolCalls,
                                toolResults: stepToolResults,
                                finishReason: stepFinishReason,
                                usage: stepUsage,
                                warnings,
                                logprobs: stepLogProbs,
                                request: stepRequest,
                                response: {
                                    ...stepResponse,
                                    headers: rawResponse == null ? void 0 : rawResponse.headers,
                                    // deep clone msgs to avoid mutating past messages in multi-step:
                                    messages: JSON.parse(JSON.stringify(responseMessages))
                                },
                                experimental_providerMetadata: stepProviderMetadata,
                                isContinued: nextStepType === "continue"
                            };
                            stepResults.push(currentStepResult);
                            await (onStepFinish == null ? void 0 : onStepFinish(currentStepResult));
                            const combinedUsage = {
                                promptTokens: usage.promptTokens + stepUsage.promptTokens,
                                completionTokens: usage.completionTokens + stepUsage.completionTokens,
                                totalTokens: usage.totalTokens + stepUsage.totalTokens
                            };
                            if (nextStepType !== "done") {
                                await streamStep({
                                    currentStep: currentStep + 1,
                                    responseMessages,
                                    usage: combinedUsage,
                                    stepType: nextStepType,
                                    previousStepText: fullStepText,
                                    hasLeadingWhitespace: hasWhitespaceSuffix
                                });
                                return;
                            }
                            try {
                                controller.enqueue({
                                    type: "finish",
                                    finishReason: stepFinishReason,
                                    usage: combinedUsage,
                                    experimental_providerMetadata: stepProviderMetadata,
                                    logprobs: stepLogProbs,
                                    response: {
                                        ...stepResponse
                                    }
                                });
                                self.stitchableStream.close();
                                rootSpan.setAttributes(selectTelemetryAttributes({
                                    telemetry,
                                    attributes: {
                                        "ai.response.finishReason": stepFinishReason,
                                        "ai.response.text": {
                                            output: ()=>fullStepText
                                        },
                                        "ai.response.toolCalls": {
                                            output: ()=>stepToolCallsJson
                                        },
                                        "ai.usage.promptTokens": combinedUsage.promptTokens,
                                        "ai.usage.completionTokens": combinedUsage.completionTokens
                                    }
                                }));
                                self.usagePromise.resolve(combinedUsage);
                                self.finishReasonPromise.resolve(stepFinishReason);
                                self.textPromise.resolve(fullStepText);
                                self.toolCallsPromise.resolve(stepToolCalls);
                                self.providerMetadataPromise.resolve(stepProviderMetadata);
                                self.toolResultsPromise.resolve(stepToolResults);
                                self.requestPromise.resolve(stepRequest);
                                self.responsePromise.resolve({
                                    ...stepResponse,
                                    headers: rawResponse == null ? void 0 : rawResponse.headers,
                                    messages: responseMessages
                                });
                                self.stepsPromise.resolve(stepResults);
                                self.warningsPromise.resolve(warnings != null ? warnings : []);
                                await (onFinish == null ? void 0 : onFinish({
                                    finishReason: stepFinishReason,
                                    logprobs: stepLogProbs,
                                    usage: combinedUsage,
                                    text: fullStepText,
                                    toolCalls: stepToolCalls,
                                    // The tool results are inferred as a never[] type, because they are
                                    // optional and the execute method with an inferred result type is
                                    // optional as well. Therefore we need to cast the toolResults to any.
                                    // The type exposed to the users will be correctly inferred.
                                    toolResults: stepToolResults,
                                    request: stepRequest,
                                    response: {
                                        ...stepResponse,
                                        headers: rawResponse == null ? void 0 : rawResponse.headers,
                                        messages: responseMessages
                                    },
                                    warnings,
                                    experimental_providerMetadata: stepProviderMetadata,
                                    steps: stepResults
                                }));
                            } catch (error) {
                                controller.error(error);
                            } finally{
                                rootSpan.end();
                            }
                        }
                    })));
                }
                await streamStep({
                    currentStep: 0,
                    responseMessages: [],
                    usage: {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0
                    },
                    previousStepText: "",
                    stepType: "initial",
                    hasLeadingWhitespace: false
                });
            }
        }).catch((error)=>{
            self.stitchableStream.addStream(new ReadableStream({
                start (controller) {
                    controller.enqueue({
                        type: "error",
                        error
                    });
                    controller.close();
                }
            }));
            self.stitchableStream.close();
        });
    }
    get warnings() {
        return this.warningsPromise.value;
    }
    get usage() {
        return this.usagePromise.value;
    }
    get finishReason() {
        return this.finishReasonPromise.value;
    }
    get experimental_providerMetadata() {
        return this.providerMetadataPromise.value;
    }
    get text() {
        return this.textPromise.value;
    }
    get toolCalls() {
        return this.toolCallsPromise.value;
    }
    get toolResults() {
        return this.toolResultsPromise.value;
    }
    get request() {
        return this.requestPromise.value;
    }
    get response() {
        return this.responsePromise.value;
    }
    get steps() {
        return this.stepsPromise.value;
    }
    /**
  Split out a new stream from the original stream.
  The original stream is replaced to allow for further splitting,
  since we do not know how many times the stream will be split.
  
  Note: this leads to buffering the stream content on the server.
  However, the LLM results are expected to be small enough to not cause issues.
     */ teeStream() {
        const [stream1, stream2] = this.stitchableStream.stream.tee();
        this.stitchableStream.stream = stream2;
        return stream1;
    }
    get textStream() {
        return createAsyncIterableStream(this.teeStream(), {
            transform (chunk, controller) {
                if (chunk.type === "text-delta") {
                    controller.enqueue(chunk.textDelta);
                } else if (chunk.type === "error") {
                    controller.error(chunk.error);
                }
            }
        });
    }
    get fullStream() {
        return createAsyncIterableStream(this.teeStream(), {
            transform (chunk, controller) {
                controller.enqueue(chunk);
            }
        });
    }
    toDataStreamInternal({ getErrorMessage: getErrorMessage5 = ()=>"An error occurred.", // mask error messages for safety by default
    sendUsage = true } = {}) {
        let aggregatedResponse = "";
        const callbackTransformer = new TransformStream({
            async transform (chunk, controller) {
                controller.enqueue(chunk);
                if (chunk.type === "text-delta") {
                    aggregatedResponse += chunk.textDelta;
                }
            }
        });
        const streamPartsTransformer = new TransformStream({
            transform: async (chunk, controller)=>{
                const chunkType = chunk.type;
                switch(chunkType){
                    case "text-delta":
                        {
                            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("text", chunk.textDelta));
                            break;
                        }
                    case "tool-call-streaming-start":
                        {
                            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("tool_call_streaming_start", {
                                toolCallId: chunk.toolCallId,
                                toolName: chunk.toolName
                            }));
                            break;
                        }
                    case "tool-call-delta":
                        {
                            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("tool_call_delta", {
                                toolCallId: chunk.toolCallId,
                                argsTextDelta: chunk.argsTextDelta
                            }));
                            break;
                        }
                    case "tool-call":
                        {
                            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("tool_call", {
                                toolCallId: chunk.toolCallId,
                                toolName: chunk.toolName,
                                args: chunk.args
                            }));
                            break;
                        }
                    case "tool-result":
                        {
                            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("tool_result", {
                                toolCallId: chunk.toolCallId,
                                result: chunk.result
                            }));
                            break;
                        }
                    case "error":
                        {
                            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("error", getErrorMessage5(chunk.error)));
                            break;
                        }
                    case "step-finish":
                        {
                            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("finish_step", {
                                finishReason: chunk.finishReason,
                                usage: sendUsage ? {
                                    promptTokens: chunk.usage.promptTokens,
                                    completionTokens: chunk.usage.completionTokens
                                } : void 0,
                                isContinued: chunk.isContinued
                            }));
                            break;
                        }
                    case "finish":
                        {
                            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("finish_message", {
                                finishReason: chunk.finishReason,
                                usage: sendUsage ? {
                                    promptTokens: chunk.usage.promptTokens,
                                    completionTokens: chunk.usage.completionTokens
                                } : void 0
                            }));
                            break;
                        }
                    default:
                        {
                            const exhaustiveCheck = chunkType;
                            throw new Error(`Unknown chunk type: ${exhaustiveCheck}`);
                        }
                }
            }
        });
        return this.fullStream.pipeThrough(callbackTransformer).pipeThrough(streamPartsTransformer);
    }
    pipeDataStreamToResponse(response, { status, statusText, headers, data, getErrorMessage: getErrorMessage5, sendUsage } = {}) {
        writeToServerResponse({
            response,
            status,
            statusText,
            headers: prepareOutgoingHttpHeaders(headers, {
                contentType: "text/plain; charset=utf-8",
                dataStreamVersion: "v1"
            }),
            stream: this.toDataStream({
                data,
                getErrorMessage: getErrorMessage5,
                sendUsage
            })
        });
    }
    pipeTextStreamToResponse(response, init) {
        writeToServerResponse({
            response,
            status: init == null ? void 0 : init.status,
            statusText: init == null ? void 0 : init.statusText,
            headers: prepareOutgoingHttpHeaders(init == null ? void 0 : init.headers, {
                contentType: "text/plain; charset=utf-8"
            }),
            stream: this.textStream.pipeThrough(new TextEncoderStream())
        });
    }
    // TODO breaking change 5.0: remove pipeThrough(new TextEncoderStream())
    toDataStream(options) {
        const stream = this.toDataStreamInternal({
            getErrorMessage: options == null ? void 0 : options.getErrorMessage,
            sendUsage: options == null ? void 0 : options.sendUsage
        }).pipeThrough(new TextEncoderStream());
        return (options == null ? void 0 : options.data) ? mergeStreams(options == null ? void 0 : options.data.stream, stream) : stream;
    }
    mergeIntoDataStream(writer) {
        writer.merge(this.toDataStreamInternal({
            getErrorMessage: writer.onError
        }));
    }
    toDataStreamResponse({ headers, status, statusText, data, getErrorMessage: getErrorMessage5, sendUsage } = {}) {
        return new Response(this.toDataStream({
            data,
            getErrorMessage: getErrorMessage5,
            sendUsage
        }), {
            status,
            statusText,
            headers: prepareResponseHeaders(headers, {
                contentType: "text/plain; charset=utf-8",
                dataStreamVersion: "v1"
            })
        });
    }
    toTextStreamResponse(init) {
        var _a13;
        return new Response(this.textStream.pipeThrough(new TextEncoderStream()), {
            status: (_a13 = init == null ? void 0 : init.status) != null ? _a13 : 200,
            headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
                contentType: "text/plain; charset=utf-8"
            })
        });
    }
};
// core/middleware/wrap-language-model.ts
var experimental_wrapLanguageModel = ({ model, middleware: { transformParams, wrapGenerate, wrapStream }, modelId, providerId })=>{
    async function doTransform({ params, type }) {
        return transformParams ? await transformParams({
            params,
            type
        }) : params;
    }
    return {
        specificationVersion: "v1",
        provider: providerId != null ? providerId : model.provider,
        modelId: modelId != null ? modelId : model.modelId,
        defaultObjectGenerationMode: model.defaultObjectGenerationMode,
        supportsImageUrls: model.supportsImageUrls,
        supportsUrl: model.supportsUrl,
        supportsStructuredOutputs: model.supportsStructuredOutputs,
        async doGenerate (params) {
            const transformedParams = await doTransform({
                params,
                type: "generate"
            });
            const doGenerate = async ()=>model.doGenerate(transformedParams);
            return wrapGenerate ? wrapGenerate({
                doGenerate,
                params: transformedParams,
                model
            }) : doGenerate();
        },
        async doStream (params) {
            const transformedParams = await doTransform({
                params,
                type: "stream"
            });
            const doStream = async ()=>model.doStream(transformedParams);
            return wrapStream ? wrapStream({
                doStream,
                params: transformedParams,
                model
            }) : doStream();
        }
    };
};
;
function experimental_customProvider({ languageModels, textEmbeddingModels, fallbackProvider }) {
    return {
        languageModel (modelId) {
            if (languageModels != null && modelId in languageModels) {
                return languageModels[modelId];
            }
            if (fallbackProvider) {
                return fallbackProvider.languageModel(modelId);
            }
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoSuchModelError"]({
                modelId,
                modelType: "languageModel"
            });
        },
        textEmbeddingModel (modelId) {
            if (textEmbeddingModels != null && modelId in textEmbeddingModels) {
                return textEmbeddingModels[modelId];
            }
            if (fallbackProvider) {
                return fallbackProvider.textEmbeddingModel(modelId);
            }
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoSuchModelError"]({
                modelId,
                modelType: "textEmbeddingModel"
            });
        }
    };
}
;
var name12 = "AI_NoSuchProviderError";
var marker12 = `vercel.ai.error.${name12}`;
var symbol12 = Symbol.for(marker12);
var _a12;
var NoSuchProviderError = class extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoSuchModelError"] {
    constructor({ modelId, modelType, providerId, availableProviders, message = `No such provider: ${providerId} (available providers: ${availableProviders.join()})` }){
        super({
            errorName: name12,
            modelId,
            modelType,
            message
        });
        this[_a12] = true;
        this.providerId = providerId;
        this.availableProviders = availableProviders;
    }
    static isInstance(error) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AISDKError"].hasMarker(error, marker12);
    }
};
_a12 = symbol12;
;
function experimental_createProviderRegistry(providers) {
    const registry = new DefaultProviderRegistry();
    for (const [id, provider] of Object.entries(providers)){
        registry.registerProvider({
            id,
            provider
        });
    }
    return registry;
}
var DefaultProviderRegistry = class {
    constructor(){
        this.providers = {};
    }
    registerProvider({ id, provider }) {
        this.providers[id] = provider;
    }
    getProvider(id) {
        const provider = this.providers[id];
        if (provider == null) {
            throw new NoSuchProviderError({
                modelId: id,
                modelType: "languageModel",
                providerId: id,
                availableProviders: Object.keys(this.providers)
            });
        }
        return provider;
    }
    splitId(id, modelType) {
        const index = id.indexOf(":");
        if (index === -1) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoSuchModelError"]({
                modelId: id,
                modelType,
                message: `Invalid ${modelType} id for registry: ${id} (must be in the format "providerId:modelId")`
            });
        }
        return [
            id.slice(0, index),
            id.slice(index + 1)
        ];
    }
    languageModel(id) {
        var _a13, _b;
        const [providerId, modelId] = this.splitId(id, "languageModel");
        const model = (_b = (_a13 = this.getProvider(providerId)).languageModel) == null ? void 0 : _b.call(_a13, modelId);
        if (model == null) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoSuchModelError"]({
                modelId: id,
                modelType: "languageModel"
            });
        }
        return model;
    }
    textEmbeddingModel(id) {
        var _a13;
        const [providerId, modelId] = this.splitId(id, "textEmbeddingModel");
        const provider = this.getProvider(providerId);
        const model = (_a13 = provider.textEmbeddingModel) == null ? void 0 : _a13.call(provider, modelId);
        if (model == null) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$40$1$2e$0$2e$1$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["NoSuchModelError"]({
                modelId: id,
                modelType: "textEmbeddingModel"
            });
        }
        return model;
    }
    /**
   * @deprecated Use `textEmbeddingModel` instead.
   */ textEmbedding(id) {
        return this.textEmbeddingModel(id);
    }
};
// core/tool/tool.ts
function tool(tool2) {
    return tool2;
}
// core/util/cosine-similarity.ts
function cosineSimilarity(vector1, vector2) {
    if (vector1.length !== vector2.length) {
        throw new Error(`Vectors must have the same length (vector1: ${vector1.length} elements, vector2: ${vector2.length} elements)`);
    }
    return dotProduct(vector1, vector2) / (magnitude(vector1) * magnitude(vector2));
}
function dotProduct(vector1, vector2) {
    return vector1.reduce((accumulator, value, index)=>accumulator + value * vector2[index], 0);
}
function magnitude(vector) {
    return Math.sqrt(dotProduct(vector, vector));
}
;
function AssistantResponse({ threadId, messageId }, process2) {
    const stream = new ReadableStream({
        async start (controller) {
            var _a13;
            const textEncoder = new TextEncoder();
            const sendMessage = (message)=>{
                controller.enqueue(textEncoder.encode((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatAssistantStreamPart"])("assistant_message", message)));
            };
            const sendDataMessage = (message)=>{
                controller.enqueue(textEncoder.encode((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatAssistantStreamPart"])("data_message", message)));
            };
            const sendError = (errorMessage)=>{
                controller.enqueue(textEncoder.encode((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatAssistantStreamPart"])("error", errorMessage)));
            };
            const forwardStream = async (stream2)=>{
                var _a14, _b;
                let result = void 0;
                for await (const value of stream2){
                    switch(value.event){
                        case "thread.message.created":
                            {
                                controller.enqueue(textEncoder.encode((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatAssistantStreamPart"])("assistant_message", {
                                    id: value.data.id,
                                    role: "assistant",
                                    content: [
                                        {
                                            type: "text",
                                            text: {
                                                value: ""
                                            }
                                        }
                                    ]
                                })));
                                break;
                            }
                        case "thread.message.delta":
                            {
                                const content = (_a14 = value.data.delta.content) == null ? void 0 : _a14[0];
                                if ((content == null ? void 0 : content.type) === "text" && ((_b = content.text) == null ? void 0 : _b.value) != null) {
                                    controller.enqueue(textEncoder.encode((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatAssistantStreamPart"])("text", content.text.value)));
                                }
                                break;
                            }
                        case "thread.run.completed":
                        case "thread.run.requires_action":
                            {
                                result = value.data;
                                break;
                            }
                    }
                }
                return result;
            };
            controller.enqueue(textEncoder.encode((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatAssistantStreamPart"])("assistant_control_data", {
                threadId,
                messageId
            })));
            try {
                await process2({
                    sendMessage,
                    sendDataMessage,
                    forwardStream
                });
            } catch (error) {
                sendError((_a13 = error.message) != null ? _a13 : `${error}`);
            } finally{
                controller.close();
            }
        },
        pull (controller) {},
        cancel () {}
    });
    return new Response(stream, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8"
        }
    });
}
// streams/langchain-adapter.ts
var langchain_adapter_exports = {};
__export(langchain_adapter_exports, {
    mergeIntoDataStream: ()=>mergeIntoDataStream,
    toDataStream: ()=>toDataStream,
    toDataStreamResponse: ()=>toDataStreamResponse
});
;
// streams/stream-callbacks.ts
function createCallbacksTransformer(callbacks = {}) {
    const textEncoder = new TextEncoder();
    let aggregatedResponse = "";
    return new TransformStream({
        async start () {
            if (callbacks.onStart) await callbacks.onStart();
        },
        async transform (message, controller) {
            controller.enqueue(textEncoder.encode(message));
            aggregatedResponse += message;
            if (callbacks.onToken) await callbacks.onToken(message);
            if (callbacks.onText && typeof message === "string") {
                await callbacks.onText(message);
            }
        },
        async flush () {
            if (callbacks.onCompletion) {
                await callbacks.onCompletion(aggregatedResponse);
            }
            if (callbacks.onFinal) {
                await callbacks.onFinal(aggregatedResponse);
            }
        }
    });
}
// streams/langchain-adapter.ts
function toDataStreamInternal(stream, callbacks) {
    return stream.pipeThrough(new TransformStream({
        transform: async (value, controller)=>{
            var _a13;
            if (typeof value === "string") {
                controller.enqueue(value);
                return;
            }
            if ("event" in value) {
                if (value.event === "on_chat_model_stream") {
                    forwardAIMessageChunk((_a13 = value.data) == null ? void 0 : _a13.chunk, controller);
                }
                return;
            }
            forwardAIMessageChunk(value, controller);
        }
    })).pipeThrough(createCallbacksTransformer(callbacks)).pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream({
        transform: async (chunk, controller)=>{
            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("text", chunk));
        }
    }));
}
function toDataStream(stream, callbacks) {
    return toDataStreamInternal(stream, callbacks).pipeThrough(new TextEncoderStream());
}
function toDataStreamResponse(stream, options) {
    var _a13;
    const dataStream = toDataStreamInternal(stream, options == null ? void 0 : options.callbacks).pipeThrough(new TextEncoderStream());
    const data = options == null ? void 0 : options.data;
    const init = options == null ? void 0 : options.init;
    const responseStream = data ? mergeStreams(data.stream, dataStream) : dataStream;
    return new Response(responseStream, {
        status: (_a13 = init == null ? void 0 : init.status) != null ? _a13 : 200,
        statusText: init == null ? void 0 : init.statusText,
        headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
            contentType: "text/plain; charset=utf-8",
            dataStreamVersion: "v1"
        })
    });
}
function mergeIntoDataStream(stream, options) {
    options.dataStream.merge(toDataStreamInternal(stream, options.callbacks));
}
function forwardAIMessageChunk(chunk, controller) {
    if (typeof chunk.content === "string") {
        controller.enqueue(chunk.content);
    } else {
        const content = chunk.content;
        for (const item of content){
            if (item.type === "text") {
                controller.enqueue(item.text);
            }
        }
    }
}
// streams/llamaindex-adapter.ts
var llamaindex_adapter_exports = {};
__export(llamaindex_adapter_exports, {
    mergeIntoDataStream: ()=>mergeIntoDataStream2,
    toDataStream: ()=>toDataStream2,
    toDataStreamResponse: ()=>toDataStreamResponse2
});
;
;
function toDataStreamInternal2(stream, callbacks) {
    const trimStart = trimStartOfStream();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$provider$2d$utils$40$2$2e$0$2e$3_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$provider$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["convertAsyncIteratorToReadableStream"])(stream[Symbol.asyncIterator]()).pipeThrough(new TransformStream({
        async transform (message, controller) {
            controller.enqueue(trimStart(message.delta));
        }
    })).pipeThrough(createCallbacksTransformer(callbacks)).pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream({
        transform: async (chunk, controller)=>{
            controller.enqueue((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("text", chunk));
        }
    }));
}
function toDataStream2(stream, callbacks) {
    return toDataStreamInternal2(stream, callbacks).pipeThrough(new TextEncoderStream());
}
function toDataStreamResponse2(stream, options = {}) {
    var _a13;
    const { init, data, callbacks } = options;
    const dataStream = toDataStreamInternal2(stream, callbacks).pipeThrough(new TextEncoderStream());
    const responseStream = data ? mergeStreams(data.stream, dataStream) : dataStream;
    return new Response(responseStream, {
        status: (_a13 = init == null ? void 0 : init.status) != null ? _a13 : 200,
        statusText: init == null ? void 0 : init.statusText,
        headers: prepareResponseHeaders(init == null ? void 0 : init.headers, {
            contentType: "text/plain; charset=utf-8",
            dataStreamVersion: "v1"
        })
    });
}
function mergeIntoDataStream2(stream, options) {
    options.dataStream.merge(toDataStreamInternal2(stream, options.callbacks));
}
function trimStartOfStream() {
    let isStreamStart = true;
    return (text2)=>{
        if (isStreamStart) {
            text2 = text2.trimStart();
            if (text2) isStreamStart = false;
        }
        return text2;
    };
}
;
// util/constants.ts
var HANGING_STREAM_WARNING_TIME_MS = 15 * 1e3;
// streams/stream-data.ts
var StreamData = class {
    constructor(){
        this.encoder = new TextEncoder();
        this.controller = null;
        this.isClosed = false;
        this.warningTimeout = null;
        const self = this;
        this.stream = new ReadableStream({
            start: async (controller)=>{
                self.controller = controller;
                if ("TURBOPACK compile-time truthy", 1) {
                    self.warningTimeout = setTimeout(()=>{
                        console.warn("The data stream is hanging. Did you forget to close it with `data.close()`?");
                    }, HANGING_STREAM_WARNING_TIME_MS);
                }
            },
            pull: (controller)=>{},
            cancel: (reason)=>{
                this.isClosed = true;
            }
        });
    }
    async close() {
        if (this.isClosed) {
            throw new Error("Data Stream has already been closed.");
        }
        if (!this.controller) {
            throw new Error("Stream controller is not initialized.");
        }
        this.controller.close();
        this.isClosed = true;
        if (this.warningTimeout) {
            clearTimeout(this.warningTimeout);
        }
    }
    append(value) {
        if (this.isClosed) {
            throw new Error("Data Stream has already been closed.");
        }
        if (!this.controller) {
            throw new Error("Stream controller is not initialized.");
        }
        this.controller.enqueue(this.encoder.encode((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("data", [
            value
        ])));
    }
    appendMessageAnnotation(value) {
        if (this.isClosed) {
            throw new Error("Data Stream has already been closed.");
        }
        if (!this.controller) {
            throw new Error("Stream controller is not initialized.");
        }
        this.controller.enqueue(this.encoder.encode((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f40$ai$2d$sdk$2b$ui$2d$utils$40$1$2e$0$2e$4_zod$40$3$2e$23$2e$7$2f$node_modules$2f40$ai$2d$sdk$2f$ui$2d$utils$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["formatDataStreamPart"])("message_annotations", [
            value
        ])));
    }
};
;
 //# sourceMappingURL=index.mjs.map
}}),

};

//# sourceMappingURL=b058b_ai_dist_index_mjs_5d4df6._.js.map