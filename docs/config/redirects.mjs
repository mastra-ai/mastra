export const redirectList = [
  {
    source: "/:locale/docs/getting-started/model-providers",
    destination: "/:locale/models",
    permanent: true,
  },
  {
    source: "/:locale/docs/getting-started/model-capability",
    destination: "/:locale/models",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/runtime-variables",
    destination: "/:locale/docs/agents/runtime-context",
    permanent: true,
  },
  {
    source: "/:locale/docs/tools-mcp/dynamic-context",
    destination: "/:locale/docs/tools-mcp/runtime-context",
    permanent: true,
  },
  {
    source: "/:locale/docs/08-running-evals",
    destination: "/:locale/docs/evals/overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/00-overview",
    destination: "/:locale/docs/agents/overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/01-agent-memory",
    destination: "/:locale/docs/agents/agent-memory",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/02-adding-tools",
    destination: "/:locale/docs/agents/adding-tools",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/adding-tools",
    destination: "/:locale/docs/agents/using-tools-and-mcp",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/02a-mcp-guide",
    destination: "/:locale/docs/agents/mcp-guide",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/mcp-guide",
    destination: "/:locale/docs/agents/using-tools-and-mcp",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/03-adding-voice",
    destination: "/:locale/docs/agents/adding-voice",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals/00-overview",
    destination: "/:locale/docs/evals/overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals/01-textual-evals",
    destination: "/:locale/docs/evals/textual-evals",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals/02-custom-eval",
    destination: "/:locale/docs/evals/custom-eval",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals/03-running-in-ci",
    destination: "/:locale/docs/evals/running-in-ci",
    permanent: true,
  },
  {
    source: "/:locale/docs/local-dev/creating-a-new-project",
    destination: "/:locale/docs/getting-started/installation",
    permanent: true,
  },
  {
    source: "/:locale/docs/local-dev/add-to-existing-project",
    destination:
      "/:locale/docs/getting-started/installation#add-to-an-existing-project",
    permanent: true,
  },
  {
    source: "/:locale/docs/deployment/deployment",
    destination: "/:locale/docs/deployment/serverless-platforms",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/ai-sdk-v5",
    destination: "/:locale/docs/frameworks/agentic-uis/ai-sdk#vercel-ai-sdk-v5",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/express",
    destination: "/:locale/docs/frameworks/servers/express",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/vite-react",
    destination: "/:locale/docs/frameworks/web-frameworks/vite-react",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/next-js",
    destination: "/:locale/docs/frameworks/web-frameworks/next-js",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/astro",
    destination: "/:locale/docs/frameworks/web-frameworks/astro",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/ai-sdk",
    destination: "/:locale/docs/frameworks/agentic-uis/ai-sdk",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/copilotkit",
    destination: "/:locale/docs/frameworks/agentic-uis/copilotkit",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/assistant-ui",
    destination: "/:locale/docs/frameworks/agentic-uis/assistant-ui",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/openrouter",
    destination: "/:locale/docs/frameworks/agentic-uis/openrouter",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/01-next-js",
    destination: "/:locale/docs/frameworks/next-js",
    permanent: true,
  },
  {
    source: "/:locale/docs/frameworks/02-ai-sdk",
    destination: "/:locale/docs/frameworks/ai-sdk",
    permanent: true,
  },
  {
    source: "/:locale/docs/workflows/flow-control",
    destination: "/:locale/docs/workflows/control-flow",
    permanent: true,
  },
  {
    source: "/:locale/docs/workflows/index",
    destination: "/:locale/docs/workflows/overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/voice",
    destination: "/:locale/docs/voice/overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/memory/memory-processors",
    destination: "/:locale/docs/memory/memory-processors",
    permanent: false, // we should have a memory-processors reference
  },
  {
    source: "/:locale/reference/memory/memory-processors",
    destination: "/:locale/docs/memory/memory-processors",
    permanent: true,
  },
  {
    source: "/:locale/docs/memory/getting-started",
    destination: "/:locale/docs/memory/overview",
    permanent: true,
  },
  {
    source:
      "/:locale/docs/memory/getting-started#conversation-history-last-messages",
    destination: "/:locale/docs/memory/overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/deployment/logging-and-tracing",
    destination: "/:locale/docs/observability/logging",
    permanent: true,
  },
  {
    source: "/:locale/examples/memory",
    destination: "/:locale/docs/memory/storage/memory-with-libsql",
    permanent: true,
  },
  {
    source: "/:locale/examples/memory/memory-with-libsql",
    destination: "/:locale/docs/memory/storage/memory-with-libsql",
    permanent: true,
  },
  {
    source: "/:locale/examples/memory/memory-with-pg",
    destination: "/:locale/docs/memory/storage/memory-with-pg",
    permanent: true,
  },
  {
    source: "/:locale/examples/memory/memory-with-upstash",
    destination: "/:locale/docs/memory/storage/memory-with-upstash",
    permanent: true,
  },
  {
    source: "/:locale/examples/memory/memory-processors",
    destination: "/:locale/docs/memory/memory-processors",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/rerank",
    destination: "/:locale/examples/rag/rerank/rerank",
    permanent: true,
  },
  {
    source: "/:locale/docs/local-dev/mastra-init",
    destination: "/:locale/docs/getting-started/installation",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/embed-chunk-array",
    destination: "/:locale/examples/rag/embedding/embed-chunk-array",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/embed-text-chunk",
    destination: "/:locale/examples/rag/embedding/embed-text-chunk",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/filter-rag",
    destination: "/:locale/examples/rag/usage/filter-rag",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/insert-embedding-in-astra",
    destination: "/:locale/examples/rag/upsert/upsert-embeddings#astra-db",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/insert-embedding-in-pgvector",
    destination: "/:locale/examples/rag/upsert/upsert-embeddings#pgvector",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/insert-embedding-in-chroma",
    destination: "/:locale/examples/rag/upsert/upsert-embeddings#chroma",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/insert-embedding-in-pinecone",
    destination: "/:locale/examples/rag/upsert/upsert-embeddings#pinecone",
    permanent: true,
  },
  {
    source: "/:locale/examples/memory/short-term-working-memory",
    destination: "/:locale/docs/memory/storage/memory-with-libsql",
    permanent: true,
  },
  {
    source: "/:locale/docs/local-dev/integrations",
    destination: "/:locale/docs/integrations",
    permanent: true,
  },
  {
    source: "/:locale/docs/integrations",
    destination: "/:locale/docs/tools-mcp/mcp-overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals/01-supported-evals",
    destination: "/:locale/docs/evals/overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/02b-discord-mcp-bot",
    destination: "/:locale/docs/agents/mcp-guide",
    permanent: true,
  },
  {
    source: "/:locale/docs/api/memory",
    destination: "/:locale/docs/agents/agent-memory",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/deployment/deployment",
    destination: "/:locale/docs/deployment/serverless-platforms",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/deployment/logging-and-tracing",
    destination: "/:locale/docs/observability/logging",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/engine/:path*",
    destination: "/:locale/docs",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/guides/01-harry-potter",
    destination: "/:locale/guides",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/guides/02-chef-michel",
    destination: "/:locale/guides/guide/chef-michel",
    permanent: true,
  },
  {
    source: "/:locale/docs/guides/chef-michel",
    destination: "/:locale/guides/guide/chef-michel",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/guides/03-stock-agent",
    destination: "/:locale/guides/guide/stock-agent",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/local-dev/integrations",
    destination: "/:locale/docs/server-db/local-dev-playground",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/rag/vector-databases",
    destination: "/:locale/docs/rag/vector-databases",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/rag/retrieval",
    destination: "/:locale/docs/rag/retrieval",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/cli/engine",
    destination: "/:locale/reference",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/workflows/step-retries",
    destination: "/:locale/reference/workflows/workflow",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/observability/otel-config",
    destination: "/:locale/reference/observability/otel-config",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/client-js",
    destination: "/:locale/reference/client-js/agents",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/memory/addMessage",
    destination: "/:locale/reference/memory/createThread",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/memory/rememberMessages",
    destination: "/:locale/reference/memory/createThread",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/observability/combine-loggers",
    destination: "/:locale/reference/observability/logger",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/retrieval",
    destination: "/:locale/examples/rag/query/retrieve-results",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/rag/pgstore",
    destination: "/:locale/reference/rag/pg",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/rag/reranker",
    destination: "/:locale/reference/rag/rerank",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/storage/mastra-storage",
    destination: "/:locale/reference/storage/libsql",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/tts/generate",
    destination: "/:locale/reference/voice/mastra-voice",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/tts/providers-and-models",
    destination: "/:locale/reference/voice/mastra-voice",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/tts/provider-and-models",
    destination: "/:locale/reference/voice/mastra-voice",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/voice/voice.close",
    destination: "/:locale/reference/voice/mastra-voice",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/voice/voice.off",
    destination: "/:locale/reference/voice/mastra-voice",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/tts/stream",
    destination: "/:locale/reference/voice/mastra-voice",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide",
    destination: "/:locale/guides",
    permanent: true,
  },
  {
    source: "/:locale/docs/guide/:path*",
    destination: "/:locale/guides/guide/:path*",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference",
    destination: "/:locale/reference",
    permanent: true,
  },
  {
    source: "/:locale/docs/reference/:path*",
    destination: "/:locale/reference/:path*",
    permanent: true,
  },
  {
    source: "/:locale/docs/showcase",
    destination: "/:locale/showcase",
    permanent: true,
  },
  {
    source: "/:locale/docs/showcase/:path*",
    destination: "/:locale/showcase/:path*",
    permanent: true,
  },
  {
    source: "/:locale/docs/workflows/data-flow",
    destination: "/:locale/docs/workflows/control-flow",
    permanent: true,
  },
  {
    source: "/:locale/docs/local-dev/creating-projects",
    destination: "/:locale/docs/local-dev/creating-a-new-project",
    permanent: true,
  },
  {
    source: "/:locale/docs/local-dev/sync",
    destination: "/:locale/docs/integrations",
    permanent: true,
  },
  {
    source: "/:locale/docs/local-dev/syncs",
    destination: "/:locale/docs/integrations",
    permanent: true,
  },
  {
    source: "/:locale/docs/local-dev/syncing-projects",
    destination: "/:locale/docs/server-db/local-dev-playground",
    permanent: true,
  },
  {
    source: "/:locale/docs/guides/:path*",
    destination: "/:locale/guides/guide/:path*",
    permanent: true,
  },
  {
    source: "/:locale/docs/client-js/overview",
    destination: "/:locale/docs/server-db/mastra-client",
    permanent: true,
  },
  {
    source: "/:locale/docs/deployment/custom-api-routes",
    destination: "/:locale/docs/server-db/custom-api-routes",
    permanent: true,
  },
  {
    source: "/:locale/docs/deployment/middleware",
    destination: "/:locale/docs/server-db/middleware",
    permanent: true,
  },
  {
    source: "/:locale/docs/deployment/server",
    destination: "/:locale/docs/deployment/server-deployment",
    permanent: true,
  },
  {
    source: "/:locale/docs/local-dev/mastra-dev",
    destination: "/:locale/docs/server-db/local-dev-playground",
    permanent: true,
  },
  {
    source: "/:locale/docs/storage/overview",
    destination: "/:locale/docs/server-db/storage",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/adjust-chunk-delimiters",
    destination: "/:locale/examples/rag/chunking/adjust-chunk-delimiters",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/adjust-chunk-size",
    destination: "/:locale/examples/rag/chunking/adjust-chunk-size",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/basic-rag",
    destination: "/:locale/examples/rag/usage/basic-rag",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/chunk-html",
    destination: "/:locale/examples/rag/chunking/chunk-html",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/chunk-json",
    destination: "/:locale/examples/rag/chunking/chunk-json",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/chunk-markdown",
    destination: "/:locale/examples/rag/chunking/chunk-markdown",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/chunk-text",
    destination: "/:locale/examples/rag/chunking/chunk-text",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/chunking",
    destination: "/:locale/examples/rag/chunking/chunk-text",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/cleanup-rag",
    destination: "/:locale/examples/rag/usage/cleanup-rag",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/cot-rag",
    destination: "/:locale/examples/rag/usage/cot-rag",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/cot-workflow-rag",
    destination: "/:locale/examples/rag/usage/cot-workflow-rag",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/embed-text-with-cohere",
    destination: "/:locale/examples/rag/embedding/embed-text-with-cohere",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/graph-rag",
    destination: "/:locale/examples/rag/usage/graph-rag",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/hybrid-vector-search",
    destination: "/:locale/examples/rag/query/hybrid-vector-search",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/insert-embedding-in-libsql",
    destination: "/:locale/reference/rag/libsql",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/insert-embedding-in-qdrant",
    destination: "/:locale/reference/rag/qdrant",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/insert-embedding-in-upstash",
    destination: "/:locale/reference/rag/upstash",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/insert-embedding-in-vectorize",
    destination: "/:locale/reference/rag/pg",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/metadata-extraction",
    destination: "/:locale/examples/rag/embedding/metadata-extraction",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/query/metadata-extraction",
    destination: "/:locale/examples/rag/embedding/metadata-extraction",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/rerank-rag",
    destination: "/:locale/examples/rag/rerank/rerank",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/reranking-with-cohere",
    destination: "/:locale/examples/rag/rerank/reranking-with-cohere",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/usage/rerank-rag",
    destination: "/:locale/examples/rag/rerank/rerank",
    permanent: true,
  },
  {
    source: "/:locale/examples/rag/retrieve-results",
    destination: "/:locale/examples/rag/query/retrieve-results",
    permanent: true,
  },
  {
    source: "/:locale/examples/voice",
    destination: "/:locale/examples/voice/text-to-speech",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/subscribed-steps",
    destination: "/:locale/examples/workflows/agent-and-tool-interop",
    permanent: true,
  },
  {
    source: "/:locale/docs/voice/voice-to-voice",
    destination: "/:locale/docs/voice/speech-to-speech",
    permanent: true,
  },
  {
    source: "/:locale/reference/tools/mcp-configuration",
    destination: "/:locale/reference/tools/mcp-client",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/create-logger",
    destination: "/:locale/reference/observability/logger",
    permanent: true,
  },
  {
    source: "/:locale/docs/workflows-vnext/overview",
    destination: "/:locale/docs/workflows/overview",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/vector-search",
    destination: "/:locale/examples/rag/query/hybrid-vector-search",
    permanent: true,
  },

  // redirect overview pages
  {
    source: "/:locale/docs/frameworks/agentic-uis",
    destination: "/:locale/docs/frameworks/agentic-uis/ai-sdk",
    permanent: true,
  },
  {
    source: "/:locale/examples/evals/word-inclusion",
    destination: "/:locale/examples/evals/custom-native-javascript-eval",
    permanent: true,
  },
  {
    source: "/:locale/examples/evals/custom-eval",
    destination: "/:locale/examples/evals/custom-llm-judge-eval",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/agent-and-tool-interop",
    destination: "/:locale/examples/workflows/agent-as-step",
    permanent: true,
  },
  {
    source: "/:locale/reference/agents/createTool",
    destination: "/:locale/reference/tools/create-tool",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/start",
    destination: "/:locale/reference/workflows/run-methods/start",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/resume",
    destination: "/:locale/reference/workflows/run-methods/resume",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/watch",
    destination: "/:locale/reference/workflows/run-methods/watch",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/snapshots",
    destination: "/:locale/docs/server-db/snapshots",
    permanent: true,
  },
  {
    source: "/:locale/examples/agents/hierarchical-multi-agent",
    destination: "/:locale/examples/agents/supervisor-agent",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/streaming",
    destination: "/:locale/docs/streaming/overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/workflows/streaming",
    destination: "/:locale/docs/streaming/overview",
    permanent: true,
  },
  {
    source: "/:locale/reference/agents/getAgent",
    destination: "/:locale/reference/core/getAgent",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/branch",
    destination: "/:locale/reference/workflows/workflow-methods/branch",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/commit",
    destination: "/:locale/reference/workflows/workflow-methods/commit",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/create-run",
    destination: "/:locale/reference/workflows/workflow-methods/create-run",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/dountil",
    destination: "/:locale/reference/workflows/workflow-methods/dountil",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/dowhile",
    destination: "/:locale/reference/workflows/workflow-methods/dowhile",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/foreach",
    destination: "/:locale/reference/workflows/workflow-methods/foreach",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/map",
    destination: "/:locale/reference/workflows/workflow-methods/map",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/parallel",
    destination: "/:locale/reference/workflows/workflow-methods/parallel",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/sendEvent",
    destination: "/:locale/reference/workflows/workflow-methods/sendEvent",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/sleep",
    destination: "/:locale/reference/workflows/workflow-methods/sleep",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/sleepUntil",
    destination: "/:locale/reference/workflows/workflow-methods/sleepUntil",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/then",
    destination: "/:locale/reference/workflows/workflow-methods/then",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/waitForEvent",
    destination: "/:locale/reference/workflows/workflow-methods/waitForEvent",
    permanent: true,
  },
  {
    source: "/:locale/reference/templates",
    destination: "/:locale/reference/templates/overview",
    permanent: true,
  },
  {
    source: "/:locale/reference/agents/stream",
    destination: "/:locale/reference/streaming/agents/stream",
    permanent: true,
  },
  {
    source: "/:locale/reference/streaming/agents",
    destination: "/:locale/reference/streaming/agents/stream",
    permanent: true,
  },
  {
    source: "/:locale/reference/agents/streamVNext",
    destination: "/:locale/reference/streaming/agents/streamVNext",
    permanent: true,
  },
  {
    source: "/:locale/reference/agents/ChunkType",
    destination: "/:locale/reference/streaming/ChunkType",
    permanent: true,
  },
  {
    source: "/:locale/reference/agents/MastraModelOutput",
    destination: "/:locale/reference/streaming/agents/MastraModelOutput",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/run-methods/stream",
    destination: "/:locale/reference/streaming/workflows/stream",
    permanent: true,
  },
  {
    source: "/:locale/reference/workflows/run-methods/streamVNext",
    destination: "/:locale/reference/streaming/workflows/streamVNext",
    permanent: true,
  },
  {
    source: "/:locale/reference/networks/agent-network",
    destination: "/:locale/reference/agents/network",
    permanent: true,
  },
  // VNext to new standard methods redirects
  {
    source: "/:locale/reference/agents/generateVNext",
    destination: "/:locale/reference/agents/generate",
    permanent: true,
  },
  {
    source: "/:locale/reference/streaming/agents/streamVNext",
    destination: "/:locale/reference/streaming/agents/stream",
    permanent: true,
  },
  {
    source: "/:locale/docs/observability/tracing",
    destination: "/:locale/docs/observability/otel-tracing",
    permanent: true,
  },
  // AI Tracing documentation moved
  {
    source: "/:locale/docs/observability/ai-tracing",
    destination: "/:locale/docs/observability/ai-tracing/overview",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/ai-tracing",
    destination: "/:locale/reference/observability/ai-tracing/ai-tracing",
    permanent: true,
  },
  // Observability reference reorganization
  {
    source: "/:locale/reference/observability/logger",
    destination: "/:locale/reference/observability/logging/pino-logger",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/otel-config",
    destination: "/:locale/reference/observability/otel-tracing/otel-config",
    permanent: true,
  },
  // OTLP Tracing provider redirects
  {
    source: "/:locale/reference/observability/providers/arize-ax",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/arize-ax",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/arize-phoenix",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/arize-phoenix",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/braintrust",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/braintrust",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/dash0",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/dash0",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/keywordsai",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/keywordsai",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/laminar",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/laminar",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/langfuse",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/langfuse",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/langsmith",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/langsmith",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/langwatch",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/langwatch",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/new-relic",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/new-relic",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/signoz",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/signoz",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/traceloop",
    destination:
      "/:locale/reference/observability/otel-tracing/providers/traceloop",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers",
    destination: "/:locale/reference/observability/otel-tracing/providers",
    permanent: true,
  },
  {
    source: "/:locale/reference/observability/providers/index",
    destination: "/:locale/reference/observability/otel-tracing/providers",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/input-processors",
    destination: "/:locale/docs/agents/guardrails",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/output-processors",
    destination: "/:locale/docs/agents/guardrails",
    permanent: true,
  },
  // Vector store reference redirects (moved from RAG to Vectors)
  {
    source: "/:locale/reference/rag/astra",
    destination: "/:locale/reference/vectors/astra",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/chroma",
    destination: "/:locale/reference/vectors/chroma",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/vectorize",
    destination: "/:locale/reference/vectors/vectorize",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/couchbase",
    destination: "/:locale/reference/vectors/couchbase",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/lance",
    destination: "/:locale/reference/vectors/lance",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/libsql",
    destination: "/:locale/reference/vectors/libsql",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/mongodb",
    destination: "/:locale/reference/vectors/mongodb",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/opensearch",
    destination: "/:locale/reference/vectors/opensearch",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/pg",
    destination: "/:locale/reference/vectors/pg",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/pinecone",
    destination: "/:locale/reference/vectors/pinecone",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/qdrant",
    destination: "/:locale/reference/vectors/qdrant",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/s3vectors",
    destination: "/:locale/reference/vectors/s3vectors",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/turbopuffer",
    destination: "/:locale/reference/vectors/turbopuffer",
    permanent: true,
  },
  {
    source: "/:locale/reference/rag/upstash",
    destination: "/:locale/reference/vectors/upstash",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/dynamic-agents",
    destination: "/:locale/docs/agents/runtime-context",
    permanent: true,
  },
  {
    source: "/:locale/reference/cli/mcp-docs-server",
    destination: "/:locale/docs/getting-started/mcp-docs-server",
    permanent: true,
  },
  {
    source: "/:locale/reference/cli/init",
    destination: "/:locale/reference/cli/mastra",
    permanent: true,
  },
  {
    source: "/:locale/reference/cli/dev",
    destination: "/:locale/reference/cli/mastra",
    permanent: true,
  },
  {
    source: "/:locale/reference/cli/build",
    destination: "/:locale/reference/cli/mastra",
    permanent: true,
  },
  {
    source: "/:locale/reference/cli/start",
    destination: "/:locale/reference/cli/mastra",
    permanent: true,
  },
  {
    source: "/:locale/reference/cli/lint",
    destination: "/:locale/reference/cli/mastra",
    permanent: true,
  },
  {
    source: "/:locale/reference/cli/scorers",
    destination: "/:locale/reference/cli/mastra",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/using-tools-and-mcp",
    destination: "/:locale/docs/agents/using-tools",
    permanent: true,
  },
  {
    source: "/:locale/reference/agents/migration-guide",
    destination: "/:locale/guides/migrations/vnext-to-standard-apis",
    permanent: true,
  },
  {
    source: "/:locale/docs/agents/runtime-context",
    destination: "/:locale/docs/server-db/runtime-context",
    permanent: true,
  },
  {
    source: "/:locale/examples/agents/adding-voice-capabilities",
    destination: "/:locale/docs/agents/adding-voice",
    permanent: true,
  },
  {
    source: "/:locale/examples/deployment",
    destination: "/:locale/docs/deployment/overview",
    permanent: true,
  },
  {
    source: "/:locale/examples/deployment/index",
    destination: "/:locale/docs/deployment/overview",
    permanent: true,
  },
  {
    source: "/:locale/examples/deployment/deploying-mastra-server",
    destination: "/:locale/docs/deployment/overview",
    permanent: true,
  },
  {
    source: "/:locale/examples/deployment/auth-middleware",
    destination: "/:locale/docs/server-db/middleware",
    permanent: true,
  },
  {
    source: "/:locale/examples/deployment/cors-middleware",
    destination: "/:locale/docs/server-db/middleware",
    permanent: true,
  },
  {
    source: "/:locale/examples/deployment/custom-api-route",
    destination: "/:locale/docs/server-db/middleware",
    permanent: true,
  },
  {
    source: "/:locale/examples/deployment/logging-middleware",
    destination: "/:locale/docs/server-db/middleware",
    permanent: true,
  },

  {
    source: "/:locale/examples/scorers/answer-relevancy",
    destination: "/:locale/reference/scorers/answer-relevancy",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/answer-similarity",
    destination: "/:locale/reference/scorers/answer-similarity",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/bias",
    destination: "/:locale/reference/scorers/bias",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/completeness",
    destination: "/:locale/reference/scorers/completeness",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/content-similarity",
    destination: "/:locale/reference/scorers/content-similarity",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/context-precision",
    destination: "/:locale/reference/scorers/context-precision",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/context-relevance",
    destination: "/:locale/reference/scorers/context-relevance",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/faithfulness",
    destination: "/:locale/reference/scorers/faithfulness",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/hallucination",
    destination: "/:locale/reference/scorers/hallucination",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/keyword-coverage",
    destination: "/:locale/reference/scorers/keyword-coverage",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/textual-difference",
    destination: "/:locale/reference/scorers/textual-difference",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/tone-consistency",
    destination: "/:locale/reference/scorers/tone-consistency",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/tool-call-accuracy",
    destination: "/:locale/reference/scorers/tool-call-accuracy",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/prompt-alignment",
    destination: "/:locale/reference/scorers/prompt-alignment",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/noise-sensitivity",
    destination: "/:locale/reference/scorers/noise-sensitivity",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/toxicity",
    destination: "/:locale/reference/scorers/toxicity",
    permanent: true,
  },
  {
    source: "/:locale/examples/scorers/custom-scorer",
    destination: "/:locale/docs/scorers/custom-scorers",
    permanent: true,
  },
  {
    source: "/:locale/en/docs/tools-mcp/runtime-context",
    destination: "/:locale/en/docs/server-db/runtime-context",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals",
    destination: "/:locale/docs/scorers/evals-old-api",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals/overview",
    destination: "/:locale/docs/scorers/evals-old-api/overview",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals/custom-eval",
    destination: "/:locale/docs/scorers/evals-old-api/custom-eval",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals/running-in-ci",
    destination: "/:locale/docs/scorers/evals-old-api/running-in-ci",
    permanent: true,
  },
  {
    source: "/:locale/docs/evals/textual-evals",
    destination: "/:locale/docs/scorers/evals-old-api/textual-evals",
    permanent: true,
  },
  {
    source: "/:locale/examples/agents/using-a-tool",
    destination:
      "/:locale/docs/agents/using-tools-and-mcp#adding-tools-to-an-agent",
    permanent: true,
  },
  {
    source: "/:locale/examples/agents/using-a-workflow",
    destination:
      "/:locale/docs/workflows/agents-and-tools#adding-an-agent-as-a-step",
    permanent: true,
  },
  {
    source: "/:locale/docs/server-db/snapshots",
    destination: "/:locale/docs/workflows/snapshots",
    permanent: true,
  },
  {
    source: "/:locale/docs/workflows/pausing-execution",
    destination: "/:locale/docs/workflows/suspend-and-resume",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/agent-as-step",
    destination: "/:locale/docs/workflows/agents-and-tools",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/array-as-input",
    destination: "/:locale/docs/workflows/control-flow",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/calling-agent",
    destination: "/:locale/docs/workflows/agents-and-tools",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/conditional-branching",
    destination: "/:locale/docs/workflows/control-flow",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/human-in-the-loop-multi-turn",
    destination: "/:locale/docs/workflows/human-in-the-loop",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/human-in-the-loop",
    destination: "/:locale/docs/workflows/human-in-the-loop",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/parallel-steps",
    destination: "/:locale/docs/workflows/control-flow",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/sequential-steps",
    destination: "/:locale/docs/workflows/control-flow",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/running-workflows",
    destination: "/:locale/docs/workflows/overview",
    permanent: true,
  },
  {
    source: "/:locale/examples/workflows/tool-as-step",
    destination: "/:locale/docs/workflows/agents-and-tools",
    permanent: true,
  },
  {
    source: "/:locale/examples/tools/calling-tools",
    destination: "/:locale/docs/agents/using-tools",
    permanent: true,
  },
  {
    source: "/:locale/examples/tools/dynamic-tools",
    destination: "/:locale/docs/server-db/runtime-context",
    permanent: true,
  },
  {
    source: "/:locale/examples/tools/workflow-as-tools",
    destination: "/:locale/docs/workflows/agents-and-tools",
    permanent: true,
  },
  {
    source: "/:locale/examples/memory/working-memory-basic",
    destination: "/:locale/docs/memory/working-memory",
    permanent: true,
  },
  {
    source: "/:locale/docs/server-db/local-dev-playground",
    destination: "/:locale/docs/getting-started/studio",
    permanent: true,
  },
];
