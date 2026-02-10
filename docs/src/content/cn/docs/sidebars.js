/**
 * 创建侧边栏可以让你：
 * - 创建有序的文档组
 * - 为每组文档渲染侧边栏
 * - 提供上/下一篇导航

 * 侧边栏可以从文件系统生成，也可以在这里显式定义。

 * 创建任意数量的侧边栏。
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // Docs sidebar - main documentation
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: '快速开始',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'getting-started/start',
          label: '入门',
        },
        {
          type: 'doc',
          id: 'getting-started/studio',
          label: 'Studio',
        },
        {
          type: 'doc',
          id: 'getting-started/project-structure',
          label: '项目结构',
        },
        {
          type: 'doc',
          id: 'getting-started/manual-install',
          label: '手动安装',
        },
        {
          type: 'doc',
          id: 'getting-started/build-with-ai',
          label: 'AI 构建',
        },
      ],
    },
    {
      type: 'category',
      label: '代理',
      items: [
        {
          type: 'doc',
          id: 'agents/overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'agents/using-tools',
          label: '使用工具',
        },
        {
          type: 'doc',
          id: 'agents/agent-memory',
          label: '内存',
        },
        {
          type: 'doc',
          id: 'agents/structured-output',
          label: '结构化输出',
        },
        {
          type: 'doc',
          id: 'agents/networks',
          label: '网络',
        },
        {
          type: 'doc',
          id: 'agents/processors',
          label: '处理器',
        },
        {
          type: 'doc',
          id: 'agents/guardrails',
          label: '护栏',
        },
        {
          type: 'doc',
          id: 'agents/agent-approval',
          label: '代理审批',
        },
        {
          type: 'doc',
          id: 'agents/network-approval',
          label: '网络审批',
        },
        {
          type: 'doc',
          id: 'agents/adding-voice',
          label: '语音',
        },
      ],
    },
    {
      type: 'category',
      label: '工作流',
      items: [
        {
          type: 'doc',
          id: 'workflows/overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'workflows/workflow-state',
          label: '工作流状态',
        },
        {
          type: 'doc',
          id: 'workflows/control-flow',
          label: '控制流',
        },
        {
          type: 'doc',
          id: 'workflows/agents-and-tools',
          label: '代理与工具',
        },
        {
          type: 'doc',
          id: 'workflows/snapshots',
          label: '快照',
        },
        {
          type: 'doc',
          id: 'workflows/suspend-and-resume',
          label: '暂停与恢复',
        },
        {
          type: 'doc',
          id: 'workflows/human-in-the-loop',
          label: '人工介入',
        },
        {
          type: 'doc',
          id: 'workflows/time-travel',
          label: '时间回溯',
        },
        {
          type: 'doc',
          id: 'workflows/error-handling',
          label: '错误处理',
        },
      ],
    },
    {
      type: 'category',
      label: '流式处理',
      items: [
        {
          type: 'doc',
          id: 'streaming/overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'streaming/events',
          label: '事件',
        },
        {
          type: 'doc',
          id: 'streaming/tool-streaming',
          label: '工具流式',
        },
        {
          type: 'doc',
          id: 'streaming/workflow-streaming',
          label: '工作流流式',
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
          label: '概览',
        },
        {
          type: 'doc',
          id: 'mcp/publishing-mcp-server',
          label: '发布 MCP 服务器',
        },
      ],
    },
    {
      type: 'category',
      label: '内存',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'memory/overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'memory/storage',
          label: '存储',
        },
        {
          type: 'doc',
          id: 'memory/message-history',
          label: '消息历史',
        },
        {
          type: 'doc',
          id: 'memory/working-memory',
          label: '工作内存',
        },
        {
          type: 'doc',
          id: 'memory/semantic-recall',
          label: '语义召回',
        },
        {
          type: 'doc',
          id: 'memory/observational-memory',
          label: '观测内存',
          customProps: {
            tags: ['new'],
          },
        },
        {
          type: 'doc',
          id: 'memory/memory-processors',
          label: '内存处理器',
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
          label: '概览',
        },
        {
          type: 'doc',
          id: 'rag/chunking-and-embedding',
          label: '分块与向量化',
        },
        {
          type: 'doc',
          id: 'rag/vector-databases',
          label: '向量数据库',
        },
        {
          type: 'doc',
          id: 'rag/retrieval',
          label: '检索',
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
      label: '工作区',
      customProps: {
        tags: ['new'],
      },
      items: [
        {
          type: 'doc',
          id: 'workspace/overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'workspace/filesystem',
          label: '文件系统',
        },
        {
          type: 'doc',
          id: 'workspace/sandbox',
          label: '沙箱',
        },
        {
          type: 'doc',
          id: 'workspace/skills',
          label: '技能',
        },
        {
          type: 'doc',
          id: 'workspace/search',
          label: '搜索与索引',
        },
      ],
    },
    {
      type: 'category',
      label: '服务器',
      items: [
        {
          type: 'doc',
          id: 'server/mastra-server',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'server/server-adapters',
          label: '服务器适配器',
        },
        {
          type: 'doc',
          id: 'server/custom-adapters',
          label: '自定义适配器',
        },
        {
          type: 'doc',
          id: 'server/middleware',
          label: '中间件',
        },
        {
          type: 'doc',
          id: 'server/request-context',
          label: '请求上下文',
        },
        {
          type: 'doc',
          id: 'server/custom-api-routes',
          label: '自定义 API 路由',
        },
        {
          type: 'doc',
          id: 'server/mastra-client',
          label: 'Mastra 客户端',
        },
        {
          type: 'category',
          label: '认证',
          items: [
            {
              type: 'doc',
              id: 'server/auth/index',
              label: '概览',
            },
            {
              type: 'doc',
              id: 'server/auth/simple-auth',
              label: '简单认证',
            },
            {
              type: 'doc',
              id: 'server/auth/jwt',
              label: 'JSON Web Token',
            },
            {
              type: 'doc',
              id: 'server/auth/clerk',
              label: 'Clerk',
            },
            {
              type: 'doc',
              id: 'server/auth/supabase',
              label: 'Supabase',
            },
            {
              type: 'doc',
              id: 'server/auth/firebase',
              label: 'Firebase',
            },
            {
              type: 'doc',
              id: 'server/auth/workos',
              label: 'WorkOS',
            },
            {
              type: 'doc',
              id: 'server/auth/auth0',
              label: 'Auth0',
            },
            {
              type: 'doc',
              id: 'server/auth/composite-auth',
              label: '组合认证',
            },
            {
              type: 'doc',
              id: 'server/auth/custom-auth-provider',
              label: '自定义认证提供商',
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '部署',
      items: [
        {
          type: 'doc',
          id: 'deployment/overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'deployment/mastra-server',
          label: 'Mastra 服务器',
        },
        {
          type: 'doc',
          id: 'deployment/monorepo',
          label: 'Monorepo',
        },
        {
          type: 'doc',
          id: 'deployment/cloud-providers',
          label: '云服务商',
        },
        {
          type: 'doc',
          id: 'deployment/web-framework',
          label: 'Web 框架',
        },
        {
          type: 'doc',
          id: 'deployment/workflow-runners',
          label: '工作流运行器',
        },
      ],
    },
    {
      type: 'category',
      label: 'Mastra Cloud',
      customProps: {
        tags: ['beta'],
      },
      items: [
        {
          type: 'doc',
          id: 'mastra-cloud/overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'mastra-cloud/setup',
          label: '设置',
        },
        {
          type: 'doc',
          id: 'mastra-cloud/studio',
          label: 'Studio',
        },
        {
          type: 'doc',
          id: 'mastra-cloud/deployment',
          label: '部署',
        },
        {
          type: 'doc',
          id: 'mastra-cloud/observability',
          label: '可观测性',
        },
      ],
    },
    {
      type: 'category',
      label: '可观测性',
      items: [
        {
          type: 'doc',
          id: 'observability/overview',
          key: 'observability.overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'observability/logging',
          label: '日志',
        },
        {
          type: 'category',
          label: '追踪',
          items: [
            {
              type: 'doc',
              id: 'observability/tracing/overview',
              key: 'observability.tracing.overview',
              label: '概览',
            },
            {
              type: 'category',
              label: '桥接',
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
              label: '导出器',
              items: [
                {
                  type: 'doc',
                  id: 'observability/tracing/exporters/default',
                  label: '默认',
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
              label: '处理器',
              items: [
                {
                  type: 'doc',
                  id: 'observability/tracing/processors/sensitive-data-filter',
                  label: '敏感数据过滤器',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '评估',
      items: [
        {
          type: 'doc',
          id: 'evals/overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'evals/built-in-scorers',
          label: '内置评分器',
        },
        {
          type: 'doc',
          id: 'evals/custom-scorers',
          label: '自定义评分器',
        },
        {
          type: 'doc',
          id: 'evals/running-in-ci',
          label: '在 CI 中运行',
        },
      ],
    },
    {
      type: 'category',
      label: '语音',
      items: [
        {
          type: 'doc',
          id: 'voice/overview',
          label: '概览',
        },
        {
          type: 'doc',
          id: 'voice/text-to-speech',
          label: '文字转语音',
        },
        {
          type: 'doc',
          id: 'voice/speech-to-text',
          label: '语音转文字',
        },
        {
          type: 'doc',
          id: 'voice/speech-to-speech',
          label: '语音转语音',
        },
      ],
    },
    {
      type: 'category',
      label: 'AI 构建',
      collapsed: true,
      items: [
        {
          type: 'doc',
          id: 'build-with-ai/skills',
          label: '技能',
        },
        {
          type: 'doc',
          id: 'build-with-ai/mcp-docs-server',
          label: 'MCP 文档服务器',
        },
      ],
    },
    {
      type: 'category',
      label: '社区',
      items: [
        {
          type: 'doc',
          id: 'community/contributing-templates',
          label: '贡献模板',
        },
        {
          type: 'doc',
          id: 'community/licensing',
          label: '许可证',
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
