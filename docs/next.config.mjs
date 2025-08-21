/** @type {import('next').NextConfig} */
import nextra from "nextra";
import { initGT } from "gt-next/config";
import { transformerNotationDiff } from "@shikijs/transformers";
import path from "path";
import { readFileSync } from "fs";

const withNextra = nextra({
  search: {
    codeblocks: true,
  },
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: JSON.parse(
        readFileSync(path.join(process.cwd(), "theme.json"), "utf-8"),
      ),
      transformers: [transformerNotationDiff()],
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
            source: "/en/docs/api/copilotkit",
            destination: "/api/copilotkit",
          },
          {
            source: "/ja/docs/api/copilotkit",
            destination: "/api/copilotkit",
          },
          {
            source: "/docs/api/copilotkit",
            destination: "/api/copilotkit",
          },
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
        source: "/:locale/docs/08-running-evals",
        destination: "/:locale/docs/evals/overview",
        permanent: true,
      },
      {
        source: "/docs/08-running-evals",
        destination: "/en/docs/evals/overview",
        permanent: false,
      },
      {
        source: "/:locale/docs/agents/00-overview",
        destination: "/:locale/docs/agents/overview",
        permanent: true,
      },
      {
        source: "/docs/agents/00-overview",
        destination: "/en/docs/agents/overview",
        permanent: false,
      },
      {
        source: "/:locale/docs/agents/01-agent-memory",
        destination: "/:locale/docs/agents/agent-memory",
        permanent: true,
      },
      {
        source: "/docs/agents/01-agent-memory",
        destination: "/en/docs/agents/agent-memory",
        permanent: false,
      },
      {
        source: "/:locale/docs/agents/02-adding-tools",
        destination: "/:locale/docs/agents/adding-tools",
        permanent: true,
      },
      {
        source: "/docs/agents/02-adding-tools",
        destination: "/en/docs/agents/adding-tools",
        permanent: false,
      },
      {
        source: "/:locale/docs/agents/adding-tools",
        destination: "/:locale/docs/agents/using-tools-and-mcp",
        permanent: true,
      },
      {
        source: "/docs/agents/adding-tools",
        destination: "/en/docs/agents/using-tools-and-mcp",
        permanent: false,
      },
      {
        source: "/:locale/docs/agents/02a-mcp-guide",
        destination: "/:locale/docs/agents/mcp-guide",
        permanent: true,
      },
      {
        source: "/docs/agents/02a-mcp-guide",
        destination: "/en/docs/agents/mcp-guide",
        permanent: false,
      },
      {
        source: "/:locale/docs/agents/mcp-guide",
        destination: "/:locale/docs/agents/using-tools-and-mcp",
        permanent: true,
      },
      {
        source: "/docs/agents/mcp-guide",
        destination: "/en/docs/agents/using-tools-and-mcp",
        permanent: false,
      },
      {
        source: "/:locale/docs/agents/03-adding-voice",
        destination: "/:locale/docs/agents/adding-voice",
        permanent: true,
      },
      {
        source: "/docs/agents/03-adding-voice",
        destination: "/en/docs/agents/adding-voice",
        permanent: false,
      },
      {
        source: "/:locale/docs/evals/00-overview",
        destination: "/:locale/docs/evals/overview",
        permanent: true,
      },
      {
        source: "/docs/evals/00-overview",
        destination: "/en/docs/evals/overview",
        permanent: false,
      },
      {
        source: "/:locale/docs/evals/01-textual-evals",
        destination: "/:locale/docs/evals/textual-evals",
        permanent: true,
      },
      {
        source: "/docs/evals/01-textual-evals",
        destination: "/en/docs/evals/textual-evals",
        permanent: false,
      },
      {
        source: "/:locale/docs/evals/02-custom-eval",
        destination: "/:locale/docs/evals/custom-eval",
        permanent: true,
      },
      {
        source: "/docs/evals/02-custom-eval",
        destination: "/en/docs/evals/custom-eval",
        permanent: false,
      },
      {
        source: "/:locale/docs/evals/03-running-in-ci",
        destination: "/:locale/docs/evals/running-in-ci",
        permanent: true,
      },
      {
        source: "/docs/evals/03-running-in-ci",
        destination: "/en/docs/evals/running-in-ci",
        permanent: false,
      },
      {
        source: "/:locale/docs/local-dev/creating-a-new-project",
        destination: "/:locale/docs/getting-started/installation",
        permanent: true,
      },
      {
        source: "/docs/local-dev/creating-a-new-project",
        destination: "/en/docs/getting-started/installation",
        permanent: false,
      },
      {
        source: "/:locale/docs/local-dev/add-to-existing-project",
        destination:
          "/:locale/docs/getting-started/installation#add-to-an-existing-project",
        permanent: true,
      },
      {
        source: "/docs/local-dev/add-to-existing-project",
        destination:
          "/en/docs/getting-started/installation#add-to-an-existing-project",
        permanent: false,
      },
      {
        source: "/:locale/docs/deployment/deployment",
        destination: "/:locale/docs/deployment/serverless-platforms",
        permanent: true,
      },
      {
        source: "/:locale/docs/deployment/client",
        destination: "/:locale/docs/client-js/overview",
        permanent: true,
      },
      {
        source: "/docs/deployment/client",
        destination: "/en/docs/client-js/overview",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/ai-sdk-v5",
        destination:
          "/:locale/docs/frameworks/agentic-uis/ai-sdk#vercel-ai-sdk-v5",
        permanent: true,
      },
      {
        source: "/docs/frameworks/ai-sdk-v5",
        destination: "/en/docs/frameworks/agentic-uis/ai-sdk#vercel-ai-sdk-v5",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/express",
        destination: "/:locale/docs/frameworks/servers/express",
        permanent: true,
      },
      {
        source: "/docs/frameworks/express",
        destination: "/en/docs/frameworks/servers/express",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/vite-react",
        destination: "/:locale/docs/frameworks/web-frameworks/vite-react",
        permanent: true,
      },
      {
        source: "/docs/frameworks/vite-react",
        destination: "/en/docs/frameworks/web-frameworks/vite-react",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/next-js",
        destination: "/:locale/docs/frameworks/web-frameworks/next-js",
        permanent: true,
      },
      {
        source: "/docs/frameworks/next-js",
        destination: "/en/docs/frameworks/web-frameworks/next-js",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/astro",
        destination: "/:locale/docs/frameworks/web-frameworks/astro",
        permanent: true,
      },
      {
        source: "/docs/frameworks/astro",
        destination: "/en/docs/frameworks/web-frameworks/astro",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/ai-sdk",
        destination: "/:locale/docs/frameworks/agentic-uis/ai-sdk",
        permanent: true,
      },
      {
        source: "/docs/frameworks/ai-sdk",
        destination: "/en/docs/frameworks/agentic-uis/ai-sdk",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/copilotkit",
        destination: "/:locale/docs/frameworks/agentic-uis/copilotkit",
        permanent: true,
      },
      {
        source: "/docs/frameworks/copilotkit",
        destination: "/en/docs/frameworks/agentic-uis/copilotkit",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/assistant-ui",
        destination: "/:locale/docs/frameworks/agentic-uis/assistant-ui",
        permanent: true,
      },
      {
        source: "/docs/frameworks/assistant-ui",
        destination: "/en/docs/frameworks/agentic-uis/assistant-ui",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/openrouter",
        destination: "/:locale/docs/frameworks/agentic-uis/openrouter",
        permanent: true,
      },
      {
        source: "/docs/frameworks/openrouter",
        destination: "/en/docs/frameworks/agentic-uis/openrouter",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/01-next-js",
        destination: "/:locale/docs/frameworks/next-js",
        permanent: true,
      },
      {
        source: "/docs/frameworks/01-next-js",
        destination: "/en/docs/frameworks/next-js",
        permanent: false,
      },
      {
        source: "/:locale/docs/frameworks/02-ai-sdk",
        destination: "/:locale/docs/frameworks/ai-sdk",
        permanent: true,
      },
      {
        source: "/docs/frameworks/02-ai-sdk",
        destination: "/en/docs/frameworks/ai-sdk",
        permanent: false,
      },
      {
        source: "/:locale/docs/workflows/flow-control",
        destination: "/:locale/docs/workflows/control-flow",
        permanent: true,
      },
      {
        source: "/:locale/docs/workflows/00-overview",
        destination: "/:locale/docs/workflows/overview",
        permanent: true,
      },
      {
        source: "/docs/workflows/00-overview",
        destination: "/en/docs/workflows/overview",
        permanent: false,
      },
      {
        source: "/:locale/docs/workflows/index",
        destination: "/:locale/docs/workflows/overview",
        permanent: true,
      },
      {
        source: "/docs/workflows/index",
        destination: "/en/docs/workflows/overview",
        permanent: false,
      },
      {
        source: "/:locale/docs/voice",
        destination: "/:locale/docs/voice/overview",
        permanent: true,
      },
      {
        source: "/docs/voice",
        destination: "/en/docs/voice/overview",
        permanent: false,
      },
      {
        source: "/:locale/reference/memory/memory-processors",
        destination: "/:locale/docs/memory/memory-processors",
        permanent: true,
      },
      {
        source: "/reference/memory/memory-processors",
        destination: "/en/docs/memory/memory-processors",
        permanent: false,
      },
      {
        source: "/:locale/docs/memory/getting-started",
        destination: "/:locale/docs/memory/overview",
        permanent: true,
      },
      {
        source: "/docs/memory/getting-started",
        destination: "/en/docs/memory/overview",
        permanent: false,
      },
      {
        source:
          "/:locale/docs/memory/getting-started#conversation-history-last-messages",
        destination: "/:locale/docs/memory/overview",
        permanent: true,
      },
      {
        source:
          "/docs/memory/getting-started#conversation-history-last-messages",
        destination: "/en/docs/memory/overview",
        permanent: false,
      },
      {
        source: "/:locale/docs/deployment/logging-and-tracing",
        destination: "/:locale/docs/observability/logging",
        permanent: true,
      },
      {
        source: "/docs/deployment/logging-and-tracing",
        destination: "/en/docs/observability/logging",
        permanent: false,
      },
      {
        source: "/:locale/examples/memory",
        destination: "/:locale/examples/memory/memory-with-libsql",
        permanent: true,
      },
      {
        source: "/examples/memory",
        destination: "/en/examples/memory/memory-with-libsql",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/rerank",
        destination: "/:locale/examples/rag/rerank/rerank",
        permanent: true,
      },
      {
        source: "/examples/rag/rerank",
        destination: "/en/examples/rag/rerank/rerank",
        permanent: false,
      },
      {
        source: "/:locale/docs/local-dev/mastra-init",
        destination: "/:locale/docs/getting-started/installation",
        permanent: true,
      },
      {
        source: "/docs/local-dev/mastra-init",
        destination: "/en/docs/getting-started/installation",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/embed-chunk-array",
        destination: "/:locale/examples/rag/embedding/embed-chunk-array",
        permanent: true,
      },
      {
        source: "/examples/rag/embed-chunk-array",
        destination: "/en/examples/rag/embedding/embed-chunk-array",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/embed-text-chunk",
        destination: "/:locale/examples/rag/embedding/embed-text-chunk",
        permanent: true,
      },
      {
        source: "/examples/rag/embed-text-chunk",
        destination: "/en/examples/rag/embedding/embed-text-chunk",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/filter-rag",
        destination: "/:locale/examples/rag/usage/filter-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/filter-rag",
        destination: "/en/examples/rag/usage/filter-rag",
        permanent: false,
      },
      {
        source: "/:locale/workflows",
        destination: "/:locale/docs/workflows/overview",
        permanent: true,
      },
      {
        source: "/workflows",
        destination: "/en/docs/workflows/overview",
        permanent: false,
      },
      {
        source: "/:locale/workflows/:path*",
        destination: "/:locale/docs/workflows/:path*",
        permanent: true,
      },
      {
        source: "/workflows/:path*",
        destination: "/en/docs/workflows/:path*",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/insert-embedding-in-astra",
        destination: "/:locale/examples/rag/upsert/upsert-embeddings#astra-db",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-astra",
        destination: "/en/examples/rag/upsert/upsert-embeddings#astra-db",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/insert-embedding-in-pgvector",
        destination: "/:locale/examples/rag/upsert/upsert-embeddings#pgvector",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-pgvector",
        destination: "/en/examples/rag/upsert/upsert-embeddings#pgvector",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/insert-embedding-in-chroma",
        destination: "/:locale/examples/rag/upsert/upsert-embeddings#chroma",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-chroma",
        destination: "/en/examples/rag/upsert/upsert-embeddings#chroma",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/insert-embedding-in-pinecone",
        destination: "/:locale/examples/rag/upsert/upsert-embeddings#pinecone",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-pinecone",
        destination: "/en/examples/rag/upsert/upsert-embeddings#pinecone",
        permanent: false,
      },
      {
        source: "/:locale/examples/memory/short-term-working-memory",
        destination: "/:locale/examples/memory/memory-with-libsql",
        permanent: true,
      },
      {
        source: "/examples/memory/short-term-working-memory",
        destination: "/en/examples/memory/memory-with-libsql",
        permanent: false,
      },
      {
        source: "/:locale/docs/local-dev/integrations",
        destination: "/:locale/docs/integrations",
        permanent: true,
      },
      {
        source: "/docs/local-dev/integrations",
        destination: "/en/docs/integrations",
        permanent: false,
      },
      {
        source: "/:locale/docs/integrations",
        destination: "/:locale/docs/tools-mcp/mcp-overview",
        permanent: true,
      },
      {
        source: "/docs/integrations",
        destination: "/en/docs/tools-mcp/mcp-overview",
        permanent: false,
      },
      {
        source: "/:locale/docs/evals/01-supported-evals",
        destination: "/:locale/docs/evals/overview",
        permanent: true,
      },
      {
        source: "/docs/evals/01-supported-evals",
        destination: "/en/docs/evals/overview",
        permanent: false,
      },
      {
        source: "/:locale/docs/agents/02b-discord-mcp-bot",
        destination: "/:locale/docs/agents/mcp-guide",
        permanent: true,
      },
      {
        source: "/docs/agents/02b-discord-mcp-bot",
        destination: "/en/docs/agents/mcp-guide",
        permanent: false,
      },
      {
        source: "/:locale/docs/api/memory",
        destination: "/:locale/docs/agents/agent-memory",
        permanent: true,
      },
      {
        source: "/docs/api/memory",
        destination: "/en/docs/agents/agent-memory",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/deployment/deployment",
        destination: "/:locale/docs/deployment/serverless-platforms",
        permanent: true,
      },
      {
        source: "/docs/guide/deployment/deployment",
        destination: "/en/docs/deployment/serverless-platforms",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/deployment/logging-and-tracing",
        destination: "/:locale/docs/observability/logging",
        permanent: true,
      },
      {
        source: "/docs/guide/deployment/logging-and-tracing",
        destination: "/en/docs/observability/logging",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/engine/:path*",
        destination: "/:locale/docs",
        permanent: true,
      },
      {
        source: "/docs/guide/engine/:path*",
        destination: "/en/docs",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/guides/01-harry-potter",
        destination: "/:locale/guides",
        permanent: true,
      },
      {
        source: "/docs/guide/guides/01-harry-potter",
        destination: "/en/guides",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/guides/02-chef-michel",
        destination: "/:locale/guides/guide/chef-michel",
        permanent: true,
      },
      {
        source: "/docs/guide/guides/02-chef-michel",
        destination: "/en/guides/guide/chef-michel",
        permanent: false,
      },
      {
        source: "/:locale/docs/guides/chef-michel",
        destination: "/:locale/guides/guide/chef-michel",
        permanent: true,
      },
      {
        source: "/docs/guides/chef-michel",
        destination: "/en/guides/guide/chef-michel",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/guides/03-stock-agent",
        destination: "/:locale/guides/guide/stock-agent",
        permanent: true,
      },
      {
        source: "/docs/guide/guides/03-stock-agent",
        destination: "/en/guides/guide/stock-agent",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/local-dev/integrations",
        destination: "/:locale/docs/server-db/local-dev-playground",
        permanent: true,
      },
      {
        source: "/docs/guide/local-dev/integrations",
        destination: "/en/docs/server-db/local-dev-playground",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/rag/vector-databases",
        destination: "/:locale/docs/rag/vector-databases",
        permanent: true,
      },
      {
        source: "/docs/guide/rag/vector-databases",
        destination: "/en/docs/rag/vector-databases",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/rag/retrieval",
        destination: "/:locale/docs/rag/retrieval",
        permanent: true,
      },
      {
        source: "/docs/guide/rag/retrieval",
        destination: "/en/docs/rag/retrieval",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/cli/engine",
        destination: "/:locale/reference",
        permanent: true,
      },
      {
        source: "/docs/reference/cli/engine",
        destination: "/en/reference",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/workflows/step-retries",
        destination: "/:locale/reference/workflows/workflow",
        permanent: true,
      },
      {
        source: "/docs/reference/workflows/step-retries",
        destination: "/en/reference/workflows/workflow",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/observability/otel-config",
        destination: "/:locale/reference/observability/otel-config",
        permanent: true,
      },
      {
        source: "/docs/reference/observability/otel-config",
        destination: "/en/reference/observability/otel-config",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/client-js",
        destination: "/:locale/reference/client-js/agents",
        permanent: true,
      },
      {
        source: "/docs/reference/client-js",
        destination: "/en/reference/client-js/agents",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/memory/addMessage",
        destination: "/:locale/reference/memory/createThread",
        permanent: true,
      },
      {
        source: "/docs/reference/memory/addMessage",
        destination: "/en/reference/memory/createThread",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/memory/rememberMessages",
        destination: "/:locale/reference/memory/createThread",
        permanent: true,
      },
      {
        source: "/docs/reference/memory/rememberMessages",
        destination: "/en/reference/memory/createThread",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/observability/combine-loggers",
        destination: "/:locale/reference/observability/logger",
        permanent: true,
      },
      {
        source: "/docs/reference/observability/combine-loggers",
        destination: "/en/reference/observability/logger",
        permanent: false,
      },
      {
        source: "/:locale/reference/rag/retrieval",
        destination: "/:locale/examples/rag/query/retrieve-results",
        permanent: true,
      },
      {
        source: "/reference/rag/retrieval",
        destination: "/en/examples/rag/query/retrieve-results",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/rag/pgstore",
        destination: "/:locale/reference/rag/pg",
        permanent: true,
      },
      {
        source: "/docs/reference/rag/pgstore",
        destination: "/en/reference/rag/pg",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/rag/reranker",
        destination: "/:locale/reference/rag/rerank",
        permanent: true,
      },
      {
        source: "/docs/reference/rag/reranker",
        destination: "/en/reference/rag/rerank",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/storage/mastra-storage",
        destination: "/:locale/reference/storage/libsql",
        permanent: true,
      },
      {
        source: "/docs/reference/storage/mastra-storage",
        destination: "/en/reference/storage/libsql",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/tts/generate",
        destination: "/:locale/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/tts/generate",
        destination: "/en/reference/voice/mastra-voice",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/tts/providers-and-models",
        destination: "/:locale/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/tts/providers-and-models",
        destination: "/en/reference/voice/mastra-voice",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/tts/provider-and-models",
        destination: "/:locale/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/tts/provider-and-models",
        destination: "/en/reference/voice/mastra-voice",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/voice/voice.close",
        destination: "/:locale/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/voice/voice.close",
        destination: "/en/reference/voice/mastra-voice",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/voice/voice.off",
        destination: "/:locale/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/voice/voice.off",
        destination: "/en/reference/voice/mastra-voice",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/tts/stream",
        destination: "/:locale/reference/voice/mastra-voice",
        permanent: true,
      },
      {
        source: "/docs/reference/tts/stream",
        destination: "/en/reference/voice/mastra-voice",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide",
        destination: "/:locale/guides",
        permanent: true,
      },
      {
        source: "/docs/guide",
        destination: "/en/guides",
        permanent: false,
      },
      {
        source: "/:locale/docs/guide/:path*",
        destination: "/:locale/guides/guide/:path*",
        permanent: true,
      },
      {
        source: "/docs/guide/:path*",
        destination: "/en/guides/guide/:path*",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference",
        destination: "/:locale/reference",
        permanent: true,
      },
      {
        source: "/docs/reference",
        destination: "/en/reference",
        permanent: false,
      },
      {
        source: "/:locale/docs/reference/:path*",
        destination: "/:locale/reference/:path*",
        permanent: true,
      },
      {
        source: "/docs/reference/:path*",
        destination: "/en/reference/:path*",
        permanent: false,
      },
      {
        source: "/:locale/docs/showcase",
        destination: "/:locale/showcase",
        permanent: true,
      },
      {
        source: "/docs/showcase",
        destination: "/en/showcase",
        permanent: false,
      },
      {
        source: "/:locale/docs/showcase/:path*",
        destination: "/:locale/showcase/:path*",
        permanent: true,
      },
      {
        source: "/docs/showcase/:path*",
        destination: "/en/showcase/:path*",
        permanent: false,
      },
      {
        source: "/:locale/docs/workflows/data-flow",
        destination: "/:locale/docs/workflows/control-flow",
        permanent: true,
      },
      {
        source: "/docs/workflows/data-flow",
        destination: "/en/docs/workflows/control-flow",
        permanent: false,
      },
      {
        source: "/:locale/docs/local-dev/creating-projects",
        destination: "/:locale/docs/local-dev/creating-a-new-project",
        permanent: true,
      },
      {
        source: "/docs/local-dev/creating-projects",
        destination: "/en/docs/local-dev/creating-a-new-project",
        permanent: false,
      },
      {
        source: "/:locale/docs/local-dev/sync",
        destination: "/:locale/docs/integrations",
        permanent: true,
      },
      {
        source: "/docs/local-dev/sync",
        destination: "/en/docs/integrations",
        permanent: false,
      },
      {
        source: "/:locale/docs/local-dev/syncs",
        destination: "/:locale/docs/integrations",
        permanent: true,
      },
      {
        source: "/docs/local-dev/syncs",
        destination: "/en/docs/integrations",
        permanent: false,
      },
      {
        source: "/:locale/docs/local-dev/syncing-projects",
        destination: "/:locale/docs/server-db/local-dev-playground",
        permanent: true,
      },
      {
        source: "/docs/local-dev/syncing-projects",
        destination: "/en/docs/server-db/local-dev-playground",
        permanent: false,
      },
      {
        source: "/:locale/docs/guides/:path*",
        destination: "/:locale/guides/guide/:path*",
        permanent: true,
      },
      {
        source: "/docs/guides/:path*",
        destination: "/en/guides/guide/:path*",
        permanent: false,
      },
      {
        source: "/:locale/docs/client-js/overview",
        destination: "/:locale/docs/server-db/mastra-client",
        permanent: true,
      },
      {
        source: "/docs/client-js/overview",
        destination: "/en/docs/server-db/mastra-client",
        permanent: false,
      },
      {
        source: "/:locale/docs/deployment/custom-api-routes",
        destination: "/:locale/docs/server-db/custom-api-routes",
        permanent: true,
      },
      {
        source: "/docs/deployment/custom-api-routes",
        destination: "/en/docs/server-db/custom-api-routes",
        permanent: false,
      },
      {
        source: "/:locale/docs/deployment/middleware",
        destination: "/:locale/docs/server-db/middleware",
        permanent: true,
      },
      {
        source: "/docs/deployment/middleware",
        destination: "/en/docs/server-db/middleware",
        permanent: false,
      },
      {
        source: "/:locale/docs/deployment/server",
        destination: "/:locale/docs/deployment/server-deployment",
        permanent: true,
      },
      {
        source: "/docs/deployment/server",
        destination: "/en/docs/deployment/server-deployment",
        permanent: false,
      },
      {
        source: "/:locale/docs/local-dev/mastra-dev",
        destination: "/:locale/docs/server-db/local-dev-playground",
        permanent: true,
      },
      {
        source: "/docs/local-dev/mastra-dev",
        destination: "/en/docs/server-db/local-dev-playground",
        permanent: false,
      },
      {
        source: "/:locale/docs/storage/overview",
        destination: "/:locale/docs/server-db/storage",
        permanent: true,
      },
      {
        source: "/docs/storage/overview",
        destination: "/en/docs/server-db/storage",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/adjust-chunk-delimiters",
        destination: "/:locale/examples/rag/chunking/adjust-chunk-delimiters",
        permanent: true,
      },
      {
        source: "/examples/rag/adjust-chunk-delimiters",
        destination: "/en/examples/rag/chunking/adjust-chunk-delimiters",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/adjust-chunk-size",
        destination: "/:locale/examples/rag/chunking/adjust-chunk-size",
        permanent: true,
      },
      {
        source: "/examples/rag/adjust-chunk-size",
        destination: "/en/examples/rag/chunking/adjust-chunk-size",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/basic-rag",
        destination: "/:locale/examples/rag/usage/basic-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/basic-rag",
        destination: "/en/examples/rag/usage/basic-rag",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/chunk-html",
        destination: "/:locale/examples/rag/chunking/chunk-html",
        permanent: true,
      },
      {
        source: "/examples/rag/chunk-html",
        destination: "/en/examples/rag/chunking/chunk-html",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/chunk-json",
        destination: "/:locale/examples/rag/chunking/chunk-json",
        permanent: true,
      },
      {
        source: "/examples/rag/chunk-json",
        destination: "/en/examples/rag/chunking/chunk-json",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/chunk-markdown",
        destination: "/:locale/examples/rag/chunking/chunk-markdown",
        permanent: true,
      },
      {
        source: "/examples/rag/chunk-markdown",
        destination: "/en/examples/rag/chunking/chunk-markdown",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/chunk-text",
        destination: "/:locale/examples/rag/chunking/chunk-text",
        permanent: true,
      },
      {
        source: "/examples/rag/chunk-text",
        destination: "/en/examples/rag/chunking/chunk-text",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/chunking",
        destination: "/:locale/examples/rag/chunking/chunk-text",
        permanent: true,
      },
      {
        source: "/examples/rag/chunking",
        destination: "/en/examples/rag/chunking/chunk-text",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/cleanup-rag",
        destination: "/:locale/examples/rag/usage/cleanup-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/cleanup-rag",
        destination: "/en/examples/rag/usage/cleanup-rag",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/cot-rag",
        destination: "/:locale/examples/rag/usage/cot-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/cot-rag",
        destination: "/en/examples/rag/usage/cot-rag",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/cot-workflow-rag",
        destination: "/:locale/examples/rag/usage/cot-workflow-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/cot-workflow-rag",
        destination: "/en/examples/rag/usage/cot-workflow-rag",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/embed-text-with-cohere",
        destination: "/:locale/examples/rag/embedding/embed-text-with-cohere",
        permanent: true,
      },
      {
        source: "/examples/rag/embed-text-with-cohere",
        destination: "/en/examples/rag/embedding/embed-text-with-cohere",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/graph-rag",
        destination: "/:locale/examples/rag/usage/graph-rag",
        permanent: true,
      },
      {
        source: "/examples/rag/graph-rag",
        destination: "/en/examples/rag/usage/graph-rag",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/hybrid-vector-search",
        destination: "/:locale/examples/rag/query/hybrid-vector-search",
        permanent: true,
      },
      {
        source: "/examples/rag/hybrid-vector-search",
        destination: "/en/examples/rag/query/hybrid-vector-search",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/insert-embedding-in-libsql",
        destination: "/:locale/reference/rag/libsql",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-libsql",
        destination: "/en/reference/rag/libsql",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/insert-embedding-in-qdrant",
        destination: "/:locale/reference/rag/qdrant",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-qdrant",
        destination: "/en/reference/rag/qdrant",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/insert-embedding-in-upstash",
        destination: "/:locale/reference/rag/upstash",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-upstash",
        destination: "/en/reference/rag/upstash",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/insert-embedding-in-vectorize",
        destination: "/:locale/reference/rag/pg",
        permanent: true,
      },
      {
        source: "/examples/rag/insert-embedding-in-vectorize",
        destination: "/en/reference/rag/pg",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/metadata-extraction",
        destination: "/:locale/examples/rag/embedding/metadata-extraction",
        permanent: true,
      },
      {
        source: "/examples/rag/metadata-extraction",
        destination: "/en/examples/rag/embedding/metadata-extraction",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/query/metadata-extraction",
        destination: "/:locale/examples/rag/embedding/metadata-extraction",
        permanent: true,
      },
      {
        source: "/examples/rag/query/metadata-extraction",
        destination: "/en/examples/rag/embedding/metadata-extraction",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/rerank-rag",
        destination: "/:locale/examples/rag/rerank/rerank",
        permanent: true,
      },
      {
        source: "/examples/rag/rerank-rag",
        destination: "/en/examples/rag/rerank/rerank",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/reranking-with-cohere",
        destination: "/:locale/examples/rag/rerank/reranking-with-cohere",
        permanent: true,
      },
      {
        source: "/examples/rag/reranking-with-cohere",
        destination: "/en/examples/rag/rerank/reranking-with-cohere",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/usage/rerank-rag",
        destination: "/:locale/examples/rag/rerank/rerank",
        permanent: true,
      },
      {
        source: "/examples/rag/usage/rerank-rag",
        destination: "/en/examples/rag/rerank/rerank",
        permanent: false,
      },
      {
        source: "/:locale/examples/rag/retrieve-results",
        destination: "/:locale/examples/rag/query/retrieve-results",
        permanent: true,
      },
      {
        source: "/examples/rag/retrieve-results",
        destination: "/en/examples/rag/query/retrieve-results",
        permanent: false,
      },
      {
        source: "/:locale/examples/voice",
        destination: "/:locale/examples/voice/text-to-speech",
        permanent: true,
      },
      {
        source: "/examples/voice",
        destination: "/en/examples/voice/text-to-speech",
        permanent: false,
      },
      {
        source: "/:locale/examples/workflows/subscribed-steps",
        destination: "/:locale/examples/workflows/agent-and-tool-interop",
        permanent: true,
      },
      {
        source: "/examples/workflows/subscribed-steps",
        destination: "/en/examples/workflows/agent-and-tool-interop",
        permanent: false,
      },
      {
        source: "/:locale/docs/voice/voice-to-voice",
        destination: "/:locale/docs/voice/speech-to-speech",
        permanent: true,
      },
      {
        source: "/docs/voice/voice-to-voice",
        destination: "/en/docs/voice/speech-to-speech",
        permanent: false,
      },
      {
        source: "/:locale/reference/tools/mcp-configuration",
        destination: "/:locale/reference/tools/mcp-client",
        permanent: true,
      },
      {
        source: "/reference/tools/mcp-configuration",
        destination: "/en/reference/tools/mcp-client",
        permanent: false,
      },
      {
        source: "/:locale/reference/observability/create-logger",
        destination: "/:locale/reference/observability/logger",
        permanent: true,
      },
      {
        source: "/reference/observability/create-logger",
        destination: "/en/reference/observability/logger",
        permanent: false,
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
        source: "/examples/evals/word-inclusion",
        destination: "/en/examples/evals/custom-native-javascript-eval",
        permanent: false,
      },
      {
        source: "/:locale/examples/evals/custom-eval",
        destination: "/:locale/examples/evals/custom-llm-judge-eval",
        permanent: true,
      },
      {
        source: "/examples/evals/custom-eval",
        destination: "/en/examples/evals/custom-llm-judge-eval",
        permanent: false,
      },
      {
        source: "/:locale/examples/workflows/agent-and-tool-interop",
        destination: "/:locale/examples/workflows/agent-as-step",
        permanent: true,
      },
      {
        source: "/examples/workflows/agent-and-tool-interop",
        destination: "/en/examples/workflows/agent-as-step",
        permanent: false,
      },
      {
        source: "/:locale/reference/agents/createTool",
        destination: "/:locale/reference/tools/create-tool",
        permanent: true,
      },
      {
        source: "/reference/agents/createTool",
        destination: "/en/reference/tools/create-tool",
        permanent: false,
      },
      {
        source: "/:locale/reference/workflows/start",
        destination: "/:locale/reference/workflows/run-methods/start",
        permanent: true,
      },
      {
        source: "/reference/workflows/start",
        destination: "/en/reference/workflows/run-methods/start",
        permanent: false,
      },
      {
        source: "/:locale/reference/workflows/streamVNext",
        destination: "/:locale/reference/workflows/run-methods/streamVNext",
        permanent: true,
      },
      {
        source: "/reference/workflows/streamVNext",
        destination: "/en/reference/workflows/run-methods/streamVNext",
        permanent: false,
      },
      {
        source: "/:locale/reference/workflows/resume",
        destination: "/:locale/reference/workflows/run-methods/resume",
        permanent: true,
      },
      {
        source: "/reference/workflows/resume",
        destination: "/en/reference/workflows/run-methods/resume",
        permanent: false,
      },
      {
        source: "/:locale/reference/workflows/watch",
        destination: "/:locale/reference/workflows/run-methods/watch",
        permanent: true,
      },
      {
        source: "/reference/workflows/watch",
        destination: "/en/reference/workflows/run-methods/watch",
        permanent: false,
      },
      {
        source: "/:locale/reference/workflows/stream",
        destination: "/:locale/reference/workflows/run-methods/stream",
        permanent: true,
      },
      {
        source: "/reference/workflows/stream",
        destination: "/en/reference/workflows/run-methods/stream",
        permanent: false,
      },
      {
        source: "/:locale/reference/workflows/snapshots",
        destination: "/:locale/docs/server-db/snapshots",
        permanent: true,
      },
      {
        source: "/reference/workflows/snapshots",
        destination: "/en/docs/server-db/snapshots",
        permanent: false,
      },
    ],
    trailingSlash: false,
  }),
);
