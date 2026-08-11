/**
 * Sidebar for Guides
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guidesSidebar: [
    'index',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'getting-started/quickstart',
          label: 'Quickstart',
        },
        {
          type: 'doc',
          id: 'getting-started/manual-install',
          label: 'Manual Install',
        },
      ],
    },
    {
      type: 'category',
      label: 'Capabilities',
      collapsed: false,
      items: [
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
      ],
    },
    {
      type: 'category',
      label: 'Agent Frameworks',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'agent-frameworks/ai-sdk',
          label: 'AI SDK',
        },
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      collapsed: true,
      items: [
        {
          type: 'html',
          value: '<a class="menu__link" href="/docs/mastra-platform/server"><span>Mastra platform</span></a>',
        },
        {
          type: 'doc',
          id: 'deployment/mastra-workers',
          label: 'Mastra Workers',
          customProps: {
            tags: ['new'],
          },
        },
      ],
    },
    {
      type: 'category',
      label: 'Tutorials',
      collapsed: true,
      items: [
        {
          type: 'category',
          label: 'Fundamentals',
          items: [
            {
              type: 'doc',
              id: 'guide/ai-recruiter',
              label: 'Workflows: AI Recruiter',
            },
            {
              type: 'doc',
              id: 'guide/research-assistant',
              label: 'RAG: Research Assistant',
            },
            {
              type: 'doc',
              id: 'guide/notes-mcp-server',
              label: 'MCP Server: Notes MCP Server',
            },
            {
              type: 'doc',
              id: 'guide/signal-provider',
              label: 'Signals: CI Signal Provider',
            },
          ],
        },
        {
          type: 'category',
          label: 'Multi-agent systems',
          items: [
            {
              type: 'doc',
              id: 'guide/research-coordinator',
              label: 'Supervisor Agents: Research Coordinator',
            },
          ],
        },
        {
          type: 'category',
          label: 'Workspaces',
          items: [
            {
              type: 'doc',
              id: 'guide/dev-assistant',
              label: 'Workspace: Dev Assistant',
            },
            {
              type: 'doc',
              id: 'guide/code-review-bot',
              label: 'Skills: Code Review Bot',
            },
            {
              type: 'doc',
              id: 'guide/docs-manager',
              label: 'Filesystem: Docs Manager',
            },
          ],
        },
        {
          type: 'doc',
          id: 'guide/coding-agent',
          label: 'Building a Coding Agent',
        },
        {
          type: 'doc',
          id: 'guide/github-actions-pr-description',
          label: 'GitHub Actions: PR Description',
        },
      ],
    },
  ],
}

export default sidebars
