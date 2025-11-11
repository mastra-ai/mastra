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
        { type: "doc", id: "agents/runtime-context", label: "Runtime Context" },
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
      ],
    },
    // Workflows (Legacy) - Hidden from sidebar using CSS class "sidebar-hidden" (see custom.css)
    // Pages remain accessible via direct URLs and sidebar still shows when visiting legacy pages
    {
      type: "category",
      label: "Workflows (Legacy)",
      className: "sidebar-hidden",
      link: {
        type: "generated-index",
        title: "Workflows (Legacy)",
        slug: "/examples/workflows-legacy",
      },
      items: [
        {
          type: "doc",
          id: "workflows_legacy/creating-a-workflow",
          label: "Creating a Workflow",
        },
        {
          type: "doc",
          id: "workflows_legacy/sequential-steps",
          label: "Sequential Steps",
        },
        {
          type: "doc",
          id: "workflows_legacy/parallel-steps",
          label: "Parallel Steps",
        },
        {
          type: "doc",
          id: "workflows_legacy/branching-paths",
          label: "Branching Paths",
        },
        {
          type: "doc",
          id: "workflows_legacy/conditional-branching",
          label: "Conditional Branching",
        },
        {
          type: "doc",
          id: "workflows_legacy/calling-agent",
          label: "Calling an Agent",
        },
        {
          type: "doc",
          id: "workflows_legacy/using-a-tool-as-a-step",
          label: "Using a Tool as a Step",
        },
        {
          type: "doc",
          id: "workflows_legacy/cyclical-dependencies",
          label: "Cyclical Dependencies",
        },
        {
          type: "doc",
          id: "workflows_legacy/workflow-variables",
          label: "Workflow Variables",
        },
        {
          type: "doc",
          id: "workflows_legacy/human-in-the-loop",
          label: "Human in the Loop Workflow (Legacy)",
        },
        {
          type: "doc",
          id: "workflows_legacy/suspend-and-resume",
          label: "Workflow (Legacy) with Suspend and Resume",
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
        {
          type: "doc",
          id: "evals/answer-relevancy",
          label: "Answer Relevancy",
        },
        { type: "doc", id: "evals/bias", label: "Bias" },
        { type: "doc", id: "evals/completeness", label: "Completeness" },
        {
          type: "doc",
          id: "evals/content-similarity",
          label: "Content Similarity",
        },
        {
          type: "doc",
          id: "evals/context-position",
          label: "Context Position",
        },
        {
          type: "doc",
          id: "evals/context-precision",
          label: "Context Precision",
        },
        {
          type: "doc",
          id: "evals/context-relevancy",
          label: "Context Relevancy",
        },
        {
          type: "doc",
          id: "evals/contextual-recall",
          label: "Contextual Recall",
        },
        { type: "doc", id: "evals/faithfulness", label: "Faithfulness" },
        { type: "doc", id: "evals/hallucination", label: "Hallucination" },
        {
          type: "doc",
          id: "evals/keyword-coverage",
          label: "Keyword Coverage",
        },
        {
          type: "doc",
          id: "evals/prompt-alignment",
          label: "Prompt Alignment",
        },
        { type: "doc", id: "evals/summarization", label: "Summarization" },
        {
          type: "doc",
          id: "evals/textual-difference",
          label: "Textual Difference",
        },
        {
          type: "doc",
          id: "evals/tone-consistency",
          label: "Tone Consistency",
        },
        { type: "doc", id: "evals/toxicity", label: "Toxicity" },
        {
          type: "doc",
          id: "evals/custom-llm-judge-eval",
          label: "LLM as a Judge",
        },
        {
          type: "doc",
          id: "evals/custom-native-javascript-eval",
          label: "Native JavaScript",
        },
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
          id: "observability/basic-ai-tracing",
          label: "Basic AI Tracing",
        },
      ],
    },
  ],
};

export default sidebars;
