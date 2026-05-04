import type { ComponentType } from 'react'

export const contentModules: Record<string, () => Promise<{ default: ComponentType }>> = {
  'what-is-an-agent': () => import('./content/what-is-an-agent.mdx'),
  'run-your-first-agent': () => import('./content/run-your-first-agent.mdx'),
  'project-structure': () => import('./content/project-structure.mdx'),
  'create-an-agent': () => import('./content/create-an-agent.mdx'),
  'create-a-tool': () => import('./content/create-a-tool.mdx'),
  'build-with-ai': () => import('./content/build-with-ai.mdx'),
  'fetch-live-data': () => import('./content/fetch-live-data.mdx'),
  'connect-to-mcp': () => import('./content/connect-to-mcp.mdx'),
  'build-a-workflow': () => import('./content/build-a-workflow.mdx'),
  'agents-vs-workflows': () => import('./content/agents-vs-workflows.mdx'),
  'agents-in-workflows': () => import('./content/agents-in-workflows.mdx'),
  'how-memory-works': () => import('./content/how-memory-works.mdx'),
  'observational-memory': () => import('./content/observational-memory.mdx'),
  'guardrails-with-processors': () => import('./content/guardrails-with-processors.mdx'),
  'deploy-to-mastra-platform': () => import('./content/deploy-to-mastra-platform.mdx'),
  'chat-with-agent-in-slack': () => import('./content/chat-with-agent-in-slack.mdx'),
}
