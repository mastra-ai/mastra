/**
 * Resolve HTML output routes back to MDX source files
 *
 * Maps build routes to their source MDX files to extract frontmatter.
 */

import path from 'path'
import fs from 'fs-extra'

interface RouteMapping {
  routePrefix: string
  sourceDir: string
}

const ROUTE_MAPPINGS: RouteMapping[] = [
  { routePrefix: '/docs', sourceDir: 'src/content/en/docs' },
  { routePrefix: '/reference', sourceDir: 'src/content/en/reference' },
  { routePrefix: '/guides', sourceDir: 'src/content/en/guides' },
  { routePrefix: '/models', sourceDir: 'src/content/en/models' },
]

/**
 * Resolve a route to its source MDX file path
 *
 * @param route - The route from the build (e.g., "/docs/agents/overview")
 * @param siteDir - The docusaurus site directory
 * @returns The absolute path to the source MDX file, or null if not found
 */
export async function resolveSourceFile(route: string, siteDir: string): Promise<string | null> {
  for (const mapping of ROUTE_MAPPINGS) {
    if (route.startsWith(mapping.routePrefix)) {
      const relativePath = route.slice(mapping.routePrefix.length)

      // Handle root path for a category (e.g., /docs)
      const basePath = relativePath === '' ? '' : relativePath

      const possiblePaths = [
        path.join(siteDir, mapping.sourceDir, `${basePath}.mdx`),
        path.join(siteDir, mapping.sourceDir, `${basePath}.md`),
        path.join(siteDir, mapping.sourceDir, basePath, 'index.mdx'),
        path.join(siteDir, mapping.sourceDir, basePath, 'index.md'),
      ]

      for (const sourcePath of possiblePaths) {
        if (await fs.pathExists(sourcePath)) {
          return sourcePath
        }
      }
    }
  }

  return null
}

/**
 * Extract the category from a route
 *
 * @param route - The route (e.g., "/docs/agents/overview")
 * @returns The category (e.g., "docs")
 */
export function getCategoryFromRoute(route: string): string {
  const match = route.match(/^\/([^/]+)/)
  return match ? match[1] : 'docs'
}

/**
 * Extract the folder path from a route (path within the category)
 *
 * @param route - The route (e.g., "/docs/agents/overview")
 * @returns The folder path (e.g., "agents/overview")
 */
export function getFolderPathFromRoute(route: string): string {
  const match = route.match(/^\/[^/]+\/(.+)$/)
  return match ? match[1] : ''
}

/**
 * Check if a route belongs to a documented section
 */
export function isDocumentedRoute(route: string): boolean {
  return ROUTE_MAPPINGS.some(mapping => route.startsWith(mapping.routePrefix))
}
