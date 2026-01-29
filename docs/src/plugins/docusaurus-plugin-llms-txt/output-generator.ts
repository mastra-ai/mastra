/**
 * Output generation for root and individual llms.txt files
 */

import fs from 'fs-extra'
import path from 'path'
import type { ResolvedOptions } from './options'
import { generateMarkdownList, getBaseUrl, getSidebarLocations, parseSidebarFile } from './sidebars-handler'

export interface RouteEntry {
  route: string
  title?: string
  cached: boolean
}

/**
 * Generate the root llms.txt file with links to all individual files
 */
export async function generateRootLlmsTxt(outDir: string, siteDir: string, options: ResolvedOptions): Promise<void> {
  let output = ROOT_LLMS_PREFIX_BLOCK + '\n\n'

  for (const sidebar of getSidebarLocations(siteDir)) {
    try {
      const items = await parseSidebarFile(sidebar.path)
      const baseUrl = getBaseUrl(sidebar.id)
      const condensedCategories = sidebar.condensedCategories || []

      output += `## ${sidebar.id}\n\n`
      output += generateMarkdownList(items, baseUrl, 0, condensedCategories)
      output += '\n'
    } catch (error) {
      console.error(`Error processing ${sidebar.id}:`, error)
    }
  }

  await fs.writeFile(path.join(outDir, 'llms.txt'), output, 'utf-8')
}

/**
 * Write an individual llms.txt file
 */
export async function writeLlmsTxt(outputPath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, content, 'utf-8')
}

const ROOT_LLMS_PREFIX_BLOCK = `# Mastra

Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server. It's the easiest way to build, tune, and scale reliable AI products.

Some of its highlights include: Model routing, agents, workflows, human-in-the-loop, context management, and MCP.

The documentation is organized into key sections:

- **Docs**: Core documentation covering concepts, features, and implementation details
- **Models**: Mastra provides a unified interface for working with LLMs across multiple providers
- **Guides**: Step-by-step tutorials for building specific applications
- **Reference**: API reference documentation

Each section contains detailed docs that provide comprehensive information about Mastra's features and how to use them effectively.

These are the most popular starting points:

- [Getting Started](https://mastra.ai/docs/getting-started/start/llms.txt): Create a new project with the \`create mastra\` CLI or use one of the framework quickstart guides
- [Agent Overview](https://mastra.ai/docs/agents/overview/llms.txt): Agents use LLMs and tools to solve open-ended tasks. They reason about goals, decide which tools to use, retain conversation memory, and iterate internally until the model emits a final answer or an optional stop condition is met.
- [Workflows Overview](https://mastra.ai/docs/workflows/overview/llms.txt): Workflows let you define complex sequences of tasks using clear, structured steps rather than relying on the reasoning of a single agent.
- [Memory Overview](https://mastra.ai/docs/memory/overview/llms.txt): Memory gives your agent coherence across interactions and allows it to improve over time by retaining relevant information from past conversations.`
