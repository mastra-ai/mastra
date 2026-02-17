import type { ComponentType } from 'react'

export const contentModules: Record<string, () => Promise<{ default: ComponentType }>> = {
  '01-what-is-an-agent': () => import('./content/01-what-is-an-agent.mdx'),
  '02-setup-and-first-run': () => import('./content/02-setup-and-first-run.mdx'),
  '03-scaffolded-project-walkthrough': () => import('./content/03-scaffolded-project-walkthrough.mdx'),
  '04-create-new-agent': () => import('./content/04-create-new-agent.mdx'),
}
