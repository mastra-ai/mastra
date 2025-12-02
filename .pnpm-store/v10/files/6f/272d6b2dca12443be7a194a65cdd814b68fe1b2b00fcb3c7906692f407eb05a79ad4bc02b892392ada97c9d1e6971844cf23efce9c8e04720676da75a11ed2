"use strict";
/**
 * Semantic conventions for OpenInference tracing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLM_COST_PROMPT_DETAILS_CACHE_WRITE = exports.LLM_COST_COMPLETION_DETAILS_AUDIO = exports.LLM_COST_COMPLETION_DETAILS_REASONING = exports.LLM_COST_OUTPUT = exports.LLM_COST_INPUT = exports.LLM_COST_TOTAL = exports.LLM_COST_COMPLETION = exports.LLM_COST_PROMPT = exports.LLM_COST = exports.LLM_TOKEN_COUNT_COMPLETION_DETAILS = exports.LLM_TOKEN_COUNT_PROMPT_DETAILS = exports.LLM_TOKEN_COUNT_TOTAL = exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO = exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_INPUT = exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ = exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE = exports.LLM_TOKEN_COUNT_PROMPT = exports.LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO = exports.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING = exports.LLM_TOKEN_COUNT_COMPLETION = exports.LLM_SYSTEM = exports.LLM_PROVIDER = exports.LLM_MODEL_NAME = exports.LLM_OUTPUT_MESSAGES = exports.LLM_INVOCATION_PARAMETERS = exports.LLM_PROMPTS = exports.LLM_INPUT_MESSAGES = exports.OUTPUT_MIME_TYPE = exports.OUTPUT_VALUE = exports.INPUT_MIME_TYPE = exports.INPUT_VALUE = exports.GraphPostfixes = exports.AgentPostfixes = exports.PromptAttributePostfixes = exports.AudioAttributesPostfixes = exports.UserAttributePostfixes = exports.SessionAttributePostfixes = exports.TagAttributePostfixes = exports.DocumentAttributePostfixes = exports.ToolCallAttributePostfixes = exports.ImageAttributesPostfixes = exports.MessageContentsAttributePostfixes = exports.MessageAttributePostfixes = exports.ToolAttributePostfixes = exports.EmbeddingAttributePostfixes = exports.RerankerAttributePostfixes = exports.RetrievalAttributePostfixes = exports.LLMPromptTemplateAttributePostfixes = exports.LLMAttributePostfixes = exports.SemanticAttributePrefixes = void 0;
exports.PROMPT_ID = exports.PROMPT_VENDOR = exports.AUDIO_TRANSCRIPT = exports.AUDIO_MIME_TYPE = exports.AUDIO_URL = exports.TAG_TAGS = exports.PROMPT_TEMPLATE_VERSION = exports.METADATA = exports.RERANKER_TOP_K = exports.RERANKER_MODEL_NAME = exports.RERANKER_QUERY = exports.RERANKER_OUTPUT_DOCUMENTS = exports.RERANKER_INPUT_DOCUMENTS = exports.USER_ID = exports.SESSION_ID = exports.TOOL_JSON_SCHEMA = exports.TOOL_PARAMETERS = exports.TOOL_DESCRIPTION = exports.TOOL_NAME = exports.LLM_TOOLS = exports.LLM_FUNCTION_CALL = exports.PROMPT_TEMPLATE_TEMPLATE = exports.PROMPT_TEMPLATE_VARIABLES = exports.RETRIEVAL_DOCUMENTS = exports.EMBEDDING_EMBEDDINGS = exports.EMBEDDING_VECTOR = exports.EMBEDDING_MODEL_NAME = exports.EMBEDDING_TEXT = exports.DOCUMENT_METADATA = exports.DOCUMENT_SCORE = exports.DOCUMENT_CONTENT = exports.DOCUMENT_ID = exports.IMAGE_URL = exports.MESSAGE_CONTENT_IMAGE = exports.MESSAGE_CONTENT_TEXT = exports.MESSAGE_CONTENT_TYPE = exports.MESSAGE_CONTENTS = exports.MESSAGE_CONTENT = exports.MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON = exports.MESSAGE_FUNCTION_CALL_NAME = exports.TOOL_CALL_ID = exports.TOOL_CALL_FUNCTION_ARGUMENTS_JSON = exports.TOOL_CALL_FUNCTION_NAME = exports.MESSAGE_TOOL_CALL_ID = exports.MESSAGE_TOOL_CALLS = exports.MESSAGE_NAME = exports.MESSAGE_ROLE = exports.LLM_COST_PROMPT_DETAILS_AUDIO = exports.LLM_COST_PROMPT_DETAILS_CACHE_INPUT = exports.LLM_COST_PROMPT_DETAILS_CACHE_READ = void 0;
exports.LLMProvider = exports.LLMSystem = exports.MimeType = exports.OpenInferenceSpanKind = exports.SemanticConventions = exports.GRAPH_NODE_PARENT_ID = exports.GRAPH_NODE_NAME = exports.GRAPH_NODE_ID = exports.AGENT_NAME = exports.PROMPT_URL = void 0;
exports.SemanticAttributePrefixes = {
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
exports.LLMAttributePostfixes = {
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
exports.LLMPromptTemplateAttributePostfixes = {
    variables: "variables",
    template: "template",
};
exports.RetrievalAttributePostfixes = {
    documents: "documents",
};
exports.RerankerAttributePostfixes = {
    input_documents: "input_documents",
    output_documents: "output_documents",
    query: "query",
    model_name: "model_name",
    top_k: "top_k",
};
exports.EmbeddingAttributePostfixes = {
    embeddings: "embeddings",
    text: "text",
    model_name: "model_name",
    vector: "vector",
};
exports.ToolAttributePostfixes = {
    name: "name",
    description: "description",
    parameters: "parameters",
    json_schema: "json_schema",
};
exports.MessageAttributePostfixes = {
    role: "role",
    content: "content",
    contents: "contents",
    name: "name",
    function_call_name: "function_call_name",
    function_call_arguments_json: "function_call_arguments_json",
    tool_calls: "tool_calls",
    tool_call_id: "tool_call_id",
};
exports.MessageContentsAttributePostfixes = {
    type: "type",
    text: "text",
    image: "image",
};
exports.ImageAttributesPostfixes = {
    url: "url",
};
exports.ToolCallAttributePostfixes = {
    function_name: "function.name",
    function_arguments_json: "function.arguments",
    id: "id",
};
exports.DocumentAttributePostfixes = {
    id: "id",
    content: "content",
    score: "score",
    metadata: "metadata",
};
exports.TagAttributePostfixes = {
    tags: "tags",
};
exports.SessionAttributePostfixes = {
    id: "id",
};
exports.UserAttributePostfixes = {
    id: "id",
};
exports.AudioAttributesPostfixes = {
    url: "url",
    mime_type: "mime_type",
    transcript: "transcript",
};
exports.PromptAttributePostfixes = {
    vendor: "vendor",
    id: "id",
    url: "url",
};
exports.AgentPostfixes = {
    name: "name",
};
exports.GraphPostfixes = {
    node_id: "node.id",
    node_name: "node.name",
    node_parent_id: "node.parent_id",
};
/**
 * The input to any span
 */
exports.INPUT_VALUE = `${exports.SemanticAttributePrefixes.input}.value`;
exports.INPUT_MIME_TYPE = `${exports.SemanticAttributePrefixes.input}.mime_type`;
/**
 * The output of any span
 */
exports.OUTPUT_VALUE = `${exports.SemanticAttributePrefixes.output}.value`;
exports.OUTPUT_MIME_TYPE = `${exports.SemanticAttributePrefixes.output}.mime_type`;
/**
 * The messages sent to the LLM for completions
 * Typically seen in OpenAI chat completions
 * @see https://beta.openai.com/docs/api-reference/completions/create
 */
exports.LLM_INPUT_MESSAGES = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.input_messages}`;
/**
 * The prompts sent to the LLM for completions
 * Typically seen in OpenAI legacy completions
 * @see https://beta.openai.com/docs/api-reference/completions/create
 */
exports.LLM_PROMPTS = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.prompts}`;
/**
 * The JSON representation of the parameters passed to the LLM
 */
exports.LLM_INVOCATION_PARAMETERS = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.invocation_parameters}`;
/**
 * The messages received from the LLM for completions
 * Typically seen in OpenAI chat completions
 * @see https://platform.openai.com/docs/api-reference/chat/object#choices-message
 */
exports.LLM_OUTPUT_MESSAGES = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.output_messages}`;
/**
 * The name of the LLM model
 */
exports.LLM_MODEL_NAME = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.model_name}`;
/**
 * The provider of the inferences. E.g. the cloud provider
 */
exports.LLM_PROVIDER = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.provider}`;
/**
 * The AI product as identified by the client or server
 */
exports.LLM_SYSTEM = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.system}`;
/** Token count for the completion by the llm (in tokens) */
exports.LLM_TOKEN_COUNT_COMPLETION = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.completion`;
/** Token count for the reasoning steps in the completion (in tokens) */
exports.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.completion_details.reasoning`;
/** Token count for audio input generated by the model (in tokens) */
exports.LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.completion_details.audio`;
/** Token count for the prompt to the llm (in tokens) */
exports.LLM_TOKEN_COUNT_PROMPT = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.prompt`;
/** Token count for the tokens written to cache (in tokens) */
exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.prompt_details.cache_write`;
/** Token count for the tokens retrieved from cache (in tokens) */
exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.prompt_details.cache_read`;
/** Token count for the input tokens in the prompt that were cached (in tokens) */
exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_INPUT = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.prompt_details.cache_input`;
/** Token count for audio input presented in the prompt (in tokens) */
exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.prompt_details.audio`;
/** Token count for the entire transaction with the llm (in tokens) */
exports.LLM_TOKEN_COUNT_TOTAL = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.total`;
/**
 * Key prefix for additional prompt token count details. Each detail should be a separate attribute
 * with this prefix, e.g. llm.token_count.prompt_details.reasoning, llm.token_count.prompt_details.audio.
 * All values should be in tokens (integer count of tokens).
 */
exports.LLM_TOKEN_COUNT_PROMPT_DETAILS = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.prompt_details`;
/**
 * Key prefix for additional completion token count details. Each detail should be a separate attribute
 * with this prefix, e.g. llm.token_count.completion_details.reasoning, llm.token_count.completion_details.audio.
 * All values should be in tokens (integer count of tokens).
 */
exports.LLM_TOKEN_COUNT_COMPLETION_DETAILS = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.token_count}.completion_details`;
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
exports.LLM_COST = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}`;
/** Cost of the prompt tokens in USD */
exports.LLM_COST_PROMPT = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.prompt`;
/** Cost of the completion tokens in USD */
exports.LLM_COST_COMPLETION = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.completion`;
/** Total cost of the LLM call in USD (prompt + completion) */
exports.LLM_COST_TOTAL = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.total`;
/** Total cost of input tokens in USD. This represents the cost of tokens that were used as input
 * to the model, which may be different from the prompt cost if there are additional processing steps. */
exports.LLM_COST_INPUT = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.prompt_details.input`;
/** Total cost of output tokens in USD. This represents the cost of tokens that were generated as output
 * by the model, which may be different from the completion cost if there are additional processing steps. */
exports.LLM_COST_OUTPUT = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.completion_details.output`;
/** Cost of reasoning steps in the completion in USD */
exports.LLM_COST_COMPLETION_DETAILS_REASONING = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.completion_details.reasoning`;
/** Cost of audio tokens in the completion in USD */
exports.LLM_COST_COMPLETION_DETAILS_AUDIO = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.completion_details.audio`;
/** Cost of prompt tokens written to cache in USD */
exports.LLM_COST_PROMPT_DETAILS_CACHE_WRITE = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.prompt_details.cache_write`;
/** Cost of prompt tokens read from cache in USD */
exports.LLM_COST_PROMPT_DETAILS_CACHE_READ = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.prompt_details.cache_read`;
/** Cost of input tokens in the prompt that were cached in USD */
exports.LLM_COST_PROMPT_DETAILS_CACHE_INPUT = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.prompt_details.cache_input`;
/** Cost of audio tokens in the prompt in USD */
exports.LLM_COST_PROMPT_DETAILS_AUDIO = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.cost}.prompt_details.audio`;
/**
 * The role that the LLM assumes the message is from
 * during the LLM invocation
 */
exports.MESSAGE_ROLE = `${exports.SemanticAttributePrefixes.message}.${exports.MessageAttributePostfixes.role}`;
/**
 * The name of the message. This is only used for role 'function' where the name
 * of the function is captured in the name field and the parameters are captured in the
 * content.
 */
exports.MESSAGE_NAME = `${exports.SemanticAttributePrefixes.message}.${exports.MessageAttributePostfixes.name}`;
/**
 * The tool calls generated by the model, such as function calls.
 */
exports.MESSAGE_TOOL_CALLS = `${exports.SemanticAttributePrefixes.message}.${exports.MessageAttributePostfixes.tool_calls}`;
/**
 * The id of the tool call on a "tool" role message
 */
exports.MESSAGE_TOOL_CALL_ID = `${exports.SemanticAttributePrefixes.message}.${exports.MessageAttributePostfixes.tool_call_id}`;
/**
 * tool_call.function.name
 */
exports.TOOL_CALL_FUNCTION_NAME = `${exports.SemanticAttributePrefixes.tool_call}.${exports.ToolCallAttributePostfixes.function_name}`;
/**
 * tool_call.function.argument (JSON string)
 */
exports.TOOL_CALL_FUNCTION_ARGUMENTS_JSON = `${exports.SemanticAttributePrefixes.tool_call}.${exports.ToolCallAttributePostfixes.function_arguments_json}`;
/**
 * The id of the tool call
 */
exports.TOOL_CALL_ID = `${exports.SemanticAttributePrefixes.tool_call}.${exports.ToolCallAttributePostfixes.id}`;
/**
 * The LLM function call function name
 */
exports.MESSAGE_FUNCTION_CALL_NAME = `${exports.SemanticAttributePrefixes.message}.${exports.MessageAttributePostfixes.function_call_name}`;
/**
 * The LLM function call function arguments in a json string
 */
exports.MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON = `${exports.SemanticAttributePrefixes.message}.${exports.MessageAttributePostfixes.function_call_arguments_json}`;
/**
 * The content of the message sent to the LLM
 */
exports.MESSAGE_CONTENT = `${exports.SemanticAttributePrefixes.message}.${exports.MessageAttributePostfixes.content}`;
/**
 * The array of contents for the message sent to the LLM. Each element of the array is
 * an `message_content` object.
 */
exports.MESSAGE_CONTENTS = `${exports.SemanticAttributePrefixes.message}.${exports.MessageAttributePostfixes.contents}`;
/**
 * The type of content sent to the LLM
 */
exports.MESSAGE_CONTENT_TYPE = `${exports.SemanticAttributePrefixes.message_content}.${exports.MessageContentsAttributePostfixes.type}`;
/**
 * The text content of the message sent to the LLM
 */
exports.MESSAGE_CONTENT_TEXT = `${exports.SemanticAttributePrefixes.message_content}.${exports.MessageContentsAttributePostfixes.text}`;
/**
 * The image content of the message sent to the LLM
 */
exports.MESSAGE_CONTENT_IMAGE = `${exports.SemanticAttributePrefixes.message_content}.${exports.MessageContentsAttributePostfixes.image}`;
/**
 * The http or base64 link to the image
 */
exports.IMAGE_URL = `${exports.SemanticAttributePrefixes.image}.${exports.ImageAttributesPostfixes.url}`;
exports.DOCUMENT_ID = `${exports.SemanticAttributePrefixes.document}.${exports.DocumentAttributePostfixes.id}`;
exports.DOCUMENT_CONTENT = `${exports.SemanticAttributePrefixes.document}.${exports.DocumentAttributePostfixes.content}`;
exports.DOCUMENT_SCORE = `${exports.SemanticAttributePrefixes.document}.${exports.DocumentAttributePostfixes.score}`;
exports.DOCUMENT_METADATA = `${exports.SemanticAttributePrefixes.document}.${exports.DocumentAttributePostfixes.metadata}`;
/**
 * The text that was embedded to create the vector
 */
exports.EMBEDDING_TEXT = `${exports.SemanticAttributePrefixes.embedding}.${exports.EmbeddingAttributePostfixes.text}`;
/**
 * The name of the model that was used to create the vector
 */
exports.EMBEDDING_MODEL_NAME = `${exports.SemanticAttributePrefixes.embedding}.${exports.EmbeddingAttributePostfixes.model_name}`;
/**
 * The embedding vector. Typically a high dimensional vector of floats or ints
 */
exports.EMBEDDING_VECTOR = `${exports.SemanticAttributePrefixes.embedding}.${exports.EmbeddingAttributePostfixes.vector}`;
/**
 * The embedding list root
 */
exports.EMBEDDING_EMBEDDINGS = `${exports.SemanticAttributePrefixes.embedding}.${exports.EmbeddingAttributePostfixes.embeddings}`;
/**
 * The retrieval documents list root
 */
exports.RETRIEVAL_DOCUMENTS = `${exports.SemanticAttributePrefixes.retrieval}.${exports.RetrievalAttributePostfixes.documents}`;
const PROMPT_TEMPLATE_PREFIX = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.prompt_template}`;
/**
 * The JSON representation of the variables used in the prompt template
 */
exports.PROMPT_TEMPLATE_VARIABLES = `${PROMPT_TEMPLATE_PREFIX}.variables`;
/**
 * A prompt template
 */
exports.PROMPT_TEMPLATE_TEMPLATE = `${PROMPT_TEMPLATE_PREFIX}.template`;
/**
 * The JSON representation of a function call of an LLM
 */
exports.LLM_FUNCTION_CALL = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.function_call}`;
/**
 * List of tools that are advertised to the LLM to be able to call
 */
exports.LLM_TOOLS = `${exports.SemanticAttributePrefixes.llm}.${exports.LLMAttributePostfixes.tools}`;
/**
 * The name of a tool
 */
exports.TOOL_NAME = `${exports.SemanticAttributePrefixes.tool}.${exports.ToolAttributePostfixes.name}`;
/**
 * The description of a tool
 */
exports.TOOL_DESCRIPTION = `${exports.SemanticAttributePrefixes.tool}.${exports.ToolAttributePostfixes.description}`;
/**
 * The parameters of the tool represented as a JSON string
 */
exports.TOOL_PARAMETERS = `${exports.SemanticAttributePrefixes.tool}.${exports.ToolAttributePostfixes.parameters}`;
/**
 * The json schema of a tool input, It is RECOMMENDED that this be in the
 * OpenAI tool calling format: https://platform.openai.com/docs/assistants/tools
 */
exports.TOOL_JSON_SCHEMA = `${exports.SemanticAttributePrefixes.tool}.${exports.ToolAttributePostfixes.json_schema}`;
/**
 * The session id of a trace. Used to correlate spans in a single session.
 */
exports.SESSION_ID = `${exports.SemanticAttributePrefixes.session}.${exports.SessionAttributePostfixes.id}`;
/**
 * The user id of a trace. Used to correlate spans for a single user.
 */
exports.USER_ID = `${exports.SemanticAttributePrefixes.user}.${exports.UserAttributePostfixes.id}`;
/**
 * The documents used as input to the reranker
 */
exports.RERANKER_INPUT_DOCUMENTS = `${exports.SemanticAttributePrefixes.reranker}.${exports.RerankerAttributePostfixes.input_documents}`;
/**
 * The documents output by the reranker
 */
exports.RERANKER_OUTPUT_DOCUMENTS = `${exports.SemanticAttributePrefixes.reranker}.${exports.RerankerAttributePostfixes.output_documents}`;
/**
 * The query string for the reranker
 */
exports.RERANKER_QUERY = `${exports.SemanticAttributePrefixes.reranker}.${exports.RerankerAttributePostfixes.query}`;
/**
 * The model name for the reranker
 */
exports.RERANKER_MODEL_NAME = `${exports.SemanticAttributePrefixes.reranker}.${exports.RerankerAttributePostfixes.model_name}`;
/**
 * The top k parameter for the reranker
 */
exports.RERANKER_TOP_K = `${exports.SemanticAttributePrefixes.reranker}.${exports.RerankerAttributePostfixes.top_k}`;
/**
 * Metadata for a span, used to store user-defined key-value pairs
 */
exports.METADATA = "metadata";
/**
 * A prompt template version
 */
exports.PROMPT_TEMPLATE_VERSION = `${PROMPT_TEMPLATE_PREFIX}.version`;
/**
 * The tags associated with a span
 */
exports.TAG_TAGS = `${exports.SemanticAttributePrefixes.tag}.${exports.TagAttributePostfixes.tags}`;
/**
 * The url of an audio file
 */
exports.AUDIO_URL = `${exports.SemanticAttributePrefixes.audio}.${exports.AudioAttributesPostfixes.url}`;
/**
 * The audio mime type
 */
exports.AUDIO_MIME_TYPE = `${exports.SemanticAttributePrefixes.audio}.${exports.AudioAttributesPostfixes.mime_type}`;
/**
 * The audio transcript as text
 */
exports.AUDIO_TRANSCRIPT = `${exports.SemanticAttributePrefixes.audio}.${exports.AudioAttributesPostfixes.transcript}`;
/**
 * The vendor or origin of the prompt, e.g. a prompt library, a specialized service, etc.
 */
exports.PROMPT_VENDOR = `${exports.SemanticAttributePrefixes.prompt}.${exports.PromptAttributePostfixes.vendor}`;
/**
 * A vendor-specific id used to locate the prompt
 */
exports.PROMPT_ID = `${exports.SemanticAttributePrefixes.prompt}.${exports.PromptAttributePostfixes.id}`;
/**
 * A vendor-specific URL used to locate the prompt
 */
exports.PROMPT_URL = `${exports.SemanticAttributePrefixes.prompt}.${exports.PromptAttributePostfixes.url}`;
/**
 * The name of the agent. Agents that perform the same functions should have the same name.
 */
exports.AGENT_NAME = `${exports.SemanticAttributePrefixes.agent}.${exports.AgentPostfixes.name}`;
/**
 * The id of the node in the execution graph. This along with graph.node.parent_id are used to visualize the execution graph.
 */
exports.GRAPH_NODE_ID = `${exports.SemanticAttributePrefixes.graph}.${exports.GraphPostfixes.node_id}`;
/**
 * The name of the node in the execution graph. Use this to present a human readable name for the node. Optional
 */
exports.GRAPH_NODE_NAME = `${exports.SemanticAttributePrefixes.graph}.${exports.GraphPostfixes.node_name}`;
/**
 * This references the id of the parent node. Leaving this unset or set as empty string implies that the current span is the root node.
 */
exports.GRAPH_NODE_PARENT_ID = `${exports.SemanticAttributePrefixes.graph}.${exports.GraphPostfixes.node_parent_id}`;
exports.SemanticConventions = {
    IMAGE_URL: exports.IMAGE_URL,
    INPUT_VALUE: exports.INPUT_VALUE,
    INPUT_MIME_TYPE: exports.INPUT_MIME_TYPE,
    OUTPUT_VALUE: exports.OUTPUT_VALUE,
    OUTPUT_MIME_TYPE: exports.OUTPUT_MIME_TYPE,
    LLM_INPUT_MESSAGES: exports.LLM_INPUT_MESSAGES,
    LLM_OUTPUT_MESSAGES: exports.LLM_OUTPUT_MESSAGES,
    LLM_MODEL_NAME: exports.LLM_MODEL_NAME,
    LLM_PROMPTS: exports.LLM_PROMPTS,
    LLM_INVOCATION_PARAMETERS: exports.LLM_INVOCATION_PARAMETERS,
    LLM_TOKEN_COUNT_COMPLETION: exports.LLM_TOKEN_COUNT_COMPLETION,
    LLM_TOKEN_COUNT_COMPLETION_DETAILS: exports.LLM_TOKEN_COUNT_COMPLETION_DETAILS,
    LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING: exports.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING,
    LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO: exports.LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO,
    LLM_TOKEN_COUNT_PROMPT: exports.LLM_TOKEN_COUNT_PROMPT,
    LLM_TOKEN_COUNT_PROMPT_DETAILS: exports.LLM_TOKEN_COUNT_PROMPT_DETAILS,
    LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE: exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE,
    LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ: exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ,
    LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_INPUT: exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_INPUT,
    LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO: exports.LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO,
    LLM_TOKEN_COUNT_TOTAL: exports.LLM_TOKEN_COUNT_TOTAL,
    LLM_SYSTEM: exports.LLM_SYSTEM,
    LLM_PROVIDER: exports.LLM_PROVIDER,
    LLM_TOOLS: exports.LLM_TOOLS,
    LLM_COST: exports.LLM_COST,
    LLM_COST_PROMPT: exports.LLM_COST_PROMPT,
    LLM_COST_COMPLETION: exports.LLM_COST_COMPLETION,
    LLM_COST_TOTAL: exports.LLM_COST_TOTAL,
    LLM_COST_INPUT: exports.LLM_COST_INPUT,
    LLM_COST_OUTPUT: exports.LLM_COST_OUTPUT,
    LLM_COST_COMPLETION_DETAILS_REASONING: exports.LLM_COST_COMPLETION_DETAILS_REASONING,
    LLM_COST_COMPLETION_DETAILS_AUDIO: exports.LLM_COST_COMPLETION_DETAILS_AUDIO,
    LLM_COST_PROMPT_DETAILS_CACHE_WRITE: exports.LLM_COST_PROMPT_DETAILS_CACHE_WRITE,
    LLM_COST_PROMPT_DETAILS_CACHE_READ: exports.LLM_COST_PROMPT_DETAILS_CACHE_READ,
    LLM_COST_PROMPT_DETAILS_CACHE_INPUT: exports.LLM_COST_PROMPT_DETAILS_CACHE_INPUT,
    LLM_COST_PROMPT_DETAILS_AUDIO: exports.LLM_COST_PROMPT_DETAILS_AUDIO,
    MESSAGE_ROLE: exports.MESSAGE_ROLE,
    MESSAGE_NAME: exports.MESSAGE_NAME,
    MESSAGE_TOOL_CALLS: exports.MESSAGE_TOOL_CALLS,
    MESSAGE_TOOL_CALL_ID: exports.MESSAGE_TOOL_CALL_ID,
    TOOL_CALL_ID: exports.TOOL_CALL_ID,
    TOOL_CALL_FUNCTION_NAME: exports.TOOL_CALL_FUNCTION_NAME,
    TOOL_CALL_FUNCTION_ARGUMENTS_JSON: exports.TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
    MESSAGE_FUNCTION_CALL_NAME: exports.MESSAGE_FUNCTION_CALL_NAME,
    MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON: exports.MESSAGE_FUNCTION_CALL_ARGUMENTS_JSON,
    MESSAGE_CONTENT: exports.MESSAGE_CONTENT,
    MESSAGE_CONTENTS: exports.MESSAGE_CONTENTS,
    MESSAGE_CONTENT_IMAGE: exports.MESSAGE_CONTENT_IMAGE,
    MESSAGE_CONTENT_TEXT: exports.MESSAGE_CONTENT_TEXT,
    MESSAGE_CONTENT_TYPE: exports.MESSAGE_CONTENT_TYPE,
    DOCUMENT_ID: exports.DOCUMENT_ID,
    DOCUMENT_CONTENT: exports.DOCUMENT_CONTENT,
    DOCUMENT_SCORE: exports.DOCUMENT_SCORE,
    DOCUMENT_METADATA: exports.DOCUMENT_METADATA,
    EMBEDDING_EMBEDDINGS: exports.EMBEDDING_EMBEDDINGS,
    EMBEDDING_TEXT: exports.EMBEDDING_TEXT,
    EMBEDDING_MODEL_NAME: exports.EMBEDDING_MODEL_NAME,
    EMBEDDING_VECTOR: exports.EMBEDDING_VECTOR,
    TOOL_DESCRIPTION: exports.TOOL_DESCRIPTION,
    TOOL_NAME: exports.TOOL_NAME,
    TOOL_PARAMETERS: exports.TOOL_PARAMETERS,
    TOOL_JSON_SCHEMA: exports.TOOL_JSON_SCHEMA,
    PROMPT_TEMPLATE_VARIABLES: exports.PROMPT_TEMPLATE_VARIABLES,
    PROMPT_TEMPLATE_TEMPLATE: exports.PROMPT_TEMPLATE_TEMPLATE,
    PROMPT_TEMPLATE_VERSION: exports.PROMPT_TEMPLATE_VERSION,
    RERANKER_INPUT_DOCUMENTS: exports.RERANKER_INPUT_DOCUMENTS,
    RERANKER_OUTPUT_DOCUMENTS: exports.RERANKER_OUTPUT_DOCUMENTS,
    RERANKER_QUERY: exports.RERANKER_QUERY,
    RERANKER_MODEL_NAME: exports.RERANKER_MODEL_NAME,
    RERANKER_TOP_K: exports.RERANKER_TOP_K,
    LLM_FUNCTION_CALL: exports.LLM_FUNCTION_CALL,
    RETRIEVAL_DOCUMENTS: exports.RETRIEVAL_DOCUMENTS,
    SESSION_ID: exports.SESSION_ID,
    USER_ID: exports.USER_ID,
    METADATA: exports.METADATA,
    TAG_TAGS: exports.TAG_TAGS,
    OPENINFERENCE_SPAN_KIND: `${exports.SemanticAttributePrefixes.openinference}.span.kind`,
    PROMPT_VENDOR: exports.PROMPT_VENDOR,
    PROMPT_ID: exports.PROMPT_ID,
    PROMPT_URL: exports.PROMPT_URL,
    AGENT_NAME: exports.AGENT_NAME,
    GRAPH_NODE_ID: exports.GRAPH_NODE_ID,
    GRAPH_NODE_NAME: exports.GRAPH_NODE_NAME,
    GRAPH_NODE_PARENT_ID: exports.GRAPH_NODE_PARENT_ID,
};
var OpenInferenceSpanKind;
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
})(OpenInferenceSpanKind || (exports.OpenInferenceSpanKind = OpenInferenceSpanKind = {}));
/**
 * An enum of common mime types. Not exhaustive.
 */
var MimeType;
(function (MimeType) {
    MimeType["TEXT"] = "text/plain";
    MimeType["JSON"] = "application/json";
    MimeType["AUDIO_WAV"] = "audio/wav";
})(MimeType || (exports.MimeType = MimeType = {}));
var LLMSystem;
(function (LLMSystem) {
    LLMSystem["OPENAI"] = "openai";
    LLMSystem["ANTHROPIC"] = "anthropic";
    LLMSystem["MISTRALAI"] = "mistralai";
    LLMSystem["COHERE"] = "cohere";
    LLMSystem["VERTEXAI"] = "vertexai";
    LLMSystem["AI21"] = "ai21";
    LLMSystem["META"] = "meta";
    LLMSystem["AMAZON"] = "amazon";
})(LLMSystem || (exports.LLMSystem = LLMSystem = {}));
var LLMProvider;
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
})(LLMProvider || (exports.LLMProvider = LLMProvider = {}));
//# sourceMappingURL=SemanticConventions.js.map