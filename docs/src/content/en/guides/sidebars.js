/**
 * Sidebar for Guides
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guidesSidebar: [
    "index",
    {
      type: "category",
      label: "Guides",
      collapsed: false,
      items: [
        {
          type: "doc",
          id: "guide/chef-michel",
          label: "Agents: Chef Michel",
        },
        {
          type: "doc",
          id: "guide/stock-agent",
          label: "Tools: Stock Agent",
        },
        {
          type: "doc",
          id: "guide/ai-recruiter",
          label: "Workflows: AI Recruiter",
        },
        {
          type: "doc",
          id: "guide/research-assistant",
          label: "RAG: Research Assistant",
        },
        {
          type: "doc",
          id: "guide/notes-mcp-server",
          label: "MCP Server: Notes MCP Server",
        },
        {
          type: "doc",
          id: "guide/web-search",
          label: "Tools: Web Search",
        },
      ],
    },
    {
      type: "category",
      label: "Migrations",
      collapsed: false,
      items: [
        {
          type: "category",
          label: "v1.0",
          items: [
            {
              id: "migrations/upgrade-to-v1/overview",
              type: "doc",
              label: "Overview",
            },
            {
              id: "migrations/upgrade-to-v1/agent",
              type: "doc",
              label: "Agents",
            },
            {
              id: "migrations/upgrade-to-v1/cli",
              type: "doc",
              label: "CLI",
            },
            {
              id: "migrations/upgrade-to-v1/client",
              type: "doc",
              label: "Client SDK",
            },
            {
              id: "migrations/upgrade-to-v1/evals",
              type: "doc",
              label: "Evals",
            },
            {
              id: "migrations/upgrade-to-v1/mastra",
              type: "doc",
              label: "Mastra",
            },
            {
              id: "migrations/upgrade-to-v1/mcp",
              type: "doc",
              label: "MCP",
            },
            {
              id: "migrations/upgrade-to-v1/memory",
              type: "doc",
              label: "Memory",
            },
            {
              id: "migrations/upgrade-to-v1/processors",
              type: "doc",
              label: "Processors",
            },
            {
              id: "migrations/upgrade-to-v1/storage",
              type: "doc",
              label: "Storage",
            },
            {
              id: "migrations/upgrade-to-v1/tools",
              type: "doc",
              label: "Tools",
            },
            {
              id: "migrations/upgrade-to-v1/tracing",
              type: "doc",
              label: "Tracing",
            },
            {
              id: "migrations/upgrade-to-v1/vectors",
              type: "doc",
              label: "Vectors",
            },
            {
              id: "migrations/upgrade-to-v1/voice",
              type: "doc",
              label: "Voice",
            },
            {
              id: "migrations/upgrade-to-v1/workflows",
              type: "doc",
              label: "Workflows",
            },
          ],
        },
        {
          type: "doc",
          id: "migrations/vnext-to-standard-apis",
          label: "VNext to Standard APIs",
        },
        {
          type: "doc",
          id: "migrations/agentnetwork",
          label: "AgentNetwork to .network()",
        },
      ],
    },
  ],
};

export default sidebars;
