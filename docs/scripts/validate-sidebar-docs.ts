import fs from 'fs/promises'
import path from 'path'
import { pathToFileURL } from 'url'

/**
 * Validates that every MDX file under the content directories is referenced
 * in its corresponding sidebars.js. Catches "ghost pages" that exist on disk but are not linked in any sidebar.
 *
 * Usage:
 *   pnpm validate:sidebar-docs
 */

interface SidebarDoc {
  type: 'doc'
  id: string
  label?: string
}

interface SidebarCategory {
  type: 'category'
  label: string
  items: SidebarItem[]
}

type SidebarItem = SidebarDoc | SidebarCategory | string

interface SectionConfig {
  name: string
  contentDir: string
  sidebarPath: string
  sidebarKey: string
}

const SECTIONS: SectionConfig[] = [
  {
    name: 'docs',
    contentDir: 'src/content/en/docs',
    sidebarPath: 'src/content/en/docs/sidebars.js',
    sidebarKey: 'docsSidebar',
  },
  {
    name: 'guides',
    contentDir: 'src/content/en/guides',
    sidebarPath: 'src/content/en/guides/sidebars.js',
    sidebarKey: 'guidesSidebar',
  },
  {
    name: 'reference',
    contentDir: 'src/content/en/reference',
    sidebarPath: 'src/content/en/reference/sidebars.js',
    sidebarKey: 'referenceSidebar',
  },
]

/** Files that are intentionally not in any sidebar */
const IGNORED_PATTERNS = [
  /\/_template\.mdx$/, // Template files for authors
]

function extractDocIds(items: SidebarItem[]): Set<string> {
  const ids = new Set<string>()

  for (const item of items) {
    if (typeof item === 'string') {
      ids.add(item)
    } else if (item.type === 'doc') {
      ids.add(item.id)
    } else if (item.type === 'category') {
      for (const id of extractDocIds(item.items)) {
        ids.add(id)
      }
    }
  }

  return ids
}

async function collectMdxFiles(dir: string): Promise<string[]> {
  const results: string[] = []

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true })
    const subdirs: Promise<void>[] = []
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        subdirs.push(walk(fullPath))
      } else if (entry.name.endsWith('.mdx')) {
        results.push(fullPath)
      }
    }
    await Promise.all(subdirs)
  }

  await walk(dir)
  return results
}

function shouldIgnore(filePath: string): boolean {
  return IGNORED_PATTERNS.some(pattern => pattern.test(filePath))
}

interface ValidationResult {
  section: string
  ghostPages: string[]
}

async function validateSection(section: SectionConfig, rootDir: string): Promise<ValidationResult> {
  const sidebarFullPath = path.join(rootDir, section.sidebarPath)
  const contentFullDir = path.join(rootDir, section.contentDir)

  const sidebarModule = await import(pathToFileURL(sidebarFullPath).href)
  const sidebars = sidebarModule.default ?? sidebarModule
  const items: SidebarItem[] = sidebars[section.sidebarKey]

  if (!items || !Array.isArray(items)) {
    throw new Error(`${section.sidebarKey} not found in ${section.sidebarPath}`)
  }

  const sidebarIds = extractDocIds(items)
  const mdxFiles = await collectMdxFiles(contentFullDir)

  const ghostPages: string[] = []

  for (const filePath of mdxFiles) {
    if (shouldIgnore(filePath)) continue

    // Convert file path to doc ID: strip content dir prefix and .mdx extension
    const relativePath = path.relative(contentFullDir, filePath)
    const docId = relativePath.replace(/\.mdx$/, '')

    if (!sidebarIds.has(docId)) {
      // Show path relative to the content section for readability
      ghostPages.push(docId)
    }
  }

  return { section: section.name, ghostPages: ghostPages.sort() }
}

async function main(): Promise<void> {
  const rootDir = process.cwd()

  console.log('Checking for docs not linked in sidebars...\n')

  const results = await Promise.all(SECTIONS.map(section => validateSection(section, rootDir)))

  const totalGhostPages = results.reduce((sum, r) => sum + r.ghostPages.length, 0)

  if (totalGhostPages === 0) {
    console.log('All docs are linked in their sidebars')
    return
  }

  console.log(`Found ${totalGhostPages} doc(s) not linked in any sidebar:\n`)

  for (const result of results) {
    if (result.ghostPages.length === 0) continue

    console.log(`  ${result.section}/sidebars.js (${result.ghostPages.length} missing):`)
    for (const page of result.ghostPages) {
      console.log(`    - ${page}`)
    }
    console.log()
  }

  console.log('Add the missing docs to their sidebars.js, or add an ignore pattern to scripts/validate-sidebar-docs.ts')
  process.exit(1)
}

main().catch(error => {
  console.error('Unhandled error:', error instanceof Error ? error.message : error)
  process.exit(1)
})
