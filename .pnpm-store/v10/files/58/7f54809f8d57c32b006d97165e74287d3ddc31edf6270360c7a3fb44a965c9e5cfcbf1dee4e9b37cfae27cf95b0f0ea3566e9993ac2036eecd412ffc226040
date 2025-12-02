import { type AiAdapter } from "../adapter.js";
/**
 * An OpenAI model using the OpenAI Responses API I/O format.
 *
 * This adapter is intentionally minimal: it defines typings and surface
 * configuration only. It does not implement SSE parsing; streaming is
 * executor-driven when callers set `stream: true`.
 */
export interface OpenAiResponsesAdapter extends AiAdapter {
    /** The format of the I/O for this model. */
    format: "openai-responses";
    "~types": {
        /** Request body for POST /v1/responses */
        input: OpenAiResponsesApi.Request;
        /** Response body from POST /v1/responses */
        output: OpenAiResponsesApi.Response;
    };
}
export declare namespace OpenAiResponsesApi {
    /**
     * Built-in and custom tools configuration.
     * - Built-ins: typed pass-through for MVP (e.g., web_search, file_search)
     * - Custom functions: fully typed
     */
    type Tool = {
        type: "web_search" | "file_search" | (string & {});
        [k: string]: unknown;
    } | {
        type: "function";
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
        /**
         * In Responses API, functions are strict by default. Allow explicit control.
         */
        strict?: boolean;
    };
    type ToolChoice = "auto" | "required" | "none" | {
        type: string;
        [k: string]: unknown;
    };
    /**
     * Request body for POST /v1/responses
     * Matches the OpenAI Responses API. Fields we don't model deeply are left as pass-through.
     */
    interface Request {
        /** Model ID to use (e.g., gpt-5, gpt-4o, etc.) */
        model?: string;
        /** Text, or an array of structured items; MVP focuses on string input. */
        input?: string | any[];
        /** System/developer guidance separate from input */
        instructions?: string | null;
        /** Built-in tools and custom function tools the model may call */
        tools?: Tool[];
        /** How the model should select tools */
        tool_choice?: ToolChoice;
        /** Whether tool calls can run in parallel (defaults to true) */
        parallel_tool_calls?: boolean;
        /** Whether to store responses by default (defaults to true) */
        store?: boolean;
        /** Temperature (0..2); defaults to 1 */
        temperature?: number;
        /** Nucleus sampling; defaults to 1 */
        top_p?: number;
        /** Upper bound for generated tokens (visible + reasoning) */
        max_output_tokens?: number | null;
        /** Number of top logprobs per token (0..20) */
        top_logprobs?: number | null;
        /** Reasoning model options (pass-through) */
        reasoning?: Record<string, any> | null;
        /** Prompt cache bucketing */
        prompt_cache_key?: string | null;
        /** Per-user safety identifier */
        safety_identifier?: string | null;
        /** Arbitrary metadata */
        metadata?: Record<string, string> | null;
        /** Service tier control */
        service_tier?: "auto" | "default" | "flex" | "priority";
        /** Truncation strategy */
        truncation?: "auto" | "disabled";
        /** Limits total built-in tool calls processed in a single response */
        max_tool_calls?: number;
        /** Control additional data included in response */
        include?: string[];
        /** Run in the background */
        background?: boolean;
        /** Conversation linkage or object */
        conversation?: string | Record<string, any> | null;
        /** Chain on a previous response */
        previous_response_id?: string | null;
        /** Text output configuration including structured outputs */
        text?: {
            /** Controls verbosity of textual outputs for GPT-5 family models. */
            verbosity?: "low" | "medium" | "high";
            format?: {
                type: "text";
            } | {
                type: "json_schema";
                name?: string;
                strict?: boolean;
                schema?: Record<string, any>;
            };
        } | null;
        /** Optional prompt template config */
        prompt?: Record<string, any> | null;
        /** Enable SSE streaming; caller-controlled */
        stream?: boolean;
        /** Streaming options when stream=true; pass-through */
        stream_options?: Record<string, any> | null;
    }
    /**
     * Response body for POST /v1/responses
     */
    interface Response {
        id: string;
        object: "response" | string;
        created_at: number;
        status: string;
        error?: unknown | null;
        incomplete_details?: unknown | null;
        instructions?: string | null;
        max_output_tokens?: number | null;
        model: string;
        output: Item[];
        parallel_tool_calls?: boolean;
        previous_response_id?: string | null;
        reasoning?: {
            effort?: unknown;
            summary?: unknown;
        } | null;
        store?: boolean;
        temperature?: number | null;
        text?: {
            format?: {
                type: string;
            } | Record<string, unknown>;
        } | null;
        tool_choice?: ToolChoice | null;
        tools?: Tool[] | null;
        top_p?: number | null;
        truncation?: "auto" | "disabled";
        usage?: {
            input_tokens: number;
            input_tokens_details?: {
                cached_tokens?: number;
            };
            output_tokens: number;
            output_tokens_details?: {
                reasoning_tokens?: number;
            };
            total_tokens: number;
        } | null;
        user?: string | null;
        metadata?: Record<string, unknown> | null;
    }
    type Item = MessageItem | FunctionCallItem | FunctionCallOutputItem | {
        type: string;
        [k: string]: unknown;
    };
    interface MessageItem {
        id: string;
        type: "message";
        status: string;
        role: "assistant" | "user" | (string & {});
        content: MessageContentPart[];
    }
    type MessageContentPart = {
        type: "output_text";
        text: string;
        annotations?: any[];
        logprobs?: any[];
    } | {
        type: string;
        [k: string]: unknown;
    };
    interface FunctionCallItem {
        id: string;
        type: "function_call";
        name: string;
        arguments: string;
        call_id: string;
    }
    interface FunctionCallOutputItem {
        id?: string;
        type: "function_call_output";
        call_id: string;
        output?: any;
    }
}
//# sourceMappingURL=openai-responses.d.ts.map