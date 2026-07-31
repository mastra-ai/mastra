/**
 * Sidebar for Docs.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Introduction',
      collapsed: false,
      collapsible: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
        { type: 'doc', id: 'index', label: 'Getting Started' },
        { type: 'doc', id: 'build-with-ai', label: 'Build with AI' },
      ],
    },
    {
      type: 'category',
      label: 'Build',
      collapsed: false,
      collapsible: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
        { type: 'doc', id: 'agents', label: 'Agents' },
        { type: 'doc', id: 'workflows', label: 'Workflows' },
        { type: 'doc', id: 'harness', label: 'Harness' },
        { type: 'doc', id: 'memory', label: 'Memory' },
      ],
    },
    {
      type: 'category',
      label: 'Extend',
      collapsed: false,
      collapsible: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
        { type: 'doc', id: 'extend', label: 'Skills' },
        { type: 'doc', id: 'sandboxes', label: 'Sandboxes' },
        { type: 'doc', id: 'browser', label: 'Browser' },
        { type: 'doc', id: 'channels', label: 'Channels' },
        { type: 'doc', id: 'subagents', label: 'Subagents' },
        { type: 'doc', id: 'tools', label: 'Tools' },
        { type: 'doc', id: 'mcp', label: 'MCP' },
      ],
    },
    {
      type: 'category',
      label: 'Develop / Deploy',
      collapsed: false,
      collapsible: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
        { type: 'doc', id: 'develop-deploy', label: 'Local development' },
        { type: 'doc', id: 'deploy', label: 'Deploy' },
        { type: 'doc', id: 'storage', label: 'Storage' },
      ],
    },
    {
      type: 'category',
      label: 'Observe',
      collapsed: false,
      collapsible: false,
      customProps: {
        displayAsGroup: true,
      },
      items: [
        { type: 'doc', id: 'observe', label: 'Tracing' },
        { type: 'doc', id: 'metrics', label: 'Metrics' },
        { type: 'doc', id: 'evals', label: 'Evals' },
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
          id: 'mastra-platform/trace-intelligence',
          label: 'Trace Intelligence',
          customProps: {
            tags: ['beta'],
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
