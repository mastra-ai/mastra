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
          id: 'getting-started/next-js',
          label: 'Next.js',
        },
        {
          type: 'doc',
          id: 'getting-started/vite-react',
          label: 'React',
        },
        {
          type: 'doc',
          id: 'getting-started/astro',
          label: 'Astro',
        },
        {
          type: 'doc',
          id: 'getting-started/sveltekit',
          label: 'SvelteKit',
        },
        {
          type: 'doc',
          id: 'getting-started/nuxt',
          label: 'Nuxt',
        },
        {
          type: 'doc',
          id: 'getting-started/express',
          label: 'Express',
        },
        {
          type: 'doc',
          id: 'getting-started/hono',
          label: 'Hono',
        },
        {
          type: 'doc',
          id: 'getting-started/electron',
          label: 'Electron',
        },
      ],
    },
    {
      type: 'category',
      label: 'Agent Frameworks',
      collapsed: false,
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
      label: 'Agentic UIs',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'build-your-ui/ai-sdk-ui',
          label: 'AI SDK UI',
        },
        {
          type: 'doc',
          id: 'build-your-ui/copilotkit',
          label: 'CopilotKit',
        },
        {
          type: 'doc',
          id: 'build-your-ui/assistant-ui',
          label: 'Assistant UI',
        },
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'deployment/amazon-ec2',
          label: 'Amazon EC2',
        },
        {
          type: 'doc',
          id: 'deployment/aws-lambda',
          label: 'AWS Lambda',
        },
        {
          type: 'doc',
          id: 'deployment/azure-app-services',
          label: 'Azure App Services',
        },
        {
          type: 'doc',
          id: 'deployment/cloudflare',
          label: 'Cloudflare',
        },
        {
          type: 'doc',
          id: 'deployment/digital-ocean',
          label: 'Digital Ocean',
        },
        {
          type: 'doc',
          id: 'deployment/netlify',
          label: 'Netlify',
        },
        {
          type: 'doc',
          id: 'deployment/vercel',
          label: 'Vercel',
        },
        {
          type: 'doc',
          id: 'deployment/inngest',
          label: 'Inngest',
        },
      ],
    },
    {
      type: 'category',
      label: 'Migrations',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'v1.0',
          items: [
            {
              id: 'migrations/upgrade-to-v1/overview',
              type: 'doc',
              label: 'Overview',
            },
            {
              id: 'migrations/upgrade-to-v1/agent',
              type: 'doc',
              label: 'Agents',
            },
            {
              id: 'migrations/upgrade-to-v1/cli',
              type: 'doc',
              label: 'CLI',
            },
            {
              id: 'migrations/upgrade-to-v1/client',
              type: 'doc',
              label: 'Client SDK',
            },
            {
              id: 'migrations/upgrade-to-v1/deployment',
              type: 'doc',
              label: 'Deployment',
            },
            {
              id: 'migrations/upgrade-to-v1/evals',
              type: 'doc',
              label: 'Evals',
            },
            {
              id: 'migrations/upgrade-to-v1/mastra',
              type: 'doc',
              label: 'Mastra',
            },
            {
              id: 'migrations/upgrade-to-v1/mcp',
              type: 'doc',
              label: 'MCP',
            },
            {
              id: 'migrations/upgrade-to-v1/memory',
              type: 'doc',
              label: 'Memory',
            },
            {
              id: 'migrations/upgrade-to-v1/processors',
              type: 'doc',
              label: 'Processors',
            },
            {
              id: 'migrations/upgrade-to-v1/rag',
              type: 'doc',
              label: 'RAG',
            },
            {
              id: 'migrations/upgrade-to-v1/storage',
              type: 'doc',
              label: 'Storage',
            },
            {
              id: 'migrations/upgrade-to-v1/tools',
              type: 'doc',
              label: 'Tools',
            },
            {
              id: 'migrations/upgrade-to-v1/tracing',
              type: 'doc',
              label: 'Tracing',
            },
            {
              id: 'migrations/upgrade-to-v1/vectors',
              type: 'doc',
              label: 'Vectors',
            },
            {
              id: 'migrations/upgrade-to-v1/voice',
              type: 'doc',
              label: 'Voice',
            },
            {
              id: 'migrations/upgrade-to-v1/workflows',
              type: 'doc',
              label: 'Workflows',
            },
          ],
        },
        {
          type: 'doc',
          id: 'migrations/vnext-to-standard-apis',
          label: 'VNext → Standard APIs',
        },
        {
          type: 'doc',
          id: 'migrations/agentnetwork',
          label: 'AgentNetwork → .network()',
        },
        {
          type: 'doc',
          id: 'migrations/network-to-supervisor',
          label: '.network() → Supervisor Pattern',
        },
        {
          type: 'doc',
          id: 'migrations/ai-sdk-v4-to-v5',
          label: 'AI SDK v4 → v5',
        },
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'guide/chef-michel',
          label: 'Agents: Chef Michel',
        },
        {
          type: 'doc',
          id: 'guide/research-coordinator',
          label: 'Supervisor Pattern: Research Coordinator',
        },
        {
          type: 'doc',
          id: 'guide/stock-agent',
          label: 'Tools: Stock Agent',
        },
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
          id: 'guide/web-search',
          label: 'Tools: Web Search',
        },
        {
          type: 'doc',
          id: 'guide/whatsapp-chat-bot',
          label: 'WhatsApp Chat Bot',
        },
        {
          type: 'doc',
          id: 'guide/github-actions-pr-description',
          label: 'GitHub Actions: PR Description',
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
        {
          type: 'doc',
          id: 'guide/dev-assistant',
          label: 'Workspace: Dev Assistant',
        },
      ],
    },
  ],
}

export default sidebars
