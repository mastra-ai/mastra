import { CardItems } from "./example-cards";

export const ReferenceCards = () => {
  return (
    <CardItems
      titles={[
        "Core",
        "CLI",
        "Agents",
        "Tools",
        "Workflows",
        "Networks",
        "Memory",
        "Storage",
        "RAG",
        "Evals",
        "Voice",
        "Observability",
        "Client SDK - JS",
        "Deployer",
      ]}
      items={{
        Core: [
          {
            title: "Mastra Class",
            href: "/reference/core/mastra-class",
          },
        ],
        CLI: [
          {
            title: "mastra init",
            href: "/reference/cli/init",
          },
          {
            title: "mastra dev",
            href: "/reference/cli/dev",
          },
          {
            title: "mastra deploy",
            href: "/reference/cli/deploy",
          },
          {
            title: "mastra build",
            href: "/reference/cli/build",
          },
        ],
        Agents: [
          {
            title: "getAgent()",
            href: "/reference/agents/getAgent",
          },
          {
            title: "createTool()",
            href: "/reference/agents/createTool",
          },
          {
            title: "generate()",
            href: "/reference/agents/generate",
          },
          {
            title: "stream()",
            href: "/reference/agents/stream",
          },
        ],
        Tools: [
          {
            title: "createDocumentChunkerTool()",
            href: "/reference/tools/document-chunker-tool",
          },
          {
            title: "createGraphRAGTool()",
            href: "/reference/tools/graph-rag-tool",
          },
          {
            title: "createVectorQueryTool()",
            href: "/reference/tools/vector-query-tool",
          },
          {
            title: "MastraMCPClient",
            href: "/reference/tools/client",
          },
          {
            title: "MCPConfiguration",
            href: "/reference/tools/mcp-configuration",
          },
        ],
        Workflows: [
          {
            title: "Workflow",
            href: "/reference/workflows/workflow",
          },
          {
            title: "Step",
            href: "/reference/workflows/step-class",
          },
          {
            title: "StepOptions",
            href: "/reference/workflows/step-options",
          },
          {
            title: "StepCondition",
            href: "/reference/workflows/step-condition",
          },
          {
            title: ".step()",
            href: "/reference/workflows/step-function",
          },
          {
            title: ".after()",
            href: "/reference/workflows/after",
          },
          {
            title: ".then()",
            href: "/reference/workflows/then",
          },
          {
            title: ".until()",
            href: "/reference/workflows/until",
          },
          {
            title: ".while()",
            href: "/reference/workflows/while",
          },
          {
            title: ".if()",
            href: "/reference/workflows/if",
          },
          {
            title: ".else()",
            href: "/reference/workflows/else",
          },
          {
            title: ".createRun()",
            href: "/reference/workflows/createRun",
          },
          {
            title: ".start()",
            href: "/reference/workflows/start",
          },
          {
            title: ".execute()",
            href: "/reference/workflows/execute",
          },
          {
            title: ".suspend()",
            href: "/reference/workflows/suspend",
          },
          {
            title: "Snapshots",
            href: "/reference/workflows/snapshots",
          },
          {
            title: ".resume()",
            href: "/reference/workflows/resume",
          },
          {
            title: ".commit()",
            href: "/reference/workflows/commit",
          },
          {
            title: ".watch()",
            href: "/reference/workflows/watch",
          },
          {
            title: "Event-Driven Workflows",
            href: "/reference/workflows/events",
          },
          {
            title: ".afterEvent()",
            href: "/reference/workflows/afterEvent",
          },
          {
            title: ".resumeWithEvent()",
            href: "/reference/workflows/resumeWithEvent",
          },
          {
            title: "Step Retries",
            href: "/reference/workflows/step-retries",
          },
        ],
        Networks: [
          {
            title: "AgentNetwork (Experimental)",
            href: "/reference/networks/agent-network",
          },
        ],
        Memory: [
          {
            title: "Memory Class",
            href: "/reference/memory/Memory",
          },
          {
            title: ".createThread()",
            href: "/reference/memory/createThread",
          },
          {
            title: ".query()",
            href: "/reference/memory/query",
          },
          {
            title: ".getThreadById()",
            href: "/reference/memory/getThreadById",
          },
          {
            title: ".getThreadsByResourceId()",
            href: "/reference/memory/getThreadsByResourceId",
          },
        ],
        Storage: [
          {
            title: "LibSQL Storage",
            href: "/reference/storage/libsql",
          },
          {
            title: "PostgreSQL Storage",
            href: "/reference/storage/postgresql",
          },
          {
            title: "Upstash Storage",
            href: "/reference/storage/upstash",
          },
        ],
        RAG: [
          {
            title: ".chunk()",
            href: "/reference/rag/chunk",
          },
          {
            title: ".embed()",
            href: "/reference/rag/embeddings",
          },
          {
            title: "ExtractParams",
            href: "/reference/rag/extract-params",
          },
          {
            title: "rerank()",
            href: "/reference/rag/rerank",
          },
          {
            title: "MDocument",
            href: "/reference/rag/document",
          },
          {
            title: "Metadata Filters",
            href: "/reference/rag/metadata-filters",
          },
          {
            title: "GraphRAG",
            href: "/reference/rag/graph-rag",
          },
          {
            title: "AstraVector",
            href: "/reference/rag/astra",
          },
          {
            title: "ChromaVector",
            href: "/reference/rag/chroma",
          },
          {
            title: "CloudflareVector",
            href: "/reference/rag/vectorize",
          },
          {
            title: "PgVector",
            href: "/reference/rag/pg",
          },
          {
            title: "LibSQLVector",
            href: "/reference/rag/libsql",
          },
          {
            title: "PineconeVector",
            href: "/reference/rag/pinecone",
          },
          {
            title: "QdrantVector",
            href: "/reference/rag/qdrant",
          },
          {
            title: "TurboPuffer",
            href: "/reference/rag/turbopuffer",
          },
          {
            title: "UpstashVector",
            href: "/reference/rag/upstash",
          },
        ],
        Evals: [
          {
            title: "AnswerRelevancy",
            href: "/reference/evals/answer-relevancy",
          },
          {
            title: "Bias",
            href: "/reference/evals/bias",
          },
          {
            title: "Completeness",
            href: "/reference/evals/completeness",
          },
          {
            title: "ContentSimilarity",
            href: "/reference/evals/content-similarity",
          },
          {
            title: "ContextPosition",
            href: "/reference/evals/context-position",
          },
          {
            title: "ContextPrecision",
            href: "/reference/evals/context-precision",
          },
          {
            title: "ContextRelevancy",
            href: "/reference/evals/context-relevancy",
          },
          {
            title: "ContextualRecall",
            href: "/reference/evals/contextual-recall",
          },
          {
            title: "Faithfulness",
            href: "/reference/evals/faithfulness",
          },
          {
            title: "Hallucination",
            href: "/reference/evals/hallucination",
          },
          {
            title: "KeywordCoverage",
            href: "/reference/evals/keyword-coverage",
          },
          {
            title: "PromptAlignment",
            href: "/reference/evals/prompt-alignment",
          },
          {
            title: "Summarization",
            href: "/reference/evals/summarization",
          },
          {
            title: "TextualDifference",
            href: "/reference/evals/textual-difference",
          },
          {
            title: "ToneConsistency",
            href: "/reference/evals/tone-consistency",
          },
          {
            title: "Toxicity",
            href: "/reference/evals/toxicity",
          },
        ],
        Voice: [
          {
            title: "Text to Speech",
            href: "/reference/voice/text-to-speech",
          },
          {
            title: "Speech to Text",
            href: "/reference/voice/speech-to-text",
          },
        ],
        Observability: [
          {
            title: "Providers",
            href: "/reference/observability/providers",
          },
          {
            title: "Logger",
            href: "/reference/observability/logger",
          },
          {
            title: "OTelConfig",
            href: "/reference/observability/otel-config",
          },
          {
            title: ".createLogger()",
            href: "/reference/observability/create-logger",
          },
        ],
        "Client SDK - JS": [
          {
            title: "Agents API",
            href: "/reference/client-js/agents",
          },
          {
            title: "Memory API",
            href: "/reference/client-js/memory",
          },
          {
            title: "Tools API",
            href: "/reference/client-js/tools",
          },
          {
            title: "Workflows API",
            href: "/reference/client-js/workflows",
          },
          {
            title: "Vectors API",
            href: "/reference/client-js/vectors",
          },
          {
            title: "Logs API",
            href: "/reference/client-js/logs",
          },
          {
            title: "Telemetry API",
            href: "/reference/client-js/telemetry",
          },
          {
            title: "Error Handling",
            href: "/reference/client-js/error-handling",
          },
        ],
        Deployer: [
          {
            title: "Deployer",
            href: "/reference/deployer/deployer",
          },
          {
            title: "Cloudflare",
            href: "/reference/deployer/cloudflare",
          },
          {
            title: "Netlify",
            href: "/reference/deployer/netlify",
          },
          {
            title: "Vercel",
            href: "/reference/deployer/vercel",
          },
        ],
      }}
    ></CardItems>
  );
};
