/**
 * Sidebar for Reference
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  referenceSidebar: [
    {
      type: "doc",
      id: "index",
      label: "Overview",
    },
    {
      type: "category",
      label: "Core",
      collapsed: true,
      items: [
        { type: "doc", id: "core/getAgent", label: ".getAgent()" },
        { type: "doc", id: "core/listAgents", label: ".listAgents()" },
        { type: "doc", id: "core/getAgentById", label: ".getAgentById()" },
        { type: "doc", id: "core/getWorkflow", label: ".getWorkflow()" },
        { type: "doc", id: "core/listWorkflows", label: ".listWorkflows()" },
        { type: "doc", id: "core/setStorage", label: ".setStorage()" },
        { type: "doc", id: "core/getServer", label: ".getServer()" },
        { type: "doc", id: "core/getMCPServer", label: ".getMCPServer()" },
        {
          type: "doc",
          id: "core/getMCPServerById",
          label: ".getMCPServerById()",
        },
        { type: "doc", id: "core/getVector", label: ".getVector()" },
        { type: "doc", id: "core/listVectors", label: ".listVectors()" },
        { type: "doc", id: "core/getDeployer", label: ".getDeployer()" },
        { type: "doc", id: "core/getStorage", label: ".getStorage()" },
        { type: "doc", id: "core/listMCPServers", label: ".listMCPServers()" },
        { type: "doc", id: "core/getTelemetry", label: ".getTelemetry()" },
        { type: "doc", id: "core/setTelemetry", label: ".setTelemetry()" },
        { type: "doc", id: "core/listLogs", label: ".listLogs()" },
        {
          type: "doc",
          id: "core/listLogsByRunId",
          label: ".listLogsByRunId()",
        },
        { type: "doc", id: "core/getLogger", label: ".getLogger()" },
        { type: "doc", id: "core/setLogger", label: ".setLogger()" },
        { type: "doc", id: "core/listScorers", label: ".listScorers()" },
        { type: "doc", id: "core/getScorer", label: ".getScorer()" },
        {
          type: "doc",
          id: "core/getScorerById",
          label: ".getScorerById()",
        },
        { type: "doc", id: "core/getGateway", label: ".getGateway()" },
        {
          type: "doc",
          id: "core/getGatewayById",
          label: ".getGatewayById()",
        },
        { type: "doc", id: "core/listGateways", label: ".listGateways()" },
        { type: "doc", id: "core/addGateway", label: ".addGateway()" },
        { type: "doc", id: "core/mastra-class", label: "Mastra Class" },
        {
          type: "doc",
          id: "core/mastra-model-gateway",
          label: "MastraModelGateway",
        },
      ],
    },
    {
      type: "category",
      label: "CLI",
      collapsed: true,
      items: [
        { type: "doc", id: "cli/mastra", label: "mastra" },
        { type: "doc", id: "cli/create-mastra", label: "create-mastra" },
      ],
    },
    {
      type: "category",
      label: "Agents",
      collapsed: true,
      items: [
        { type: "doc", id: "agents/agent", label: "Agent" },
        { type: "doc", id: "agents/generate", label: ".generate()" },
        {
          type: "doc",
          id: "agents/generateLegacy",
          label: ".generateLegacy() (Legacy)",
        },
        { type: "doc", id: "agents/network", label: ".network()" },
        { type: "doc", id: "agents/listAgents", label: ".listAgents()" },
        { type: "doc", id: "agents/listWorkflows", label: ".listWorkflows()" },
        { type: "doc", id: "agents/listTools", label: ".listTools()" },
        { type: "doc", id: "agents/listScorers", label: ".listScorers()" },
        { type: "doc", id: "agents/getModel", label: ".getModel()" },
        { type: "doc", id: "agents/getMemory", label: ".getMemory()" },
        { type: "doc", id: "agents/getVoice", label: ".getVoice()" },
        {
          type: "doc",
          id: "agents/getDescription",
          label: ".getDescription()",
        },
        {
          type: "doc",
          id: "agents/getInstructions",
          label: ".getInstructions()",
        },
        { type: "doc", id: "agents/getLLM", label: ".getLLM()" },
        {
          type: "doc",
          id: "agents/getDefaultOptions",
          label: ".getDefaultOptions()",
        },
        {
          type: "doc",
          id: "agents/getDefaultGenerateOptions",
          label: ".getDefaultGenerateOptionsLegacy()",
        },
        {
          type: "doc",
          id: "agents/getDefaultStreamOptions",
          label: ".getDefaultStreamOptionsLegacy()",
        },
      ],
    },
    {
      type: "category",
      label: "Workflows",
      collapsed: true,
      items: [
        { type: "doc", id: "workflows/workflow", label: "Workflow Class" },
        {
          type: "category",
          label: "Methods",
          items: [
            {
              type: "doc",
              id: "workflows/workflow-methods/then",
              label: ".then()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/branch",
              label: ".branch()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/parallel",
              label: ".parallel()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/commit",
              label: ".commit()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/dowhile",
              label: ".dowhile()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/dountil",
              label: ".dountil()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/foreach",
              label: ".foreach()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/map",
              label: ".map()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/sleep",
              label: ".sleep()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/sleepUntil",
              label: ".sleepUntil()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/waitForEvent",
              label: ".waitForEvent()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/sendEvent",
              label: ".sendEvent()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/create-run",
              label: ".createRun()",
            },
          ],
        },
        { type: "doc", id: "workflows/step", label: "Step Class" },
        { type: "doc", id: "workflows/run", label: "Run Class" },
        {
          type: "category",
          label: "Run Methods",
          items: [
            {
              type: "doc",
              id: "workflows/run-methods/start",
              label: ".start()",
            },
            {
              type: "doc",
              id: "workflows/run-methods/resume",
              label: ".resume()",
            },
            {
              type: "doc",
              id: "workflows/run-methods/cancel",
              label: ".cancel()",
            },
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Streaming",
      collapsed: true,
      items: [
        { type: "doc", id: "streaming/ChunkType", label: "ChunkType" },
        {
          type: "category",
          label: "Agents",
          items: [
            {
              type: "doc",
              id: "streaming/agents/stream",
              label: ".stream()",
            },
            {
              type: "doc",
              id: "streaming/agents/streamLegacy",
              label: ".streamLegacy() (Legacy)",
            },
            {
              type: "doc",
              id: "streaming/agents/MastraModelOutput",
              label: "MastraModelOutput",
            },
          ],
        },
        {
          type: "category",
          label: "Workflows",
          items: [
            {
              type: "doc",
              id: "streaming/workflows/stream",
              label: ".stream()",
            },
            {
              type: "doc",
              id: "streaming/workflows/streamVNext",
              label: ".streamVNext()",
            },
            {
              type: "doc",
              id: "streaming/workflows/resumeStreamVNext",
              label: ".resumeStreamVNext()",
            },
            {
              type: "doc",
              id: "streaming/workflows/observeStream",
              label: ".observeStream()",
            },
            {
              type: "doc",
              id: "streaming/workflows/observeStreamVNext",
              label: ".observeStreamVNext()",
            },
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Tools & MCP",
      collapsed: true,
      items: [
        { type: "doc", id: "tools/create-tool", label: "createTool()" },
        { type: "doc", id: "tools/mcp-client", label: "MCPClient" },
        { type: "doc", id: "tools/mcp-server", label: "MCPServer" },
        {
          type: "doc",
          id: "tools/document-chunker-tool",
          label: "createDocumentChunkerTool()",
        },
        {
          type: "doc",
          id: "tools/graph-rag-tool",
          label: "createGraphRAGTool()",
        },
        {
          type: "doc",
          id: "tools/vector-query-tool",
          label: "createVectorQueryTool()",
        },
      ],
    },
    {
      type: "category",
      label: "Memory",
      collapsed: true,
      items: [
        { type: "doc", id: "memory/memory-class", label: "Memory Class" },
        { type: "doc", id: "memory/createThread", label: ".createThread()" },
        { type: "doc", id: "memory/recall", label: ".recall()" },
        { type: "doc", id: "memory/query", label: ".query() (Deprecated)" },
        { type: "doc", id: "memory/getThreadById", label: ".getThreadById()" },
        {
          type: "doc",
          id: "memory/listThreadsByResourceId",
          label: ".listThreadsByResourceId()",
        },
        {
          type: "doc",
          id: "memory/deleteMessages",
          label: ".deleteMessages()",
        },
      ],
    },
    {
      type: "category",
      label: "RAG",
      collapsed: true,
      items: [
        { type: "doc", id: "rag/rerank", label: "rerank()" },
        { type: "doc", id: "rag/embeddings", label: "Embed" },
        {
          type: "doc",
          id: "rag/rerankWithScorer",
          label: "rerankWithScorer()",
        },
        { type: "doc", id: "rag/document", label: "MDocument" },
        { type: "doc", id: "rag/graph-rag", label: "GraphRAG" },
        { type: "doc", id: "rag/database-config", label: "DatabaseConfig" },
        { type: "doc", id: "rag/extract-params", label: "ExtractParams" },
        { type: "doc", id: "rag/metadata-filters", label: "Metadata Filters" },
        { type: "doc", id: "rag/chunk", label: "Reference: .chunk()" },
      ],
    },
    {
      type: "category",
      label: "Storage",
      collapsed: true,
      items: [
        { type: "doc", id: "storage/libsql", label: "LibSQL Storage" },
        { type: "doc", id: "storage/postgresql", label: "PostgreSQL Storage" },
        { type: "doc", id: "storage/upstash", label: "Upstash Storage" },
        {
          type: "doc",
          id: "storage/cloudflare",
          label: "Cloudflare KV Storage",
        },
        { type: "doc", id: "storage/dynamodb", label: "DynamoDB Storage" },
        { type: "doc", id: "storage/mssql", label: "MSSQL Storage" },
        {
          type: "doc",
          id: "storage/cloudflare-d1",
          label: "Cloudflare D1 Storage",
        },
        { type: "doc", id: "storage/lance", label: "LanceDB Storage" },
        { type: "doc", id: "storage/mongodb", label: "MongoDB Storage" },
      ],
    },
    {
      type: "category",
      label: "Vectors",
      collapsed: true,
      items: [
        { type: "doc", id: "vectors/astra", label: "Astra Vector Store" },
        { type: "doc", id: "vectors/lance", label: "Lance Vector Store" },
        {
          type: "doc",
          id: "vectors/vectorize",
          label: "Cloudflare Vector Store",
        },
        { type: "doc", id: "vectors/libsql", label: "LibSQLVector Store" },
        { type: "doc", id: "vectors/qdrant", label: "Qdrant Vector Store" },
        {
          type: "doc",
          id: "vectors/opensearch",
          label: "OpenSearch Vector Store",
        },
        { type: "doc", id: "vectors/pinecone", label: "Pinecone Vector Store" },
        { type: "doc", id: "vectors/mongodb", label: "MongoDB Vector Store" },
        {
          type: "doc",
          id: "vectors/s3vectors",
          label: "Amazon S3 Vectors Store",
        },
        {
          type: "doc",
          id: "vectors/turbopuffer",
          label: "Turbopuffer Vector Store",
        },
        { type: "doc", id: "vectors/upstash", label: "Upstash Vector Store" },
        {
          type: "doc",
          id: "vectors/couchbase",
          label: "Couchbase Vector Store",
        },
        { type: "doc", id: "vectors/chroma", label: "Chroma Vector Store" },
        { type: "doc", id: "vectors/pg", label: "PG Vector Store" },
      ],
    },
    {
      type: "category",
      label: "Deployer",
      collapsed: true,
      items: [
        { type: "doc", id: "deployer/deployer", label: "Deployer" },
        { type: "doc", id: "deployer/cloudflare", label: "Cloudflare" },
        { type: "doc", id: "deployer/netlify", label: "Netlify" },
        { type: "doc", id: "deployer/vercel", label: "Vercel" },
      ],
    },
    {
      type: "category",
      label: "Client SDK",
      collapsed: true,
      items: [
        { type: "doc", id: "client-js/agents", label: "Agents API" },
        { type: "doc", id: "client-js/memory", label: "Memory API" },
        { type: "doc", id: "client-js/tools", label: "Tools API" },
        { type: "doc", id: "client-js/workflows", label: "Workflows API" },
        { type: "doc", id: "client-js/vectors", label: "Vectors API" },
        { type: "doc", id: "client-js/logs", label: "Logs API" },
        { type: "doc", id: "client-js/telemetry", label: "Telemetry API" },
        {
          type: "doc",
          id: "client-js/observability",
          label: "Observability API",
        },
        {
          type: "doc",
          id: "client-js/error-handling",
          label: "Error Handling",
        },
        {
          type: "doc",
          id: "client-js/mastra-client",
          label: "Mastra Client SDK",
        },
      ],
    },
    {
      type: "category",
      label: "Observability",
      collapsed: true,
      items: [
        {
          type: "category",
          label: "Tracing",
          items: [
            {
              type: "doc",
              id: "observability/tracing/instances",
              label: "Instances",
            },
            {
              type: "doc",
              id: "observability/tracing/configuration",
              label: "Configuration",
            },
            {
              type: "doc",
              id: "observability/tracing/spans",
              label: "Spans",
            },
            {
              type: "doc",
              id: "observability/tracing/interfaces",
              label: "Interfaces",
            },
            {
              type: "category",
              label: "Exporters",
              items: [
                {
                  type: "doc",
                  id: "observability/tracing/exporters/arize",
                  label: "ArizeExporter",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/braintrust",
                  label: "BraintrustExporter",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/cloud-exporter",
                  label: "CloudExporter",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/console-exporter",
                  label: "ConsoleExporter",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/default-exporter",
                  label: "DefaultExporter",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/langfuse",
                  label: "LangfuseExporter",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/langsmith",
                  label: "LangSmithExporter",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/otel",
                  label: "OtelExporter",
                },
              ],
            },
            {
              type: "category",
              label: "Processors",
              items: [
                {
                  type: "doc",
                  id: "observability/tracing/processors/sensitive-data-filter",
                  label: "SensitiveDataFilter",
                },
              ],
            },
          ],
        },
        {
          type: "category",
          label: "Logging",
          items: [
            {
              type: "doc",
              id: "logging/pino-logger",
              label: "PinoLogger",
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
        { type: "doc", id: "evals/mastra-scorer", label: "MastraScorer" },
        { type: "doc", id: "evals/create-scorer", label: "createScorer" },
        { type: "doc", id: "evals/run-evals", label: "runEvals" },
        { type: "doc", id: "evals/bias", label: "Bias" },
        { type: "doc", id: "evals/completeness", label: "Completeness" },
        { type: "doc", id: "evals/faithfulness", label: "Faithfulness" },
        { type: "doc", id: "evals/hallucination", label: "Hallucination" },
        { type: "doc", id: "evals/toxicity", label: "Toxicity" },
        {
          type: "doc",
          id: "evals/keyword-coverage",
          label: "Keyword Coverage Scorer",
        },
        {
          type: "doc",
          id: "evals/tone-consistency",
          label: "Tone Consistency Scorer",
        },
        {
          type: "doc",
          id: "evals/noise-sensitivity",
          label: "Noise Sensitivity Scorer",
        },
        {
          type: "doc",
          id: "evals/content-similarity",
          label: "Content Similarity Scorer",
        },
        {
          type: "doc",
          id: "evals/answer-relevancy",
          label: "Answer Relevancy Scorer",
        },
        {
          type: "doc",
          id: "evals/context-precision",
          label: "Context Precision Scorer",
        },
        {
          type: "doc",
          id: "evals/answer-similarity",
          label: "Answer Similarity Scorer",
        },
        {
          type: "doc",
          id: "evals/context-relevance",
          label: "Context Relevance Scorer",
        },
        {
          type: "doc",
          id: "evals/tool-call-accuracy",
          label: "Tool Call Accuracy Scorers",
        },
        {
          type: "doc",
          id: "evals/textual-difference",
          label: "Textual Difference Scorer",
        },
        {
          type: "doc",
          id: "evals/prompt-alignment",
          label: "Prompt Alignment Scorer",
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
          id: "processors/language-detector",
          label: "LanguageDetector",
        },
        {
          type: "doc",
          id: "processors/batch-parts-processor",
          label: "BatchPartsProcessor",
        },
        {
          type: "doc",
          id: "processors/moderation-processor",
          label: "ModerationProcessor",
        },
        {
          type: "doc",
          id: "processors/prompt-injection-detector",
          label: "PromptInjectionDetector",
        },
        {
          type: "doc",
          id: "processors/pii-detector",
          label: "PIIDetector",
        },
        {
          type: "doc",
          id: "processors/unicode-normalizer",
          label: "UnicodeNormalizer",
        },
        {
          type: "doc",
          id: "processors/token-limiter-processor",
          label: "TokenLimiterProcessor",
        },
        {
          type: "doc",
          id: "processors/system-prompt-scrubber",
          label: "SystemPromptScrubber",
        },
      ],
    },
    {
      type: "category",
      label: "Auth",
      collapsed: true,
      items: [
        { type: "doc", id: "auth/jwt", label: "JSON Web Token" },
        { type: "doc", id: "auth/clerk", label: "Clerk" },
        { type: "doc", id: "auth/supabase", label: "Supabase" },
        { type: "doc", id: "auth/firebase", label: "Firebase" },
        { type: "doc", id: "auth/workos", label: "WorkOS" },
        { type: "doc", id: "auth/auth0", label: "Auth0" },
      ],
    },
    {
      type: "category",
      label: "Voice",
      collapsed: true,
      items: [
        { type: "doc", id: "voice/mastra-voice", label: "Mastra Voice" },
        { type: "doc", id: "voice/composite-voice", label: "Composite Voice" },
        { type: "doc", id: "voice/voice.speak", label: ".speak()" },
        { type: "doc", id: "voice/voice.listen", label: ".listen()" },
        {
          type: "doc",
          id: "voice/voice.getSpeakers",
          label: ".getSpeakers()",
        },
        { type: "doc", id: "voice/voice.connect", label: ".connect() (rt.)" },
        { type: "doc", id: "voice/voice.send", label: ".send() (rt.)" },
        { type: "doc", id: "voice/voice.answer", label: ".answer() (rt.)" },
        { type: "doc", id: "voice/voice.on", label: ".on() (rt.)" },
        { type: "doc", id: "voice/voice.events", label: "Events (rt.)" },
        { type: "doc", id: "voice/voice.off", label: ".off() (rt.)" },
        { type: "doc", id: "voice/voice.close", label: ".close() (rt.)" },
        {
          type: "doc",
          id: "voice/voice.addInstructions",
          label: ".addInstructions() (rt.)",
        },
        { type: "doc", id: "voice/voice.addTools", label: ".addTools() (rt.)" },
        {
          type: "doc",
          id: "voice/voice.updateConfig",
          label: ".updateConfig() (rt.)",
        },
        { type: "doc", id: "voice/deepgram", label: "Deepgram" },
        { type: "doc", id: "voice/elevenlabs", label: "ElevenLabs" },
        { type: "doc", id: "voice/google", label: "Google" },
        {
          type: "doc",
          id: "voice/google-gemini-live",
          label: "Google Gemini Live",
        },
        { type: "doc", id: "voice/murf", label: "Murf" },
        { type: "doc", id: "voice/openai", label: "OpenAI" },
        {
          type: "doc",
          id: "voice/openai-realtime",
          label: "OpenAI Realtime",
        },
        { type: "doc", id: "voice/playai", label: "PlayAI" },
        { type: "doc", id: "voice/sarvam", label: "Sarvam" },
        { type: "doc", id: "voice/speechify", label: "Speechify" },
        { type: "doc", id: "voice/azure", label: "Azure" },
        { type: "doc", id: "voice/cloudflare", label: "Cloudflare" },
      ],
    },
    {
      type: "category",
      label: "Templates",
      collapsed: true,
      items: [{ type: "doc", id: "templates/overview", label: "Overview" }],
    },
  ],
};

export default sidebars;
