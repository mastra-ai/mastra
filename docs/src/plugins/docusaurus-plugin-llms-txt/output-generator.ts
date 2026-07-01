/**
 * Output generation for root and individual llms.txt files
 */

import fs from 'fs-extra'
import path from 'path'
import { generateMarkdownList, getBaseUrl, getSidebarLocations, parseSidebarFile } from './sidebars-handler'

export interface RouteEntry {
  route: string
  title?: string
  cached: boolean
}

/**
 * Generate the root llms.txt file with links to all individual files
 */
export async function generateRootLlmsTxt(outDir: string, siteDir: string): Promise<void> {
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

> Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server. It's the easiest way to build, tune, and scale reliable AI products.

Below is a list of all available documentation pages.`
