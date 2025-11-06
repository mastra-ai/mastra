/**
 * Sidebar for Examples
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  examplesSidebar: [
    {
      type: "doc",
      id: "index",
      label: "Overview",
    },
    {
      type: "category",
      label: "Agents",
      collapsed: true,
      items: [
        { type: "doc", id: "agents/calling-agents", label: "Calling Agents" },
        {
          type: "doc",
          id: "agents/system-prompt",
          label: "Changing the System Prompt",
        },
        {
          type: "doc",
          id: "agents/supervisor-agent",
          label: "Supervisor Agent",
        },
        { type: "doc", id: "agents/image-analysis", label: "Image Analysis" },
        { type: "doc", id: "agents/request-context", label: "Request Context" },
        {
          type: "doc",
          id: "agents/deploying-mcp-server",
          label: "Deploying an MCPServer",
        },
        {
          type: "doc",
          id: "agents/ai-sdk-v5-integration",
          label: "AI SDK v5 Integration",
        },
        {
          type: "doc",
          id: "agents/whatsapp-chat-bot",
          label: "WhatsApp Chat Bot",
        },
      ],
    },
    {
      type: "category",
      label: "Workflows",
      collapsed: true,
      items: [
        {
          type: "doc",
          id: "workflows/inngest-workflow",
          label: "Inngest Workflow",
        },
      ],
    },
    {
      type: "category",
      label: "Processors",
      collapsed: true,
      items: [
        {
          type: "doc",
          id: "processors/message-length-limiter",
          label: "Message Length Limiter",
        },
        {
          type: "doc",
          id: "processors/response-length-limiter",
          label: "Response Length Limiter",
        },
        {
          type: "doc",
          id: "processors/response-validator",
          label: "Response Validator",
        },
      ],
    },
    {
      type: "category",
      label: "Memory",
      collapsed: true,
      items: [
        {
          type: "doc",
          id: "memory/working-memory-template",
          label: "Memory with Template",
        },
        {
          type: "doc",
          id: "memory/working-memory-schema",
          label: "Memory with Schema",
        },
        {
          type: "doc",
          id: "memory/memory-with-mongodb",
          label: "Memory with MongoDB",
        },
      ],
    },
    {
      type: "category",
      label: "RAG",
      collapsed: true,
      items: [
        {
          type: "category",
          label: "Chunking",
          items: [
            { type: "doc", id: "rag/chunking/chunk-text", label: "Chunk Text" },
            {
              type: "doc",
              id: "rag/chunking/chunk-markdown",
              label: "Chunk Markdown",
            },
            {
              type: "doc",
              id: "rag/chunking/chunk-html",
              label: "Chunk HTML",
            },
            {
              type: "doc",
              id: "rag/chunking/chunk-json",
              label: "Chunk JSON",
            },
            {
              type: "doc",
              id: "rag/chunking/adjust-chunk-size",
              label: "Adjust Chunk Size",
            },
            {
              type: "doc",
              id: "rag/chunking/adjust-chunk-delimiters",
              label: "Adjust Chunk Delimiters",
            },
          ],
        },
        {
          type: "category",
          label: "Embedding",
          items: [
            {
              type: "doc",
              id: "rag/embedding/embed-text-chunk",
              label: "Embed Text Chunk",
            },
            {
              type: "doc",
              id: "rag/embedding/embed-chunk-array",
              label: "Embed Chunk Array",
            },
            {
              type: "doc",
              id: "rag/embedding/embed-text-with-cohere",
              label: "Embed Text with Cohere",
            },
            {
              type: "doc",
              id: "rag/embedding/metadata-extraction",
              label: "Metadata Extraction",
            },
          ],
        },
        {
          type: "category",
          label: "Upsert",
          items: [
            {
              type: "doc",
              id: "rag/upsert/upsert-embeddings",
              label: "Upsert Embeddings",
            },
          ],
        },
        {
          type: "category",
          label: "Query",
          items: [
            {
              type: "doc",
              id: "rag/query/hybrid-vector-search",
              label: "Hybrid Vector Search",
            },
            {
              type: "doc",
              id: "rag/query/retrieve-results",
              label: "Retrieve Results",
            },
          ],
        },
        {
          type: "category",
          label: "Rerank",
          items: [
            {
              type: "doc",
              id: "rag/rerank/rerank",
              label: "Re-ranking Results",
            },
            {
              type: "doc",
              id: "rag/rerank/rerank-rag",
              label: "Re-ranking Results with Tools",
            },
            {
              type: "doc",
              id: "rag/rerank/reranking-with-cohere",
              label: "Re-ranking results with Cohere",
            },
            {
              type: "doc",
              id: "rag/rerank/reranking-with-zeroentropy",
              label: "Re-ranking results with ZeroEntropy",
            },
          ],
        },
        {
          type: "category",
          label: "Usage",
          items: [
            {
              type: "doc",
              id: "rag/usage/basic-rag",
              label: "Using the Vector Query Tool",
            },
            {
              type: "doc",
              id: "rag/usage/cleanup-rag",
              label: "Optimizing Information Density",
            },
            {
              type: "doc",
              id: "rag/usage/filter-rag",
              label: "Metadata Filtering",
            },
            {
              type: "doc",
              id: "rag/usage/cot-rag",
              label: "Chain of Thought Prompting",
            },
            {
              type: "doc",
              id: "rag/usage/cot-workflow-rag",
              label: "Structured Reasoning with Workflows",
            },
            {
              type: "doc",
              id: "rag/usage/graph-rag",
              label: "Graph RAG",
            },
            {
              type: "doc",
              id: "rag/usage/database-specific-config",
              label: "Database-Specific Configurations",
            },
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Evals",
      collapsed: true,
      items: [
        { type: "doc", id: "evals/running-in-ci", label: "Running in CI" },
      ],
    },
    {
      type: "category",
      label: "Voice",
      collapsed: true,
      items: [
        { type: "doc", id: "voice/text-to-speech", label: "Text to Speech" },
        { type: "doc", id: "voice/speech-to-text", label: "Speech to Text" },
        { type: "doc", id: "voice/turn-taking", label: "Turn Taking" },
        {
          type: "doc",
          id: "voice/speech-to-speech",
          label: "Speech to Speech",
        },
      ],
    },
    {
      type: "category",
      label: "Observability",
      collapsed: true,
      items: [
        {
          type: "doc",
          id: "observability/basic-tracing",
          label: "Basic Tracing",
        },
      ],
    },
  ],
};

export default sidebars;
