import { CardItems } from "./cards/card-items";

export const ReferenceCards = () => {
  return (
    <CardItems
      titles={[
        "Core",
        "CLI",
        "Agents",
        "Streaming",
        "Workflows",
        "Legacy Workflows",
        "Tools & MCP",
        "Memory",
        "Networks",
        "RAG",
        "Storage",
        "Deployer",
        "Client SDK",
        "Observability",
        "Evals",
        "Scorers",
        "Auth",
        "Voice",
        "Templates",
      ]}
      items={{
        Core: [
          {
            title: "Mastra",
            href: "/reference/core/mastra-class",
          },
          {
            title: ".getAgent()",
            href: "/reference/core/getAgent",
          },
          {
            title: ".getAgents()",
            href: "/reference/core/getAgents",
          },
          {
            title: ".getAgentById()",
            href: "/reference/core/getAgentById",
          },
          {
            title: ".getWorkflow()",
            href: "/reference/core/getWorkflow",
          },
          {
            title: ".getWorkflows()",
            href: "/reference/core/getWorkflows",
          },
          {
            title: ".getMemory()",
            href: "/reference/core/getMemory",
          },
          {
            title: ".setStorage()",
            href: "/reference/core/setStorage",
          },
          {
            title: ".getServer()",
            href: "/reference/core/getServer",
          },
          {
            title: ".getMCPServer()",
            href: "/reference/core/getMCPServer",
          },
          {
            title: ".getVector()",
            href: "/reference/core/getVector",
          },
          {
            title: ".getVectors()",
            href: "/reference/core/getVectors",
          },
          {
            title: ".getDeployer()",
            href: "/reference/core/getDeployer",
          },
          {
            title: ".getStorage()",
            href: "/reference/core/getStorage",
          },
          {
            title: ".getMCPServers()",
            href: "/reference/core/getMCPServers",
          },
          {
            title: ".getTelemetry()",
            href: "/reference/core/getTelemetry",
          },
          {
            title: ".setTelemetry()",
            href: "/reference/core/setTelemetry",
          },
          {
            title: ".getLogs()",
            href: "/reference/core/getLogs",
          },
          {
            title: ".getLogsByRunId()",
            href: "/reference/core/getLogsByRunId",
          },
          {
            title: ".getLogger()",
            href: "/reference/core/getLogger",
          },
          {
            title: ".setLogger()",
            href: "/reference/core/setLogger",
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
            title: "mastra scorers",
            href: "/reference/cli/scorers",
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
            title: ".generate()",
            href: "/reference/agents/generate",
          },
          {
            title: ".generateVNext() (Experimental)",
            href: "/reference/agents/generateVNext",
          },
          {
            title: ".stream()",
            href: "/reference/agents/stream",
          },
          {
            title: ".streamVNext() (Experimental)",
            href: "/reference/agents/streamVNext",
          },
          {
            title: "MastraModelOutput",
            href: "/reference/agents/MastraModelOutput",
          },
          {
            title: "ChunkType",
            href: "/reference/agents/ChunkType",
          },
          {
            title: ".getWorkflows()",
            href: "/reference/agents/getWorkflows",
          },
          {
            title: ".getTools()",
            href: "/reference/agents/getTools",
          },
          {
            title: ".getScorers()",
            href: "/reference/agents/getScorers",
          },
          {
            title: ".getModel()",
            href: "/reference/agents/getModel",
          },
          {
            title: ".getMemory()",
            href: "/reference/agents/getMemory",
          },
          {
            title: ".getVoice()",
            href: "/reference/agents/getVoice",
          },
          {
            title: ".getDescription()",
            href: "/reference/agents/getDescription",
          },
          {
            title: ".getInstructions()",
            href: "/reference/agents/getInstructions",
          },
          {
            title: ".getLLM()",
            href: "/reference/agents/getLLM",
          },
          {
            title: ".getDefaultGenerateOptions()",
            href: "/reference/agents/getDefaultGenerateOptions",
          },
          {
            title: ".getDefaultStreamOptions()",
            href: "/reference/agents/getDefaultStreamOptions",
          },
          {
            title: ".getDefaultVNextStreamOptions()",
            href: "/reference/agents/getDefaultVNextStreamOptions",
          },
        ],
        Streaming: [
          {
            title: ".stream()",
            href: "/reference/streaming/stream",
          },
          {
            title: ".streamVNext() (Experimental)",
            href: "/reference/streaming/streamVNext",
          },
          {
            title: "MastraModelOutput",
            href: "/reference/streaming/MastraModelOutput",
          },
          {
            title: "ChunkType",
            href: "/reference/streaming/ChunkType",
          },
        ],
        "Tools & MCP": [
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
            title: "Workflow Class",
            href: "/reference/workflows/workflow",
          },
          {
            title: "Step Class",
            href: "/reference/workflows/step",
          },
          {
            title: "Run Class",
            href: "/reference/workflows/run",
          },
          {
            title: ".then()",
            href: "/reference/workflows/workflow-methods/then",
          },
          {
            title: ".branch()",
            href: "/reference/workflows/workflow-methods/branch",
          },
          {
            title: ".parallel()",
            href: "/reference/workflows/workflow-methods/parallel",
          },
          {
            title: ".commit()",
            href: "/reference/workflows/workflow-methods/commit",
          },
          {
            title: ".dowhile()",
            href: "/reference/workflows/workflow-methods/dowhile",
          },
          {
            title: ".dountil()",
            href: "/reference/workflows/workflow-methods/dountil",
          },
          {
            title: ".foreach()",
            href: "/reference/workflows/workflow-methods/foreach",
          },
          {
            title: ".map()",
            href: "/reference/workflows/workflow-methods/map",
          },
          {
            title: ".sleep()",
            href: "/reference/workflows/workflow-methods/sleep",
          },
          {
            title: ".sleepUntil()",
            href: "/reference/workflows/workflow-methods/sleepUntil",
          },
          {
            title: ".waitForEvent()",
            href: "/reference/workflows/workflow-methods/waitForEvent",
          },
          {
            title: ".sendEvent()",
            href: "/reference/workflows/workflow-methods/sendEvent",
          },
          {
            title: ".createRunAsync()",
            href: "/reference/workflows/workflow-methods/create-run",
          },
          {
            title: ".start()",
            href: "/reference/workflows/run-methods/start",
          },
          {
            title: ".resume()",
            href: "/reference/workflows/run-methods/resume",
          },
          {
            title: ".stream()",
            href: "/reference/workflows/run-methods/stream",
          },
          {
            title: ".streamVNext() (Experimental)",
            href: "/reference/workflows/run-methods/streamVNext",
          },
          {
            title: ".watch()",
            href: "/reference/workflows/run-methods/watch",
          },
          {
            title: ".cancel()",
            href: "/reference/workflows/run-methods/cancel",
          },
        ],
        "Legacy Workflows": [
          {
            title: "Workflow",
            href: "/reference/legacyWorkflows/workflow",
          },
          {
            title: "Step",
            href: "/reference/legacyWorkflows/step-class",
          },
          {
            title: "StepOptions",
            href: "/reference/legacyWorkflows/step-options",
          },
          {
            title: "StepCondition",
            href: "/reference/legacyWorkflows/step-condition",
          },
          {
            title: ".step()",
            href: "/reference/legacyWorkflows/step-function",
          },
          {
            title: ".after()",
            href: "/reference/legacyWorkflows/after",
          },
          {
            title: ".then()",
            href: "/reference/legacyWorkflows/then",
          },
          {
            title: ".until()",
            href: "/reference/legacyWorkflows/until",
          },
          {
            title: ".while()",
            href: "/reference/legacyWorkflows/while",
          },
          {
            title: ".if()",
            href: "/reference/legacyWorkflows/if",
          },
          {
            title: ".else()",
            href: "/reference/legacyWorkflows/else",
          },
          {
            title: ".createRun()",
            href: "/reference/legacyWorkflows/createRun",
          },
          {
            title: ".start()",
            href: "/reference/legacyWorkflows/start",
          },
          {
            title: ".execute()",
            href: "/reference/legacyWorkflows/execute",
          },
          {
            title: ".suspend()",
            href: "/reference/legacyWorkflows/suspend",
          },
          {
            title: "Snapshots",
            href: "/reference/legacyWorkflows/snapshots",
          },
          {
            title: ".resume()",
            href: "/reference/legacyWorkflows/resume",
          },
          {
            title: ".commit()",
            href: "/reference/legacyWorkflows/commit",
          },
          {
            title: ".watch()",
            href: "/reference/legacyWorkflows/watch",
          },
          {
            title: "Event-Driven Workflows",
            href: "/reference/legacyWorkflows/events",
          },
          {
            title: ".afterEvent()",
            href: "/reference/legacyWorkflows/afterEvent",
          },
          {
            title: ".resumeWithEvent()",
            href: "/reference/legacyWorkflows/resumeWithEvent",
          },
          {
            title: "Step Retries",
            href: "/reference/legacyWorkflows/step-retries",
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
          {
            title: ".getThreadsByResourceIdPaginated()",
            href: "/reference/memory/getThreadsByResourceIdPaginated",
          },
          {
            title: ".deleteMessages()",
            href: "/reference/memory/deleteMessages",
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
          {
            title: "MSSQL Storage",
            href: "/reference/storage/mssql",
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
          {
            title: "S3Vectors",
            href: "/reference/rag/s3vectors",
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
        Scorers: [
          {
            title: "MastraScorer Class",
            href: "/reference/scorers/mastra-scorer",
          },
          {
            title: "createScorer",
            href: "/reference/scorers/create-scorer",
          },
          {
            title: "AnswerRelevancy",
            href: "/reference/scorers/answer-relevancy",
          },
          {
            title: "AnswerSimilarity",
            href: "/reference/scorers/answer-similarity",
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
            title: "ContentSimilarity",
            href: "/reference/scorers/content-similarity",
          },
          {
            title: "ContextRelevance",
            href: "/reference/scorers/context-relevance",
          },
          {
            title: "ContextPrecision",
            href: "/reference/scorers/context-precision",
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
            title: "KeywordCoverage",
            href: "/reference/scorers/keyword-coverage",
          },
          {
            title: "TextualDifference",
            href: "/reference/scorers/textual-difference",
          },
          {
            title: "ToneConsistency",
            href: "/reference/scorers/tone-consistency",
          },
          {
            title: "ToolCallAccuracy",
            href: "/reference/scorers/tool-call-accuracy",
          },
          {
            title: "PromptAlignment",
            href: "/reference/scorers/prompt-alignment",
          },
          {
            title: "NoiseSensitivity",
            href: "/reference/scorers/noise-sensitivity",
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
            title: ".connect() (realtime)",
            href: "/reference/voice/voice.connect",
          },
          {
            title: ".send() (realtime)",
            href: "/reference/voice/voice.send",
          },
          {
            title: ".answer() (realtime)",
            href: "/reference/voice/voice.answer",
          },
          {
            title: ".on() (realtime)",
            href: "/reference/voice/voice.on",
          },
          {
            title: "events (realtime)",
            href: "/reference/voice/voice.events",
          },
          {
            title: ".off() (realtime)",
            href: "/reference/voice/voice.off",
          },
          {
            title: ".close() (realtime)",
            href: "/reference/voice/voice.close",
          },
          {
            title: ".addInstructions() (realtime)",
            href: "/reference/voice/voice.addInstructions",
          },
          {
            title: ".addTools() (realtime)",
            href: "/reference/voice/voice.addTools",
          },
          {
            title: ".updateConfig() (realtime)",
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
            title: "Google Gemini Live",
            href: "/reference/voice/google-gemini-live",
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
            title: "PinoLogger",
            href: "/reference/observability/logger",
          },
          {
            title: "OTelConfig",
            href: "/reference/observability/otel-config",
          },
          {
            title: "Arize AX",
            href: "/reference/observability/providers/arize-ax",
          },
          {
            title: "Arize Phoenix",
            href: "/reference/observability/providers/arize-phoenix",
          },
          {
            title: "Dash0",
            href: "/reference/observability/providers/dash0",
          },
          {
            title: "SigNoz",
            href: "/reference/observability/providers/signoz",
          },
          {
            title: "Braintrust",
            href: "/reference/observability/providers/braintrust",
          },
          {
            title: "LangSmith",
            href: "/reference/observability/providers/langsmith",
          },
          {
            title: "Langfuse",
            href: "/reference/observability/providers/langfuse",
          },
          {
            title: "LangWatch",
            href: "/reference/observability/providers/langwatch",
          },
          {
            title: "New Relic",
            href: "/reference/observability/providers/new-relic",
          },
          {
            title: "Traceloop",
            href: "/reference/observability/providers/traceloop",
          },
          {
            title: "Laminar",
            href: "/reference/observability/providers/laminar",
          },
          {
            title: "Keywords AI",
            href: "/reference/observability/providers/keywordsai",
          },
        ],
        "Client SDK": [
          {
            title: "MastraClient",
            href: "/reference/client-js/mastra-client",
          },
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
          {
            title: "Workflows (Legacy) API",
            href: "/reference/client-js/workflows-legacy",
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
        Auth: [
          {
            title: "JSON Web Token",
            href: "/reference/auth/jwt",
          },
          {
            title: "Clerk",
            href: "/reference/auth/clerk",
          },
          {
            title: "Firebase",
            href: "/reference/auth/firebase",
          },
          {
            title: "Supabase",
            href: "/reference/auth/supabase",
          },
        ],
        Templates: [
          {
            title: "Templates",
            href: "/reference/templates/overview",
          },
        ],
      }}
    />
  );
};
