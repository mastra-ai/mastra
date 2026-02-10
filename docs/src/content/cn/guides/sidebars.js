/**
 * 侧边栏 - 指南
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  guidesSidebar: [
    'index',
    {
      type: 'category',
      label: '快速开始',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'getting-started/quickstart',
          label: '快速入门',
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
      ],
    },
    {
      type: 'category',
      label: '代理框架',
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
      label: '代理 UI',
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
      label: '部署',
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
          id: 'deployment/cloudflare-deployer',
          label: 'Cloudflare',
        },
        {
          type: 'doc',
          id: 'deployment/digital-ocean',
          label: 'Digital Ocean',
        },
        {
          type: 'doc',
          id: 'deployment/netlify-deployer',
          label: 'Netlify',
        },
        {
          type: 'doc',
          id: 'deployment/vercel-deployer',
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
      label: '迁移指南',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'v1.0',
          items: [
            {
              id: 'migrations/upgrade-to-v1/overview',
              type: 'doc',
              label: '概览',
            },
            {
              id: 'migrations/upgrade-to-v1/agent',
              type: 'doc',
              label: '代理',
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
              id: 'migrations/upgrade-to-v1/evals',
              type: 'doc',
              label: '评估',
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
              label: '内存',
            },
            {
              id: 'migrations/upgrade-to-v1/processors',
              type: 'doc',
              label: '处理器',
            },
            {
              id: 'migrations/upgrade-to-v1/storage',
              type: 'doc',
              label: '存储',
            },
            {
              id: 'migrations/upgrade-to-v1/tools',
              type: 'doc',
              label: '工具',
            },
            {
              id: 'migrations/upgrade-to-v1/tracing',
              type: 'doc',
              label: '追踪',
            },
            {
              id: 'migrations/upgrade-to-v1/vectors',
              type: 'doc',
              label: '向量',
            },
            {
              id: 'migrations/upgrade-to-v1/voice',
              type: 'doc',
              label: '语音',
            },
            {
              id: 'migrations/upgrade-to-v1/workflows',
              type: 'doc',
              label: '工作流',
            },
          ],
        },
        {
          type: 'doc',
          id: 'migrations/vnext-to-standard-apis',
          label: 'VNext → 标准 API',
        },
        {
          type: 'doc',
          id: 'migrations/agentnetwork',
          label: 'AgentNetwork → .network()',
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
      label: '指南',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'guide/chef-michel',
          label: '代理：厨师 Michel',
        },
        {
          type: 'doc',
          id: 'guide/stock-agent',
          label: '工具：股票代理',
        },
        {
          type: 'doc',
          id: 'guide/ai-recruiter',
          label: '工作流：AI 招聘官',
        },
        {
          type: 'doc',
          id: 'guide/research-assistant',
          label: 'RAG：研究助手',
        },
        {
          type: 'doc',
          id: 'guide/notes-mcp-server',
          label: 'MCP 服务器：笔记 MCP 服务器',
        },
        {
          type: 'doc',
          id: 'guide/web-search',
          label: '工具：网络搜索',
        },
        {
          type: 'doc',
          id: 'guide/whatsapp-chat-bot',
          label: 'WhatsApp 聊天机器人',
        },
        {
          type: 'doc',
          id: 'guide/github-actions-pr-description',
          label: 'GitHub Actions：PR 描述',
        },
      ],
    },
  ],
}

export default sidebars
