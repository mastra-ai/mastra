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
}
