#!/usr/bin/env node

/**
 * Checks for .mdx files that exist on disk but are not referenced
 * in their corresponding sidebars.js file.
 *
 * Usage: node check.mjs
 */

import { readdir, stat } from 'node:fs/promises'
import { join, relative, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

const CONTENT_ROOT = new URL('./src/content/en/', import.meta.url).pathname

// Each sidebar section: directory (relative to CONTENT_ROOT) that contains
// both a sidebars.js and .mdx files.
const SECTIONS = ['docs', 'guides', 'reference', 'models']

/** Recursively find all .mdx files under a directory */
async function findMdxFiles(dir) {
  const results = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await findMdxFiles(fullPath)))
    } else if (entry.name.endsWith('.mdx') && !entry.name.startsWith('_')) {
      results.push(fullPath)
    }
  }
  return results
}

/** Recursively extract all doc IDs from a sidebar items array */
function extractDocIds(items) {
  const ids = new Set()
  for (const item of items) {
    if (typeof item === 'string') {
      ids.add(item)
    } else if (item && typeof item === 'object') {
      if (item.type === 'doc' && item.id) {
        ids.add(item.id)
      }
      if (item.type === 'category' && Array.isArray(item.items)) {
        for (const id of extractDocIds(item.items)) {
          ids.add(id)
        }
      }
    }
  }
  return ids
}

async function main() {
  let totalMissing = 0

  for (const section of SECTIONS) {
    const sectionDir = join(CONTENT_ROOT, section)
    const sidebarPath = join(sectionDir, 'sidebars.js')

    // Check the sidebar file exists
    try {
      await stat(sidebarPath)
    } catch {
      console.log(`⚠  No sidebars.js found for "${section}", skipping.`)
      continue
    }

    // Import the sidebar config
    const sidebarModule = await import(pathToFileURL(sidebarPath).href)
    const sidebars = sidebarModule.default || sidebarModule.sidebars || sidebarModule

    // Collect all doc IDs from every sidebar defined in the file
    const allIds = new Set()
    for (const [, items] of Object.entries(sidebars)) {
      if (Array.isArray(items)) {
        for (const id of extractDocIds(items)) {
          allIds.add(id)
        }
      }
    }

    // Find all .mdx files on disk
    const mdxFiles = await findMdxFiles(sectionDir)

    // Convert file paths to doc IDs (relative path without .mdx extension)
    const missing = []
    for (const file of mdxFiles) {
      const rel = relative(sectionDir, file)
      // Skip the sidebars.js itself or any non-mdx
      const docId = rel.replace(/\.mdx$/, '')
      if (!allIds.has(docId)) {
        missing.push(rel)
      }
    }

    if (missing.length > 0) {
      console.log(`\n${section}/ — ${missing.length} file(s) not in sidebar:\n`)
      for (const f of missing.sort()) {
        console.log(`  ${f}`)
      }
      totalMissing += missing.length
    } else {
      console.log(`\n${section}/ — all files are in the sidebar ✓`)
    }
  }

  console.log(
    `\n${totalMissing === 0 ? 'All good!' : `Total: ${totalMissing} file(s) not referenced in any sidebar.`}\n`,
  )
  process.exit(totalMissing > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(2)
})
