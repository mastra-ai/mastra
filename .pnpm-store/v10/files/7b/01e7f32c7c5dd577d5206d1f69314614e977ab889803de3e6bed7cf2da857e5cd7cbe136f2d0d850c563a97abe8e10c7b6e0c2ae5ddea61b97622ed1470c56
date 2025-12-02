/**
 * Semantic conventions for OpenInference tracing
 */
export const SemanticAttributePrefixes = {
    input: "input",
    output: "output",
    llm: "llm",
    retrieval: "retrieval",
    reranker: "reranker",
    messages: "messages",
    message: "message",
    document: "document",
    embedding: "embedding",
    tool: "tool",
    tool_call: "tool_call",
    metadata: "metadata",
    tag: "tag",
    session: "session",
    user: "user",
    openinference: "openinference",
    message_content: "message_content",
    image: "image",
    audio: "audio",
    prompt: "prompt",
    agent: "agent",
    graph: "graph",
};
export const LLMAttributePostfixes = {
    provider: "provider",
    system: "system",
    model_name: "model_name",
    token_count: "token_count",
    input_messages: "input_messages",
    output_messages: "output_messages",
    invocation_parameters: "invocation_parameters",
    prompts: "prompts",
    prompt_template: "prompt_template",
    function_call: "function_call",
    tools: "tools",
    cost: "cost",
};
export const LLMPromptTemplateAttributePostfixes = {
    variables: "variables",
    template: "template",
};
export const RetrievalAttributePostfixes = {
    documents: "documents",
};
export const RerankerAttributePostfixes = {
    input_documents: "input_documents",
    output_documents: "output_documents",
    query: "query",
    model_name: "model_name",
    top_k: "top_k",
};
export const EmbeddingAttributePostfixes = {
    embeddings: "embeddings",
    text: "text",
    model_name: "model_name",
    vector: "vector",
};
export const ToolAttributePostfixes = {
    name: "name",
    description: "description",
    parameters: "parameters",
    json_schema: "json_schema",
};
export const MessageAttributePostfixes = {
    role: "role",
    content: "content",
    contents: "contents",
    name: "name",
    function_call_name: "function_call_name",
    function_call_arguments_json: "function_call_arguments_json",
    tool_calls: "tool_calls",
    tool_call_id: "tool_call_id",
};
export const MessageContentsAttributePostfixes = {
    type: "type",
    text: "text",
    image: "image",
};
export const ImageAttributesPostfixes = {
    url: "url",
};
export const ToolCallAttributePostfixes = {
    function_name: "function.name",
    function_arguments_json: "function.arguments",
    id: "id",
};
export const DocumentAttributePostfixes = {
    id: "id",
    content: "content",
    score: "score",
    metadata: "metadata",
};
export const TagAttributePostfixes = {
    tags: "tags",
};
export const SessionAttributePostfixes = {
    id: "id",
};
export const UserAttributePostfixes = {
    id: "id",
};
export const AudioAttributesPostfixes = {
    url: "url",
    mime_type: "mime_type",
    transcript: "transcript",
};
export const PromptAttributePostfixes = {
    vendor: "vendor",
    id: "id",
    url: "url",
};
export const AgentPostfixes = {
    name: "name",
};
export const GraphPostfixes = {
    node_id: "node.id",
    node_name: "node.name",
    node_parent_id: "node.parent_id",
};
/**
 * The input to any span
 */
export const INPUT_VALUE = `${SemanticAttributePrefixes.input}.value`;
export const INPUT_MIME_TYPE = `${SemanticAttributePrefixes.input}.mime_type`;
/**
 * The output of any span
 */
export const OUTPUT_VALUE = `${SemanticAttributePrefixes.output}.value`;
export const OUTPUT_MIME_TYPE = `${SemanticAttributePrefixes.output}.mime_type`;
/**
 * The messages sent to the LLM for completions
 * Typically seen in OpenAI chat completions
 * @see https://beta.openai.com/docs/api-reference/completions/create
 */
export const LLM_INPUT_MESSAGES = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.input_messages}`;
/**
 * The prompts sent to the LLM for completions
 * Typically seen in OpenAI legacy completions
 * @see https://beta.openai.com/docs/api-reference/completions/create
 */
export const LLM_PROMPTS = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.prompts}`;
/**
 * The JSON representation of the parameters passed to the LLM
 */
export const LLM_INVOCATION_PARAMETERS = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.invocation_parameters}`;
/**
 * The messages received from the LLM for completions
 * Typically seen in OpenAI chat completions
 * @see https://platform.openai.com/docs/api-reference/chat/object#choices-message
 */
export const LLM_OUTPUT_MESSAGES = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.output_messages}`;
/**
 * The name of the LLM model
 */
export const LLM_MODEL_NAME = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.model_name}`;
/**
 * The provider of the inferences. E.g. the cloud provider
 */
export const LLM_PROVIDER = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.provider}`;
/**
 * The AI product as identified by the client or server
 */
export const LLM_SYSTEM = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.system}`;
/** Token count for the completion by the llm (in tokens) */
export const LLM_TOKEN_COUNT_COMPLETION = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.completion`;
/** Token count for the reasoning steps in the completion (in tokens) */
export const LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.completion_details.reasoning`;
/** Token count for audio input generated by the model (in tokens) */
export const LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.completion_details.audio`;
/** Token count for the prompt to the llm (in tokens) */
export const LLM_TOKEN_COUNT_PROMPT = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.prompt`;
/** Token count for the tokens written to cache (in tokens) */
export const LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.prompt_details.cache_write`;
/** Token count for the tokens retrieved from cache (in tokens) */
export const LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.prompt_details.cache_read`;
/** Token count for the input tokens in the prompt that were cached (in tokens) */
export const LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_INPUT = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.prompt_details.cache_input`;
/** Token count for audio input presented in the prompt (in tokens) */
export const LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.prompt_details.audio`;
/** Token count for the entire transaction with the llm (in tokens) */
export const LLM_TOKEN_COUNT_TOTAL = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.total`;
/**
 * Key prefix for additional prompt token count details. Each detail should be a separate attribute
 * with this prefix, e.g. llm.token_count.prompt_details.reasoning, llm.token_count.prompt_details.audio.
 * All values should be in tokens (integer count of tokens).
 */
export const LLM_TOKEN_COUNT_PROMPT_DETAILS = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.prompt_details`;
/**
 * Key prefix for additional completion token count details. Each detail should be a separate attribute
 * with this prefix, e.g. llm.token_count.completion_details.reasoning, llm.token_count.completion_details.audio.
 * All values should be in tokens (integer count of tokens).
 */
export const LLM_TOKEN_COUNT_COMPLETION_DETAILS = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.token_count}.completion_details`;
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
export const LLM_COST = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}`;
/** Cost of the prompt tokens in USD */
export const LLM_COST_PROMPT = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.prompt`;
/** Cost of the completion tokens in USD */
export const LLM_COST_COMPLETION = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.completion`;
/** Total cost of the LLM call in USD (prompt + completion) */
export const LLM_COST_TOTAL = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.total`;
/** Total cost of input tokens in USD. This represents the cost of tokens that were used as input
 * to the model, which may be different from the prompt cost if there are additional processing steps. */
export const LLM_COST_INPUT = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.prompt_details.input`;
/** Total cost of output tokens in USD. This represents the cost of tokens that were generated as output
 * by the model, which may be different from the completion cost if there are additional processing steps. */
export const LLM_COST_OUTPUT = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.completion_details.output`;
/** Cost of reasoning steps in the completion in USD */
export const LLM_COST_COMPLETION_DETAILS_REASONING = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.completion_details.reasoning`;
/** Cost of audio tokens in the completion in USD */
export const LLM_COST_COMPLETION_DETAILS_AUDIO = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.completion_details.audio`;
/** Cost of prompt tokens written to cache in USD */
export const LLM_COST_PROMPT_DETAILS_CACHE_WRITE = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.prompt_details.cache_write`;
/** Cost of prompt tokens read from cache in USD */
export const LLM_COST_PROMPT_DETAILS_CACHE_READ = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.prompt_details.cache_read`;
/** Cost of input tokens in the prompt that were cached in USD */
export const LLM_COST_PROMPT_DETAILS_CACHE_INPUT = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.prompt_details.cache_input`;
/** Cost of audio tokens in the prompt in USD */
export const LLM_COST_PROMPT_DETAILS_AUDIO = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.cost}.prompt_details.audio`;
/**
 * The role that the LLM assumes the message is from
 * during the LLM invocation
 */
export const MESSAGE_ROLE = `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.role}`;
/**
 * The name of the message. This is only used for role 'function' where the name
 * of the function is captured in the name field and the parameters are captured in the
 * content.
 */
export const MESSAGE_NAME = `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.name}`;
/**
 * The tool calls generated by the model, such as function calls.
 */
export const MESSAGE_TOOL_CALLS = `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.tool_calls}`;
/**
 * The id of the tool call on a "tool" role message
 */
export const MESSAGE_TOOL_CALL_ID = `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.tool_call_id}`;
/**
 * tool_call.function.name
 */
export const TOOL_CALL_FUNCTION_NAME = `${SemanticAttributePrefixes.tool_call}.${ToolCallAttributePostfixes.function_name}`;
/**
 * tool_call.function.argument (JSON string)
 */
export const TOOL_CALL_FUNCTION_ARGUMENTS_JSON = `${SemanticAttributePrefixes.tool_call}.${ToolCallAttributePostfixes.function_arguments_json}`;
/**
 * The id of the tool call
 */
export const TOOL_CALL_ID = `${SemanticAttributePrefixes.tool_call}.${ToolCallAttributePostfixes.id}`;
/**
 * The LLM function call function name
 */
export const MESSAGE_FUNCTION_CALL_NAME = `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.function_call_name}`;
/**
 * The LLM function call function arguments in a json string
 */
export const MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON = `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.function_call_arguments_json}`;
/**
 * The content of the message sent to the LLM
 */
export const MESSAGE_CONTENT = `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.content}`;
/**
 * The array of contents for the message sent to the LLM. Each element of the array is
 * an `message_content` object.
 */
export const MESSAGE_CONTENTS = `${SemanticAttributePrefixes.message}.${MessageAttributePostfixes.contents}`;
/**
 * The type of content sent to the LLM
 */
export const MESSAGE_CONTENT_TYPE = `${SemanticAttributePrefixes.message_content}.${MessageContentsAttributePostfixes.type}`;
/**
 * The text content of the message sent to the LLM
 */
export const MESSAGE_CONTENT_TEXT = `${SemanticAttributePrefixes.message_content}.${MessageContentsAttributePostfixes.text}`;
/**
 * The image content of the message sent to the LLM
 */
export const MESSAGE_CONTENT_IMAGE = `${SemanticAttributePrefixes.message_content}.${MessageContentsAttributePostfixes.image}`;
/**
 * The http or base64 link to the image
 */
export const IMAGE_URL = `${SemanticAttributePrefixes.image}.${ImageAttributesPostfixes.url}`;
export const DOCUMENT_ID = `${SemanticAttributePrefixes.document}.${DocumentAttributePostfixes.id}`;
export const DOCUMENT_CONTENT = `${SemanticAttributePrefixes.document}.${DocumentAttributePostfixes.content}`;
export const DOCUMENT_SCORE = `${SemanticAttributePrefixes.document}.${DocumentAttributePostfixes.score}`;
export const DOCUMENT_METADATA = `${SemanticAttributePrefixes.document}.${DocumentAttributePostfixes.metadata}`;
/**
 * The text that was embedded to create the vector
 */
export const EMBEDDING_TEXT = `${SemanticAttributePrefixes.embedding}.${EmbeddingAttributePostfixes.text}`;
/**
 * The name of the model that was used to create the vector
 */
export const EMBEDDING_MODEL_NAME = `${SemanticAttributePrefixes.embedding}.${EmbeddingAttributePostfixes.model_name}`;
/**
 * The embedding vector. Typically a high dimensional vector of floats or ints
 */
export const EMBEDDING_VECTOR = `${SemanticAttributePrefixes.embedding}.${EmbeddingAttributePostfixes.vector}`;
/**
 * The embedding list root
 */
export const EMBEDDING_EMBEDDINGS = `${SemanticAttributePrefixes.embedding}.${EmbeddingAttributePostfixes.embeddings}`;
/**
 * The retrieval documents list root
 */
export const RETRIEVAL_DOCUMENTS = `${SemanticAttributePrefixes.retrieval}.${RetrievalAttributePostfixes.documents}`;
const PROMPT_TEMPLATE_PREFIX = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.prompt_template}`;
/**
 * The JSON representation of the variables used in the prompt template
 */
export const PROMPT_TEMPLATE_VARIABLES = `${PROMPT_TEMPLATE_PREFIX}.variables`;
/**
 * A prompt template
 */
export const PROMPT_TEMPLATE_TEMPLATE = `${PROMPT_TEMPLATE_PREFIX}.template`;
/**
 * The JSON representation of a function call of an LLM
 */
export const LLM_FUNCTION_CALL = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.function_call}`;
/**
 * List of tools that are advertised to the LLM to be able to call
 */
export const LLM_TOOLS = `${SemanticAttributePrefixes.llm}.${LLMAttributePostfixes.tools}`;
/**
 * The name of a tool
 */
export const TOOL_NAME = `${SemanticAttributePrefixes.tool}.${ToolAttributePostfixes.name}`;
/**
 * The description of a tool
 */
export const TOOL_DESCRIPTION = `${SemanticAttributePrefixes.tool}.${ToolAttributePostfixes.description}`;
/**
 * The parameters of the tool represented as a JSON string
 */
export const TOOL_PARAMETERS = `${SemanticAttributePrefixes.tool}.${ToolAttributePostfixes.parameters}`;
/**
 * The json schema of a tool input, It is RECOMMENDED that this be in the
 * OpenAI tool calling format: https://platform.openai.com/docs/assistants/tools
 */
export const TOOL_JSON_SCHEMA = `${SemanticAttributePrefixes.tool}.${ToolAttributePostfixes.json_schema}`;
/**
 * The session id of a trace. Used to correlate spans in a single session.
 */
export const SESSION_ID = `${SemanticAttributePrefixes.session}.${SessionAttributePostfixes.id}`;
/**
 * The user id of a trace. Used to correlate spans for a single user.
 */
export const USER_ID = `${SemanticAttributePrefixes.user}.${UserAttributePostfixes.id}`;
/**
 * The documents used as input to the reranker
 */
export const RERANKER_INPUT_DOCUMENTS = `${SemanticAttributePrefixes.reranker}.${RerankerAttributePostfixes.input_documents}`;
/**
 * The documents output by the reranker
 */
export const RERANKER_OUTPUT_DOCUMENTS = `${SemanticAttributePrefixes.reranker}.${RerankerAttributePostfixes.output_documents}`;
/**
 * The query string for the reranker
 */
export const RERANKER_QUERY = `${SemanticAttributePrefixes.reranker}.${RerankerAttributePostfixes.query}`;
/**
 * The model name for the reranker
 */
export const RERANKER_MODEL_NAME = `${SemanticAttributePrefixes.reranker}.${RerankerAttributePostfixes.model_name}`;
/**
 * The top k parameter for the reranker
 */
export const RERANKER_TOP_K = `${SemanticAttributePrefixes.reranker}.${RerankerAttributePostfixes.top_k}`;
/**
 * Metadata for a span, used to store user-defined key-value pairs
 */
export const METADATA = "metadata";
/**
 * A prompt template version
 */
export const PROMPT_TEMPLATE_VERSION = `${PROMPT_TEMPLATE_PREFIX}.version`;
/**
 * The tags associated with a span
 */
export const TAG_TAGS = `${SemanticAttributePrefixes.tag}.${TagAttributePostfixes.tags}`;
/**
 * The url of an audio file
 */
export const AUDIO_URL = `${SemanticAttributePrefixes.audio}.${AudioAttributesPostfixes.url}`;
/**
 * The audio mime type
 */
export const AUDIO_MIME_TYPE = `${SemanticAttributePrefixes.audio}.${AudioAttributesPostfixes.mime_type}`;
/**
 * The audio transcript as text
 */
export const AUDIO_TRANSCRIPT = `${SemanticAttributePrefixes.audio}.${AudioAttributesPostfixes.transcript}`;
/**
 * The vendor or origin of the prompt, e.g. a prompt library, a specialized service, etc.
 */
export const PROMPT_VENDOR = `${SemanticAttributePrefixes.prompt}.${PromptAttributePostfixes.vendor}`;
/**
 * A vendor-specific id used to locate the prompt
 */
export const PROMPT_ID = `${SemanticAttributePrefixes.prompt}.${PromptAttributePostfixes.id}`;
/**
 * A vendor-specific URL used to locate the prompt
 */
export const PROMPT_URL = `${SemanticAttributePrefixes.prompt}.${PromptAttributePostfixes.url}`;
/**
 * The name of the agent. Agents that perform the same functions should have the same name.
 */
export const AGENT_NAME = `${SemanticAttributePrefixes.agent}.${AgentPostfixes.name}`;
/**
 * The id of the node in the execution graph. This along with graph.node.parent_id are used to visualize the execution graph.
 */
export const GRAPH_NODE_ID = `${SemanticAttributePrefixes.graph}.${GraphPostfixes.node_id}`;
/**
 * The name of the node in the execution graph. Use this to present a human readable name for the node. Optional
 */
export const GRAPH_NODE_NAME = `${SemanticAttributePrefixes.graph}.${GraphPostfixes.node_name}`;
/**
 * This references the id of the parent node. Leaving this unset or set as empty string implies that the current span is the root node.
 */
export const GRAPH_NODE_PARENT_ID = `${SemanticAttributePrefixes.graph}.${GraphPostfixes.node_parent_id}`;
export const SemanticConventions = {
    IMAGE_URL,
    INPUT_VALUE,
    INPUT_MIME_TYPE,
    OUTPUT_VALUE,
    OUTPUT_MIME_TYPE,
    LLM_INPUT_MESSAGES,
    LLM_OUTPUT_MESSAGES,
    LLM_MODEL_NAME,
    LLM_PROMPTS,
    LLM_INVOCATION_PARAMETERS,
    LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_COMPLETION_DETAILS,
    LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING,
    LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO,
    LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_PROMPT_DETAILS,
    LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE,
    LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ,
    LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_INPUT,
    LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO,
    LLM_TOKEN_COUNT_TOTAL,
    LLM_SYSTEM,
    LLM_PROVIDER,
    LLM_TOOLS,
    LLM_COST,
    LLM_COST_PROMPT,
    LLM_COST_COMPLETION,
    LLM_COST_TOTAL,
    LLM_COST_INPUT,
    LLM_COST_OUTPUT,
    LLM_COST_COMPLETION_DETAILS_REASONING,
    LLM_COST_COMPLETION_DETAILS_AUDIO,
    LLM_COST_PROMPT_DETAILS_CACHE_WRITE,
    LLM_COST_PROMPT_DETAILS_CACHE_READ,
    LLM_COST_PROMPT_DETAILS_CACHE_INPUT,
    LLM_COST_PROMPT_DETAILS_AUDIO,
    MESSAGE_ROLE,
    MESSAGE_NAME,
    MESSAGE_TOOL_CALLS,
    MESSAGE_TOOL_CALL_ID,
    TOOL_CALL_ID,
    TOOL_CALL_FUNCTION_NAME,
    TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
    MESSAGE_FUNCTION_CALL_NAME,
    MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
    MESSAGE_CONTENT,
    MESSAGE_CONTENTS,
    MESSAGE_CONTENT_IMAGE,
    MESSAGE_CONTENT_TEXT,
    MESSAGE_CONTENT_TYPE,
    DOCUMENT_ID,
    DOCUMENT_CONTENT,
    DOCUMENT_SCORE,
    DOCUMENT_METADATA,
    EMBEDDING_EMBEDDINGS,
    EMBEDDING_TEXT,
    EMBEDDING_MODEL_NAME,
    EMBEDDING_VECTOR,
    TOOL_DESCRIPTION,
    TOOL_NAME,
    TOOL_PARAMETERS,
    TOOL_JSON_SCHEMA,
    PROMPT_TEMPLATE_VARIABLES,
    PROMPT_TEMPLATE_TEMPLATE,
    PROMPT_TEMPLATE_VERSION,
    RERANKER_INPUT_DOCUMENTS,
    RERANKER_OUTPUT_DOCUMENTS,
    RERANKER_QUERY,
    RERANKER_MODEL_NAME,
    RERANKER_TOP_K,
    LLM_FUNCTION_CALL,
    RETRIEVAL_DOCUMENTS,
    SESSION_ID,
    USER_ID,
    METADATA,
    TAG_TAGS,
    OPENINFERENCE_SPAN_KIND: `${SemanticAttributePrefixes.openinference}.span.kind`,
    PROMPT_VENDOR,
    PROMPT_ID,
    PROMPT_URL,
    AGENT_NAME,
    GRAPH_NODE_ID,
    GRAPH_NODE_NAME,
    GRAPH_NODE_PARENT_ID,
};
export var OpenInferenceSpanKind;
(function (OpenInferenceSpanKind) {
    OpenInferenceSpanKind["LLM"] = "LLM";
    OpenInferenceSpanKind["CHAIN"] = "CHAIN";
    OpenInferenceSpanKind["TOOL"] = "TOOL";
    OpenInferenceSpanKind["RETRIEVER"] = "RETRIEVER";
    OpenInferenceSpanKind["RERANKER"] = "RERANKER";
    OpenInferenceSpanKind["EMBEDDING"] = "EMBEDDING";
    OpenInferenceSpanKind["AGENT"] = "AGENT";
    OpenInferenceSpanKind["GUARDRAIL"] = "GUARDRAIL";
    OpenInferenceSpanKind["EVALUATOR"] = "EVALUATOR";
})(OpenInferenceSpanKind || (OpenInferenceSpanKind = {}));
/**
 * An enum of common mime types. Not exhaustive.
 */
export var MimeType;
(function (MimeType) {
    MimeType["TEXT"] = "text/plain";
    MimeType["JSON"] = "application/json";
    MimeType["AUDIO_WAV"] = "audio/wav";
})(MimeType || (MimeType = {}));
export var LLMSystem;
(function (LLMSystem) {
    LLMSystem["OPENAI"] = "openai";
    LLMSystem["ANTHROPIC"] = "anthropic";
    LLMSystem["MISTRALAI"] = "mistralai";
    LLMSystem["COHERE"] = "cohere";
    LLMSystem["VERTEXAI"] = "vertexai";
    LLMSystem["AI21"] = "ai21";
    LLMSystem["META"] = "meta";
    LLMSystem["AMAZON"] = "amazon";
})(LLMSystem || (LLMSystem = {}));
export var LLMProvider;
(function (LLMProvider) {
    LLMProvider["OPENAI"] = "openai";
    LLMProvider["ANTHROPIC"] = "anthropic";
    LLMProvider["MISTRALAI"] = "mistralai";
    LLMProvider["COHERE"] = "cohere";
    // Cloud Providers of LLM systems
    LLMProvider["GOOGLE"] = "google";
    LLMProvider["AWS"] = "aws";
    LLMProvider["AZURE"] = "azure";
    LLMProvider["XAI"] = "xai";
    LLMProvider["DEEPSEEK"] = "deepseek";
})(LLMProvider || (LLMProvider = {}));
//# sourceMappingURL=SemanticConventions.js.map