/**
 * Generate llms-manifest.json mapping packages to their documentation
 */

import path from 'path'
import fs from 'fs-extra'
import { extractFrontMatter, getPackageNames } from '../../utils/frontmatter'
import { resolveSourceFile, getCategoryFromRoute, getFolderPathFromRoute, isDocumentedRoute } from './source-resolver'

export interface ManifestEntry {
  path: string
  title: string
  description?: string
  category: string
  folderPath: string
}

export interface LlmsManifest {
  version: string
  generatedAt: string
  packages: Record<string, ManifestEntry[]>
}

export interface RouteInfo {
  route: string
  title?: string
}

/**
 * Clean a title by removing " | Section" suffixes
 * e.g., "Voice | Agents" -> "Voice"
 */
function cleanTitle(title: string | undefined): string | undefined {
  if (!title) return undefined
  return title.replace(/\s*\|.*$/, '').trim() || undefined
}

/**
 * Generate the llms-manifest.json content
 *
 * @param routes - Array of processed routes with their titles
 * @param siteDir - The docusaurus site directory
 * @param outDir - The build output directory
 * @returns The generated manifest
 */
export async function generateManifest(routes: RouteInfo[], siteDir: string, outDir: string): Promise<LlmsManifest> {
  const manifest: LlmsManifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    packages: {},
  }

  for (const { route, title } of routes) {
    // Skip root routes and non-documented routes
    if (route === '/' || !isDocumentedRoute(route)) {
      continue
    }

    // Resolve source MDX file
    const sourceFile = await resolveSourceFile(route, siteDir)
    if (!sourceFile) {
      continue
    }

    // Read and parse frontmatter
    try {
      const content = await fs.readFile(sourceFile, 'utf-8')
      const frontmatter = extractFrontMatter(content)
      let packages = getPackageNames(frontmatter)

      // If no packages field, assign to "general" category for docs like migrations
      if (packages.length === 0) {
        packages = ['general']
      }

      const category = getCategoryFromRoute(route)
      const folderPath = getFolderPathFromRoute(route)
      const llmsTxtPath = `${route.slice(1)}/llms.txt`

      const entry: ManifestEntry = {
        path: llmsTxtPath,
        title: cleanTitle(title) || cleanTitle(frontmatter?.title) || 'Untitled',
        category,
        folderPath,
        description: frontmatter?.description,
      }

      // Add to each package's entry list
      for (const pkg of packages) {
        if (!manifest.packages[pkg]) {
          manifest.packages[pkg] = []
        }
        manifest.packages[pkg].push(entry)
      }
    } catch (error) {
      console.warn(`[llms-txt] Failed to process ${sourceFile}:`, error)
    }
  }

  // Sort entries within each package by category then folderPath
  for (const pkg of Object.keys(manifest.packages)) {
    manifest.packages[pkg].sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category)
      }
      return a.folderPath.localeCompare(b.folderPath)
    })
  }

  return manifest
}

/**
 * Write the manifest to the output directory
 *
 * @param manifest - The generated manifest
 * @param outDir - The build output directory
 */
export async function writeManifest(manifest: LlmsManifest, outDir: string): Promise<void> {
  const manifestPath = path.join(outDir, 'llms-manifest.json')
  await fs.writeJson(manifestPath, manifest, { spaces: 2 })

  const packageCount = Object.keys(manifest.packages).length
  const entryCount = Object.values(manifest.packages).reduce((sum, entries) => sum + entries.length, 0)

  console.log(`[llms-txt] Generated manifest with ${packageCount} packages and ${entryCount} entries`)
}
