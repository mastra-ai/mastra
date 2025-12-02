"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AISDKExporter = exports.parseStrippedIsoTime = void 0;
const vercel_js_1 = require("./utils/vercel.cjs");
const index_js_1 = require("./index.cjs");
const uuid_1 = require("uuid");
const traceable_js_1 = require("./singletons/traceable.cjs");
const env_js_1 = require("./utils/env.cjs");
const env_js_2 = require("./env.cjs");
const constants_js_1 = require("./experimental/otel/constants.cjs");
// Attempt to convert CoreMessage to a LangChain-compatible format
// which allows us to render messages more nicely in LangSmith
function convertCoreToSmith(message) {
    if (message.role === "assistant") {
        const data = { content: message.content };
        if (Array.isArray(message.content)) {
            data.content = message.content.map((part) => {
                if (part.type === "text") {
                    return {
                        type: "text",
                        text: part.text,
                        // Backcompat for AI SDK 4
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...part.experimental_providerMetadata,
                    };
                }
                if (part.type === "tool-call") {
                    // Backcompat for AI SDK 4
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const legacyToolCallInput = part.args;
                    return {
                        type: "tool_use",
                        name: part.toolName,
                        id: part.toolCallId,
                        input: legacyToolCallInput ?? part.input,
                        // Backcompat for AI SDK 4
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...part.experimental_providerMetadata,
                    };
                }
                return part;
            });
            const toolCalls = message.content.filter((part) => part.type === "tool-call");
            if (toolCalls.length > 0) {
                data.additional_kwargs ??= {};
                data.additional_kwargs.tool_calls = toolCalls.map((part) => {
                    // Backcompat for AI SDK 4
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const legacyToolCallInput = part.args;
                    return {
                        id: part.toolCallId,
                        type: "function",
                        function: {
                            name: part.toolName,
                            id: part.toolCallId,
                            arguments: JSON.stringify(legacyToolCallInput ?? part.input),
                        },
                    };
                });
            }
        }
        return { type: "ai", data };
    }
    if (message.role === "user") {
        const data = { content: message.content };
        if (Array.isArray(message.content)) {
            data.content = message.content.map((part) => {
                if (part.type === "text") {
                    return {
                        type: "text",
                        text: part.text,
                        // Backcompat for AI SDK 4
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...part.experimental_providerMetadata,
                    };
                }
                if (part.type === "image") {
                    let imageUrl = part.image;
                    if (typeof imageUrl !== "string") {
                        let uint8Array;
                        if (imageUrl != null &&
                            typeof imageUrl === "object" &&
                            "type" in imageUrl &&
                            "data" in imageUrl) {
                            // Typing is wrong here if a buffer is passed in
                            uint8Array = new Uint8Array(imageUrl.data);
                        }
                        else if (imageUrl != null &&
                            typeof imageUrl === "object" &&
                            Object.keys(imageUrl).every((key) => !isNaN(Number(key)))) {
                            // ArrayBuffers get turned into objects with numeric keys for some reason
                            uint8Array = new Uint8Array(Array.from({
                                ...imageUrl,
                                length: Object.keys(imageUrl).length,
                            }));
                        }
                        if (uint8Array) {
                            let binary = "";
                            for (let i = 0; i < uint8Array.length; i++) {
                                binary += String.fromCharCode(uint8Array[i]);
                            }
                            imageUrl = btoa(binary);
                        }
                    }
                    return {
                        type: "image_url",
                        image_url: imageUrl,
                        // Backcompat for AI SDK 4
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...part.experimental_providerMetadata,
                    };
                }
                return part;
            });
        }
        return { type: "human", data };
    }
    if (message.role === "system") {
        return { type: "system", data: { content: message.content } };
    }
    if (message.role === "tool") {
        const res = message.content.map((toolCall) => {
            // Backcompat for AI SDK 4
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const legacyToolCallResult = toolCall.result;
            return {
                type: "tool",
                data: {
                    content: JSON.stringify(legacyToolCallResult ?? toolCall.output),
                    name: toolCall.toolName,
                    tool_call_id: toolCall.toolCallId,
                },
            };
        });
        if (res.length === 1)
            return res[0];
        return res;
    }
    return message;
}
const tryJson = (str) => {
    try {
        if (!str)
            return str;
        if (typeof str !== "string")
            return str;
        return JSON.parse(str);
    }
    catch {
        return str;
    }
};
function stripNonAlphanumeric(input) {
    return input.replace(/[-:.]/g, "");
}
function getDotOrder(item) {
    const { startTime: [seconds, nanoseconds], id: runId, executionOrder, } = item;
    // Date only has millisecond precision, so we use the microseconds to break
    // possible ties, avoiding incorrect run order
    const nanosecondString = String(nanoseconds).padStart(9, "0");
    const msFull = Number(nanosecondString.slice(0, 6)) + executionOrder;
    const msString = String(msFull).padStart(6, "0");
    const ms = Number(msString.slice(0, -3));
    const ns = msString.slice(-3);
    return (stripNonAlphanumeric(`${new Date(seconds * 1000 + ms).toISOString().slice(0, -1)}${ns}Z`) + runId);
}
function joinDotOrder(...segments) {
    return segments.filter(Boolean).join(".");
}
function removeDotOrder(dotOrder, ...ids) {
    return dotOrder
        .split(".")
        .filter((i) => !ids.some((id) => i.includes(id)))
        .join(".");
}
function reparentDotOrder(dotOrder, sourceRunId, parentDotOrder) {
    const segments = dotOrder.split(".");
    const sourceIndex = segments.findIndex((i) => i.includes(sourceRunId));
    if (sourceIndex === -1)
        return dotOrder;
    return joinDotOrder(...parentDotOrder.split("."), ...segments.slice(sourceIndex));
}
// Helper function to convert dotted order version of start time to ISO string
const parseStrippedIsoTime = (stripped) => {
    const year = stripped.slice(0, 4);
    const month = stripped.slice(4, 6);
    const day = stripped.slice(6, 8);
    const hour = stripped.slice(9, 11); // Skip 'T'
    const minute = stripped.slice(11, 13);
    const second = stripped.slice(13, 15);
    const ms = stripped.slice(15, 18); // milliseconds
    const us = stripped.length >= 21 ? stripped.slice(18, 21) : "000"; // microseconds
    // Create ISO string with microsecond precision only if microseconds are present
    return us !== "000"
        ? `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${us}Z`
        : `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;
};
exports.parseStrippedIsoTime = parseStrippedIsoTime;
function getMutableRunCreate(dotOrder) {
    const segments = dotOrder.split(".").map((i) => {
        const [startTime, runId] = i.split("Z");
        return { startTime, runId };
    });
    const traceId = segments[0].runId;
    const parentRunId = segments.at(-2)?.runId;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const lastSegment = segments.at(-1);
    const startTime = (0, exports.parseStrippedIsoTime)(lastSegment.startTime);
    return {
        id: lastSegment.runId,
        trace_id: traceId,
        dotted_order: dotOrder,
        parent_run_id: parentRunId,
        start_time: startTime,
    };
}
function convertToTimestamp([seconds, nanoseconds]) {
    const ms = String(nanoseconds).slice(0, 3);
    return Number(String(seconds) + ms);
}
function sortByHr(a, b) {
    if (a.startTime[0] !== b.startTime[0]) {
        return Math.sign(a.startTime[0] - b.startTime[0]);
    }
    else if (a.startTime[1] !== b.startTime[1]) {
        return Math.sign(a.startTime[1] - b.startTime[1]);
    }
    else if (getParentSpanId(a) === b.spanContext().spanId) {
        return -1;
    }
    else if (getParentSpanId(b) === a.spanContext().spanId) {
        return 1;
    }
    else {
        return 0;
    }
}
const ROOT = "$";
const RUN_ID_NAMESPACE = "5c718b20-9078-11ef-9a3d-325096b39f47";
const RUN_ID_METADATA_KEY = {
    input: "langsmith:runId",
    output: "ai.telemetry.metadata.langsmith:runId",
};
const RUN_NAME_METADATA_KEY = {
    input: "langsmith:runName",
    output: "ai.telemetry.metadata.langsmith:runName",
};
const TRACE_METADATA_KEY = {
    input: "langsmith:trace",
    output: "ai.telemetry.metadata.langsmith:trace",
};
const BAGGAGE_METADATA_KEY = {
    input: "langsmith:baggage",
    output: "ai.telemetry.metadata.langsmith:baggage",
};
const RESERVED_METADATA_KEYS = [
    RUN_ID_METADATA_KEY.output,
    RUN_NAME_METADATA_KEY.output,
    TRACE_METADATA_KEY.output,
    BAGGAGE_METADATA_KEY.output,
];
function getParentSpanId(span) {
    // Backcompat shim to support OTEL 1.x and 2.x
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (span.parentSpanId ?? span.parentSpanContext?.spanId ?? undefined);
}
/**
 * @deprecated Use `wrapAISDK` from `langsmith/experimental/vercel` instead.
 * OpenTelemetry trace exporter for Vercel AI SDK.
 *
 * @example
 * ```ts
 * import { AISDKExporter } from "langsmith/vercel";
 * import { Client } from "langsmith";
 *
 * import { generateText } from "ai";
 * import { openai } from "@ai-sdk/openai";
 *
 * import { NodeSDK } from "@opentelemetry/sdk-node";
 * import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
 *
 * const client = new Client();
 *
 * const sdk = new NodeSDK({
 *   traceExporter: new AISDKExporter({ client }),
 *   instrumentations: [getNodeAutoInstrumentations()],
 * });
 *
 * sdk.start();
 *
 * const res = await generateText({
 *   model: openai("gpt-4o-mini"),
 *   messages: [
 *     {
 *       role: "user",
 *       content: "What color is the sky?",
 *     },
 *   ],
 *   experimental_telemetry: AISDKExporter.getSettings({
 *     runName: "langsmith_traced_call",
 *     metadata: { userId: "123", language: "english" },
 *   }),
 * });
 *
 * await sdk.shutdown();
 * ```
 */
class AISDKExporter {
    constructor(args) {
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "traceByMap", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "seenSpanInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "pendingSpans", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "debug", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "projectName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** @internal */
        Object.defineProperty(this, "getSpanAttributeKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (span, key) => {
                const attributes = span.attributes;
                return key in attributes && typeof attributes[key] === "string"
                    ? attributes[key]
                    : undefined;
            }
        });
        this.client = args?.client ?? new index_js_1.Client();
        this.debug =
            args?.debug ?? (0, env_js_1.getEnvironmentVariable)("OTEL_LOG_LEVEL") === "DEBUG";
        this.projectName = args?.projectName;
        this.logDebug("creating exporter", { tracingEnabled: (0, env_js_2.isTracingEnabled)() });
    }
    static getSettings(settings) {
        const { runId, runName, ...rest } = settings ?? {};
        const metadata = { ...rest?.metadata };
        if (runId != null)
            metadata[RUN_ID_METADATA_KEY.input] = runId;
        if (runName != null)
            metadata[RUN_NAME_METADATA_KEY.input] = runName;
        // attempt to obtain the run tree if used within a traceable function
        let defaultEnabled = settings?.isEnabled ?? (0, env_js_2.isTracingEnabled)();
        try {
            const runTree = (0, traceable_js_1.getCurrentRunTree)();
            const headers = runTree.toHeaders();
            metadata[TRACE_METADATA_KEY.input] = headers["langsmith-trace"];
            metadata[BAGGAGE_METADATA_KEY.input] = headers["baggage"];
            // honor the tracingEnabled flag if coming from traceable
            if (runTree.tracingEnabled != null) {
                defaultEnabled = runTree.tracingEnabled;
            }
        }
        catch {
            // pass
        }
        if (metadata[RUN_ID_METADATA_KEY.input] &&
            metadata[TRACE_METADATA_KEY.input]) {
            throw new Error("Cannot provide `runId` when used within traceable function.");
        }
        return { ...rest, isEnabled: rest.isEnabled ?? defaultEnabled, metadata };
    }
    /** @internal */
    parseInteropFromMetadata(span, parentSpan) {
        if (!this.isRootRun(span))
            return undefined;
        if (parentSpan?.name === "ai.toolCall") {
            return undefined;
        }
        const userTraceId = this.getSpanAttributeKey(span, RUN_ID_METADATA_KEY.output);
        const parentTrace = this.getSpanAttributeKey(span, TRACE_METADATA_KEY.output);
        if (parentTrace && userTraceId) {
            throw new Error(`Cannot provide both "${RUN_ID_METADATA_KEY.input}" and "${TRACE_METADATA_KEY.input}" metadata keys.`);
        }
        if (parentTrace) {
            const parentRunTree = index_js_1.RunTree.fromHeaders({
                "langsmith-trace": parentTrace,
                baggage: this.getSpanAttributeKey(span, BAGGAGE_METADATA_KEY.output) || "",
            });
            if (!parentRunTree)
                throw new Error("Unreachable code: empty parent run tree");
            return { type: "traceable", parentRunTree };
        }
        if (userTraceId)
            return { type: "user", userRunId: userTraceId };
        return undefined;
    }
    /** @internal */
    getRunCreate(span, projectName) {
        const asRunCreate = (rawConfig) => {
            const aiMetadata = Object.keys(span.attributes)
                .filter((key) => key.startsWith("ai.telemetry.metadata.") &&
                !RESERVED_METADATA_KEYS.includes(key))
                .reduce((acc, key) => {
                acc[key.slice("ai.telemetry.metadata.".length)] =
                    span.attributes[key];
                return acc;
            }, {});
            if (("ai.telemetry.functionId" in span.attributes &&
                span.attributes["ai.telemetry.functionId"]) ||
                ("resource.name" in span.attributes && span.attributes["resource.name"])) {
                aiMetadata["functionId"] =
                    span.attributes["ai.telemetry.functionId"] ||
                        span.attributes["resource.name"];
            }
            const parsedStart = convertToTimestamp(span.startTime);
            const parsedEnd = convertToTimestamp(span.endTime);
            let name = rawConfig.name;
            // if user provided a custom name, only use it if it's the root
            if (this.isRootRun(span)) {
                name =
                    this.getSpanAttributeKey(span, RUN_NAME_METADATA_KEY.output) || name;
            }
            const config = {
                ...rawConfig,
                name,
                extra: {
                    ...rawConfig.extra,
                    metadata: {
                        ...rawConfig.extra?.metadata,
                        ...aiMetadata,
                        "ai.operationId": span.attributes["ai.operationId"],
                    },
                },
                session_name: projectName ??
                    this.projectName ??
                    (0, env_js_1.getLangSmithEnvironmentVariable)("PROJECT") ??
                    (0, env_js_1.getLangSmithEnvironmentVariable)("SESSION"),
                start_time: Math.min(parsedStart, parsedEnd),
                end_time: Math.max(parsedStart, parsedEnd),
            };
            return config;
        };
        switch (span.name) {
            case "ai.generateText.doGenerate":
            case "ai.generateText":
            case "ai.streamText.doStream":
            case "ai.streamText": {
                const inputs = (() => {
                    if ("ai.prompt.messages" in span.attributes) {
                        return {
                            messages: tryJson(span.attributes["ai.prompt.messages"]).flatMap((i) => convertCoreToSmith(i)),
                        };
                    }
                    if ("ai.prompt" in span.attributes) {
                        const input = tryJson(span.attributes["ai.prompt"]);
                        if (typeof input === "object" &&
                            input != null &&
                            "messages" in input &&
                            Array.isArray(input.messages)) {
                            return {
                                messages: input.messages.flatMap((i) => convertCoreToSmith(i)),
                            };
                        }
                        return { input };
                    }
                    return {};
                })();
                const outputs = (() => {
                    let result = undefined;
                    if (span.attributes["ai.response.toolCalls"]) {
                        let content = tryJson(span.attributes["ai.response.toolCalls"]);
                        if (Array.isArray(content)) {
                            content = content.map((i) => ({
                                type: "tool-call",
                                ...i,
                                args: tryJson(i.args),
                            }));
                        }
                        result = {
                            llm_output: convertCoreToSmith({
                                role: "assistant",
                                content,
                            }),
                        };
                    }
                    else if (span.attributes["ai.response.text"]) {
                        result = {
                            llm_output: convertCoreToSmith({
                                role: "assistant",
                                content: span.attributes["ai.response.text"],
                            }),
                        };
                    }
                    return result;
                })();
                const invocationParams = (() => {
                    if ("ai.prompt.tools" in span.attributes) {
                        return {
                            tools: span.attributes["ai.prompt.tools"].flatMap((tool) => {
                                try {
                                    return JSON.parse(tool);
                                }
                                catch {
                                    // pass
                                }
                                return [];
                            }),
                        };
                    }
                    return {};
                })();
                const events = [];
                const firstChunkEvent = span.events.find((i) => i.name === "ai.stream.firstChunk");
                if (firstChunkEvent) {
                    events.push({
                        name: "new_token",
                        time: convertToTimestamp(firstChunkEvent.time),
                    });
                }
                const runType = span.name === "ai.generateText" || span.name === "ai.streamText"
                    ? "chain"
                    : "llm";
                const error = span.status?.code === 2 ? span.status.message : undefined;
                const usageMetadata = (0, vercel_js_1.extractUsageMetadata)(span);
                // TODO: add first_token_time
                return asRunCreate({
                    run_type: runType,
                    name: span.attributes["ai.model.provider"],
                    error,
                    inputs,
                    outputs,
                    events,
                    extra: {
                        invocation_params: invocationParams,
                        batch_size: 1,
                        metadata: {
                            usage_metadata: usageMetadata,
                            ls_provider: span.attributes["ai.model.provider"]
                                .split(".")
                                .at(0),
                            ls_model_type: span.attributes["ai.model.provider"]
                                .split(".")
                                .at(1),
                            ls_model_name: span.attributes["ai.model.id"],
                        },
                    },
                });
            }
            case "ai.toolCall": {
                const args = tryJson(span.attributes["ai.toolCall.input"] ??
                    span.attributes["ai.toolCall.args"]);
                let inputs = { args };
                if (typeof args === "object" && args != null) {
                    inputs = args;
                }
                const output = tryJson(span.attributes["ai.toolCall.output"] ??
                    span.attributes["ai.toolCall.result"]);
                let outputs = { output };
                if (typeof output === "object" && output != null) {
                    outputs = output;
                }
                const error = span.status?.code === 2 ? span.status.message : undefined;
                return asRunCreate({
                    run_type: "tool",
                    name: span.attributes["ai.toolCall.name"],
                    error,
                    extra: error
                        ? {
                            metadata: {
                                usage_metadata: {
                                    input_tokens: 0,
                                    output_tokens: 0,
                                    total_tokens: 0,
                                },
                            },
                        }
                        : undefined,
                    inputs,
                    outputs,
                });
            }
            case "ai.streamObject":
            case "ai.streamObject.doStream":
            case "ai.generateObject":
            case "ai.generateObject.doGenerate": {
                const inputs = (() => {
                    if ("ai.prompt.messages" in span.attributes) {
                        return {
                            messages: tryJson(span.attributes["ai.prompt.messages"]).flatMap((i) => convertCoreToSmith(i)),
                        };
                    }
                    if ("ai.prompt" in span.attributes) {
                        return { input: tryJson(span.attributes["ai.prompt"]) };
                    }
                    return {};
                })();
                const outputs = (() => {
                    let result = undefined;
                    if (span.attributes["ai.response.object"]) {
                        result = {
                            output: tryJson(span.attributes["ai.response.object"]),
                        };
                    }
                    return result;
                })();
                const events = [];
                const firstChunkEvent = span.events.find((i) => i.name === "ai.stream.firstChunk");
                if (firstChunkEvent) {
                    events.push({
                        name: "new_token",
                        time: convertToTimestamp(firstChunkEvent.time),
                    });
                }
                const runType = span.name === "ai.generateObject" || span.name === "ai.streamObject"
                    ? "chain"
                    : "llm";
                const error = span.status?.code === 2 ? span.status.message : undefined;
                const usageMetadata = (0, vercel_js_1.extractUsageMetadata)(span);
                return asRunCreate({
                    run_type: runType,
                    name: span.attributes["ai.model.provider"],
                    error,
                    inputs,
                    outputs,
                    events,
                    extra: {
                        batch_size: 1,
                        metadata: {
                            usage_metadata: usageMetadata,
                            ls_provider: span.attributes["ai.model.provider"]
                                .split(".")
                                .at(0),
                            ls_model_type: span.attributes["ai.model.provider"]
                                .split(".")
                                .at(1),
                            ls_model_name: span.attributes["ai.model.id"],
                        },
                    },
                });
            }
            case "ai.embed":
            case "ai.embed.doEmbed":
            case "ai.embedMany":
            case "ai.embedMany.doEmbed":
            default:
                return undefined;
        }
    }
    /** @internal */
    isRootRun(span) {
        switch (span.name) {
            case "ai.generateText":
            case "ai.streamText":
            case "ai.generateObject":
            case "ai.streamObject":
            case "ai.embed":
            case "ai.embedMany":
                return true;
            default:
                return false;
        }
    }
    _export(spans, resultCallback) {
        this.logDebug("exporting spans", spans);
        const typedSpans = spans
            .concat(Object.values(this.pendingSpans))
            .slice()
            // Parent spans should go before child spans in the final order,
            // but may have the same exact start time as their children.
            // They will end earlier, so break ties by end time.
            // TODO: Figure out why this happens.
            .sort((a, b) => sortByHr(a, b));
        for (const span of typedSpans) {
            const { traceId, spanId } = span.spanContext();
            const runId = (0, uuid_1.v5)(spanId, RUN_ID_NAMESPACE);
            let parentId = getParentSpanId(span);
            if (constants_js_1.LANGSMITH_IS_ROOT in span.attributes) {
                parentId = undefined;
            }
            else if (constants_js_1.LANGSMITH_TRACEABLE_PARENT_OTEL_SPAN_ID in span.attributes &&
                typeof span.attributes[constants_js_1.LANGSMITH_TRACEABLE_PARENT_OTEL_SPAN_ID] ===
                    "string") {
                parentId = span.attributes[constants_js_1.LANGSMITH_TRACEABLE_PARENT_OTEL_SPAN_ID];
            }
            let parentRunId = parentId
                ? (0, uuid_1.v5)(parentId, RUN_ID_NAMESPACE)
                : undefined;
            let parentSpanInfo = parentRunId
                ? this.seenSpanInfo[parentRunId]
                : undefined;
            // Unrelated, untraced spans should behave as passthroughs from LangSmith's perspective.
            while (parentSpanInfo != null &&
                this.getRunCreate(parentSpanInfo.span) == null) {
                parentId = getParentSpanId(parentSpanInfo.span);
                if (parentId == null) {
                    break;
                }
                parentRunId = parentId ? (0, uuid_1.v5)(parentId, RUN_ID_NAMESPACE) : undefined;
                parentSpanInfo = parentRunId
                    ? this.seenSpanInfo[parentRunId]
                    : undefined;
            }
            // Export may be called in any order, so we need to queue any spans with missing parents
            // for retry later in order to determine whether their parents are tool calls
            // and should not be reparented below.
            if (parentRunId !== undefined && parentSpanInfo === undefined) {
                this.pendingSpans[spanId] = span;
                continue;
            }
            else {
                delete this.pendingSpans[spanId];
            }
            this.traceByMap[traceId] ??= {
                childMap: {},
                nodeMap: {},
                relativeExecutionOrder: {},
            };
            const traceMap = this.traceByMap[traceId];
            traceMap.relativeExecutionOrder[parentRunId ?? ROOT] ??= -1;
            traceMap.relativeExecutionOrder[parentRunId ?? ROOT] += 1;
            const interop = this.parseInteropFromMetadata(span, parentSpanInfo?.span);
            const projectName = (interop?.type === "traceable"
                ? interop.parentRunTree.project_name
                : undefined) ?? parentSpanInfo?.projectName;
            const run = this.getRunCreate(span, projectName);
            traceMap.nodeMap[runId] ??= {
                id: runId,
                startTime: span.startTime,
                run,
                sent: false,
                interop,
                executionOrder: traceMap.relativeExecutionOrder[parentRunId ?? ROOT],
            };
            if (this.seenSpanInfo[runId] == null) {
                this.seenSpanInfo[runId] = {
                    span,
                    dotOrder: joinDotOrder(parentSpanInfo?.dotOrder, getDotOrder(traceMap.nodeMap[runId])),
                    projectName,
                    sent: false,
                };
            }
            if (this.debug)
                console.log(`[${span.name}] ${runId}`, run);
            traceMap.childMap[parentRunId ?? ROOT] ??= [];
            traceMap.childMap[parentRunId ?? ROOT].push(traceMap.nodeMap[runId]);
        }
        const sampled = [];
        const actions = [];
        for (const traceId of Object.keys(this.traceByMap)) {
            const traceMap = this.traceByMap[traceId];
            const queue = Object.keys(traceMap.childMap)
                .map((runId) => {
                if (runId === ROOT) {
                    return traceMap.childMap[runId];
                }
                return [];
            })
                .flat();
            const seen = new Set();
            while (queue.length) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const task = queue.shift();
                if (seen.has(task.id))
                    continue;
                let taskDotOrder = this.seenSpanInfo[task.id].dotOrder;
                if (!task.sent) {
                    if (task.run != null) {
                        if (task.interop?.type === "user") {
                            actions.push({
                                type: "rename",
                                sourceRunId: task.id,
                                targetRunId: task.interop.userRunId,
                            });
                        }
                        if (task.interop?.type === "traceable") {
                            actions.push({
                                type: "reparent",
                                runId: task.id,
                                parentDotOrder: task.interop.parentRunTree.dotted_order,
                            });
                        }
                        for (const action of actions) {
                            if (action.type === "delete") {
                                taskDotOrder = removeDotOrder(taskDotOrder, action.runId);
                            }
                            if (action.type === "reparent") {
                                taskDotOrder = reparentDotOrder(taskDotOrder, action.runId, action.parentDotOrder);
                            }
                            if (action.type === "rename") {
                                taskDotOrder = taskDotOrder.replace(action.sourceRunId, action.targetRunId);
                            }
                        }
                        this.seenSpanInfo[task.id].dotOrder = taskDotOrder;
                        if (!this.seenSpanInfo[task.id].sent) {
                            sampled.push({
                                ...task.run,
                                ...getMutableRunCreate(taskDotOrder),
                            });
                        }
                        this.seenSpanInfo[task.id].sent = true;
                    }
                    else {
                        actions.push({ type: "delete", runId: task.id });
                    }
                    task.sent = true;
                }
                const children = traceMap.childMap[task.id] ?? [];
                queue.push(...children);
            }
        }
        this.logDebug(`sampled runs to be sent to LangSmith`, sampled);
        Promise.all(sampled.map((run) => this.client.createRun(run))).then(() => resultCallback({ code: 0 }), (error) => resultCallback({ code: 1, error }));
    }
    export(spans, resultCallback) {
        this._export(spans, (result) => {
            if (result.code === 0) {
                // Empty export to try flushing pending spans to rule out any trace order shenanigans
                this._export([], resultCallback);
            }
            else {
                resultCallback(result);
            }
        });
    }
    async shutdown() {
        // find nodes which are incomplete
        const incompleteNodes = Object.values(this.traceByMap).flatMap((trace) => Object.values(trace.nodeMap).filter((i) => !i.sent && i.run != null));
        this.logDebug("shutting down", { incompleteNodes });
        if (incompleteNodes.length > 0) {
            console.warn("Some incomplete nodes were found before shutdown and not sent to LangSmith.");
        }
        await this.forceFlush();
    }
    async forceFlush() {
        await new Promise((resolve) => {
            this.export([], resolve);
        });
        await this.client.awaitPendingTraceBatches();
    }
    logDebug(...args) {
        if (!this.debug)
            return;
        console.debug(`[${new Date().toISOString()}] [LangSmith]`, ...args);
    }
}
exports.AISDKExporter = AISDKExporter;
