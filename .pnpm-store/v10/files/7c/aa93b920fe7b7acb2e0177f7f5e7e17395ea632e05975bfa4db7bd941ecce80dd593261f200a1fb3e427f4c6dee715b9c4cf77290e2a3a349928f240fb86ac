import type { MastraDBMessage } from '../../agent/message-list/index.js';
import type { MastraModelConfig } from '../../llm/model/shared.types.js';
import type { TracingContext } from '../../observability/index.js';
import type { ChunkType } from '../../stream/index.js';
import type { Processor } from '../index.js';
export interface SystemPromptScrubberOptions {
    /** Strategy to use when system prompts are detected: 'block' | 'warn' | 'filter' | 'redact' */
    strategy?: 'block' | 'warn' | 'filter' | 'redact';
    /** Custom patterns to detect system prompts (regex strings) */
    customPatterns?: string[];
    /** Whether to include detection details in warnings */
    includeDetections?: boolean;
    /** Custom instructions for the detection agent */
    instructions?: string;
    /** Redaction method: 'mask' | 'placeholder' | 'remove' */
    redactionMethod?: 'mask' | 'placeholder' | 'remove';
    /** Custom placeholder text for redaction */
    placeholderText?: string;
    /** Model to use for the detection agent */
    model: MastraModelConfig;
    /**
     * Structured output options used for the detection agent
     */
    structuredOutputOptions?: {
        /**
         * Whether to use system prompt injection instead of native response format to coerce the LLM to respond with json text if the LLM does not natively support structured outputs.
         */
        jsonPromptInjection?: boolean;
    };
}
export interface SystemPromptDetectionResult {
    /** Specific detections with locations */
    detections: SystemPromptDetection[] | null;
    /** Redacted content if available */
    redacted_content?: string | null;
    /** Reason for detection */
    reason: string | null;
}
export interface SystemPromptDetection {
    /** Type of system prompt detected */
    type: string;
    /** The detected content */
    value: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Start position in text */
    start: number;
    /** End position in text */
    end: number;
    /** Redacted value if available */
    redacted_value: string | null;
}
export declare class SystemPromptScrubber implements Processor<'system-prompt-scrubber'> {
    readonly id = "system-prompt-scrubber";
    readonly name = "System Prompt Scrubber";
    private strategy;
    private customPatterns;
    private includeDetections;
    private instructions;
    private redactionMethod;
    private placeholderText;
    private model;
    private detectionAgent;
    private structuredOutputOptions?;
    constructor(options: SystemPromptScrubberOptions);
    /**
     * Process streaming chunks to detect and handle system prompts
     */
    processOutputStream(args: {
        part: ChunkType;
        streamParts: ChunkType[];
        state: Record<string, any>;
        abort: (reason?: string) => never;
        tracingContext?: TracingContext;
    }): Promise<ChunkType | null>;
    /**
     * Process the final result (non-streaming)
     * Removes or redacts system prompts from assistant messages
     */
    processOutputResult({ messages, abort, tracingContext, }: {
        messages: MastraDBMessage[];
        abort: (reason?: string) => never;
        tracingContext?: TracingContext;
    }): Promise<MastraDBMessage[]>;
    /**
     * Detect system prompts in text using the detection agent
     */
    private detectSystemPrompts;
    /**
     * Redact text based on detected system prompts
     */
    private redactText;
    /**
     * Extract text content from a message
     */
    private extractTextFromMessage;
    /**
     * Create a redacted message with the given text
     */
    private createRedactedMessage;
    /**
     * Get default instructions for the detection agent
     */
    private getDefaultInstructions;
}
//# sourceMappingURL=system-prompt-scrubber.d.ts.map