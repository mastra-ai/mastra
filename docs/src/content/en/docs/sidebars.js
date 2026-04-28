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
    {
      type: 'doc',
      id: 'index',
      label: 'Get Started',
    },
    {
      type: 'category',
      label: 'Fundamentals',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'getting-started/project-structure',
          label: 'Project Structure',
        },
        {
          type: 'doc',
          id: 'getting-started/manual-install',
          label: 'Manual Install',
        },
        {
          type: 'doc',
          id: 'getting-started/build-with-ai',
          label: 'Build with AI',
        },
      ],
    },
    {
      type: 'category',
      label: 'Studio',
      items: [
        {
          type: 'doc',
          id: 'studio/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'studio/deployment',
          label: 'Deployment',
        },
        {
          type: 'doc',
          id: 'studio/auth',
          label: 'Auth',
        },
        {
          type: 'doc',
          id: 'studio/observability',
          label: 'Observability',
        },
      ],
    },
    {
      type: 'category',
      label: 'Agents',
      items: [
        {
          type: 'doc',
          id: 'agents/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'agents/using-tools',
          label: 'Tools',
        },
        {
          type: 'html',
          value: '<a class="menu__link" href="/docs/memory/overview"><span>Memory</span></a>',
        },
        {
          type: 'doc',
          id: 'agents/structured-output',
          label: 'Structured Output',
        },
        {
          type: 'doc',
          id: 'agents/supervisor-agents',
          label: 'Supervisor Agents',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'agents/background-tasks',
          label: 'Background Tasks',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'agents/processors',
          label: 'Processors',
        },
        {
          type: 'doc',
          id: 'agents/guardrails',
          label: 'Guardrails',
        },
        {
          type: 'doc',
          id: 'agents/agent-approval',
          label: 'Agent Approval',
        },
        {
          type: 'doc',
          id: 'agents/adding-voice',
          label: 'Voice',
        },
        {
          type: 'doc',
          id: 'agents/channels',
          label: 'Channels',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'agents/networks',
          label: 'Networks',
          customProps: {
            tags: ['deprecated'],
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'Memory',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'memory/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'memory/storage',
          label: 'Storage',
        },
        {
          type: 'doc',
          id: 'memory/message-history',
          label: 'Message History',
        },
        {
          type: 'doc',
          id: 'memory/observational-memory',
          label: 'Observational Memory',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'memory/working-memory',
          label: 'Working Memory',
        },
        {
          type: 'doc',
          id: 'memory/semantic-recall',
          label: 'Semantic Recall',
        },
        {
          type: 'doc',
          id: 'memory/memory-processors',
          label: 'Memory Processors',
        },
      ],
    },
    {
      type: 'category',
      label: 'Workflows',
      items: [
        {
          type: 'doc',
          id: 'workflows/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'workflows/workflow-state',
          label: 'Workflow State',
        },
        {
          type: 'doc',
          id: 'workflows/control-flow',
          label: 'Control Flow',
        },
        {
          type: 'doc',
          id: 'workflows/agents-and-tools',
          label: 'Agents & Tools',
        },
        {
          type: 'doc',
          id: 'workflows/snapshots',
          label: 'Snapshots',
        },
        {
          type: 'doc',
          id: 'workflows/suspend-and-resume',
          label: 'Suspend & Resume',
        },
        {
          type: 'doc',
          id: 'workflows/human-in-the-loop',
          label: 'Human-in-the-loop',
        },
        {
          type: 'doc',
          id: 'workflows/time-travel',
          label: 'Time Travel',
        },
        {
          type: 'doc',
          id: 'workflows/error-handling',
          label: 'Error Handling',
        },
      ],
    },
    {
      type: 'category',
      label: 'Editor',
      customProps: {
        tags: ['new'],
      },
      items: [
        {
          type: 'doc',
          id: 'editor/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'editor/tools',
          label: 'Tools',
        },
        {
          type: 'doc',
          id: 'editor/prompts',
          label: 'Prompts',
        },
      ],
    },
    {
      type: 'category',
      label: 'Streaming',
      items: [
        {
          type: 'doc',
          id: 'streaming/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'streaming/events',
          label: 'Events',
        },
        {
          type: 'doc',
          id: 'streaming/tool-streaming',
          label: 'Tool Streaming',
        },
        {
          type: 'doc',
          id: 'streaming/workflow-streaming',
          label: 'Workflow Streaming',
        },
        {
          type: 'doc',
          id: 'streaming/background-task-streaming',
          label: 'Background Task Streaming',
          customProps: {
            tags: ['new'],
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'MCP',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'mcp/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'mcp/publishing-mcp-server',
          label: 'Publishing an MCP Server',
        },
      ],
    },
    {
      type: 'category',
      label: 'Workspaces',
      items: [
        {
          type: 'doc',
          id: 'workspace/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'workspace/filesystem',
          label: 'Filesystem',
        },
        {
          type: 'doc',
          id: 'workspace/sandbox',
          label: 'Sandbox',
        },
        {
          type: 'doc',
          id: 'workspace/lsp',
          label: 'LSP Inspection',
        },
        {
          type: 'doc',
          id: 'workspace/skills',
          label: 'Skills',
        },
        {
          type: 'doc',
          id: 'workspace/search',
          label: 'Search and Indexing',
        },
      ],
    },
    {
      type: 'category',
      label: 'Browser',
      customProps: {
        tags: ['new'],
      },
      items: [
        {
          type: 'doc',
          id: 'browser/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'browser/agent-browser',
          label: 'AgentBrowser',
        },
        {
          type: 'doc',
          id: 'browser/stagehand',
          label: 'Stagehand',
        },
        {
          type: 'doc',
          id: 'browser/browser-viewer',
          label: 'BrowserViewer',
        },
      ],
    },
    {
      type: 'category',
      label: 'Server',
      items: [
        {
          type: 'doc',
          id: 'server/mastra-server',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'server/server-adapters',
          label: 'Server Adapters',
        },
        {
          type: 'doc',
          id: 'server/custom-adapters',
          label: 'Custom Adapters',
        },
        {
          type: 'doc',
          id: 'server/middleware',
          label: 'Middleware',
        },
        {
          type: 'doc',
          id: 'server/request-context',
          label: 'Request Context',
        },
        {
          type: 'doc',
          id: 'server/custom-api-routes',
          label: 'Custom API Routes',
        },
        {
          type: 'doc',
          id: 'server/mastra-client',
          label: 'Mastra Client',
        },
        {
          type: 'category',
          label: 'Auth',
          items: [
            {
              type: 'doc',
              id: 'server/auth/index',
              label: 'Overview',
            },
            {
              type: 'doc',
              id: 'server/auth/auth0',
              label: 'Auth0',
            },
            {
              type: 'doc',
              id: 'server/auth/better-auth',
              label: 'Better Auth',
            },
            {
              type: 'doc',
              id: 'server/auth/clerk',
              label: 'Clerk',
            },
            {
              type: 'doc',
              id: 'server/auth/composite-auth',
              label: 'Composite Auth',
            },
            {
              type: 'doc',
              id: 'server/auth/custom-auth-provider',
              label: 'Custom Auth Provider',
            },
            {
              type: 'doc',
              id: 'server/auth/firebase',
              label: 'Firebase',
            },
            {
              type: 'doc',
              id: 'server/auth/jwt',
              label: 'JSON Web Token',
            },
            {
              type: 'doc',
              id: 'server/auth/okta',
              label: 'Okta',
            },
            {
              type: 'doc',
              id: 'server/auth/simple-auth',
              label: 'Simple Auth',
            },
            {
              type: 'doc',
              id: 'server/auth/supabase',
              label: 'Supabase',
            },
            {
              type: 'doc',
              id: 'server/auth/workos',
              label: 'WorkOS',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      items: [
        {
          type: 'doc',
          id: 'deployment/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'deployment/mastra-server',
          label: 'Mastra Server',
        },
        {
          type: 'doc',
          id: 'deployment/monorepo',
          label: 'Monorepo',
        },
        {
          type: 'doc',
          id: 'deployment/cloud-providers',
          label: 'Cloud Providers',
        },
        {
          type: 'doc',
          id: 'deployment/web-framework',
          label: 'Web Framework',
        },
        {
          type: 'doc',
          id: 'deployment/workflow-runners',
          label: 'Workflow Runners',
        },
      ],
    },
    {
      type: 'category',
      label: 'Observability',
      items: [
        {
          type: 'doc',
          id: 'observability/overview',
          key: 'observability.overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'observability/logging',
          label: 'Logging',
        },
        {
          type: 'category',
          label: 'Tracing',
          items: [
            {
              type: 'doc',
              id: 'observability/tracing/overview',
              key: 'observability.tracing.overview',
              label: 'Overview',
            },
            {
              type: 'category',
              label: 'Bridges',
              items: [
                {
                  type: 'doc',
                  id: 'observability/tracing/bridges/otel',
                  label: 'OpenTelemetry',
                },
              ],
            },
            {
              type: 'category',
              label: 'Exporters',
              items: [
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/default',
                  label: 'Default',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/cloud',
                  label: 'Cloud',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/arize',
                  label: 'Arize',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/arthur',
                  label: 'Arthur',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/braintrust',
                  label: 'Braintrust',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/datadog',
                  label: 'Datadog',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/laminar',
                  label: 'Laminar',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/langfuse',
                  label: 'Langfuse',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/langsmith',
                  label: 'LangSmith',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/otel',
                  label: 'OpenTelemetry',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/posthog',
                  label: 'PostHog',
                },
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/sentry',
                  label: 'Sentry',
                },
              ],
            },
            {
              type: 'category',
              label: 'Processors',
              items: [
                {
                  type: 'doc',
                  id: 'observability/tracing/processors/sensitive-data-filter',
                  label: 'SensitiveDataFilter',
                },
              ],
            },
          ],
        },
        {
          type: 'category',
          label: 'Metrics',
          items: [
            {
              type: 'doc',
              id: 'observability/metrics/overview',
              label: 'Overview',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Evals',
      items: [
        {
          type: 'doc',
          id: 'evals/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'evals/built-in-scorers',
          label: 'Built-in Scorers',
        },
        {
          type: 'doc',
          id: 'evals/custom-scorers',
          label: 'Custom Scorers',
        },
        {
          type: 'doc',
          id: 'evals/running-in-ci',
          label: 'Running in CI',
        },
        {
          type: 'category',
          label: 'Datasets',
          items: [
            {
              type: 'doc',
              id: 'evals/datasets/overview',
              label: 'Overview',
            },
            {
              type: 'doc',
              id: 'evals/datasets/running-experiments',
              label: 'Running Experiments',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Mastra Platform',
      customProps: {
        tags: ['new'],
      },
      items: [
        {
          type: 'doc',
          id: 'mastra-platform/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'mastra-platform/configuration',
          label: 'Configuration',
        },
      ],
    },
    {
      type: 'category',
      label: 'RAG',
      items: [
        {
          type: 'doc',
          id: 'rag/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'rag/chunking-and-embedding',
          label: 'Chunking and Embedding',
        },
        {
          type: 'doc',
          id: 'rag/vector-databases',
          label: 'Vector Databases',
        },
        {
          type: 'doc',
          id: 'rag/retrieval',
          label: 'Retrieval',
        },
        {
          type: 'doc',
          id: 'rag/graph-rag',
          label: 'GraphRAG',
        },
      ],
    },
    {
      type: 'category',
      label: 'Voice',
      items: [
        {
          type: 'doc',
          id: 'voice/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'voice/text-to-speech',
          label: 'Text to Speech',
        },
        {
          type: 'doc',
          id: 'voice/speech-to-text',
          label: 'Speech to Text',
        },
        {
          type: 'doc',
          id: 'voice/speech-to-speech',
          label: 'Speech to Speech',
        },
      ],
    },
    {
      type: 'category',
      label: 'Build with AI',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'build-with-ai/skills',
          label: 'Skills',
        },
        {
          type: 'doc',
          id: 'build-with-ai/mcp-docs-server',
          label: 'MCP Docs Server',
        },
      ],
    },
    {
      type: 'category',
      label: 'Community',
      items: [
        {
          type: 'doc',
          id: 'community/contributing-templates',
          label: 'Contributing Templates',
        },
        {
          type: 'doc',
          id: 'community/licensing',
          label: 'License',
        },
        {
          type: 'doc',
          id: 'community/discord',
          label: 'Discord',
        },
      ],
    },
  ],
}

export default sidebars
