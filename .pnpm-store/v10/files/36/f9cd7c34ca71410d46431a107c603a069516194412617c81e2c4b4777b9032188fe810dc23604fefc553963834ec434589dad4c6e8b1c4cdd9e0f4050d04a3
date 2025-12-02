import type { generateText } from "ai";
import { Client } from "./index.js";
/** @deprecated Use `wrapAISDK` from `langsmith/experimental/vercel` instead. */
export type AITelemetrySettings = Exclude<Parameters<typeof generateText>[0]["experimental_telemetry"], undefined>;
/** @deprecated Use `wrapAISDK` from `langsmith/experimental/vercel` instead. */
export interface TelemetrySettings extends AITelemetrySettings {
    /** ID of the run sent to LangSmith */
    runId?: string;
    /** Name of the run sent to LangSmith */
    runName?: string;
}
export declare const parseStrippedIsoTime: (stripped: string) => string;
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
export declare class AISDKExporter {
    private client;
    private traceByMap;
    private seenSpanInfo;
    private pendingSpans;
    private debug;
    private projectName?;
    constructor(args?: {
        client?: Client;
        debug?: boolean;
        projectName?: string;
    });
    static getSettings(settings?: TelemetrySettings): {
        isEnabled: boolean;
        metadata: {
            [x: string]: import("@opentelemetry/api").AttributeValue;
        };
        recordInputs?: boolean;
        recordOutputs?: boolean;
        functionId?: string;
        tracer?: import("@opentelemetry/api").Tracer;
    };
    _export(spans: unknown[], resultCallback: (result: {
        code: 0 | 1;
        error?: Error;
    }) => void): void;
    export(spans: unknown[], resultCallback: (result: {
        code: 0 | 1;
        error?: Error;
    }) => void): void;
    shutdown(): Promise<void>;
    forceFlush(): Promise<void>;
    protected logDebug(...args: Parameters<typeof console.debug>): void;
}
