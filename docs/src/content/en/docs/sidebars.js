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
      label: 'Essentials',
      collapsible: false,
      collapsed: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
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
        {
          type: 'doc',
          id: 'storage/overview',
          label: 'Storage',
        },
        {
          type: 'doc',
          id: 'getting-started/file-based-agents',
          label: 'File-based Agents',
          customProps: {
            tags: ['beta'],
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'Core',
      collapsed: false,
      collapsible: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
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
              type: 'doc',
              id: 'agents/skills',
              label: 'Skills',
            },
            {
              type: 'doc',
              id: 'agents/structured-output',
              label: 'Structured Output',
            },
            {
              type: 'doc',
              id: 'agents/agent-approval',
              label: 'Agent Approval',
            },
            {
              type: 'doc',
              id: 'agents/supervisor-agents',
              label: 'Supervisor Agents',
            },
            {
              type: 'doc',
              id: 'agents/guardrails',
              label: 'Guardrails',
            },
            {
              type: 'doc',
              id: 'agents/processors',
              label: 'Processors',
            },
            {
              type: 'doc',
              id: 'agents/code-mode',
              label: 'Code Mode',
              customProps: {
                tags: ['beta'],
              },
            },
            {
              type: 'category',
              label: 'Connections',
              items: [
                {
                  type: 'doc',
                  id: 'agents/a2a',
                  label: 'A2A',
                },
                {
                  type: 'doc',
                  id: 'agents/acp',
                  label: 'ACP',
                },
                {
                  type: 'doc',
                  id: 'agents/sdk-agents',
                  label: 'SDK Agents',
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
                      id: 'mcp/mcp-apps',
                      label: 'MCP Apps',
                    },
                  ],
                },
              ],
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
              label: 'Agents and Tools',
            },
            {
              type: 'doc',
              id: 'workflows/snapshots',
              label: 'Snapshots',
            },
            {
              type: 'doc',
              id: 'workflows/suspend-and-resume',
              label: 'Suspend and Resume',
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
            {
              type: 'doc',
              id: 'workflows/scheduled-workflows',
              label: 'Scheduled Workflows',
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
              id: 'memory/message-history',
              label: 'Message History',
            },
            {
              type: 'doc',
              id: 'memory/observational-memory',
              label: 'Observational Memory',
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
            {
              type: 'doc',
              id: 'memory/multi-user-threads',
              label: 'Multi-user Threads',
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
            {
              type: 'category',
              label: 'Agent Builder',
              customProps: {
                tags: ['new'],
              },
              items: [
                { type: 'doc', id: 'agent-builder/overview', label: 'Overview' },
                { type: 'doc', id: 'agent-builder/configuration', label: 'Configuration' },
                { type: 'doc', id: 'agent-builder/access-control', label: 'Access control' },
                { type: 'doc', id: 'agent-builder/model-policy', label: 'Model policy' },
                { type: 'doc', id: 'agent-builder/memory', label: 'Memory' },
                { type: 'doc', id: 'agent-builder/workspace', label: 'Workspace' },
                { type: 'doc', id: 'agent-builder/browser', label: 'Browser' },
                { type: 'doc', id: 'agent-builder/channels', label: 'Channels' },
                { type: 'doc', id: 'agent-builder/integrations', label: 'Tool providers' },
                { type: 'doc', id: 'agent-builder/skill-registries', label: 'Skill registries' },
                { type: 'doc', id: 'agent-builder/deploying', label: 'Deploying' },
              ],
            },
            {
              type: 'category',
              label: 'Editor',
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
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Capabilities',
      collapsible: false,
      collapsed: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
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
              id: 'browser/firecrawl',
              label: 'Firecrawl',
            },
            {
              type: 'doc',
              id: 'browser/recording',
              label: 'Recording',
              customProps: {
                tags: ['beta'],
              },
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
          label: 'Channels',
          items: [
            {
              type: 'doc',
              id: 'capabilities/channels/overview',
              label: 'Overview',
            },
            {
              type: 'doc',
              id: 'capabilities/channels/slack',
              label: 'Slack',
            },
            {
              type: 'doc',
              id: 'capabilities/channels/teams',
              label: 'Microsoft Teams',
            },
            {
              type: 'doc',
              id: 'capabilities/channels/discord',
              label: 'Discord',
            },
            {
              type: 'doc',
              id: 'capabilities/channels/telegram',
              label: 'Telegram',
            },
            {
              type: 'doc',
              id: 'capabilities/channels/whatsapp',
              label: 'WhatsApp',
            },
            {
              type: 'doc',
              id: 'capabilities/channels/other-adapters',
              label: 'More',
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
            {
              type: 'doc',
              id: 'voice/livekit',
              label: 'LiveKit',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Long-running Agents',
      collapsible: false,
      collapsed: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
        {
          type: 'doc',
          id: 'long-running-agents/durable-agents',
          label: 'Durable Agents',
          customProps: {
            tags: ['beta'],
          },
        },
        {
          type: 'doc',
          id: 'long-running-agents/background-tasks',
          label: 'Background Tasks',
        },
        {
          type: 'doc',
          id: 'long-running-agents/goals',
          label: 'Goals',
          customProps: {
            tags: ['beta'],
          },
        },
        {
          type: 'doc',
          id: 'long-running-agents/schedules',
          label: 'Schedules',
          customProps: {
            tags: ['beta'],
          },
        },
        {
          type: 'doc',
          id: 'long-running-agents/signals',
          label: 'Signals',
          customProps: {
            tags: ['beta'],
          },
        },
        {
          type: 'doc',
          id: 'long-running-agents/signal-providers',
          label: 'Signal Providers',
          customProps: {
            tags: ['beta'],
          },
        },
        {
          type: 'category',
          label: 'Agent Controller',
          customProps: {
            tags: ['beta'],
          },
          items: [
            {
              type: 'doc',
              id: 'agent-controller/overview',
              label: 'Overview',
            },
            {
              type: 'doc',
              id: 'agent-controller/session',
              label: 'Session',
            },
            {
              type: 'doc',
              id: 'agent-controller/modes',
              label: 'Modes',
            },
            {
              type: 'doc',
              id: 'agent-controller/threads-and-state',
              label: 'Threads and State',
            },
            {
              type: 'doc',
              id: 'agent-controller/subagents',
              label: 'Subagents',
            },
            {
              type: 'doc',
              id: 'agent-controller/tool-approvals',
              label: 'Tool Approvals',
            },
            {
              type: 'doc',
              id: 'agent-controller/channels',
              label: 'Channels',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Production',
      collapsible: false,
      collapsed: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
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
              id: 'server/pubsub',
              label: 'PubSub',
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
                  id: 'server/auth/fga',
                  label: 'Fine-Grained Authorization',
                },
                {
                  type: 'doc',
                  id: 'server/auth/google',
                  label: 'Google',
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
              id: 'observability/config',
              label: 'Config',
            },
            {
              type: 'doc',
              id: 'observability/storage',
              label: 'Storage',
            },
            {
              type: 'doc',
              id: 'observability/logging',
              label: 'Logging',
            },
            {
              type: 'doc',
              id: 'observability/feedback',
              label: 'Feedback',
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
                {
                  type: 'doc',
                  id: 'observability/metrics/querying',
                  label: 'Querying metrics',
                },
              ],
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
              ],
            },
            {
              type: 'category',
              label: 'Integrations',
              items: [
                {
                  type: 'doc',
                  id: 'observability/integrations/overview',
                  label: 'Overview',
                },
                {
                  type: 'category',
                  label: 'Bridges',
                  items: [
                    {
                      type: 'doc',
                      id: 'observability/integrations/bridges/datadog',
                      label: 'Datadog',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/bridges/otel',
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
                      id: 'observability/integrations/exporters/mastra-storage',
                      label: 'Mastra Storage',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/mastra-platform',
                      label: 'Mastra platform',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/arize',
                      label: 'Arize',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/arthur',
                      label: 'Arthur',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/braintrust',
                      label: 'Braintrust',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/datadog',
                      label: 'Datadog',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/laminar',
                      label: 'Laminar',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/langfuse',
                      label: 'Langfuse',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/langsmith',
                      label: 'LangSmith',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/otel',
                      label: 'OpenTelemetry',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/posthog',
                      label: 'PostHog',
                    },
                    {
                      type: 'doc',
                      id: 'observability/integrations/exporters/sentry',
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
                      id: 'observability/integrations/processors/sensitive-data-filter',
                      label: 'SensitiveDataFilter',
                    },
                  ],
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
              id: 'evals/quick-checks',
              label: 'Quick Checks',
            },
            {
              type: 'doc',
              id: 'evals/gates-and-verdicts',
              label: 'Gates and Verdicts',
            },
            {
              type: 'doc',
              id: 'evals/multi-turn',
              label: 'Multi-turn Evals',
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
              type: 'doc',
              id: 'evals/evals-with-memory',
              label: 'Evals with Memory',
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
              id: 'deployment/sandbox',
              label: 'Sandbox',
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
      ],
    },
  ],
  platformSidebar: [
    {
      type: 'category',
      label: 'Mastra platform',
      items: [
        {
          type: 'doc',
          id: 'mastra-platform/overview',
          label: 'Overview',
        },
        {
          type: 'doc',
          id: 'mastra-platform/deploy',
          label: 'Deploy',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'mastra-platform/environments',
          label: 'Environments',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'mastra-platform/regions',
          label: 'Regions',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'mastra-platform/observability',
          label: 'Observability',
        },
        {
          type: 'doc',
          id: 'mastra-platform/studio',
          label: 'Studio',
        },
        {
          type: 'doc',
          id: 'mastra-platform/server',
          label: 'Server',
        },
        {
          type: 'doc',
          id: 'mastra-platform/github',
          label: 'GitHub integration',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'mastra-platform/database',
          label: 'Hosted databases',
        },
        {
          type: 'doc',
          id: 'mastra-platform/workspace',
          label: 'Workspace',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'mastra-platform/configuration',
          label: 'Configuration',
        },
      ],
    },
  ],
}

export default sidebars
