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
      key: "reference.index",
    },
    {
      type: "category",
      label: "Core",
      key: "reference.core.index",
      collapsed: true,
      items: [
        { type: "doc", id: "core/mastra-class", label: "Mastra Class" },
        { type: "doc", id: "core/getAgent", label: ".getAgent()" },
        { type: "doc", id: "core/getAgents", label: ".getAgents()" },
        { type: "doc", id: "core/getAgentById", label: ".getAgentById()" },
        {
          type: "doc",
          id: "core/getWorkflow",
          key: "reference.core.getWorkflow",
          label: ".getWorkflow()",
        },
        {
          type: "doc",
          id: "core/getWorkflows",
          key: "reference.core.getWorkflows",
          label: ".getWorkflows()",
        },
        {
          type: "doc",
          id: "core/getMemory",
          key: "reference.core.getMemory",
          label: ".getMemory()",
        },
        {
          type: "doc",
          id: "core/setStorage",
          key: "reference.core.setStorage",
          label: ".setStorage()",
        },
        { type: "doc", id: "core/getServer", label: ".getServer()" },
        { type: "doc", id: "core/getMCPServer", label: ".getMCPServer()" },
        { type: "doc", id: "core/getVector", label: ".getVector()" },
        { type: "doc", id: "core/getVectors", label: ".getVectors()" },
        { type: "doc", id: "core/getDeployer", label: ".getDeployer()" },
        { type: "doc", id: "core/getStorage", label: ".getStorage()" },
        { type: "doc", id: "core/getMCPServers", label: ".getMCPServers()" },
        { type: "doc", id: "core/getTelemetry", label: ".getTelemetry()" },
        { type: "doc", id: "core/setTelemetry", label: ".setTelemetry()" },
        { type: "doc", id: "core/getLogs", label: ".getLogs()" },
        { type: "doc", id: "core/getLogsByRunId", label: ".getLogsByRunId()" },
        { type: "doc", id: "core/getLogger", label: ".getLogger()" },
        { type: "doc", id: "core/setLogger", label: ".setLogger()" },
        {
          type: "doc",
          id: "core/getScorers",
          key: "reference.core.getScorers",
          label: ".getScorers()",
        },
        {
          type: "doc",
          id: "core/getScorer",
          key: "reference.core.getScorer",
          label: ".getScorer()",
        },
        {
          type: "doc",
          id: "core/getScorerByName",
          label: ".getScorerByName()",
        },
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
      key: "reference.agents",
      collapsed: true,
      items: [
        {
          type: "doc",
          id: "agents/agent",
          key: "references.agents.agent",
          label: "Agent",
        },
        {
          type: "doc",
          id: "agents/generate",
          key: "references.agents.generate",
          label: ".generate()",
        },
        {
          type: "doc",
          id: "agents/generateLegacy",
          label: ".generateLegacy() (Legacy)",
        },
        { type: "doc", id: "agents/network", label: ".network()" },
        { type: "doc", id: "agents/listAgents", label: ".listAgents()" },
        { type: "doc", id: "agents/getWorkflows", label: ".getWorkflows()" },
        { type: "doc", id: "agents/getTools", label: ".getTools()" },
        { type: "doc", id: "agents/getScorers", label: ".getScorers()" },
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
          id: "agents/getDefaultGenerateOptions",
          label: ".getDefaultGenerateOptions()",
        },
        {
          type: "doc",
          id: "agents/getDefaultStreamOptions",
          label: ".getDefaultStreamOptions()",
        },
      ],
    },
    {
      type: "category",
      label: "Workflows",
      key: "reference.workflows",
      collapsed: true,
      items: [
        {
          type: "doc",
          id: "workflows/workflow",
          key: "reference.workflows.workflow",
          label: "Workflow Class",
        },
        {
          type: "category",
          key: "reference.workflows.methods",
          label: "Methods",
          items: [
            {
              type: "doc",
              id: "workflows/workflow-methods/then",
              label: ".then()",
              key: "reference.workflows.methods.then",
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
              key: "reference.workflows.methods.commit",
              label: ".commit()",
            },
            {
              type: "doc",
              id: "workflows/workflow-methods/dowhile",
              key: "reference.workflows.methods.dowhile",
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
              label: ".createRunAsync()",
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
              key: "reference.workflows.run-methods.start",
              label: ".start()",
            },
            {
              type: "doc",
              id: "workflows/run-methods/resume",
              key: "reference.workflows.run-methods.resume",
              label: ".resume()",
            },
            {
              type: "doc",
              id: "workflows/run-methods/watch",
              key: "reference.workflows.run-methods.watch",
              label: ".watch()",
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
    // Legacy Workflows - Hidden from sidebar using CSS class "sidebar-hidden" (see custom.css)
    // Pages remain accessible via direct URLs and sidebar still shows when visiting legacy pages
    {
      type: "category",
      label: "Legacy Workflows",
      className: "sidebar-hidden",
      collapsed: true,
      items: [
        { type: "doc", id: "legacyWorkflows/workflow", label: "Workflow" },
        { type: "doc", id: "legacyWorkflows/after", label: ".after()" },
        { type: "doc", id: "legacyWorkflows/then", label: ".then()" },
        { type: "doc", id: "legacyWorkflows/until", label: ".until()" },
        { type: "doc", id: "legacyWorkflows/while", label: ".while()" },
        { type: "doc", id: "legacyWorkflows/if", label: ".if()" },
        { type: "doc", id: "legacyWorkflows/else", label: ".else()" },
        { type: "doc", id: "legacyWorkflows/createRun", label: ".createRun()" },
        { type: "doc", id: "legacyWorkflows/start", label: ".start()" },
        { type: "doc", id: "legacyWorkflows/execute", label: ".execute()" },
        { type: "doc", id: "legacyWorkflows/suspend", label: ".suspend()" },
        { type: "doc", id: "legacyWorkflows/snapshots", label: "Snapshots" },
        { type: "doc", id: "legacyWorkflows/resume", label: ".resume()" },
        { type: "doc", id: "legacyWorkflows/commit", label: ".commit()" },
        { type: "doc", id: "legacyWorkflows/watch", label: ".watch()" },
        {
          type: "doc",
          id: "legacyWorkflows/events",
          label: "Event-Driven Workflows",
        },
        {
          type: "doc",
          id: "legacyWorkflows/afterEvent",
          label: ".afterEvent()",
        },
        {
          type: "doc",
          id: "legacyWorkflows/resumeWithEvent",
          label: ".resumeWithEvent()",
        },
        {
          type: "doc",
          id: "legacyWorkflows/step-function",
          label: "Workflow.step()",
        },
        {
          type: "doc",
          id: "legacyWorkflows/step-options",
          label: "StepOptions",
        },
        {
          type: "doc",
          id: "legacyWorkflows/step-retries",
          label: "Step Retries",
        },
        { type: "doc", id: "legacyWorkflows/step-class", label: "Step" },
        {
          type: "doc",
          id: "legacyWorkflows/step-condition",
          label: "StepCondition",
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
              key: "reference.streaming.agents.stream",
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
        { type: "doc", id: "memory/query", label: ".query()" },
        { type: "doc", id: "memory/getThreadById", label: ".getThreadById()" },
        {
          type: "doc",
          id: "memory/getThreadsByResourceId",
          label: ".getThreadsByResourceId()",
        },
        {
          type: "doc",
          id: "memory/getThreadsByResourceIdPaginated",
          label: ".getThreadsByResourceIdPaginated()",
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
        {
          type: "doc",
          id: "deployer/deployer",
          key: "reference.deployer.deployer",
          label: "Deployer",
        },
        {
          type: "doc",
          id: "deployer/cloudflare",
          key: "reference.deployer.cloudflare",
          label: "Cloudflare",
        },
        {
          type: "doc",
          id: "deployer/netlify",
          key: "reference.deployer.netlify",
          label: "Netlify",
        },
        {
          type: "doc",
          id: "deployer/vercel",
          key: "reference.deployer.vercel",
          label: "Vercel",
        },
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
          id: "client-js/workflows-legacy",
          label: "Workflows (Legacy) API",
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
          label: "AI Tracing",
          items: [
            {
              type: "doc",
              id: "observability/ai-tracing/ai-tracing",
              label: "AITracing",
            },
            {
              type: "doc",
              id: "observability/ai-tracing/configuration",
              label: "Configuration",
            },
            {
              type: "doc",
              id: "observability/ai-tracing/span",
              label: "Span",
            },
            {
              type: "doc",
              id: "observability/ai-tracing/interfaces",
              label: "Interfaces",
            },
            {
              type: "category",
              label: "Exporters",
              items: [
                {
                  type: "doc",
                  id: "observability/ai-tracing/exporters/arize",
                  label: "ArizeExporter",
                },
                {
                  type: "doc",
                  id: "observability/ai-tracing/exporters/cloud-exporter",
                  label: "CloudExporter",
                },
                {
                  type: "doc",
                  id: "observability/ai-tracing/exporters/console-exporter",
                  label: "ConsoleExporter",
                },
                {
                  type: "doc",
                  id: "observability/ai-tracing/exporters/langsmith",
                  label: "LangSmithExporter",
                },
                {
                  type: "doc",
                  id: "observability/ai-tracing/exporters/langfuse",
                  label: "LangfuseExporter",
                },
                {
                  type: "doc",
                  id: "observability/ai-tracing/exporters/otel",
                  label: "OtelExporter",
                },
                {
                  type: "doc",
                  id: "observability/ai-tracing/exporters/braintrust",
                  label: "BraintrustExporter",
                },
                {
                  type: "doc",
                  id: "observability/ai-tracing/exporters/default-exporter",
                  label: "DefaultExporter",
                },
              ],
            },
            {
              type: "category",
              label: "Processors",
              items: [
                {
                  type: "doc",
                  id: "observability/ai-tracing/processors/sensitive-data-filter",
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
              id: "observability/logging/pino-logger",
              label: "PinoLogger",
            },
          ],
        },
        {
          type: "category",
          label: "OTEL Tracing",
          items: [
            {
              type: "doc",
              id: "observability/otel-tracing/otel-config",
              label: "OtelConfig",
            },
            {
              type: "category",
              label: "Providers",
              items: [
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/traceloop",
                  label: "Traceloop",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/dash0",
                  label: "Dash0",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/new-relic",
                  label: "New Relic",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/langwatch",
                  label: "LangWatch",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/index",
                  label: "OTLP Providers",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/langsmith",
                  label: "LangSmith",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/langfuse",
                  label: "Langfuse",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/arize-ax",
                  label: "Arize AX",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/laminar",
                  label: "Laminar",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/braintrust",
                  label: "Braintrust",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/signoz",
                  label: "SigNoz",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/arize-phoenix",
                  label: "Arize Phoenix",
                },
                {
                  type: "doc",
                  id: "observability/otel-tracing/providers/keywordsai",
                  label: "Keywords AI",
                },
              ],
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
        {
          type: "doc",
          id: "evals/bias",
          key: "reference.evals.bias",
          label: "Bias",
        },
        {
          type: "doc",
          id: "evals/completeness",
          key: "reference.evals.completeness",
          label: "Completeness",
        },
        {
          type: "doc",
          id: "evals/faithfulness",
          key: "reference.evals.faithfulness",
          label: "Faithfulness",
        },
        {
          type: "doc",
          id: "evals/hallucination",
          key: "reference.evals.hallucination",
          label: "Hallucination",
        },
        {
          type: "doc",
          id: "evals/summarization",
          key: "reference.evals.summarization",
          label: "Summarization",
        },
        {
          type: "doc",
          id: "evals/toxicity",
          key: "reference.evals.toxicity",
          label: "Toxicity",
        },
        {
          type: "doc",
          id: "evals/keyword-coverage",
          label: "KeywordCoverageMetric",
        },
        {
          type: "doc",
          id: "evals/tone-consistency",
          label: "ToneConsistencyMetric",
        },
        {
          type: "doc",
          id: "evals/content-similarity",
          label: "ContentSimilarityMetric",
        },
        {
          type: "doc",
          id: "evals/context-relevancy",
          label: "ContextRelevancyMetric",
        },
        {
          type: "doc",
          id: "evals/answer-relevancy",
          label: "AnswerRelevancyMetric",
        },
        {
          type: "doc",
          id: "evals/context-precision",
          label: "ContextPrecisionMetric",
        },
        {
          type: "doc",
          id: "evals/contextual-recall",
          label: "ContextualRecallMetric",
        },
        {
          type: "doc",
          id: "evals/context-position",
          label: "ContextPositionMetric",
        },
        {
          type: "doc",
          id: "evals/textual-difference",
          label: "TextualDifferenceMetric",
        },
        {
          type: "doc",
          id: "evals/prompt-alignment",
          label: "PromptAlignmentMetric",
        },
      ],
    },
    {
      type: "category",
      label: "Scorers",
      collapsed: true,
      items: [
        { type: "doc", id: "scorers/bias", label: "Bias" },
        { type: "doc", id: "scorers/completeness", label: "Completeness" },
        { type: "doc", id: "scorers/faithfulness", label: "Faithfulness" },
        { type: "doc", id: "scorers/hallucination", label: "Hallucination" },
        { type: "doc", id: "scorers/toxicity", label: "Toxicity" },
        {
          type: "doc",
          id: "scorers/keyword-coverage",
          label: "Keyword Coverage Scorer",
        },
        {
          type: "doc",
          id: "scorers/tone-consistency",
          label: "Tone Consistency Scorer",
        },
        {
          type: "doc",
          id: "scorers/noise-sensitivity",
          label: "Noise Sensitivity Scorer (CI/Testing Only)",
        },
        { type: "doc", id: "scorers/mastra-scorer", label: "MastraScorer" },
        { type: "doc", id: "scorers/create-scorer", label: "createScorer" },
        {
          type: "doc",
          id: "scorers/content-similarity",
          label: "Content Similarity Scorer",
        },
        { type: "doc", id: "scorers/run-experiment", label: "runExperiment" },
        {
          type: "doc",
          id: "scorers/answer-relevancy",
          label: "Answer Relevancy Scorer",
        },
        {
          type: "doc",
          id: "scorers/context-precision",
          label: "Context Precision Scorer",
        },
        {
          type: "doc",
          id: "scorers/answer-similarity",
          label: "Answer Similarity Scorer",
        },
        {
          type: "doc",
          id: "scorers/context-relevance",
          label: "Context Relevance Scorer",
        },
        {
          type: "doc",
          id: "scorers/tool-call-accuracy",
          label: "Tool Call Accuracy Scorers",
        },
        {
          type: "doc",
          id: "scorers/textual-difference",
          label: "Textual Difference Scorer",
        },
        {
          type: "doc",
          id: "scorers/prompt-alignment",
          label: "Prompt Alignment Scorer",
        },
      ],
    },
    {
      type: "category",
      label: "Processors",
      key: "reference.processors",
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
