/** @type {import('next').NextConfig} */
import nextra from "nextra";
import { initGT } from "gt-next/config";

const withNextra = nextra({
  search: {
    codeblocks: true,
  },
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: {
        displayName: "Mastra",
        name: "mastra",
        semanticHighlighting: true,
        semanticTokenColors: {
          customLiteral: "#fff",
          newOperator: "#C586C0",
          numberLiteral: "#b5cea8",
          stringLiteral: "#fff",
        },
        tokenColors: [
          {
            scope: "constant",
            settings: {
              //green
              foreground: "#46f488",
            },
          },
          {
            scope: "string",
            settings: {
              //green
              foreground: "#46f488",
            },
          },
          {
            scope: ["comment", "punctuation.definition.comment"],
            //subtle gray
            settings: {
              foreground: "#939393",
            },
          },
          {
            scope: [
              "keyword",
              "storage.type",
              "support.type",
              "storage.type.interface",
              "entity.name.type.interface",
              "storage.modifier.async",
              "storage.type.async",
              "keyword.control.loop",
              "keyword.control.from",
              "keyword.control.flow",
              "entity.name.type.ts",
            ],
            settings: {
              //orange
              foreground: "#fa7b6a",
            },
          },
          {
            scope: "parameter",
            settings: {
              foreground: "#fa7b6a",
            },
          },
          {
            scope: ["function", "entity.name.function", "meta.function-call"],
            //purple
            settings: {
              foreground: "#d06bee",
            },
          },
          {
            scope: "string.expression",
            //green
            settings: {
              foreground: "#46f488",
            },
          },
          {
            scope: [
              "punctuation",
              "meta.brace",
              "meta.array",
              "punctuation.definition",
              "meta.import",
              "meta.object.member",
              "meta.object.literal",
              "variable.object.property",
              "meta.interface",
              "variable.other.constant",
              "variable.other.property",
              "variable.other.object",
              "variable.other.readwrite",
              "variable",
              "meta.statement.command.shell",
            ],
            //white
            settings: {
              foreground: "#fff",
            },
          },
          {
            scope: "token.link",
            settings: {
              foreground: "#fff",
            },
          },
        ],
        type: "dark",
      },
    },
  },
});

const withGT = initGT();

export default withGT(
  withNextra({
    assetPrefix: process.env.NODE_ENV === "production" ? "/docs" : "",
    i18n: {
      locales: ["en", "ja"],
      defaultLocale: "en",
    },
    async rewrites() {
      return {
        beforeFiles: [
          {
            source: "/:locale/docs/_next/:path+",
            destination: "/_next/:path+",
          },
          {
            source: "/docs/_next/:path+",
            destination: "/_next/:path+",
          },
        ],
      };
    },
    redirects: () => [
      {
        source: "/docs",
        destination: "/en/docs",
        permanent: true,
      },
      {
        source: "/docs/:path*",
        destination: "/en/docs/:path*",
        permanent: true,
      },
      {
        source: "/examples",
        destination: "/en/examples",
        permanent: true,
      },
      {
        source: "/examples/:path*",
        destination: "/en/examples/:path*",
        permanent: true,
      },
      {
        source: "/guides",
        destination: "/en/guides",
        permanent: true,
      },
      {
        source: "/guides/:path*",
        destination: "/en/guides/:path*",
        permanent: true,
      },
      {
        source: "/reference",
        destination: "/en/reference",
        permanent: true,
      },
      {
        source: "/reference/:path*",
        destination: "/en/reference/:path*",
        permanent: true,
      },
      {
        source: "/showcase",
        destination: "/en/showcase",
        permanent: true,
      },
      {
        source: "/examples/memory/short-term-working-memory",
        destination: "/examples/memory/memory-with-libsql",
        permanent: true,
      },
      {
        source: "/docs/08-running-evals",
        destination: "/docs/evals/overview",
        permanent: true,
      },
      {
        source: "/docs/agents/00-overview",
        destination: "/docs/agents/overview",
        permanent: true,
      },
      {
        source: "/docs/agents/01-agent-memory",
        destination: "/docs/agents/agent-memory",
        permanent: true,
      },
      {
        source: "/docs/agents/02-adding-tools",
        destination: "/docs/agents/adding-tools",
        permanent: true,
      },
      {
        source: "/docs/agents/02a-mcp-guide",
        destination: "/docs/agents/mcp-guide",
        permanent: true,
      },
      {
        source: "/docs/agents/03-adding-voice",
        destination: "/docs/agents/adding-voice",
        permanent: true,
      },
      {
        source: "/docs/evals/00-overview",
        destination: "/docs/evals/overview",
        permanent: true,
      },
      {
        source: "/docs/evals/01-textual-evals",
        destination: "/docs/evals/textual-evals",
        permanent: true,
      },
      {
        source: "/docs/evals/02-custom-eval",
        destination: "/docs/evals/custom-eval",
        permanent: true,
      },
      {
        source: "/docs/evals/03-running-in-ci",
        destination: "/docs/evals/running-in-ci",
        permanent: true,
      },
      {
        source: "/docs/frameworks/01-next-js",
        destination: "/docs/frameworks/next-js",
        permanent: true,
      },
      {
        source: "/docs/frameworks/02-ai-sdk",
        destination: "/docs/frameworks/ai-sdk",
        permanent: true,
      },
      {
        source: "/docs/guides/01-chef-michel",
        destination: "/docs/guides/chef-michel",
        permanent: true,
      },
      {
        source: "/docs/guides/02-stock-agent",
        destination: "/docs/guides/stock-agent",
        permanent: true,
      },
      {
        source: "/docs/guides/03-recruiter",
        destination: "/docs/guides/ai-recruiter",
        permanent: true,
      },
      {
        source: "/docs/guides/04-research-assistant",
        destination: "/docs/guides/research-assistant",
        permanent: true,
      },
      {
        source: "/docs/workflows/00-overview",
        destination: "/docs/workflows/overview",
        permanent: true,
      },
      {
        source: "/docs/workflows/index",
        destination: "/docs/workflows/overview",
        permanent: true,
      },
      {
        source: "/docs/reference/memory/memory-processors",
        destination: "/docs/memory/memory-processors",
        permanent: false, // we should have a memory-processors reference
      },
      {
        source: "/docs/memory/getting-started",
        destination: "/docs/memory/overview",
        permanent: true,
      },
      {
        source: "/docs/deployment/logging-and-tracing",
        destination: "/docs/observability/logging",
        permanent: true,
      },
      {
        source: "/examples/memory",
        destination: "/examples/memory/memory-with-libsql",
        permanent: true,
      },
      {
        source: "/examples/rag/rerank",
        destination: "/examples/rag/rerank/rerank-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/rerank-rag",
        destination: "/examples/rag/rerank/rerank-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/chunking",
        destination: "/examples/rag/chunking/chunk-text",
        permanent: true,
      },
      {
        source: "/examples/rag/chunk-json",
        destination: "/examples/rag/chunking/chunk-json",
        permanent: true,
      },
      {
        source: "/examples/rag/hybrid-vector-search",
        destination: "/examples/rag/query/hybrid-vector-search",
        permanent: true,
      },
      {
        source: "/docs/local-dev/mastra-init",
        destination: "/docs/getting-started/installation",
        permanent: true,
      },
      {
        source: "/examples/rag/retrieve-results",
        destination: "/examples/rag/query/retrieve-results",
        permanent: true,
      },
      {
        source: "/examples/rag/basic-rag",
        destination: "/examples/rag/query/hybrid-vector-search",
        permanent: true,
      },
      {
        source: "/examples/rag/embed-chunk-array",
        destination: "/examples/rag/chunking/chunk-json",
        permanent: true,
      },
      {
        source: "/examples/rag/embed-text-chunk",
        destination: "/examples/rag/chunking/chunk-text",
        permanent: true,
      },
      {
        source: "/examples/rag/filter-rag",
        destination: "/docs/rag/retrieval#metadata-filtering",
        permanent: true,
      },
      {
        source: "/docs/workflows/data-flow",
        destination: "/docs/workflows/variables",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-astra",
        destination: "/examples/rag/upsert/upsert-embeddings#astra-db",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-pgvector",
        destination: "/examples/rag/upsert/upsert-embeddings#pgvector",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-chroma",
        destination: "/examples/rag/upsert/upsert-embeddings#chroma",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-pinecone",
        destination: "/examples/rag/upsert/upsert-embeddings#pinecone",
        permanent: true,
      },
      {
        source: "/examples/rag/usage/rerank-rag",
        destination: "/examples/rag/rerank/rerank-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/reranking-with-cohere",
        destination: "/examples/rag/rerank/reranking-with-cohere",
        permanent: true,
      },
      {
        source: "/examples/memory/short-term-working-memory",
        destination: "/examples/memory/memory-with-libsql",
        permanent: true,
      },
      {
        source: "/examples/rag/query/metadata-extraction",
        destination: "/examples/rag/query/retrieve-results",
        permanent: true,
      },
      {
        source: "/docs/showcase",
        destination: "/showcase",
        permanent: true,
      },
      {
        source: "/docs/local-dev/integrations",
        destination: "/docs/integrations",
        permanent: true,
      },
      {
        source: "/docs/evals/01-supported-evals",
        destination: "/docs/evals/overview",
        permanent: true,
      },
      {
        source: "/docs/agents/02b-discord-mcp-bot",
        destination: "/docs/agents/mcp-guide",
        permanent: true,
      },
      {
        source: "/docs/api/memory",
        destination: "/docs/agents/agent-memory",
        permanent: true,
      },
      {
        source: "/docs/guide/deployment/deployment",
        destination: "/docs/deployment/deployment",
        permanent: true,
      },
      {
        source: "/docs/guide/deployment/logging-and-tracing",
        destination: "/docs/observability/logging",
        permanent: true,
      },
      {
        source: "/docs/guide/engine/:path*",
        destination: "/docs",
        permanent: true,
      },
      {
        source: "/docs/guide/guides/01-harry-potter",
        destination: "/guides",
        permanent: true,
      },
      {
        source: "/docs/guide/guides/02-chef-michel",
        destination: "/guides/guide/chef-michel",
        permanent: true,
      },
      {
        source: "/docs/guide/guides/03-stock-agent",
        destination: "/guides/guide/stock-agent",
        permanent: true,
      },
      {
        source: "/docs/guide/local-dev/integrations",
        destination: "/docs/local-dev/mastra-dev",
        permanent: true,
      },
      {
        source: "/docs/guide/rag/vector-databases",
        destination: "/docs/rag/vector-databases",
        permanent: true,
      },
      {
        source: "/docs/guide/rag/retrieval",
        destination: "/docs/rag/retrieval",
        permanent: true,
      },
      {
        source: "/docs/reference/cli/engine",
        destination: "/reference",
        permanent: true,
      },
      {
        source: "/docs/reference/client-js",
        destination: "/reference/client-js/agents",
        permanent: true,
      },
      {
        source: "/docs/reference/memory/addMessage",
        destination: "/reference/memory/createThread",
        permanent: true,
      },
      {
        source: "/docs/reference/memory/rememberMessages",
        destination: "/reference/memory/createThread",
        permanent: true,
      },
      {
        source: "/docs/reference/observability/combine-loggers",
        destination: "/reference/observability/logger",
        permanent: true,
      },
      {
        source: "/docs/reference/rag/pgstore",
        destination: "/reference/rag/pg",
        permanent: true,
      },
      {
        source: "/docs/reference/rag/reranker",
        destination: "/reference/rag/rerank",
        permanent: true,
      },
      {
        source: "/docs/reference/storage/mastra-storage",
        destination: "/reference/storage/libsql",
        permanent: true,
      },
      {
        source: "/docs/reference/tts/generate",
        destination: "/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/tts/providers-and-models",
        destination: "/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/tts/stream",
        destination: "/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/tts/provider-and-models",
        destination: "/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/voice/voice.close",
        destination: "/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/voice/voice.off",
        destination: "/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/tts/stream",
        destination: "/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/guide",
        destination: "/guides",
        permanent: true,
      },
      {
        source: "/docs/guide/:path*",
        destination: "/guides/guide/:path*",
        permanent: true,
      },
      {
        source: "/docs/reference",
        destination: "/reference",
        permanent: true,
      },
      {
        source: "/docs/reference/:path*",
        destination: "/reference/:path*",
        permanent: true,
      },
      {
        source: "/docs/showcase",
        destination: "/showcase",
        permanent: true,
      },
      {
        source: "/docs/showcase/:path*",
        destination: "/showcase/:path*",
        permanent: true,
      },
      {
        source: "/docs/workflows/data-flow",
        destination: "/docs/workflows/control-flow",
        permanent: true,
      },
      {
        source: "/docs/local-dev/creating-projects",
        destination: "/docs/local-dev/creating-a-new-project",
        permanent: true,
      },
      {
        source: "/docs/local-dev/sync",
        destination: "/docs/integrations",
        permanent: true,
      },
      {
        source: "/docs/local-dev/syncs",
        destination: "/docs/integrations",
        permanent: true,
      },
      {
        source: "/docs/local-dev/syncing-projects",
        destination: "/docs/local-dev/syncing-projects",
        permanent: true,
      },
      {
        source: "/docs/guides/:path*",
        destination: "/guides/guide/:path*",
        permanent: true,
      },
      {
        source: "/examples/rag/adjust-chunk-delimiters",
        destination: "/examples/rag/chunking/adjust-chunk-delimiters",
        permanent: true,
      },
      {
        source: "/examples/rag/adjust-chunk-size",
        destination: "/examples/rag/chunking/adjust-chunk-size",
        permanent: true,
      },
      {
        source: "/examples/rag/basic-rag",
        destination: "/examples/rag/usage/basic-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/chunk-html",
        destination: "/examples/rag/chunking/chunk-html",
        permanent: true,
      },
      {
        source: "/examples/rag/chunk-json",
        destination: "/examples/rag/chunking/chunk-json",
        permanent: true,
      },
      {
        source: "/examples/rag/chunk-markdown",
        destination: "/examples/rag/chunking/chunk-markdown",
        permanent: true,
      },
      {
        source: "/examples/rag/chunk-text",
        destination: "/examples/rag/chunking/chunk-text",
        permanent: true,
      },
      {
        source: "/examples/rag/chunking",
        destination: "/examples/rag/chunking/chunk-text",
        permanent: true,
      },
      {
        source: "/examples/rag/cleanup-rag",
        destination: "/examples/rag/usage/cleanup-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/cot-rag",
        destination: "/examples/rag/usage/cot-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/cot-workflow-rag",
        destination: "/examples/rag/usage/cot-workflow-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/embed-chunk-array",
        destination: "/examples/rag/embedding/embed-chunk-array",
        permanent: true,
      },
      {
        source: "/examples/rag/embed-text-chunk",
        destination: "/examples/rag/embedding/embed-text-chunk",
        permanent: true,
      },
      {
        source: "/examples/rag/embed-text-with-cohere",
        destination: "/examples/rag/embedding/embed-text-with-cohere",
        permanent: true,
      },
      {
        source: "/examples/rag/filter-rag",
        destination: "/examples/rag/usage/filter-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/graph-rag",
        destination: "/examples/rag/usage/graph-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/hybrid-vector-search",
        destination: "/examples/rag/query/hybrid-vector-search",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-astra",
        destination: "/reference/rag/astra",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-pgvector",
        destination: "/reference/rag/pg",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-chroma",
        destination: "/reference/rag/chroma",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-libsql",
        destination: "/reference/rag/libsql",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-pinecone",
        destination: "/reference/rag/pinecone",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-qdrant",
        destination: "/reference/rag/qdrant",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-upstash",
        destination: "/reference/rag/upstash",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-vectorize",
        destination: "/reference/rag/pg",
        permanent: true,
      },
      {
        source: "/examples/rag/metadata-extraction",
        destination: "/examples/rag/embedding/metadata-extraction",
        permanent: true,
      },
      {
        source: "/examples/rag/metadata-extraction",
        destination: "/examples/rag/embedding/metadata-extraction",
        permanent: true,
      },
      {
        source: "/examples/rag/query/metadata-extraction",
        destination: "/examples/rag/embedding/metadata-extraction",
        permanent: true,
      },
      {
        source: "/examples/rag/rerank",
        destination: "/examples/rag/rerank/rerank",
        permanent: true,
      },
      {
        source: "/examples/rag/rerank-rag",
        destination: "/examples/rag/rerank/rerank",
        permanent: true,
      },
      {
        source: "/examples/rag/reranking-with-cohere",
        destination: "/examples/rag/rerank/reranking-with-cohere",
        permanent: true,
      },
      {
        source: "/examples/rag/retrieve-results",
        destination: "/examples/rag/query/retrieve-results",
        permanent: true,
      },
      {
        source: "/examples/rag/retrieve-results",
        destination: "/examples/rag/query/retrieve-results",
        permanent: true,
      },
      {
        source: "/examples/rag/usage/rerank-rag",
        destination: "/examples/rag/rerank/rerank",
        permanent: true,
      },
      {
        source: "/examples/rag/retrieve-results",
        destination: "/examples/rag/query/retrieve-results",
        permanent: true,
      },
      {
        source: "/examples/voice",
        destination: "/examples/voice/text-to-speech",
        permanent: true,
      },
      {
        source: "/examples/workflows/subscribed-steps",
        destination: "/examples/workflows/sequential-steps",
        permanent: true,
      },
      {
        source: "/docs/voice/voice-to-voice",
        destination: "/docs/voice/speech-to-speech",
        permanent: true,
      },
    ],
    trailingSlash: false,
  }),
);
