// Flatten Docusaurus sidebar configs into an ordered list of doc IDs.
// Sidebar entries may be:
//   - a string, shorthand for { type: 'doc', id: <string> }
//   - { type: 'doc', id, label? }
//   - { type: 'category', label, items: [...] }
//   - { type: 'html' | 'link' | 'ref' } — skipped
//
// The flattener returns a tree of sections, so the PDF can render chapter /
// category headings in the same order as the live docs.

import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

export async function loadSidebar(sidebarFile, sidebarKey) {
  const url = pathToFileURL(sidebarFile).href
  const mod = await import(url)
  const sidebars = mod.default || mod
  const key = sidebarKey || Object.keys(sidebars)[0]
  const items = sidebars[key]
  if (!Array.isArray(items)) {
    throw new Error(`Sidebar key "${key}" not found in ${sidebarFile}`)
  }
  return items
}

/**
 * Walk a sidebar's items array and resolve each doc entry to its MDX path.
 * Returns nested sections that mirror the sidebar structure, for rendering
 * chapter and sub-chapter headings in the PDF.
 */
export function flattenSidebar(items, options) {
  const { contentDir, depth = 1 } = options
  const out = []

  for (const raw of items) {
    const item = typeof raw === 'string' ? { type: 'doc', id: raw } : raw
    if (!item || typeof item !== 'object') continue

    if (item.type === 'doc' || (item.type === undefined && item.id)) {
      const mdxPath = resolveDocFile(contentDir, item.id)
      if (mdxPath) {
        out.push({
          type: 'doc',
          id: item.id,
          label: item.label,
          file: mdxPath,
          depth,
        })
      }
      continue
    }

    if (item.type === 'category') {
      out.push({
        type: 'category',
        label: item.label,
        depth,
        children: flattenSidebar(item.items || [], {
          contentDir,
          depth: depth + 1,
        }),
      })
      continue
    }

    // html, link, ref, etc. — skip.
  }

  return out
}

function resolveDocFile(contentDir, id) {
  const candidates = [
    path.join(contentDir, `${id}.mdx`),
    path.join(contentDir, `${id}.md`),
    path.join(contentDir, id, 'index.mdx'),
    path.join(contentDir, id, 'index.md'),
  ]
  for (const p of candidates) {
    try {
      if (fs.statSync(p).isFile()) return p
    } catch {
      // try next
    }
  }
  return null
}
