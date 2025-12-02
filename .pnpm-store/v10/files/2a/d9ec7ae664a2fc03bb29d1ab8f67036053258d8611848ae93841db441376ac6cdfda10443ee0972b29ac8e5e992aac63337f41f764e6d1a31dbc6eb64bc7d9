import { type AiAdapter } from "../adapter.js";
export interface GeminiAiAdapter extends AiAdapter {
    /**
     * Format of the IO for this model
     */
    format: "gemini";
    "~types": {
        input: GeminiAiAdapter.Input;
        output: GeminiAiAdapter.Output;
    };
}
export declare namespace GeminiAiAdapter {
    type Input = GenerateContentRequest;
    type Output = GenerateContentResponse;
    /**
     * The model that will complete your prompt.
     * See [models](https://ai.google.dev/models/gemini) for additional
     * details and options.
     */
    type Model = (string & {}) | "gemini-1.5-flash" | "gemini-1.5-flash-8b" | "gemini-1.5-pro" | "gemini-1.0-pro" | "gemini-2.0-flash" | "gemini-2.0-flash-lite" | "gemini-2.5-pro" | "gemini-2.5-flash" | "gemini-2.5-flash-lite-preview-06-17" | "text-embedding-004" | "aqa";
    interface GenerateContentRequest {
        /**
         * Required. The content of the current conversation with the model.
         * For single-turn queries, this is a single instance. For multi-turn queries like chat,
         * this is a repeated field that contains the conversation history and the latest request.
         */
        contents: Array<Content>;
        /**
         * Optional. A list of `Tools` the `Model` may use to generate the next response.
         */
        tools?: Array<Tool>;
        /**
         * Optional. Tool configuration for any `Tool` specified in the request.
         */
        toolConfig?: ToolConfig;
        /**
         * Optional. A list of unique `SafetySetting` instances for blocking unsafe content.
         */
        safetySettings?: Array<SafetySetting>;
        /**
         * Optional. Developer set system instruction(s). Currently, text only.
         */
        systemInstruction?: Content;
        /**
         * Optional. Configuration options for model generation and outputs.
         */
        generationConfig?: GenerationConfig;
        /**
         * Optional. The name of the content cached to use as context to serve the prediction.
         * Format: `cachedContents/{cachedContent}`
         */
        cachedContent?: string;
    }
    interface Content {
        /**
         * The parts that make up the content of the message.
         * A Part can be either a text or an image.
         */
        parts: Array<Part>;
        /**
         * The role of the entity that is creating this message.
         */
        role?: "user" | "model" | "system";
    }
    /**
     * A part of the content. Can be text, image, video, audio, document, function call, or function response.
     *
     * ⚠️ **Inngest Limitation**: While Inngest's step.ai supports sending multimodal content
     * (images, videos, audio, documents) to Gemini models, workflow processing capabilities
     * are optimized for text-based interactions.
     */
    type Part = TextPart | ImagePart | VideoPart | AudioPart | DocumentPart | FunctionCallPart | FunctionResponsePart;
    interface TextPart {
        /**
         * The text content.
         */
        text: string;
        /**
         * Whether this text part contains a thought summary.
         *
         * **Understanding Thought Parts:**
         * When thinking is enabled with `includeThoughts: true`, the model can return
         * thought summaries that provide insights into the model's internal reasoning process.
         * These appear as separate text parts in the response with `thought: true`.
         *
         * **Response Structure:**
         * - `thought: true` = This part contains reasoning/thinking content
         * - `thought: false` or `undefined` = This part contains the final answer
         *
         * @example Processing thought vs. answer parts
         * ```typescript
         * response.candidates[0].content.parts.forEach(part => {
         *   if (part.text) {
         *     if (part.thought) {
         *       console.log("🧠 Reasoning:", part.text);
         *     } else {
         *       console.log("💡 Answer:", part.text);
         *     }
         *   }
         * });
         * ```
         *
         * @example Separating thoughts from final response
         * ```typescript
         * const thoughts = response.candidates[0].content.parts
         *   .filter(part => part.thought && part.text)
         *   .map(part => part.text);
         *
         * const finalAnswer = response.candidates[0].content.parts
         *   .filter(part => !part.thought && part.text)
         *   .map(part => part.text)
         *   .join('');
         * ```
         *
         * @see {@link ThinkingConfig.includeThoughts} - Enable this feature
         * @see {@link https://ai.google.dev/gemini-api/docs/thinking | Thinking Documentation}
         *
         * **Note:** You can identify thought summaries by checking this boolean property when
         * iterating through the response parts.
         */
        thought?: boolean;
    }
    interface ImagePart {
        /**
         * Inline image data.
         */
        inlineData: {
            /**
             * Base64 encoded image data.
             */
            data: string;
            /**
             * The MIME type of the image data.
             */
            mimeType: string;
        };
    }
    interface VideoPart {
        /**
         * Inline video data.
         */
        inlineData: {
            /**
             * Base64 encoded video data.
             */
            data: string;
            /**
             * The MIME type of the video data.
             */
            mimeType: string;
        };
    }
    interface AudioPart {
        /**
         * Inline audio data.
         */
        inlineData: {
            /**
             * Base64 encoded audio data.
             */
            data: string;
            /**
             * The MIME type of the audio data.
             */
            mimeType: string;
        };
    }
    interface DocumentPart {
        /**
         * Inline document data.
         */
        inlineData: {
            /**
             * Base64 encoded document data.
             */
            data: string;
            /**
             * The MIME type of the document data.
             */
            mimeType: string;
        };
        /**
         * Document URL.
         */
        fileData?: {
            /**
             * The URL of the document.
             */
            fileUri: string;
            /**
             * The MIME type of the document.
             */
            mimeType: string;
        };
    }
    interface FunctionCallPart {
        /**
         * The function call.
         */
        functionCall: {
            /**
             * The name of the function to call.
             */
            name: string;
            /**
             * The arguments to pass to the function.
             */
            args: Record<string, unknown>;
        };
    }
    interface FunctionResponsePart {
        /**
         * The function response.
         */
        functionResponse: {
            /**
             * The name of the function that was called.
             */
            name: string;
            /**
             * The response from the function.
             */
            response: Record<string, unknown>;
        };
    }
    interface Tool {
        /**
         * The function declaration.
         */
        functionDeclarations: Array<FunctionDeclaration>;
    }
    interface FunctionDeclaration {
        /**
         * The name of the function.
         */
        name: string;
        /**
         * The description of the function.
         */
        description?: string;
        /**
         * The parameters of the function.
         */
        parameters: {
            /**
             * The type of the parameters.
             */
            type: string;
            /**
             * The properties of the parameters.
             */
            properties?: Record<string, {
                type: string;
                description?: string;
            }>;
            /**
             * The required parameters.
             */
            required?: Array<string>;
        };
    }
    interface ToolConfig {
        /**
         * Tool configuration settings.
         */
        functionCallingConfig?: {
            /**
             * Mode for function calling.
             */
            mode?: "AUTO" | "ANY" | "NONE";
            /**
             * Allowed functions to call.
             */
            allowedFunctionNames?: Array<string>;
        };
    }
    interface SafetySetting {
        /**
         * The category for this setting.
         */
        category: HarmCategory;
        /**
         * Controls the probability threshold at which harm is blocked.
         */
        threshold: HarmBlockThreshold;
    }
    enum HarmCategory {
        HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED",
        HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH",
        HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT",
        HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT",
        HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY"
    }
    enum HarmBlockThreshold {
        HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
        BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE",
        BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE",
        BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH",
        BLOCK_NONE = "BLOCK_NONE",
        OFF = "OFF"
    }
    /**
     * Configuration options for model generation and outputs.
     *
     * Use this interface to control how Gemini generates responses, from basic parameters
     * like temperature and token limits to advanced features like thinking, structured output,
     * and multimodal responses.
     *
     * @example Basic text generation
     * ```typescript
     * const config: GenerationConfig = {
     *   temperature: 0.7,
     *   maxOutputTokens: 1000,
     *   stopSequences: ["\n\n"]
     * };
     * ```
     *
     * @example Structured JSON output
     * ```typescript
     * const config: GenerationConfig = {
     *   responseMimeType: "application/json",
     *   responseSchema: {
     *     type: "object",
     *     properties: {
     *       name: { type: "string" },
     *       age: { type: "number" }
     *     }
     *   }
     * };
     * ```
     *
     * @example Thinking mode for complex reasoning
     * ```typescript
     * const config: GenerationConfig = {
     *   thinkingConfig: {
     *     thinkingBudget: 2048,  // Higher budget for complex tasks
     *     includeThoughts: true   // Get reasoning insights
     *   }
     * };
     * ```
     *
     * @see {@link https://ai.google.dev/gemini-api/docs/text-generation | Gemini Text Generation Guide}
     * @see {@link https://ai.google.dev/gemini-api/docs/thinking | Gemini Thinking Guide}
     * @see {@link https://ai.google.dev/gemini-api/docs/structured-output | Structured Output Guide}
     */
    interface GenerationConfig {
        /**
         * Controls the randomness of the output.
         *
         * **Recommended Values:**
         * - `0.0-0.3`: Deterministic, factual responses (good for Q&A, analysis)
         * - `0.4-0.7`: Balanced creativity and consistency (good for general chat)
         * - `0.8-1.0`: Highly creative responses (good for creative writing)
         * - `1.0+`: Maximum creativity, may be less coherent
         *
         * Values can range over [0.0, 2.0], inclusive. A value closer to 0.0 will produce
         * more focused and deterministic responses, while higher values increase randomness
         * and creativity.
         *
         * @example
         * ```typescript
         * // For factual Q&A
         * temperature: 0.1
         *
         * // For creative writing
         * temperature: 0.9
         * ```
         *
         * @see {@link topP} - Use together with topP for fine-tuned control
         * @see {@link seed} - Use with seed for reproducible results
         *
         * Note: The default value varies by model.
         */
        temperature?: number;
        /**
         * The maximum cumulative probability of tokens to consider when sampling (nucleus sampling).
         *
         * **Recommended Values:**
         * - `0.1-0.3`: Very focused responses, less diverse vocabulary
         * - `0.8-0.95`: Balanced approach (most common)
         * - `0.95-1.0`: Full vocabulary range
         *
         * The model uses combined Top-k and Top-p (nucleus) sampling. Tokens are sorted
         * based on their assigned probabilities so that only the most likely tokens are
         * considered. Top-k sampling directly limits the maximum number of tokens to consider,
         * while Nucleus sampling limits the number of tokens based on the cumulative probability.
         *
         * @example
         * ```typescript
         * // Conservative, focused responses
         * topP: 0.8,
         * topK: 40
         *
         * // More diverse vocabulary
         * topP: 0.95,
         * topK: undefined  // Let topP handle it
         * ```
         *
         * @see {@link temperature} - Use together for optimal control
         * @see {@link topK} - Alternative token limiting approach
         *
         * Note: The default value varies by Model and is specified by the Model.top_p
         * attribute returned from the getModel function.
         */
        topP?: number;
        /**
         * The maximum number of tokens to consider when sampling.
         *
         * **Recommended Values:**
         * - `1-10`: Very focused responses (good for factual queries)
         * - `20-40`: Balanced approach (most common)
         * - `40+`: More creative responses
         *
         * Gemini models use Top-p (nucleus) sampling or a combination of Top-k and nucleus
         * sampling. Top-k sampling considers the set of topK most probable tokens. Models
         * running with nucleus sampling don't allow topK setting.
         *
         * **Tip:** If you're using topP, you might not need topK. Many developers prefer
         * topP for more natural control over response diversity.
         *
         * @example
         * ```typescript
         * // Very deterministic
         * topK: 1,
         * temperature: 0.1
         *
         * // Balanced creativity
         * topK: 40,
         * topP: 0.9
         * ```
         *
         * @see {@link topP} - Often preferred over topK
         * @see {@link temperature} - Use together for fine control
         *
         * Note: The default value varies by Model. An empty topK attribute indicates
         * that the model doesn't apply top-k sampling and doesn't allow setting topK on requests.
         */
        topK?: number;
        /**
         * The maximum number of tokens to include in a response candidate.
         *
         * **Planning Your Token Budget:**
         * - **Short answers:** 50-200 tokens
         * - **Paragraph responses:** 200-500 tokens
         * - **Articles/Essays:** 1000-4000 tokens
         * - **Long-form content:** 4000+ tokens
         *
         * **Important:** When using thinking models, this limit applies to the final response,
         * not the thinking tokens (which are controlled by `thinkingBudget`).
         *
         * @example
         * ```typescript
         * // Quick answers
         * maxOutputTokens: 100
         *
         * // Detailed explanations
         * maxOutputTokens: 1000
         *
         * // Long-form content
         * maxOutputTokens: 4000
         * ```
         *
         * @see {@link thinkingConfig.thinkingBudget} - Controls thinking tokens separately
         * @see {@link stopSequences} - Alternative way to control response length
         *
         * Note: The default value varies by model, see the Model.output_token_limit
         * attribute of the Model returned from the getModel function.
         */
        maxOutputTokens?: number;
        /**
         * The set of character sequences (up to 5) that will stop output generation.
         *
         * **Common Use Cases:**
         * - Stop at double newlines: `["\n\n"]`
         * - Stop at specific markers: `["END", "STOP"]`
         * - Stop at code block endings: `["```"]`
         * - Stop at section breaks: `["---", "###"]`
         *
         * If specified, the API will stop at the first appearance of a stop_sequence.
         * The stop sequence will not be included as part of the response.
         *
         * @example
         * ```typescript
         * // Stop at paragraph breaks
         * stopSequences: ["\n\n"]
         *
         * // Stop at multiple markers
         * stopSequences: ["END", "CONCLUSION", "---"]
         *
         * // Stop at code block end
         * stopSequences: ["```"]
         * ```
         *
         * @see {@link maxOutputTokens} - Hard limit on response length
         *
         * **Limit:** Maximum of 5 sequences
         */
        stopSequences?: Array<string>;
        /**
         * Presence penalty applied to the next token's logprobs if the token has already
         * been seen in the response.
         *
         * **Recommended Values:**
         * - `0.0`: No penalty (default)
         * - `0.1-0.5`: Light penalty, reduces some repetition
         * - `0.6-1.0`: Strong penalty, encourages new vocabulary
         * - `1.0+`: Maximum penalty, strong vocabulary diversity
         *
         * This penalty is binary on/off and not dependent on the number of times the token
         * is used (after the first). Use frequencyPenalty for a penalty that increases with each use.
         *
         * **Use Case:** Preventing the model from repeating the same concepts or words.
         *
         * @example
         * ```typescript
         * // Reduce repetitive language
         * presencePenalty: 0.3,
         *
         * // Strong diversity (creative writing)
         * presencePenalty: 0.8,
         * frequencyPenalty: 0.5
         * ```
         *
         * @see {@link frequencyPenalty} - Complementary penalty that increases with usage
         *
         * A positive penalty will discourage the use of tokens that have already been used
         * in the response, increasing the vocabulary.
         *
         * A negative penalty will encourage the use of tokens that have already been used
         * in the response, decreasing the vocabulary.
         */
        presencePenalty?: number;
        /**
         * Frequency penalty applied to the next token's logprobs, multiplied by the number
         * of times each token has been seen in the response so far.
         *
         * **Recommended Values:**
         * - `0.0`: No penalty (default)
         * - `0.1-0.3`: Light penalty, natural reduction of repetition
         * - `0.4-0.7`: Moderate penalty, noticeable vocabulary expansion
         * - `0.8-1.0`: Strong penalty, maximum vocabulary diversity
         *
         * A positive penalty will discourage the use of tokens that have already been used,
         * proportional to the number of times the token has been used: The more a token is
         * used, the more difficult it is for the model to use that token again increasing
         * the vocabulary of responses.
         *
         * **Use Case:** Preventing the model from getting stuck in repetitive loops.
         *
         * @example
         * ```typescript
         * // Prevent repetitive patterns
         * frequencyPenalty: 0.2,
         *
         * // Maximum vocabulary diversity
         * presencePenalty: 0.6,
         * frequencyPenalty: 0.8
         * ```
         *
         * @see {@link presencePenalty} - Binary penalty for any repeated token
         *
         * **Caution:** A negative penalty will encourage the model to reuse tokens proportional
         * to the number of times the token has been used. Small negative values will reduce
         * the vocabulary of a response. Larger negative values will cause the model to start
         * repeating a common token until it hits the maxOutputTokens limit.
         */
        frequencyPenalty?: number;
        /**
         * MIME type of the generated candidate text.
         *
         * **Supported Types:**
         * - `"text/plain"`: Default text output
         * - `"application/json"`: Structured JSON responses
         * - `"text/x.enum"`: Enum string responses
         *
         * **Common Use Cases:**
         * - API responses that need structured data
         * - Form validation with specific formats
         * - Data extraction with consistent schema
         *
         * @example
         * ```typescript
         * // JSON API response
         * responseMimeType: "application/json",
         * responseSchema: {
         *   type: "object",
         *   properties: {
         *     status: { type: "string" },
         *     data: { type: "array" }
         *   }
         * }
         *
         * // Plain text (default)
         * responseMimeType: "text/plain"
         * ```
         *
         * @see {@link responseSchema} - Define JSON structure when using application/json
         * @see {@link responseJsonSchema} - Alternative JSON schema format
         * @see {@link https://ai.google.dev/gemini-api/docs/structured-output | Structured Output Guide}
         *
         * Refer to the docs for a list of all supported text MIME types.
         */
        responseMimeType?: string;
        /**
         * Output schema of the generated candidate text. Schemas must be a subset of the
         * OpenAPI schema and can be objects, primitives or arrays.
         *
         * **Schema Examples:**
         *
         * @example Simple object
         * ```typescript
         * responseSchema: {
         *   type: "object",
         *   properties: {
         *     name: { type: "string" },
         *     age: { type: "number" },
         *     active: { type: "boolean" }
         *   },
         *   required: ["name"]
         * }
         * ```
         *
         * @example Array of objects
         * ```typescript
         * responseSchema: {
         *   type: "array",
         *   items: {
         *     type: "object",
         *     properties: {
         *       id: { type: "string" },
         *       title: { type: "string" }
         *     }
         *   }
         * }
         * ```
         *
         * @example Enum values
         * ```typescript
         * responseSchema: {
         *   type: "string",
         *   enum: ["approved", "pending", "rejected"]
         * }
         * ```
         *
         * If set, a compatible responseMimeType must also be set. Compatible MIME types:
         * - `application/json`: Schema for JSON response
         *
         * @see {@link responseMimeType} - Must be "application/json" when using schemas
         * @see {@link responseJsonSchema} - Alternative format for JSON schemas
         * @see {@link https://ai.google.dev/gemini-api/docs/structured-output | Structured Output Guide}
         *
         * Refer to the JSON text generation guide for more details.
         */
        responseSchema?: object;
        /**
         * Output schema of the generated response. This is an alternative to responseSchema
         * that accepts JSON Schema format.
         *
         * **When to Use:**
         * - You already have JSON Schema definitions
         * - You need features not supported in OpenAPI subset
         * - You're migrating from other systems using JSON Schema
         *
         * If set, responseSchema must be omitted, but responseMimeType is required.
         *
         * **Supported JSON Schema Features:**
         * - `$id`, `$defs`, `$ref`, `$anchor`
         * - `type`, `format`, `title`, `description`
         * - `enum` (for strings and numbers)
         * - `items`, `prefixItems`, `minItems`, `maxItems`
         * - `minimum`, `maximum`, `anyOf`, `oneOf`
         * - `properties`, `additionalProperties`, `required`
         * - `propertyOrdering` (non-standard)
         *
         * @example
         * ```typescript
         * responseJsonSchema: {
         *   "$schema": "http://json-schema.org/draft-07/schema#",
         *   "type": "object",
         *   "properties": {
         *     "users": {
         *       "type": "array",
         *       "items": { "$ref": "#/$defs/User" }
         *     }
         *   },
         *   "$defs": {
         *     "User": {
         *       "type": "object",
         *       "properties": {
         *         "name": { "type": "string" }
         *       }
         *     }
         *   }
         * }
         * ```
         *
         * @see {@link responseSchema} - Simpler OpenAPI-style alternative
         * @see {@link responseMimeType} - Must be set to "application/json"
         *
         * **Note:** Cyclic references are unrolled to a limited degree and may only be
         * used within non-required properties.
         */
        responseJsonSchema?: object;
        /**
         * The requested modalities of the response. Represents the set of modalities that
         * the model can return, and should be expected in the response.
         *
         * **Available Modalities:**
         * - `"text"`: Text responses (default)
         * - `"image"`: Generated images
         * - `"audio"`: Generated audio/speech
         *
         * This is an exact match to the modalities of the response. A model may have
         * multiple combinations of supported modalities. If the requested modalities do
         * not match any of the supported combinations, an error will be returned.
         *
         * An empty list is equivalent to requesting only text.
         *
         * @example
         * ```typescript
         * // Text only (default)
         * responseModalities: ["text"]
         *
         * // Text with images
         * responseModalities: ["text", "image"]
         *
         * // Audio responses
         * responseModalities: ["audio"]
         * ```
         *
         * ⚠️ **Inngest Limitation**: Inngest's step.ai currently only supports text-based
         * responses. While you can request other modalities (images, audio), Inngest
         * workflows cannot process non-text response content.
         *
         * @see {@link speechConfig} - Configure audio generation parameters
         */
        responseModalities?: Array<string>;
        /**
         * Number of generated responses to return.
         *
         * **Use Cases:**
         * - `1`: Single best response (default, most efficient)
         * - `2-5`: Multiple options for A/B testing or variety
         * - `>5`: Batch generation for analysis
         *
         * If unset, this will default to 1.
         *
         * @example
         * ```typescript
         * // Generate multiple creative options
         * candidateCount: 3,
         * temperature: 0.8
         *
         * // Single deterministic response
         * candidateCount: 1,
         * temperature: 0.1
         * ```
         *
         * @see {@link temperature} - Higher temperatures work well with multiple candidates
         *
         * **Note:** This doesn't work for previous generation models (Gemini 1.0 family).
         * **Cost Impact:** Multiple candidates multiply your token usage.
         */
        candidateCount?: number;
        /**
         * Seed used in decoding for reproducible results.
         *
         * **Use Cases:**
         * - Testing and debugging with consistent outputs
         * - A/B testing with controlled variables
         * - Reproducible research experiments
         * - Generating consistent examples in documentation
         *
         * If not set, the request uses a randomly generated seed.
         *
         * @example
         * ```typescript
         * // Reproducible responses
         * seed: 12345,
         * temperature: 0.7  // Still get creative responses, but consistently
         *
         * // Different seed for variation
         * seed: 67890,
         * temperature: 0.7
         * ```
         *
         * @see {@link temperature} - Combine with temperature for controlled randomness
         *
         * **Note:** Same seed + same parameters = same response (usually)
         */
        seed?: number;
        /**
         * If true, export the logprobs results in response.
         *
         * **Use Cases:**
         * - Analyzing model confidence in responses
         * - Building custom scoring systems
         * - Research and model analysis
         * - Detecting uncertain or low-confidence outputs
         *
         * @example
         * ```typescript
         * // Get detailed probability information
         * responseLogprobs: true,
         * logprobs: 5  // Top 5 token probabilities
         * ```
         *
         * @see {@link logprobs} - Control how many top probabilities to return
         *
         * **Performance Note:** Enabling logprobs may slightly increase response time.
         */
        responseLogprobs?: boolean;
        /**
         * Only valid if responseLogprobs=True. This sets the number of top logprobs to
         * return at each decoding step in the Candidate.logprobs_result.
         *
         * **Recommended Values:**
         * - `1-3`: Basic confidence analysis
         * - `5-10`: Detailed probability analysis
         * - `10+`: Research and deep analysis
         *
         * @example
         * ```typescript
         * // Basic confidence checking
         * responseLogprobs: true,
         * logprobs: 3
         *
         * // Detailed analysis
         * responseLogprobs: true,
         * logprobs: 10
         * ```
         *
         * @see {@link responseLogprobs} - Must be true to use this parameter
         *
         * **Performance Note:** Higher values increase response size and processing time.
         */
        logprobs?: number;
        /**
         * Enables enhanced civic answers. It may not be available for all models.
         *
         * **Use Cases:**
         * - Political or civic information queries
         * - Elections and voting information
         * - Government and policy discussions
         * - Public affairs and civic engagement
         *
         * @example
         * ```typescript
         * // For civic/political content
         * enableEnhancedCivicAnswers: true
         * ```
         *
         * **Note:** Check model documentation for availability.
         */
        enableEnhancedCivicAnswers?: boolean;
        /**
         * The speech generation config.
         *
         * **Configuration Options:**
         * - Voice selection and characteristics
         * - Speech rate and pitch control
         * - Audio format preferences
         * - Language and accent settings
         *
         * @example
         * ```typescript
         * speechConfig: {
         *   voice: "en-US-Journey-F",
         *   rate: 1.0,
         *   pitch: 0.0
         * }
         * ```
         *
         * @see {@link responseModalities} - Include "audio" to enable speech output
         * @see {@link https://ai.google.dev/gemini-api/docs/audio-generation | Audio Generation Guide}
         *
         * ⚠️ **Inngest Limitation**: Inngest's step.ai currently does not support
         * text-to-speech capabilities. This property can be set but the generated
         * audio output cannot be processed within Inngest workflows.
         */
        speechConfig?: object;
        /**
         * Config for thinking features. An error will be returned if this field is set
         * for models that don't support thinking.
         *
         * **When to Use Thinking:**
         * - Complex mathematical problems
         * - Multi-step reasoning tasks
         * - Code analysis and debugging
         * - Research and analysis tasks
         * - Planning and strategy problems
         *
         * **Performance Trade-offs:**
         * - Higher thinking budget = better reasoning but slower responses
         * - Lower thinking budget = faster responses but simpler reasoning
         * - Dynamic thinking = optimal balance based on task complexity
         *
         * @example
         * ```typescript
         * // Complex reasoning task
         * thinkingConfig: {
         *   thinkingBudget: 4096,  // High budget for complex problems
         *   includeThoughts: true   // See the reasoning process
         * }
         *
         * // Quick task with light thinking
         * thinkingConfig: {
         *   thinkingBudget: 512,
         *   includeThoughts: false
         * }
         *
         * // Dynamic thinking (recommended)
         * thinkingConfig: {
         *   thinkingBudget: -1,     // Let model decide
         *   includeThoughts: true
         * }
         * ```
         *
         * @see {@link ThinkingConfig} - Detailed configuration options
         * @see {@link https://ai.google.dev/gemini-api/docs/thinking | Gemini Thinking Guide}
         *
         * **Supported Models:** Gemini 2.5 series models only.
         */
        thinkingConfig?: ThinkingConfig;
        /**
         * If specified, the media resolution specified will be used.
         *
         * **Resolution Options:**
         * - `MEDIA_RESOLUTION_LOW`: Faster processing, lower quality
         * - `MEDIA_RESOLUTION_MEDIUM`: Balanced approach (recommended)
         * - `MEDIA_RESOLUTION_HIGH`: Best quality, slower processing
         * - `MEDIA_RESOLUTION_UNSPECIFIED`: Use model default
         *
         * **Use Cases:**
         * - Low: Quick prototyping, thumbnails
         * - Medium: General use, good balance
         * - High: Final production, detailed analysis
         *
         * @example
         * ```typescript
         * // High quality for production
         * mediaResolution: "MEDIA_RESOLUTION_HIGH"
         *
         * // Fast processing for prototypes
         * mediaResolution: "MEDIA_RESOLUTION_LOW"
         * ```
         *
         * **Note:** Affects both input processing and output generation speed.
         */
        mediaResolution?: "MEDIA_RESOLUTION_UNSPECIFIED" | "MEDIA_RESOLUTION_LOW" | "MEDIA_RESOLUTION_MEDIUM" | "MEDIA_RESOLUTION_HIGH";
    }
    /**
     * Configuration options for thinking features in Gemini models.
     *
     * Thinking features allow the model to use an internal "thinking process" that
     * significantly improves their reasoning and multi-step planning abilities, making
     * them highly effective for complex tasks such as coding, advanced mathematics,
     * and data analysis.
     *
     * **When to Enable Thinking:**
     * - Mathematical problem solving
     * - Code debugging and analysis
     * - Multi-step reasoning tasks
     * - Research and planning
     * - Complex decision making
     *
     * **Performance Considerations:**
     * - Thinking tokens are separate from output tokens
     * - Higher budgets = better reasoning but increased cost and latency
     * - Dynamic thinking (-1) automatically adjusts based on task complexity
     *
     * @example Basic thinking setup
     * ```typescript
     * const thinkingConfig: ThinkingConfig = {
     *   thinkingBudget: 1024,     // Moderate thinking budget
     *   includeThoughts: true     // Show reasoning process
     * };
     * ```
     *
     * @example Dynamic thinking (recommended)
     * ```typescript
     * const thinkingConfig: ThinkingConfig = {
     *   thinkingBudget: -1,       // Let model decide optimal budget
     *   includeThoughts: true     // Get insights into reasoning
     * };
     * ```
     *
     * @example High-complexity tasks
     * ```typescript
     * const thinkingConfig: ThinkingConfig = {
     *   thinkingBudget: 8192,     // Maximum budget for complex problems
     *   includeThoughts: true     // Essential for debugging reasoning
     * };
     * ```
     *
     * @example Fast execution mode
     * ```typescript
     * const thinkingConfig: ThinkingConfig = {
     *   thinkingBudget: 512,      // Minimal thinking for speed
     *   includeThoughts: false    // Skip thought summaries for faster responses
     * };
     * ```
     *
     * @see {@link https://ai.google.dev/gemini-api/docs/thinking | Gemini Thinking Guide}
     * @see {@link GenerationConfig.maxOutputTokens} - Controls final response length separately
     *
     * **Supported Models:** Gemini 2.5 series models only.
     * **Pricing Note:** You're charged for both thinking tokens and output tokens.
     */
    interface ThinkingConfig {
        /**
         * The number of thinking tokens to use when generating a response.
         *
         * **Recommended Budgets by Task Type:**
         *
         * **Simple Tasks (128-512 tokens):**
         * - Basic math problems
         * - Simple code explanations
         * - Straightforward analysis
         *
         * **Medium Tasks (512-2048 tokens):**
         * - Multi-step calculations
         * - Code debugging
         * - Research summaries
         * - Planning tasks
         *
         * **Complex Tasks (2048-8192 tokens):**
         * - Advanced mathematics
         * - Complex code analysis
         * - Multi-layered reasoning
         * - Research with multiple sources
         *
         * **Special Values:**
         * - `0`: Disable thinking entirely (faster, less reasoning)
         * - `-1`: **Dynamic thinking** - model chooses optimal budget automatically
         *
         * A higher token count generally allows for more detailed reasoning, which can be
         * beneficial for tackling more complex tasks. If latency is more important, use a
         * lower budget or disable thinking by setting thinkingBudget to 0.
         *
         * Setting the thinkingBudget to -1 turns on **dynamic thinking**, meaning the model
         * will adjust the budget based on the complexity of the request.
         *
         * **Model-Specific Ranges:**
         * - **Gemini 2.5 Pro**: 128 to 32768 (cannot disable thinking)
         * - **Gemini 2.5 Flash**: 0 to 24576 (thinkingBudget = 0 disables thinking)
         * - **Gemini 2.5 Flash Lite**: 512 to 24576 (thinkingBudget = 0 disables thinking)
         *
         * @example Task-specific budgets
         * ```typescript
         * // Simple math problem
         * thinkingBudget: 256
         *
         * // Code debugging
         * thinkingBudget: 1024
         *
         * // Complex research analysis
         * thinkingBudget: 4096
         *
         * // Let model decide (recommended)
         * thinkingBudget: -1
         * ```
         *
         * @example Performance vs. quality trade-offs
         * ```typescript
         * // Maximum speed, minimal thinking
         * thinkingBudget: 0,        // Gemini Flash/Flash Lite only
         * includeThoughts: false
         *
         * // Balanced approach
         * thinkingBudget: 1024,
         * includeThoughts: true
         *
         * // Maximum reasoning quality
         * thinkingBudget: 8192,
         * includeThoughts: true
         * ```
         *
         * @see {@link includeThoughts} - Control whether to return reasoning summaries
         * @see {@link GenerationConfig.maxOutputTokens} - Separate limit for final response
         *
         * **Important:** Depending on the prompt, the model might overflow or underflow the token budget.
         * **Pricing:** You're charged for all thinking tokens used, even if they don't appear in the response.
         */
        thinkingBudget?: number;
        /**
         * Whether to include thought summaries in the response.
         *
         * **What are Thought Summaries?**
         * Thought summaries are synthesized versions of the model's raw thoughts and offer
         * insights into the model's internal reasoning process. They help you understand
         * how the model arrived at its conclusion.
         *
         * **When to Enable (true):**
         * - Debugging model reasoning
         * - Educational content showing problem-solving steps
         * - Research and analysis tasks
         * - Building trust through transparency
         * - Complex problem solving where process matters
         *
         * **When to Disable (false):**
         * - Production APIs where only final answers matter
         * - High-throughput applications optimizing for speed
         * - Simple tasks where reasoning isn't important
         * - Minimizing response size and processing time
         *
         * **Technical Details:**
         * - Thinking budgets apply to the model's raw thoughts, not summaries
         * - Summaries are additional content beyond the raw thinking tokens
         * - You can identify thought parts by checking the `thought` property on text parts
         *
         * @example Accessing thought summaries
         * ```typescript
         * // Enable thought summaries
         * const config = {
         *   thinkingConfig: {
         *     thinkingBudget: 2048,
         *     includeThoughts: true
         *   }
         * };
         *
         * // Process response to separate thoughts from final answer
         * response.candidates[0].content.parts.forEach(part => {
         *   if (part.thought) {
         *     console.log("Reasoning:", part.text);
         *   } else {
         *     console.log("Final Answer:", part.text);
         *   }
         * });
         * ```
         *
         * @example Educational math problem
         * ```typescript
         * // Show step-by-step reasoning for learning
         * const config = {
         *   thinkingConfig: {
         *     thinkingBudget: 1024,
         *     includeThoughts: true    // Students can see the thinking process
         *   }
         * };
         * ```
         *
         * @example Production API
         * ```typescript
         * // Fast responses, no reasoning shown
         * const config = {
         *   thinkingConfig: {
         *     thinkingBudget: 512,
         *     includeThoughts: false   // Only final answers for API consumers
         *   }
         * };
         * ```
         *
         * @see {@link thinkingBudget} - Controls how much thinking the model does
         * @see {@link https://ai.google.dev/gemini-api/docs/thinking | Thought Summaries Documentation}
         *
         * **Response Structure:** When enabled, you can access the summary by iterating through
         * the response parameter's parts, and checking the `thought` boolean property.
         */
        includeThoughts?: boolean;
    }
    interface GenerateContentResponse {
        /**
         * The generated response from the model.
         */
        candidates?: Array<Candidate>;
        /**
         * Usage metadata about the response.
         */
        usageMetadata?: UsageMetadata;
        /**
         * Prompt feedback related to the input prompt.
         */
        promptFeedback?: PromptFeedback;
        /**
         * Error information.
         */
        error?: {
            code: number;
            message: string;
            status: string;
        };
    }
    interface Candidate {
        /**
         * The generated content.
         */
        content: Content;
        /**
         * The reason why the model stopped generating tokens.
         */
        finishReason?: "FINISH_REASON_UNSPECIFIED" | "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER";
        /**
         * Safety ratings for the content.
         */
        safetyRatings?: Array<SafetyRating>;
        /**
         * Citation information for model-generated content.
         */
        citationMetadata?: CitationMetadata;
    }
    interface SafetyRating {
        /**
         * The category for this rating.
         */
        category: HarmCategory;
        /**
         * The probability of harm for this content.
         */
        probability: "HARM_PROBABILITY_UNSPECIFIED" | "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
        /**
         * Whether this content was blocked because of this rating.
         */
        blocked?: boolean;
    }
    interface CitationMetadata {
        /**
         * Citations for sources attributed in the content.
         */
        citations?: Array<Citation>;
    }
    interface Citation {
        /**
         * The citation source.
         */
        startIndex?: number;
        /**
         * The end index of the citation in the content.
         */
        endIndex?: number;
        /**
         * The URI of the source.
         */
        uri?: string;
        /**
         * The title of the source.
         */
        title?: string;
        /**
         * The license of the source.
         */
        license?: string;
        /**
         * The publication date of the source.
         */
        publicationDate?: string;
    }
    /**
     * Usage metadata about the response, including token counts and costs.
     *
     * **Understanding Token Usage:**
     * - `promptTokenCount`: Tokens in your input (prompt, images, etc.)
     * - `candidatesTokenCount`: Tokens in the generated response text
     * - `totalTokenCount`: Total tokens processed (prompt + candidates + thinking)
     * - `thoughtsTokenCount`: Tokens used for internal reasoning (when thinking enabled)
     *
     * **Cost Calculation:**
     * Total cost = (promptTokenCount × input_price) + (candidatesTokenCount × output_price) + (thoughtsTokenCount × output_price)
     *
     * @example Monitoring token usage
     * ```typescript
     * const usage = response.usageMetadata;
     * console.log(`Input tokens: ${usage.promptTokenCount}`);
     * console.log(`Output tokens: ${usage.candidatesTokenCount}`);
     * console.log(`Thinking tokens: ${usage.thoughtsTokenCount || 0}`);
     * console.log(`Total tokens: ${usage.totalTokenCount}`);
     * ```
     *
     * @example Cost estimation
     * ```typescript
     * const usage = response.usageMetadata;
     * const inputCost = usage.promptTokenCount * INPUT_PRICE_PER_TOKEN;
     * const outputCost = (usage.candidatesTokenCount + (usage.thoughtsTokenCount || 0)) * OUTPUT_PRICE_PER_TOKEN;
     * const totalCost = inputCost + outputCost;
     * ```
     *
     * @see {@link https://ai.google.dev/pricing | Gemini API Pricing}
     */
    interface UsageMetadata {
        /**
         * The number of tokens in the prompt.
         *
         * **What's Included:**
         * - Text content in your messages
         * - Encoded images, videos, audio files
         * - Function declarations and tool configs
         * - System instructions
         *
         * **Cost Impact:** Input tokens are typically cheaper than output tokens.
         *
         * @example
         * ```typescript
         * // This affects promptTokenCount:
         * const request = {
         *   contents: [{ parts: [{ text: "Hello, world!" }] }],  // ~3 tokens
         *   systemInstruction: { parts: [{ text: "Be helpful" }] }, // ~2 tokens
         *   tools: [...] // Additional tokens for function declarations
         * };
         * ```
         */
        promptTokenCount?: number;
        /**
         * The number of tokens in the response candidates.
         *
         * **What's Included:**
         * - Generated text content
         * - Function call responses
         * - Structured JSON output
         *
         * **What's NOT Included:**
         * - Thinking tokens (counted separately in `thoughtsTokenCount`)
         * - Metadata or system-generated content
         *
         * **Cost Impact:** Output tokens are typically more expensive than input tokens.
         *
         * @example
         * ```typescript
         * // Ways to control candidatesTokenCount:
         * const config = {
         *   maxOutputTokens: 500,        // Hard limit
         *   stopSequences: ["\n\n"],     // Early stopping
         *   responseMimeType: "application/json"  // Can affect token efficiency
         * };
         * ```
         *
         * @see {@link GenerationConfig.maxOutputTokens} - Control response length
         */
        candidatesTokenCount?: number;
        /**
         * The total number of tokens processed in this request.
         *
         * **Calculation:**
         * `totalTokenCount = promptTokenCount + candidatesTokenCount + thoughtsTokenCount`
         *
         * **Use Cases:**
         * - Overall usage monitoring
         * - Rate limiting calculations
         * - Performance optimization
         * - Cost tracking across requests
         *
         * @example Usage monitoring
         * ```typescript
         * const usage = response.usageMetadata;
         *
         * // Log total usage
         * console.log(`Total tokens used: ${usage.totalTokenCount}`);
         *
         * // Check against limits
         * if (usage.totalTokenCount > DAILY_TOKEN_LIMIT) {
         *   console.warn("Approaching daily token limit");
         * }
         *
         * // Calculate efficiency
         * const efficiency = usage.candidatesTokenCount / usage.totalTokenCount;
         * console.log(`Output efficiency: ${(efficiency * 100).toFixed(1)}%`);
         * ```
         */
        totalTokenCount?: number;
        /**
         * The number of thinking tokens generated when thinking is enabled.
         *
         * **Important Details:**
         * - Only present when using thinking models (Gemini 2.5+)
         * - These are "internal" tokens used for reasoning
         * - You're charged for these tokens at output token rates
         * - Not included in `candidatesTokenCount`
         *
         * **Cost Impact:**
         * When thinking is turned on, response pricing is the sum of output tokens and thinking tokens.
         * This field provides the total number of generated thinking tokens.
         *
         * **Optimization Tips:**
         * - Use lower `thinkingBudget` for cost control
         * - Use `thinkingBudget: -1` for dynamic allocation
         * - Set `thinkingBudget: 0` to disable thinking entirely (Flash models only)
         *
         * @example Thinking cost analysis
         * ```typescript
         * const usage = response.usageMetadata;
         *
         * if (usage.thoughtsTokenCount) {
         *   console.log(`Thinking tokens: ${usage.thoughtsTokenCount}`);
         *   console.log(`Final answer tokens: ${usage.candidatesTokenCount}`);
         *
         *   const thinkingRatio = usage.thoughtsTokenCount / usage.totalTokenCount;
         *   console.log(`Thinking ratio: ${(thinkingRatio * 100).toFixed(1)}%`);
         *
         *   // Cost breakdown
         *   const thinkingCost = usage.thoughtsTokenCount * OUTPUT_PRICE_PER_TOKEN;
         *   const answerCost = usage.candidatesTokenCount * OUTPUT_PRICE_PER_TOKEN;
         *   console.log(`Thinking cost: ${thinkingCost}, Answer cost: ${answerCost}`);
         * }
         * ```
         *
         * @example Optimizing thinking usage
         * ```typescript
         * // Monitor thinking efficiency
         * const usage = response.usageMetadata;
         * const thinkingEfficiency = usage.candidatesTokenCount / (usage.thoughtsTokenCount || 1);
         *
         * if (thinkingEfficiency < 0.1) {
         *   console.warn("High thinking-to-output ratio - consider lower thinkingBudget");
         * }
         * ```
         *
         * @see {@link ThinkingConfig.thinkingBudget} - Control thinking token allocation
         * @see {@link https://ai.google.dev/gemini-api/docs/thinking | Thinking Pricing Details}
         *
         * **Note:** This field will be `undefined` for models that don't support thinking or when thinking is disabled.
         */
        thoughtsTokenCount?: number;
    }
    interface PromptFeedback {
        /**
         * The safety ratings for the prompt.
         */
        safetyRatings?: Array<SafetyRating>;
        /**
         * Whether the prompt was blocked.
         */
        blockReason?: "BLOCK_REASON_UNSPECIFIED" | "SAFETY" | "OTHER";
    }
}
//# sourceMappingURL=gemini.d.ts.map