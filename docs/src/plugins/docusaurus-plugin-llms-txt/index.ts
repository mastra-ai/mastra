/**
 * Docusaurus Plugin: llms-txt
 *
 * Generates individual llms.txt files for each documentation page, converting rendered HTML to clean markdown for LLM consumption.
 */

import type { LoadContext, Plugin } from '@docusaurus/types'
import path from 'path'
import fs from 'fs-extra'
import { glob } from 'glob'
import pMap from 'p-map'

import { type LlmsTxtPluginOptions, resolveOptions, validateOptions } from './options.js'
import { CacheManager, computeHash } from './cache-manager.js'
import { processHtml } from './html-processor.js'
import { generateRootLlmsTxt, writeLlmsTxt, type RouteEntry } from './output-generator.js'

const PLUGIN_NAME = 'docusaurus-plugin-llms-txt'
const CONCURRENCY = 10

export default function pluginLlmsTxt(_context: LoadContext, userOptions: LlmsTxtPluginOptions): Plugin {
  // Validate and resolve options
  validateOptions(userOptions)
  const options = resolveOptions(userOptions)

  return {
    name: PLUGIN_NAME,

    async postBuild({ outDir, siteDir }) {
      console.log(`[${PLUGIN_NAME}] Starting llms.txt generation...`)

      const startTime = Date.now()

      // Initialize cache (store in node_modules/.cache to persist across builds)
      const cacheDir = path.join(siteDir, 'node_modules', '.cache', 'llms-txt')
      const cache = new CacheManager(cacheDir, options.enableCache)
      await cache.load()

      // Find all index.html files
      const htmlFiles = await glob('**/index.html', {
        cwd: outDir,
        ignore: ['assets/**', '.llms-txt-cache/**'],
      })

      console.log(`[${PLUGIN_NAME}] Found ${htmlFiles.length} HTML files to process`)

      // Process files concurrently
      let processedCount = 0
      let cachedCount = 0
      let skippedCount = 0

      const results = await pMap(
        htmlFiles,
        async (htmlFile): Promise<RouteEntry | null> => {
          // Get route from file path
          // e.g., "docs/agents/overview/index.html" -> "/docs/agents/overview"
          const dirPath = path.dirname(htmlFile)
          const route = dirPath === '.' ? '/' : '/' + dirPath

          // Check exclusions
          if (shouldExclude(route, options.excludeRoutes)) {
            skippedCount++
            return null
          }

          const htmlPath = path.join(outDir, htmlFile)

          try {
            // Read HTML content
            const html = await fs.readFile(htmlPath, 'utf-8')
            const contentHash = computeHash(html)

            const llmsTxtPath = path.join(path.dirname(htmlPath), 'llms.txt')

            // Check cache
            if (cache.isValid(route, contentHash)) {
              const cachedContent = cache.getContent(route)
              const cachedTitle = cache.getTitle(route)

              if (cachedContent) {
                // Write cached content to file (build dir is cleared each time)
                await writeLlmsTxt(llmsTxtPath, cachedContent)
                cachedCount++
                return { route, title: cachedTitle, cached: true }
              }
            }

            // Process HTML to markdown
            const { llmsTxt, metadata } = await processHtml(html, route, options)

            // Write individual llms.txt file
            await writeLlmsTxt(llmsTxtPath, llmsTxt)

            // Update cache with title and content
            cache.set(route, contentHash, metadata.title, llmsTxt)
            processedCount++

            return { route, title: metadata.title, cached: false }
          } catch (error) {
            console.error(`[${PLUGIN_NAME}] Error processing ${route}:`, error)
            return null
          }
        },
        { concurrency: CONCURRENCY },
      )

      // Filter out null results
      const validRoutes = results.filter((r): r is RouteEntry => r !== null)

      // Generate root llms.txt
      await generateRootLlmsTxt(outDir, validRoutes, options)

      // Save cache
      await cache.save()

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(
        `[${PLUGIN_NAME}] Generated ${validRoutes.length} llms.txt files ` +
          `(${processedCount} processed, ${cachedCount} cached, ${skippedCount} skipped) ` +
          `in ${duration}s`,
      )
    },
  }
}

/**
 * Check if a route should be excluded
 */
function shouldExclude(route: string, excludePatterns: string[]): boolean {
  for (const pattern of excludePatterns) {
    if (route === pattern || route.startsWith(pattern + '/')) {
      return true
    }
  }
  return false
}

// Export types for external use
export type { LlmsTxtPluginOptions }
