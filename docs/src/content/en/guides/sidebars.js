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
          id: 'getting-started/nestjs',
          label: 'NestJS',
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
        {
          type: 'doc',
          id: 'getting-started/manual-install',
          label: 'Manual Install',
        },
      ],
    },
    {
      type: 'category',
      label: 'Concepts',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'concepts/multi-agent-systems',
          label: 'Multi-agent systems',
        },
        {
          type: 'doc',
          id: 'concepts/streaming',
          label: 'Streaming',
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
            {
              type: 'doc',
              id: 'voice/realtime-voice',
              label: 'Realtime Voice',
            },
          ],
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
          id: 'build-your-ui/assistant-ui',
          label: 'Assistant UI',
        },
        {
          type: 'doc',
          id: 'build-your-ui/openui',
          label: 'OpenUI',
        },
        {
          type: 'category',
          label: 'CopilotKit',
          items: [
            {
              type: 'doc',
              id: 'build-your-ui/copilotkit/overview',
              label: 'Overview',
            },
            {
              type: 'doc',
              id: 'build-your-ui/copilotkit/generative-ui',
              label: 'Generative UI',
            },
            {
              type: 'doc',
              id: 'build-your-ui/copilotkit/channels',
              label: 'Channels',
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
          type: 'doc',
          id: 'deployment/aws-bedrock-agentcore',
          label: 'Amazon Bedrock AgentCore',
        },
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
          id: 'deployment/inngest',
          label: 'Inngest',
        },
        {
          type: 'html',
          value: '<a class="menu__link" href="/docs/mastra-platform/server"><span>Mastra platform</span></a>',
        },
        {
          type: 'doc',
          id: 'deployment/kubernetes',
          label: 'Kubernetes',
        },
        {
          type: 'doc',
          id: 'deployment/mastra-workers',
          label: 'Mastra Workers',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'deployment/netlify',
          label: 'Netlify',
        },
        {
          type: 'doc',
          id: 'deployment/temporal',
          label: 'Temporal',
        },
        {
          type: 'doc',
          id: 'deployment/vercel',
          label: 'Vercel',
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
              id: 'guide/chef-michel',
              label: 'Agents: Chef Michel',
            },
            {
              type: 'doc',
              id: 'guide/stock-agent',
              label: 'Tools: Stock Agent',
            },
            {
              type: 'doc',
              id: 'guide/web-search',
              label: 'Tools: Web Search',
            },
            {
              type: 'doc',
              id: 'guide/firecrawl',
              label: 'Tools: Firecrawl',
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
        {
          type: 'doc',
          id: 'guide/slack-assistant',
          label: 'Channels: Slack Assistant',
        },
        {
          type: 'doc',
          id: 'guide/publishing-mcp-server',
          label: 'Publishing an MCP Server',
        },
        {
          type: 'doc',
          id: 'guide/whatsapp-chat-bot',
          label: 'WhatsApp Chat Bot',
        },
      ],
    },
  ],
}

export default sidebars
