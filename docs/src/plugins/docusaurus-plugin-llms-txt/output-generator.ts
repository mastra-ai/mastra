/**
 * Output generation for root and individual llms.txt files
 */

import fs from 'fs-extra'
import path from 'path'
import type { ResolvedOptions } from './options.js'

export interface RouteEntry {
  route: string
  title?: string
  cached: boolean
}

/**
 * Generate the root llms.txt file with links to all individual files
 */
export async function generateRootLlmsTxt(
  outDir: string,
  routes: RouteEntry[],
  options: ResolvedOptions,
): Promise<void> {
  // Group routes by section
  const sections = groupRoutesBySection(routes)

  const content = buildRootContent(sections, options)

  await fs.writeFile(path.join(outDir, 'llms.txt'), content, 'utf-8')
}

/**
 * Group routes by documentation section
 */
function groupRoutesBySection(routes: RouteEntry[]): Record<string, RouteEntry[]> {
  const sections: Record<string, RouteEntry[]> = {
    Docs: [],
    Models: [],
    Guides: [],
    Reference: [],
    Other: [],
  }

  for (const entry of routes) {
    if (entry.route.startsWith('/docs')) {
      sections.Docs.push(entry)
    } else if (entry.route.startsWith('/models')) {
      sections.Models.push(entry)
    } else if (entry.route.startsWith('/guides')) {
      sections.Guides.push(entry)
    } else if (entry.route.startsWith('/reference')) {
      sections.Reference.push(entry)
    } else if (entry.route !== '/') {
      sections.Other.push(entry)
    }
  }

  // Remove empty sections
  for (const key of Object.keys(sections)) {
    if (sections[key].length === 0) {
      delete sections[key]
    }
  }

  // Sort routes within each section
  for (const key of Object.keys(sections)) {
    sections[key].sort((a, b) => a.route.localeCompare(b.route))
  }

  return sections
}

/**
 * Build the root llms.txt content
 */
function buildRootContent(sections: Record<string, RouteEntry[]>, options: ResolvedOptions): string {
  const lines: string[] = []

  // Header
  lines.push(`# ${options.siteTitle}`)
  lines.push('')
  lines.push(options.siteDescription)
  lines.push('')

  // Quick links to section indexes
  lines.push('## Documentation Sections')
  lines.push('')
  lines.push(
    `- [**Docs**](${options.siteUrl}/docs): Core documentation covering concepts, features, and implementation details`,
  )
  lines.push(
    `- [**Models**](${options.siteUrl}/models): Mastra provides a unified interface for working with LLMs across multiple providers`,
  )
  lines.push(`- [**Guides**](${options.siteUrl}/guides): Step-by-step tutorials for building specific applications`)
  lines.push(`- [**Reference**](${options.siteUrl}/reference): API reference documentation`)
  lines.push('')

  // Popular starting points
  lines.push('## Popular Starting Points')
  lines.push('')
  lines.push(
    `- [Getting Started](${options.siteUrl}/docs/getting-started/start/llms.txt): Create a new project with the \`create mastra\` CLI`,
  )
  lines.push(
    `- [Agent Overview](${options.siteUrl}/docs/agents/overview/llms.txt): Learn about agents and their capabilities`,
  )
  lines.push(
    `- [Workflows Overview](${options.siteUrl}/docs/workflows/overview/llms.txt): Define complex sequences of tasks`,
  )
  lines.push(
    `- [Memory Overview](${options.siteUrl}/docs/memory/overview/llms.txt): Give your agent coherence across interactions`,
  )
  lines.push('')

  // All pages by section
  lines.push('## All Pages')
  lines.push('')
  lines.push('Each page has its own llms.txt file for granular access:')
  lines.push('')

  for (const [sectionName, sectionRoutes] of Object.entries(sections)) {
    lines.push(`### ${sectionName}`)
    lines.push('')

    for (const entry of sectionRoutes) {
      const llmsTxtUrl = `${options.siteUrl}${entry.route}/llms.txt`
      const linkText = entry.title || entry.route
      lines.push(`- [${linkText}](${llmsTxtUrl})`)
    }

    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Write an individual llms.txt file
 */
export async function writeLlmsTxt(outputPath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, 'utf-8')
}
