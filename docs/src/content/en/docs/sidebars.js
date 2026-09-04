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
      type: 'doc',
      id: 'develop',
      label: 'Develop',
    },
    {
      type: 'category',
      label: 'Build',
      collapsed: false,
      collapsible: false,
      className: 'sidebar-group-name',
      items: [
        {
          type: 'category',
          label: 'Agents',
          link: {
            type: 'doc',
            id: 'agents/overview',
          },
          collapsed: true,
          customProps: {
            contextualSidebar: true,
          },
          items: [
            {
              type: 'doc',
              id: 'agents/tools',
              label: 'Tools',
            },
            {
              type: 'doc',
              id: 'agents/structured-output',
              label: 'Structured Output',
            },
            {
              type: 'doc',
              id: 'agents/human-in-the-loop',
              label: 'Human-in-the-Loop',
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
                tags: ['new'],
              },
            },
          ],
        },
        {
          type: 'category',
          label: 'Workflows',
          link: {
            type: 'doc',
            id: 'workflows/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
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
              id: 'workflows/dynamic-workflows',
              label: 'Dynamic Workflows',
              customProps: {
                tags: ['new'],
              },
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
              label: 'Human-in-the-Loop',
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
          label: 'Harness',
          link: {
            type: 'doc',
            id: 'harness/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
            {
              type: 'doc',
              id: 'harness/durable-agents',
              label: 'Durable Agents',
            },
            {
              type: 'doc',
              id: 'harness/background-tasks',
              label: 'Background Tasks',
            },
            {
              type: 'doc',
              id: 'harness/goals',
              label: 'Goals',
            },
            {
              type: 'doc',
              id: 'harness/schedules',
              label: 'Schedules',
            },
            {
              type: 'doc',
              id: 'harness/signals',
              label: 'Signals',
            },
            {
              type: 'doc',
              id: 'harness/signal-providers',
              label: 'Signal Providers',
            },
            {
              type: 'doc',
              id: 'harness/agent-controller',
              label: 'Agent Controller',
            },
          ],
        },
        {
          type: 'category',
          label: 'Memory',
          link: {
            type: 'doc',
            id: 'memory/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
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
              label: 'Multi-User Threads',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Extend',
      collapsible: false,
      collapsed: false,
      className: 'sidebar-group-name',
      items: [
        {
          type: 'doc',
          id: 'subagents',
          label: 'Subagents',
        },
        {
          type: 'doc',
          id: 'skills',
          label: 'Skills',
        },
        {
          type: 'doc',
          id: 'channels',
          label: 'Channels',
        },
        {
          type: 'category',
          label: 'Sandboxes',
          link: {
            type: 'doc',
            id: 'sandbox/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
            {
              type: 'doc',
              id: 'sandbox/filesystem',
              label: 'Filesystem',
            },
            {
              type: 'doc',
              id: 'sandbox/search',
              label: 'Search',
            },
            {
              type: 'doc',
              id: 'sandbox/skills',
              label: 'Skills',
            },
            {
              type: 'doc',
              id: 'sandbox/computer',
              label: 'Computer',
            },
            {
              type: 'doc',
              id: 'sandbox/lsp',
              label: 'LSP',
            },
          ],
        },
        {
          type: 'doc',
          id: 'browser',
          label: 'Browser',
        },
        {
          type: 'category',
          label: 'Connections',
          link: {
            type: 'doc',
            id: 'connections/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
            {
              type: 'doc',
              id: 'connections/mcp',
              label: 'MCP',
            },
            {
              type: 'doc',
              id: 'connections/a2a',
              label: 'A2A',
            },
            {
              type: 'doc',
              id: 'connections/acp',
              label: 'ACP',
            },
            {
              type: 'doc',
              id: 'connections/sdk-agents',
              label: 'SDK Agents',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Develop / Deploy',
      collapsible: false,
      collapsed: false,
      className: 'sidebar-group-name',
      items: [
        {
          type: 'doc',
          id: 'storage',
          label: 'Storage',
        },
        {
          type: 'category',
          label: 'Server',
          link: {
            type: 'doc',
            id: 'server/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
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
          ],
        },
        {
          type: 'category',
          label: 'Studio',
          link: {
            type: 'doc',
            id: 'studio/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
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
              type: 'doc',
              id: 'studio/editor',
              label: 'Editor',
            },
          ],
        },
        {
          type: 'category',
          label: 'Auth',
          link: {
            type: 'doc',
            id: 'auth/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
            {
              type: 'doc',
              id: 'auth/composite-auth',
              label: 'Composite Auth',
            },
            {
              type: 'doc',
              id: 'auth/custom-auth-provider',
              label: 'Custom Auth Provider',
            },
            {
              type: 'doc',
              id: 'auth/fga',
              label: 'Fine-Grained Authorization',
            },
            {
              type: 'doc',
              id: 'auth/jwt',
              label: 'JSON Web Token',
            },
            {
              type: 'doc',
              id: 'auth/simple-auth',
              label: 'Simple Auth',
            },
            {
              type: 'doc',
              id: 'auth/workers',
              label: 'Workers',
              customProps: {
                tags: ['new'],
              },
            },
          ],
        },
        {
          type: 'category',
          label: 'Deploy',
          link: {
            type: 'doc',
            id: 'deployment/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
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
            {
              type: 'doc',
              id: 'deployment/workers',
              label: 'Workers',
              customProps: {
                tags: ['new'],
              },
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Observe',
      collapsible: false,
      collapsed: false,
      className: 'sidebar-group-name',
      items: [
        {
          type: 'category',
          label: 'Traces',
          link: {
            type: 'doc',
            id: 'observability/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
            {
              type: 'doc',
              id: 'observability/tracing/overview',
              label: 'Usage',
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
              type: 'doc',
              id: 'observability/integrations/exporters/mastra-storage',
              label: 'Storage',
            },
          ],
        },
        {
          type: 'doc',
          id: 'observability/metrics/overview',
          label: 'Metrics',
        },
        {
          type: 'category',
          label: 'Evals',
          link: {
            type: 'doc',
            id: 'evals/overview',
          },
          customProps: {
            contextualSidebar: true,
          },
          items: [
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
              id: 'evals/vitest-integration',
              label: 'Vitest Integration',
            },
            {
              type: 'doc',
              id: 'evals/evals-with-memory',
              label: 'Evals with Memory',
            },
            {
              type: 'doc',
              id: 'evals/datasets',
              label: 'Datasets',
            },
            {
              type: 'doc',
              id: 'evals/experiments',
              label: 'Experiments',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'More',
      collapsed: false,
      collapsible: false,
      className: 'sidebar-group-name',
      items: [
        {
          type: 'category',
          label: 'Guides',
          link: {
            type: 'doc',
            id: 'guides/multi-agent-systems',
          },
          collapsed: true,
          customProps: {
            contextualSidebar: true,
            contextualSidebarLabel: 'Multi-agent systems',
          },
          items: [
            {
              type: 'doc',
              id: 'guides/context-engineering',
              label: 'Context engineering',
              customProps: {
                tags: ['new'],
              },
            },
            {
              type: 'doc',
              id: 'guides/authentication-identity',
              label: 'Authentication',
              customProps: {
                tags: ['new'],
              },
            },
            {
              type: 'doc',
              id: 'guides/streaming',
              label: 'Streaming',
            },
          ],
        },
      ],
    },
  ],
  platformSidebar: [
    {
      type: 'doc',
      id: 'mastra-platform/overview',
      label: 'Overview',
    },
    {
      type: 'doc',
      id: 'mastra-platform/deploy',
      label: 'Deploy',
    },
    {
      type: 'doc',
      id: 'mastra-platform/environments',
      label: 'Environments',
    },
    {
      type: 'doc',
      id: 'mastra-platform/regions',
      label: 'Regions',
    },
    {
      type: 'doc',
      id: 'mastra-platform/observability',
      label: 'Observability',
    },
    {
      type: 'doc',
      id: 'mastra-platform/trace-intelligence',
      label: 'Trace Intelligence',
      customProps: {
        tags: ['new'],
      },
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
    },
    {
      type: 'doc',
      id: 'mastra-platform/database',
      label: 'Hosted databases',
    },
    {
      type: 'doc',
      id: 'mastra-platform/workspaces',
      label: 'Workspaces',
    },
    {
      type: 'doc',
      id: 'mastra-platform/configuration',
      label: 'Configuration',
    },
    { type: 'doc', id: 'mastra-platform/api', label: 'API Reference' },
  ],
}

export default sidebars
