/**
 * Semantic conventions for OpenInference tracing
 */
export declare const SemanticAttributePrefixes: {
    readonly input: "input";
    readonly output: "output";
    readonly llm: "llm";
    readonly retrieval: "retrieval";
    readonly reranker: "reranker";
    readonly messages: "messages";
    readonly message: "message";
    readonly document: "document";
    readonly embedding: "embedding";
    readonly tool: "tool";
    readonly tool_call: "tool_call";
    readonly metadata: "metadata";
    readonly tag: "tag";
    readonly session: "session";
    readonly user: "user";
    readonly openinference: "openinference";
    readonly message_content: "message_content";
    readonly image: "image";
    readonly audio: "audio";
    readonly prompt: "prompt";
    readonly agent: "agent";
    readonly graph: "graph";
};
export declare const LLMAttributePostfixes: {
    readonly provider: "provider";
    readonly system: "system";
    readonly model_name: "model_name";
    readonly token_count: "token_count";
    readonly input_messages: "input_messages";
    readonly output_messages: "output_messages";
    readonly invocation_parameters: "invocation_parameters";
    readonly prompts: "prompts";
    readonly prompt_template: "prompt_template";
    readonly function_call: "function_call";
    readonly tools: "tools";
    readonly cost: "cost";
};
export declare const LLMPromptTemplateAttributePostfixes: {
    readonly variables: "variables";
    readonly template: "template";
};
export declare const RetrievalAttributePostfixes: {
    readonly documents: "documents";
};
export declare const RerankerAttributePostfixes: {
    readonly input_documents: "input_documents";
    readonly output_documents: "output_documents";
    readonly query: "query";
    readonly model_name: "model_name";
    readonly top_k: "top_k";
};
export declare const EmbeddingAttributePostfixes: {
    readonly embeddings: "embeddings";
    readonly text: "text";
    readonly model_name: "model_name";
    readonly vector: "vector";
};
export declare const ToolAttributePostfixes: {
    readonly name: "name";
    readonly description: "description";
    readonly parameters: "parameters";
    readonly json_schema: "json_schema";
};
export declare const MessageAttributePostfixes: {
    readonly role: "role";
    readonly content: "content";
    readonly contents: "contents";
    readonly name: "name";
    readonly function_call_name: "function_call_name";
    readonly function_call_arguments_json: "function_call_arguments_json";
    readonly tool_calls: "tool_calls";
    readonly tool_call_id: "tool_call_id";
};
export declare const MessageContentsAttributePostfixes: {
    readonly type: "type";
    readonly text: "text";
    readonly image: "image";
};
export declare const ImageAttributesPostfixes: {
    readonly url: "url";
};
export declare const ToolCallAttributePostfixes: {
    readonly function_name: "function.name";
    readonly function_arguments_json: "function.arguments";
    readonly id: "id";
};
export declare const DocumentAttributePostfixes: {
    readonly id: "id";
    readonly content: "content";
    readonly score: "score";
    readonly metadata: "metadata";
};
export declare const TagAttributePostfixes: {
    readonly tags: "tags";
};
export declare const SessionAttributePostfixes: {
    readonly id: "id";
};
export declare const UserAttributePostfixes: {
    readonly id: "id";
};
export declare const AudioAttributesPostfixes: {
    readonly url: "url";
    readonly mime_type: "mime_type";
    readonly transcript: "transcript";
};
export declare const PromptAttributePostfixes: {
    readonly vendor: "vendor";
    readonly id: "id";
    readonly url: "url";
};
export declare const AgentPostfixes: {
    readonly name: "name";
};
export declare const GraphPostfixes: {
    readonly node_id: "node.id";
    readonly node_name: "node.name";
    readonly node_parent_id: "node.parent_id";
};
/**
 * The input to any span
 */
export declare const INPUT_VALUE: "input.value";
export declare const INPUT_MIME_TYPE: "input.mime_type";
/**
 * The output of any span
 */
export declare const OUTPUT_VALUE: "output.value";
export declare const OUTPUT_MIME_TYPE: "output.mime_type";
/**
 * The messages sent to the LLM for completions
 * Typically seen in OpenAI chat completions
 * @see https://beta.openai.com/docs/api-reference/completions/create
 */
export declare const LLM_INPUT_MESSAGES: "llm.input_messages";
/**
 * The prompts sent to the LLM for completions
 * Typically seen in OpenAI legacy completions
 * @see https://beta.openai.com/docs/api-reference/completions/create
 */
export declare const LLM_PROMPTS: "llm.prompts";
/**
 * The JSON representation of the parameters passed to the LLM
 */
export declare const LLM_INVOCATION_PARAMETERS: "llm.invocation_parameters";
/**
 * The messages received from the LLM for completions
 * Typically seen in OpenAI chat completions
 * @see https://platform.openai.com/docs/api-reference/chat/object#choices-message
 */
export declare const LLM_OUTPUT_MESSAGES: "llm.output_messages";
/**
 * The name of the LLM model
 */
export declare const LLM_MODEL_NAME: "llm.model_name";
/**
 * The provider of the inferences. E.g. the cloud provider
 */
export declare const LLM_PROVIDER: "llm.provider";
/**
 * The AI product as identified by the client or server
 */
export declare const LLM_SYSTEM: "llm.system";
/** Token count for the completion by the llm (in tokens) */
export declare const LLM_TOKEN_COUNT_COMPLETION: "llm.token_count.completion";
/** Token count for the reasoning steps in the completion (in tokens) */
export declare const LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING: "llm.token_count.completion_details.reasoning";
/** Token count for audio input generated by the model (in tokens) */
export declare const LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO: "llm.token_count.completion_details.audio";
/** Token count for the prompt to the llm (in tokens) */
export declare const LLM_TOKEN_COUNT_PROMPT: "llm.token_count.prompt";
/** Token count for the tokens written to cache (in tokens) */
export declare const LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE: "llm.token_count.prompt_details.cache_write";
/** Token count for the tokens retrieved from cache (in tokens) */
export declare const LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ: "llm.token_count.prompt_details.cache_read";
/** Token count for the input tokens in the prompt that were cached (in tokens) */
export declare const LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_INPUT: "llm.token_count.prompt_details.cache_input";
/** Token count for audio input presented in the prompt (in tokens) */
export declare const LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO: "llm.token_count.prompt_details.audio";
/** Token count for the entire transaction with the llm (in tokens) */
export declare const LLM_TOKEN_COUNT_TOTAL: "llm.token_count.total";
/**
 * Key prefix for additional prompt token count details. Each detail should be a separate attribute
 * with this prefix, e.g. llm.token_count.prompt_details.reasoning, llm.token_count.prompt_details.audio.
 * All values should be in tokens (integer count of tokens).
 */
export declare const LLM_TOKEN_COUNT_PROMPT_DETAILS: "llm.token_count.prompt_details";
/**
 * Key prefix for additional completion token count details. Each detail should be a separate attribute
 * with this prefix, e.g. llm.token_count.completion_details.reasoning, llm.token_count.completion_details.audio.
 * All values should be in tokens (integer count of tokens).
 */
export declare const LLM_TOKEN_COUNT_COMPLETION_DETAILS: "llm.token_count.completion_details";
/**
 * Key prefix for cost information. When these keys are transformed into a JSON-like structure, it would look like:
 * {
 *     "prompt": 0.0021,  # Cost in USD
 *     "completion": 0.0045,  # Cost in USD
 *     "total": 0.0066,  # Cost in USD
 *     "completion_details": {
 *         "output": 0.0009,  # Cost in USD
 *         "reasoning": 0.0024,    # Cost in USD (e.g., 80 tokens * $0.03/1K tokens)
 *         "audio": 0.0012  # Cost in USD (e.g., 40 tokens * $0.03/1K tokens)
 *     },
 *     "prompt_details": {
 *         "input": 0.0003,  # Cost in USD
 *         "cache_write": 0.0006,  # Cost in USD (e.g., 20 tokens * $0.03/1K tokens)
 *         "cache_read": 0.0003,   # Cost in USD (e.g., 10 tokens * $0.03/1K tokens)
 *         "cache_input": 0.0006,  # Cost in USD (e.g., 20 tokens * $0.03/1K tokens)
 *         "audio": 0.0003   # Cost in USD (e.g., 10 tokens * $0.03/1K tokens)
 *     }
 * }
 * Note: This is a key prefix - individual attributes are stored as separate span attributes with this prefix,
 * e.g. llm.cost.prompt, llm.cost.completion_details.reasoning, etc. The JSON structure shown above represents
 * how these separate attributes can be conceptually organized.
 * All monetary values are in USD with floating point precision.
 */
export declare const LLM_COST: "llm.cost";
/** Cost of the prompt tokens in USD */
export declare const LLM_COST_PROMPT: "llm.cost.prompt";
/** Cost of the completion tokens in USD */
export declare const LLM_COST_COMPLETION: "llm.cost.completion";
/** Total cost of the LLM call in USD (prompt + completion) */
export declare const LLM_COST_TOTAL: "llm.cost.total";
/** Total cost of input tokens in USD. This represents the cost of tokens that were used as input
 * to the model, which may be different from the prompt cost if there are additional processing steps. */
export declare const LLM_COST_INPUT: "llm.cost.prompt_details.input";
/** Total cost of output tokens in USD. This represents the cost of tokens that were generated as output
 * by the model, which may be different from the completion cost if there are additional processing steps. */
export declare const LLM_COST_OUTPUT: "llm.cost.completion_details.output";
/** Cost of reasoning steps in the completion in USD */
export declare const LLM_COST_COMPLETION_DETAILS_REASONING: "llm.cost.completion_details.reasoning";
/** Cost of audio tokens in the completion in USD */
export declare const LLM_COST_COMPLETION_DETAILS_AUDIO: "llm.cost.completion_details.audio";
/** Cost of prompt tokens written to cache in USD */
export declare const LLM_COST_PROMPT_DETAILS_CACHE_WRITE: "llm.cost.prompt_details.cache_write";
/** Cost of prompt tokens read from cache in USD */
export declare const LLM_COST_PROMPT_DETAILS_CACHE_READ: "llm.cost.prompt_details.cache_read";
/** Cost of input tokens in the prompt that were cached in USD */
export declare const LLM_COST_PROMPT_DETAILS_CACHE_INPUT: "llm.cost.prompt_details.cache_input";
/** Cost of audio tokens in the prompt in USD */
export declare const LLM_COST_PROMPT_DETAILS_AUDIO: "llm.cost.prompt_details.audio";
/**
 * The role that the LLM assumes the message is from
 * during the LLM invocation
 */
export declare const MESSAGE_ROLE: "message.role";
/**
 * The name of the message. This is only used for role 'function' where the name
 * of the function is captured in the name field and the parameters are captured in the
 * content.
 */
export declare const MESSAGE_NAME: "message.name";
/**
 * The tool calls generated by the model, such as function calls.
 */
export declare const MESSAGE_TOOL_CALLS: "message.tool_calls";
/**
 * The id of the tool call on a "tool" role message
 */
export declare const MESSAGE_TOOL_CALL_ID: "message.tool_call_id";
/**
 * tool_call.function.name
 */
export declare const TOOL_CALL_FUNCTION_NAME: "tool_call.function.name";
/**
 * tool_call.function.argument (JSON string)
 */
export declare const TOOL_CALL_FUNCTION_ARGUMENTS_JSON: "tool_call.function.arguments";
/**
 * The id of the tool call
 */
export declare const TOOL_CALL_ID: "tool_call.id";
/**
 * The LLM function call function name
 */
export declare const MESSAGE_FUNCTION_CALL_NAME: "message.function_call_name";
/**
 * The LLM function call function arguments in a json string
 */
export declare const MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON: "message.function_call_arguments_json";
/**
 * The content of the message sent to the LLM
 */
export declare const MESSAGE_CONTENT: "message.content";
/**
 * The array of contents for the message sent to the LLM. Each element of the array is
 * an `message_content` object.
 */
export declare const MESSAGE_CONTENTS: "message.contents";
/**
 * The type of content sent to the LLM
 */
export declare const MESSAGE_CONTENT_TYPE: "message_content.type";
/**
 * The text content of the message sent to the LLM
 */
export declare const MESSAGE_CONTENT_TEXT: "message_content.text";
/**
 * The image content of the message sent to the LLM
 */
export declare const MESSAGE_CONTENT_IMAGE: "message_content.image";
/**
 * The http or base64 link to the image
 */
export declare const IMAGE_URL: "image.url";
export declare const DOCUMENT_ID: "document.id";
export declare const DOCUMENT_CONTENT: "document.content";
export declare const DOCUMENT_SCORE: "document.score";
export declare const DOCUMENT_METADATA: "document.metadata";
/**
 * The text that was embedded to create the vector
 */
export declare const EMBEDDING_TEXT: "embedding.text";
/**
 * The name of the model that was used to create the vector
 */
export declare const EMBEDDING_MODEL_NAME: "embedding.model_name";
/**
 * The embedding vector. Typically a high dimensional vector of floats or ints
 */
export declare const EMBEDDING_VECTOR: "embedding.vector";
/**
 * The embedding list root
 */
export declare const EMBEDDING_EMBEDDINGS: "embedding.embeddings";
/**
 * The retrieval documents list root
 */
export declare const RETRIEVAL_DOCUMENTS: "retrieval.documents";
/**
 * The JSON representation of the variables used in the prompt template
 */
export declare const PROMPT_TEMPLATE_VARIABLES: "llm.prompt_template.variables";
/**
 * A prompt template
 */
export declare const PROMPT_TEMPLATE_TEMPLATE: "llm.prompt_template.template";
/**
 * The JSON representation of a function call of an LLM
 */
export declare const LLM_FUNCTION_CALL: "llm.function_call";
/**
 * List of tools that are advertised to the LLM to be able to call
 */
export declare const LLM_TOOLS: "llm.tools";
/**
 * The name of a tool
 */
export declare const TOOL_NAME: "tool.name";
/**
 * The description of a tool
 */
export declare const TOOL_DESCRIPTION: "tool.description";
/**
 * The parameters of the tool represented as a JSON string
 */
export declare const TOOL_PARAMETERS: "tool.parameters";
/**
 * The json schema of a tool input, It is RECOMMENDED that this be in the
 * OpenAI tool calling format: https://platform.openai.com/docs/assistants/tools
 */
export declare const TOOL_JSON_SCHEMA: "tool.json_schema";
/**
 * The session id of a trace. Used to correlate spans in a single session.
 */
export declare const SESSION_ID: "session.id";
/**
 * The user id of a trace. Used to correlate spans for a single user.
 */
export declare const USER_ID: "user.id";
/**
 * The documents used as input to the reranker
 */
export declare const RERANKER_INPUT_DOCUMENTS: "reranker.input_documents";
/**
 * The documents output by the reranker
 */
export declare const RERANKER_OUTPUT_DOCUMENTS: "reranker.output_documents";
/**
 * The query string for the reranker
 */
export declare const RERANKER_QUERY: "reranker.query";
/**
 * The model name for the reranker
 */
export declare const RERANKER_MODEL_NAME: "reranker.model_name";
/**
 * The top k parameter for the reranker
 */
export declare const RERANKER_TOP_K: "reranker.top_k";
/**
 * Metadata for a span, used to store user-defined key-value pairs
 */
export declare const METADATA: "metadata";
/**
 * A prompt template version
 */
export declare const PROMPT_TEMPLATE_VERSION: "llm.prompt_template.version";
/**
 * The tags associated with a span
 */
export declare const TAG_TAGS: "tag.tags";
/**
 * The url of an audio file
 */
export declare const AUDIO_URL: "audio.url";
/**
 * The audio mime type
 */
export declare const AUDIO_MIME_TYPE: "audio.mime_type";
/**
 * The audio transcript as text
 */
export declare const AUDIO_TRANSCRIPT: "audio.transcript";
/**
 * The vendor or origin of the prompt, e.g. a prompt library, a specialized service, etc.
 */
export declare const PROMPT_VENDOR: "prompt.vendor";
/**
 * A vendor-specific id used to locate the prompt
 */
export declare const PROMPT_ID: "prompt.id";
/**
 * A vendor-specific URL used to locate the prompt
 */
export declare const PROMPT_URL: "prompt.url";
/**
 * The name of the agent. Agents that perform the same functions should have the same name.
 */
export declare const AGENT_NAME: "agent.name";
/**
 * The id of the node in the execution graph. This along with graph.node.parent_id are used to visualize the execution graph.
 */
export declare const GRAPH_NODE_ID: "graph.node.id";
/**
 * The name of the node in the execution graph. Use this to present a human readable name for the node. Optional
 */
export declare const GRAPH_NODE_NAME: "graph.node.name";
/**
 * This references the id of the parent node. Leaving this unset or set as empty string implies that the current span is the root node.
 */
export declare const GRAPH_NODE_PARENT_ID: "graph.node.parent_id";
export declare const SemanticConventions: {
    readonly IMAGE_URL: "image.url";
    readonly INPUT_VALUE: "input.value";
    readonly INPUT_MIME_TYPE: "input.mime_type";
    readonly OUTPUT_VALUE: "output.value";
    readonly OUTPUT_MIME_TYPE: "output.mime_type";
    readonly LLM_INPUT_MESSAGES: "llm.input_messages";
    readonly LLM_OUTPUT_MESSAGES: "llm.output_messages";
    readonly LLM_MODEL_NAME: "llm.model_name";
    readonly LLM_PROMPTS: "llm.prompts";
    readonly LLM_INVOCATION_PARAMETERS: "llm.invocation_parameters";
    readonly LLM_TOKEN_COUNT_COMPLETION: "llm.token_count.completion";
    readonly LLM_TOKEN_COUNT_COMPLETION_DETAILS: "llm.token_count.completion_details";
    readonly LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING: "llm.token_count.completion_details.reasoning";
    readonly LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO: "llm.token_count.completion_details.audio";
    readonly LLM_TOKEN_COUNT_PROMPT: "llm.token_count.prompt";
    readonly LLM_TOKEN_COUNT_PROMPT_DETAILS: "llm.token_count.prompt_details";
    readonly LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE: "llm.token_count.prompt_details.cache_write";
    readonly LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ: "llm.token_count.prompt_details.cache_read";
    readonly LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_INPUT: "llm.token_count.prompt_details.cache_input";
    readonly LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO: "llm.token_count.prompt_details.audio";
    readonly LLM_TOKEN_COUNT_TOTAL: "llm.token_count.total";
    readonly LLM_SYSTEM: "llm.system";
    readonly LLM_PROVIDER: "llm.provider";
    readonly LLM_TOOLS: "llm.tools";
    readonly LLM_COST: "llm.cost";
    readonly LLM_COST_PROMPT: "llm.cost.prompt";
    readonly LLM_COST_COMPLETION: "llm.cost.completion";
    readonly LLM_COST_TOTAL: "llm.cost.total";
    readonly LLM_COST_INPUT: "llm.cost.prompt_details.input";
    readonly LLM_COST_OUTPUT: "llm.cost.completion_details.output";
    readonly LLM_COST_COMPLETION_DETAILS_REASONING: "llm.cost.completion_details.reasoning";
    readonly LLM_COST_COMPLETION_DETAILS_AUDIO: "llm.cost.completion_details.audio";
    readonly LLM_COST_PROMPT_DETAILS_CACHE_WRITE: "llm.cost.prompt_details.cache_write";
    readonly LLM_COST_PROMPT_DETAILS_CACHE_READ: "llm.cost.prompt_details.cache_read";
    readonly LLM_COST_PROMPT_DETAILS_CACHE_INPUT: "llm.cost.prompt_details.cache_input";
    readonly LLM_COST_PROMPT_DETAILS_AUDIO: "llm.cost.prompt_details.audio";
    readonly MESSAGE_ROLE: "message.role";
    readonly MESSAGE_NAME: "message.name";
    readonly MESSAGE_TOOL_CALLS: "message.tool_calls";
    readonly MESSAGE_TOOL_CALL_ID: "message.tool_call_id";
    readonly TOOL_CALL_ID: "tool_call.id";
    readonly TOOL_CALL_FUNCTION_NAME: "tool_call.function.name";
    readonly TOOL_CALL_FUNCTION_ARGUMENTS_JSON: "tool_call.function.arguments";
    readonly MESSAGE_FUNCTION_CALL_NAME: "message.function_call_name";
    readonly MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON: "message.function_call_arguments_json";
    readonly MESSAGE_CONTENT: "message.content";
    readonly MESSAGE_CONTENTS: "message.contents";
    readonly MESSAGE_CONTENT_IMAGE: "message_content.image";
    readonly MESSAGE_CONTENT_TEXT: "message_content.text";
    readonly MESSAGE_CONTENT_TYPE: "message_content.type";
    readonly DOCUMENT_ID: "document.id";
    readonly DOCUMENT_CONTENT: "document.content";
    readonly DOCUMENT_SCORE: "document.score";
    readonly DOCUMENT_METADATA: "document.metadata";
    readonly EMBEDDING_EMBEDDINGS: "embedding.embeddings";
    readonly EMBEDDING_TEXT: "embedding.text";
    readonly EMBEDDING_MODEL_NAME: "embedding.model_name";
    readonly EMBEDDING_VECTOR: "embedding.vector";
    readonly TOOL_DESCRIPTION: "tool.description";
    readonly TOOL_NAME: "tool.name";
    readonly TOOL_PARAMETERS: "tool.parameters";
    readonly TOOL_JSON_SCHEMA: "tool.json_schema";
    readonly PROMPT_TEMPLATE_VARIABLES: "llm.prompt_template.variables";
    readonly PROMPT_TEMPLATE_TEMPLATE: "llm.prompt_template.template";
    readonly PROMPT_TEMPLATE_VERSION: "llm.prompt_template.version";
    readonly RERANKER_INPUT_DOCUMENTS: "reranker.input_documents";
    readonly RERANKER_OUTPUT_DOCUMENTS: "reranker.output_documents";
    readonly RERANKER_QUERY: "reranker.query";
    readonly RERANKER_MODEL_NAME: "reranker.model_name";
    readonly RERANKER_TOP_K: "reranker.top_k";
    readonly LLM_FUNCTION_CALL: "llm.function_call";
    readonly RETRIEVAL_DOCUMENTS: "retrieval.documents";
    readonly SESSION_ID: "session.id";
    readonly USER_ID: "user.id";
    readonly METADATA: "metadata";
    readonly TAG_TAGS: "tag.tags";
    readonly OPENINFERENCE_SPAN_KIND: "openinference.span.kind";
    readonly PROMPT_VENDOR: "prompt.vendor";
    readonly PROMPT_ID: "prompt.id";
    readonly PROMPT_URL: "prompt.url";
    readonly AGENT_NAME: "agent.name";
    readonly GRAPH_NODE_ID: "graph.node.id";
    readonly GRAPH_NODE_NAME: "graph.node.name";
    readonly GRAPH_NODE_PARENT_ID: "graph.node.parent_id";
};
export declare enum OpenInferenceSpanKind {
    LLM = "LLM",
    CHAIN = "CHAIN",
    TOOL = "TOOL",
    RETRIEVER = "RETRIEVER",
    RERANKER = "RERANKER",
    EMBEDDING = "EMBEDDING",
    AGENT = "AGENT",
    GUARDRAIL = "GUARDRAIL",
    EVALUATOR = "EVALUATOR"
}
/**
 * An enum of common mime types. Not exhaustive.
 */
export declare enum MimeType {
    TEXT = "text/plain",
    JSON = "application/json",
    AUDIO_WAV = "audio/wav"
}
export declare enum LLMSystem {
    OPENAI = "openai",
    ANTHROPIC = "anthropic",
    MISTRALAI = "mistralai",
    COHERE = "cohere",
    VERTEXAI = "vertexai",
    AI21 = "ai21",
    META = "meta",
    AMAZON = "amazon"
}
export declare enum LLMProvider {
    OPENAI = "openai",
    ANTHROPIC = "anthropic",
    MISTRALAI = "mistralai",
    COHERE = "cohere",
    GOOGLE = "google",
    AWS = "aws",
    AZURE = "azure",
    XAI = "xai",
    DEEPSEEK = "deepseek"
}
//# sourceMappingURL=SemanticConventions.d.ts.map