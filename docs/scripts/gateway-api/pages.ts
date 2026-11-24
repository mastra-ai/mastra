/**
 * Page metadata for the generated Gateway API reference, keyed by OpenAPI `operationId`.
 *
 * `slug` is relative to the Gateway API directory. The first operation of each group keeps the URL of the
 * hand-written page it replaced. An optional guide at `_guides/<slug>.mdx` is rendered above the generated
 * request and response reference. Operations missing here are generated from the spec's summary at their
 * operation ID, and `generate.ts` warns about them.
 */
export interface GatewayApiPage {
  slug: string
  /** Page heading and sidebar label. The browser title gets a " | Gateway" suffix. */
  title: string
  description: string
  /**
   * The provider API reference this endpoint is compatible with. The generated AI-agent note points there for
   * fields the spec leaves as open objects, such as streaming event payloads.
   */
  compatibleWith?: { name: string; url: string }
}

const openai = (name: string, resource: string) => ({
  name: `OpenAI ${name} API reference`,
  url: `https://developers.openai.com/api/reference/resources/${resource}`,
})

const COMPATIBLE_APIS = {
  chat: openai('Chat Completions', 'chat'),
  responses: openai('Responses', 'responses'),
  messages: { name: 'Anthropic Messages API reference', url: 'https://platform.claude.com/docs/en/api/messages' },
  embeddings: openai('Embeddings', 'embeddings'),
  decisions: openai('Decisions', 'decisions'),
  images: openai('Images', 'images'),
  audio: openai('Audio', 'audio'),
  models: openai('Models', 'models'),
}

export const GATEWAY_API_PAGES: Record<string, GatewayApiPage> = {
  createChatCompletion: {
    slug: 'chat-completions',
    compatibleWith: COMPATIBLE_APIS.chat,
    title: 'Chat Completions',
    description: 'Send OpenAI-compatible chat completion requests, with streaming and tools, to any Gateway model.',
  },
  createResponse: {
    slug: 'responses',
    compatibleWith: COMPATIBLE_APIS.responses,
    title: 'Create a response',
    description: 'Use the OpenAI Responses API through Gateway, including stored responses and continuation.',
  },
  getResponse: {
    slug: 'responses/retrieve',
    compatibleWith: COMPATIBLE_APIS.responses,
    title: 'Retrieve a response',
    description: 'Retrieve a response stored by the provider that created it.',
  },
  deleteResponse: {
    slug: 'responses/delete',
    compatibleWith: COMPATIBLE_APIS.responses,
    title: 'Delete a response',
    description: 'Delete a response stored by the provider that created it.',
  },
  listResponseInputItems: {
    slug: 'responses/input-items',
    compatibleWith: COMPATIBLE_APIS.responses,
    title: 'List response input items',
    description: 'List the input items of a response stored with the OpenAI Responses API.',
  },
  createMessage: {
    slug: 'messages',
    compatibleWith: COMPATIBLE_APIS.messages,
    title: 'Anthropic Messages',
    description: 'Call Claude through Gateway with the Anthropic Messages API and the Anthropic SDK.',
  },
  countMessageTokens: {
    slug: 'messages/count-tokens',
    compatibleWith: COMPATIBLE_APIS.messages,
    title: 'Count message tokens',
    description: 'Count the tokens in an Anthropic Messages request with your Anthropic account.',
  },
  createEmbeddings: {
    slug: 'embeddings',
    compatibleWith: COMPATIBLE_APIS.embeddings,
    title: 'Embeddings',
    description: 'Create text embeddings through Gateway with the OpenAI Embeddings API.',
  },
  createDecision: {
    slug: 'decisions',
    compatibleWith: COMPATIBLE_APIS.decisions,
    title: 'Decisions',
    description: 'Ask a model structured predicate, choice, and score questions about an input in a single request.',
  },
  createRerank: {
    slug: 'rerank',
    title: 'Rerank',
    description: "Rank documents by relevance to a query with Gateway's rerank endpoint.",
  },
  generateImage: {
    slug: 'images',
    compatibleWith: COMPATIBLE_APIS.images,
    title: 'Generate an image',
    description: 'Generate images through Gateway with the OpenAI Images API.',
  },
  editImage: {
    slug: 'images/edits',
    compatibleWith: COMPATIBLE_APIS.images,
    title: 'Edit an image',
    description: 'Edit images through Gateway with the OpenAI Images API.',
  },
  createVideo: {
    slug: 'videos',
    title: 'Create a video',
    description: 'Generate videos through Gateway as asynchronous jobs.',
  },
  listVideos: {
    slug: 'videos/list',
    title: 'List video jobs',
    description: 'List your Gateway video generation jobs, one page at a time.',
  },
  getVideo: {
    slug: 'videos/retrieve',
    title: 'Retrieve a video job',
    description: 'Check the status and cost of a Gateway video generation job.',
  },
  getVideoContent: {
    slug: 'videos/content',
    title: 'Download a video',
    description: 'Download the video file produced by a completed Gateway video job.',
  },
  createSpeech: {
    slug: 'audio',
    compatibleWith: COMPATIBLE_APIS.audio,
    title: 'Create speech',
    description: 'Generate speech through Gateway with the OpenAI Audio API.',
  },
  createTranscription: {
    slug: 'audio/transcriptions',
    compatibleWith: COMPATIBLE_APIS.audio,
    title: 'Create a transcription',
    description: 'Transcribe an audio file through Gateway with the OpenAI Audio API.',
  },
  listModels: {
    slug: 'models',
    compatibleWith: COMPATIBLE_APIS.models,
    title: 'List models',
    description: 'List the models available through Gateway with the OpenAI-compatible models endpoint.',
  },
  getModel: {
    slug: 'models/retrieve',
    compatibleWith: COMPATIBLE_APIS.models,
    title: 'Retrieve a model',
    description: 'Get one model from the Gateway catalog, including its pricing and capabilities.',
  },
  listAnthropicFiles: {
    slug: 'files',
    title: 'List files',
    description: 'List the files in the Anthropic account linked to your Gateway key.',
  },
  uploadAnthropicFile: {
    slug: 'files/upload',
    title: 'Upload a file',
    description: 'Upload a file to the Anthropic account linked to your Gateway key.',
  },
  getAnthropicFile: {
    slug: 'files/retrieve',
    title: 'Retrieve file metadata',
    description: 'Get the metadata of a file in the Anthropic account linked to your Gateway key.',
  },
  deleteAnthropicFile: {
    slug: 'files/delete',
    title: 'Delete a file',
    description: 'Delete a file from the Anthropic account linked to your Gateway key.',
  },
  downloadAnthropicFile: {
    slug: 'files/content',
    title: 'Download a file',
    description: 'Download the contents of a file in the Anthropic account linked to your Gateway key.',
  },
}
