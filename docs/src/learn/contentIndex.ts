import type { ComponentType } from 'react'

export const contentModules: Record<string, () => Promise<{ default: ComponentType }>> = {
  '01-build-ai-agents-with-mastra': () => import('./content/01-build-ai-agents-with-mastra.mdx'),
  '02-setup-and-first-run': () => import('./content/02-setup-and-first-run.mdx'),
  '03-mastra-project-structure': () => import('./content/03-mastra-project-structure.mdx'),
  '04-create-a-new-agent': () => import('./content/04-create-a-new-agent.mdx'),
  '05-create-a-tool': () => import('./content/05-create-a-tool.mdx'),
  '06-build-with-ai': () => import('./content/06-build-with-ai.mdx'),
  '07-fetch-live-data': () => import('./content/07-fetch-live-data.mdx'),
  '08-connect-agents-to-mcp-servers': () => import('./content/08-connect-agents-to-mcp-servers.mdx'),
}
