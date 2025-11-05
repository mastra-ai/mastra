/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // Docs sidebar - main documentation
  docsSidebar: [
    "index",
    {
      type: "category",
      label: "Getting Started",
      collapsed: false,
      items: [
        {
          type: "doc",
          id: "getting-started/installation",
          label: "Installation",
        },
        {
          type: "doc",
          id: "getting-started/studio",
          label: "Studio",
        },
        {
          type: "doc",
          id: "getting-started/project-structure",
          label: "Project Structure",
        },
        {
          type: "doc",
          id: "getting-started/mcp-docs-server",
          label: "MCP Docs Server",
        },
        {
          type: "doc",
          id: "getting-started/templates",
          label: "Templates",
        },
      ],
    },
    {
      type: "category",
      label: "Agents",
      items: [
        {
          type: "doc",
          id: "agents/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "agents/using-tools",
          label: "Using Tools",
        },
        {
          type: "doc",
          id: "agents/agent-memory",
          label: "Memory",
        },
        {
          type: "doc",
          id: "agents/networks",
          label: "Networks",
        },
        {
          type: "doc",
          id: "agents/guardrails",
          label: "Guardrails",
        },
        {
          type: "doc",
          id: "agents/adding-voice",
          label: "Adding Voice",
        },
      ],
    },
    {
      type: "category",
      label: "Workflows",
      items: [
        {
          type: "doc",
          id: "workflows/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "workflows/control-flow",
          label: "Control Flow",
        },
        {
          type: "doc",
          id: "workflows/agents-and-tools",
          label: "Agents & Tools",
        },
        {
          type: "doc",
          id: "workflows/suspend-and-resume",
          label: "Suspend & Resume",
        },
        {
          type: "doc",
          id: "workflows/error-handling",
          label: "Error Handling",
        },
        {
          type: "doc",
          id: "workflows/human-in-the-loop",
          label: "Human-in-the-loop",
        },
        {
          type: "doc",
          id: "workflows/snapshots",
          label: "Snapshots",
        },
        {
          type: "doc",
          id: "workflows/inngest-workflow",
          label: "Inngest Workflow",
        },
      ],
    },
    {
      type: "category",
      label: "Streaming",
      items: [
        {
          type: "doc",
          id: "streaming/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "streaming/events",
          label: "Events",
        },
        {
          type: "doc",
          id: "streaming/tool-streaming",
          label: "Tool Streaming",
        },
        {
          type: "doc",
          id: "streaming/workflow-streaming",
          label: "Workflow Streaming",
        },
      ],
    },
    {
      type: "category",
      label: "Tools & MCP",
      collapsed: true,
      items: [
        {
          type: "doc",
          id: "tools-mcp/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "tools-mcp/mcp-overview",
          label: "MCP Overview",
        },
        {
          type: "doc",
          id: "tools-mcp/advanced-usage",
          label: "Advanced Usage",
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
          id: "memory/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "memory/threads-and-resources",
          label: "Threads and Resources",
        },
        {
          type: "doc",
          id: "memory/working-memory",
          label: "Working Memory",
        },
        {
          type: "doc",
          id: "memory/conversation-history",
          label: "Conversation History",
        },
        {
          type: "doc",
          id: "memory/semantic-recall",
          label: "Semantic Recall",
        },
        {
          type: "doc",
          id: "memory/memory-processors",
          label: "Memory Processors",
        },
        {
          type: "category",
          label: "Storage",
          items: [
            {
              type: "doc",
              id: "memory/storage/memory-with-libsql",
              label: "Memory with LibSQL",
            },
            {
              type: "doc",
              id: "memory/storage/memory-with-pg",
              label: "Memory with PostgreSQL",
            },
            {
              type: "doc",
              id: "memory/storage/memory-with-upstash",
              label: "Memory with Upstash",
            },
          ],
        },
      ],
    },
    {
      type: "category",
      label: "RAG",
      items: [
        {
          type: "doc",
          id: "rag/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "rag/chunking-and-embedding",
          label: "Chunking and Embedding",
        },
        {
          type: "doc",
          id: "rag/vector-databases",
          label: "Vector Databases",
        },
        {
          type: "doc",
          id: "rag/retrieval",
          label: "Retrieval",
        },
      ],
    },
    {
      type: "category",
      label: "Server & DB",
      items: [
        {
          type: "doc",
          id: "server-db/production-server",
          label: "Production Server",
        },
        {
          type: "doc",
          id: "server-db/middleware",
          label: "Middleware",
        },
        {
          type: "doc",
          id: "server-db/request-context",
          label: "Request Context",
        },
        {
          type: "doc",
          id: "server-db/custom-api-routes",
          label: "Custom API Routes",
        },
        {
          type: "doc",
          id: "server-db/storage",
          label: "Storage",
        },
        {
          type: "doc",
          id: "server-db/mastra-client",
          label: "Mastra Client",
        },
      ],
    },
    {
      type: "category",
      label: "Deployment",
      items: [
        {
          type: "doc",
          id: "deployment/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "deployment/server-deployment",
          label: "Server deployment",
        },
        {
          type: "doc",
          id: "deployment/monorepo",
          label: "With a Monorepo",
        },
        {
          type: "doc",
          id: "deployment/web-framework",
          label: "With a Web Framework",
        },
        {
          type: "category",
          label: "Serverless Platforms",
          items: [
            {
              type: "doc",
              id: "deployment/serverless-platforms/index",
              label: "Overview",
            },
            {
              type: "doc",
              id: "deployment/serverless-platforms/cloudflare-deployer",
              label: "Cloudflare",
            },
            {
              type: "doc",
              id: "deployment/serverless-platforms/netlify-deployer",
              label: "Netlify",
            },
            {
              type: "doc",
              id: "deployment/serverless-platforms/vercel-deployer",
              label: "Vercel",
            },
          ],
        },
        {
          type: "category",
          label: "Cloud Providers",
          items: [
            {
              type: "doc",
              id: "deployment/cloud-providers/index",
              label: "Overview",
            },
            {
              type: "doc",
              id: "deployment/cloud-providers/amazon-ec2",
              label: "Amazon EC2",
            },
            {
              type: "doc",
              id: "deployment/cloud-providers/aws-lambda",
              label: "AWS Lambda",
            },
            {
              type: "doc",
              id: "deployment/cloud-providers/digital-ocean",
              label: "Digital Ocean",
            },
            {
              type: "doc",
              id: "deployment/cloud-providers/azure-app-services",
              label: "Azure App Services",
            },
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Mastra Cloud",
      items: [
        {
          type: "doc",
          id: "mastra-cloud/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "mastra-cloud/setting-up",
          label: "Setup & Deploy",
        },
        {
          type: "doc",
          id: "mastra-cloud/dashboard",
          label: "Dashboard",
        },
        {
          type: "doc",
          id: "mastra-cloud/observability",
          label: "Observability",
        },
      ],
    },
    {
      type: "doc",
      id: "logging",
      label: "Logging",
    },
    {
      type: "category",
      label: "Observability",
      items: [
        {
          type: "doc",
          id: "observability/overview",
          label: "Overview",
        },
        {
          type: "category",
          label: "Tracing",
          items: [
            {
              type: "doc",
              id: "observability/tracing/overview",
              label: "Overview",
            },
            {
              type: "category",
              label: "Exporters",
              items: [
                {
                  type: "doc",
                  id: "observability/tracing/exporters/default",
                  label: "Default",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/cloud",
                  label: "Cloud",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/arize",
                  label: "Arize",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/braintrust",
                  label: "Braintrust",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/langfuse",
                  label: "Langfuse",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/langsmith",
                  label: "LangSmith",
                },
                {
                  type: "doc",
                  id: "observability/tracing/exporters/otel",
                  label: "OpenTelemetry",
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
      ],
    },
    {
      type: "category",
      label: "Evals",
      items: [
        {
          type: "doc",
          id: "evals/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "evals/off-the-shelf-scorers",
          label: "Off the Shelf Scorers",
        },
        {
          type: "doc",
          id: "evals/custom-scorers",
          label: "Custom Scorers",
        },
        {
          type: "doc",
          id: "evals/running-in-ci",
          label: "Running in CI",
        },
      ],
    },
    {
      type: "category",
      label: "Auth",
      items: [
        {
          type: "doc",
          id: "auth/index",
          label: "Overview",
        },
        {
          type: "doc",
          id: "auth/jwt",
          label: "JSON Web Token",
        },
        {
          type: "doc",
          id: "auth/clerk",
          label: "Clerk",
        },
        {
          type: "doc",
          id: "auth/supabase",
          label: "Supabase",
        },
        {
          type: "doc",
          id: "auth/firebase",
          label: "Firebase",
        },
        {
          type: "doc",
          id: "auth/workos",
          label: "WorkOS",
        },
        {
          type: "doc",
          id: "auth/auth0",
          label: "Auth0",
        },
      ],
    },
    {
      type: "category",
      label: "Voice",
      items: [
        {
          type: "doc",
          id: "voice/overview",
          label: "Overview",
        },
        {
          type: "doc",
          id: "voice/text-to-speech",
          label: "Text to Speech",
        },
        {
          type: "doc",
          id: "voice/speech-to-text",
          label: "Speech to Text",
        },
        {
          type: "doc",
          id: "voice/speech-to-speech",
          label: "Speech to Speech",
        },
      ],
    },
    {
      type: "category",
      label: "Frameworks",
      items: [
        {
          type: "category",
          label: "Agentic UIs",
          items: [
            {
              type: "doc",
              id: "frameworks/agentic-uis/ai-sdk",
              label: "With Vercel AI SDK",
            },
            {
              type: "doc",
              id: "frameworks/agentic-uis/copilotkit",
              label: "With CopilotKit",
            },
            {
              type: "doc",
              id: "frameworks/agentic-uis/assistant-ui",
              label: "With Assistant UI",
            },
            {
              type: "doc",
              id: "frameworks/agentic-uis/cedar-os",
              label: "With Cedar-OS",
            },
            {
              type: "doc",
              id: "frameworks/agentic-uis/openrouter",
              label: "With OpenRouter",
            },
          ],
        },
        {
          type: "category",
          label: "Servers",
          items: [
            {
              type: "doc",
              id: "frameworks/servers/express",
              label: "With Express",
            },
          ],
        },
        {
          type: "category",
          label: "Web Frameworks",
          items: [
            {
              type: "doc",
              id: "frameworks/web-frameworks/vite-react",
              label: "With Vite/React",
            },
            {
              type: "doc",
              id: "frameworks/web-frameworks/next-js",
              label: "With Next.js",
            },
            {
              type: "doc",
              id: "frameworks/web-frameworks/astro",
              label: "With Astro",
            },
            {
              type: "doc",
              id: "frameworks/web-frameworks/sveltekit",
              label: "With SvelteKit",
            },
          ],
        },
      ],
    },
    {
      type: "category",
      label: "Community",
      items: [
        {
          type: "doc",
          id: "community/contributing-templates",
          label: "Contributing Templates",
        },
        {
          type: "doc",
          id: "community/licensing",
          label: "License",
        },
        {
          type: "doc",
          id: "community/discord",
          label: "Discord",
        },
      ],
    },
  ],
};

export default sidebars;
