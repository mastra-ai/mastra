import { CardItems } from "./cards/card-items";

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
        "Scorers (Experimental)",
        "Voice",
        "Observability",
        "Client SDK",
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
            title: "create-mastra",
            href: "/reference/cli/create-mastra",
          },
          {
            title: "mastra init",
            href: "/reference/cli/init",
          },
          {
            title: "mastra dev",
            href: "/reference/cli/dev",
          },
          {
            title: "mastra build",
            href: "/reference/cli/build",
          },
          {
            title: "mastra start",
            href: "/reference/cli/start",
          },
          {
            title: "mastra lint",
            href: "/reference/cli/lint",
          },
          {
            title: "mcp-docs-server",
            href: "/reference/cli/mcp-docs-server",
          },
        ],
        Agents: [
          {
            title: "Agent",
            href: "/reference/agents/agent",
          },
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
          {
            title: "getWorkflows()",
            href: "/reference/agents/getWorkflows",
          },
          {
            title: "getVoice()",
            href: "/reference/agents/getVoice",
          },
          {
            title: "getInstructions()",
            href: "/reference/agents/getInstructions",
          },
          {
            title: "getTools()",
            href: "/reference/agents/getTools",
          },
          {
            title: "getModel()",
            href: "/reference/agents/getModel",
          },
          {
            title: "getMemory()",
            href: "/reference/agents/getMemory",
          },
        ],
        Tools: [
          {
            title: "createTool()",
            href: "/reference/tools/create-tool",
          },
          {
            title: "MCPClient",
            href: "/reference/tools/mcp-client",
          },
          {
            title: "MCPServer",
            href: "/reference/tools/mcp-server",
          },
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
        ],
        Workflows: [
          {
            title: "Workflow",
            href: "/reference/workflows/workflow",
          },
          {
            title: "createStep()",
            href: "/reference/workflows/step",
          },
          {
            title: "then()",
            href: "/reference/workflows/then",
          },
          {
            title: "parallel()",
            href: "/reference/workflows/parallel",
          },
          {
            title: "branch()",
            href: "/reference/workflows/branch",
          },
          {
            title: "dowhile()",
            href: "/reference/workflows/dowhile",
          },
          {
            title: "dountil()",
            href: "/reference/workflows/dountil",
          },
          {
            title: "foreach()",
            href: "/reference/workflows/foreach",
          },
          {
            title: "map()",
            href: "/reference/workflows/map",
          },
          {
            title: "sleep()",
            href: "/reference/workflows/sleep",
          },
          {
            title: "sleepUntil()",
            href: "/reference/workflows/sleepUntil",
          },
          {
            title: "waitForEvent()",
            href: "/reference/workflows/waitForEvent",
          },
          {
            title: "sendEvent()",
            href: "/reference/workflows/sendEvent",
          },
          {
            title: "commit()",
            href: "/reference/workflows/commit",
          },
          {
            title: "createRunAsync()",
            href: "/reference/workflows/create-run",
          },
          {
            title: "Snapshots",
            href: "/reference/workflows/snapshots",
          },
          {
            title: "watch()",
            href: "/reference/workflows/watch",
          },
          {
            title: "stream()",
            href: "/reference/workflows/stream",
          },
          {
            title: "execute()",
            href: "/reference/workflows/execute",
          },
          {
            title: "resume()",
            href: "/reference/workflows/resume",
          },
          {
            title: "start()",
            href: "/reference/workflows/start",
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
          {
            title: "Cloudflare KV Storage",
            href: "/reference/storage/cloudflare",
          },
          {
            title: "Cloudflare D1 Storage",
            href: "/reference/storage/cloudflare-d1",
          },
          {
            title: "DynamoDB Storage",
            href: "/reference/storage/dynamodb",
          },
        ],
        RAG: [
          {
            title: "MDocument",
            href: "/reference/rag/document",
          },
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
            title: "rerankWithScorer()",
            href: "/reference/rag/rerankWithScorer",
          },
          {
            title: "Metadata Filters",
            href: "/reference/rag/metadata-filters",
          },
          {
            title: "DatabaseConfig",
            href: "/reference/rag/database-config",
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
            title: "MongoDBVector",
            href: "/reference/rag/mongodb",
          },
          {
            title: "CouchbaseVector",
            href: "/reference/rag/couchbase",
          },
          {
            title: "OpenSearchVector",
            href: "/reference/rag/opensearch",
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
          {
            title: "LanceVector",
            href: "/reference/rag/lance",
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
        "Scorers (Experimental)": [
          {
            title: "MastraScorer",
            href: "/reference/scorers/mastra-scorer",
          },
          {
            title: "createScorer",
            href: "/reference/scorers/custom-code-scorer",
          },
          {
            title: "createLLMScorer",
            href: "/reference/scorers/llm-scorer",
          },
          {
            title: "Answer Relevancy",
            href: "/reference/scorers/answer-relevancy",
          },
          {
            title: "Bias",
            href: "/reference/scorers/bias",
          },
          {
            title: "Completeness",
            href: "/reference/scorers/completeness",
          },
          {
            title: "Content Similarity",
            href: "/reference/scorers/content-similarity",
          },
          {
            title: "Faithfulness",
            href: "/reference/scorers/faithfulness",
          },
          {
            title: "Hallucination",
            href: "/reference/scorers/hallucination",
          },
          {
            title: "Keyword Coverage",
            href: "/reference/scorers/keyword-coverage",
          },
          {
            title: "Textual Difference",
            href: "/reference/scorers/textual-difference",
          },
          {
            title: "Tone Consistency",
            href: "/reference/scorers/tone-consistency",
          },
          {
            title: "Toxicity",
            href: "/reference/scorers/toxicity",
          },
        ],
        Voice: [
          {
            title: "Mastra Voice",
            href: "/reference/voice/mastra-voice",
          },
          {
            title: "Composite Voice",
            href: "/reference/voice/composite-voice",
          },
          {
            title: ".speak()",
            href: "/reference/voice/voice.speak",
          },
          {
            title: ".listen()",
            href: "/reference/voice/voice.listen",
          },
          {
            title: ".getSpeakers()",
            href: "/reference/voice/voice.getSpeakers",
          },
          {
            title: ".connect()",
            href: "/reference/voice/voice.connect",
          },
          {
            title: ".send()",
            href: "/reference/voice/voice.send",
          },
          {
            title: ".answer()",
            href: "/reference/voice/voice.answer",
          },
          {
            title: ".on()",
            href: "/reference/voice/voice.on",
          },
          {
            title: "events",
            href: "/reference/voice/voice.events",
          },
          {
            title: ".off()",
            href: "/reference/voice/voice.off",
          },
          {
            title: ".close()",
            href: "/reference/voice/voice.close",
          },
          {
            title: ".addInstructions()",
            href: "/reference/voice/voice.addInstructions",
          },
          {
            title: ".addTools()",
            href: "/reference/voice/voice.addTools",
          },
          {
            title: ".updateConfig()",
            href: "/reference/voice/voice.updateConfig",
          },
          {
            title: "Deepgram",
            href: "/reference/voice/deepgram",
          },
          {
            title: "ElevenLabs",
            href: "/reference/voice/elevenlabs",
          },
          {
            title: "Google",
            href: "/reference/voice/google",
          },
          {
            title: "Murf",
            href: "/reference/voice/murf",
          },
          {
            title: "OpenAI",
            href: "/reference/voice/openai",
          },
          {
            title: "OpenAI Realtime",
            href: "/reference/voice/openai-realtime",
          },
          {
            title: "PlayAI",
            href: "/reference/voice/playai",
          },
          {
            title: "Sarvam",
            href: "/reference/voice/sarvam",
          },
          {
            title: "Speechify",
            href: "/reference/voice/speechify",
          },
          {
            title: "Azure",
            href: "/reference/voice/azure",
          },
          {
            title: "Cloudflare",
            href: "/reference/voice/cloudflare",
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
        ],
        "Client SDK": [
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
            title: "Workflows (Legacy) API",
            href: "/reference/client-js/workflows-legacy",
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
    />
  );
};
