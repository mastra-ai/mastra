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
              id: "migrations/upgrade-to-v1/mastra",
              type: "doc",
              label: "Mastra",
            },
            {
              id: "migrations/upgrade-to-v1/agent",
              type: "doc",
              label: "Agents",
            },
            {
              id: "migrations/upgrade-to-v1/memory",
              type: "doc",
              label: "Memory",
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
