import fs from 'fs/promises'
import path from 'path'

/**
 * Validates (and optionally fixes) the sorting order of items in the reference sidebar.
 *
 * Rules (applied recursively at every level):
 *   1. "Overview" labeled items always come first.
 *   2. "Configuration" labeled items come right after Overview.
 *   3. Standalone doc pages (non-dot labels) come before subcategories.
 *   4. Subcategories are sorted alphabetically by label (case-insensitive).
 *   5. Within doc pages, non-dot items come before dot-prefixed items.
 *   6. Non-dot items are sorted alphabetically (case-insensitive).
 *   7. Dot-prefixed items are sorted alphabetically (case-insensitive).
 *
 * Usage:
 *   pnpm validate:reference-sidebar        # validate only
 *   pnpm validate:reference-sidebar:fix     # fix in place
 */

interface SidebarDoc {
  type: 'doc'
  id: string
  label: string
}

interface SidebarCategory {
  type: 'category'
  label: string
  collapsed?: boolean
  items: SidebarItem[]
}

type SidebarItem = SidebarDoc | SidebarCategory

interface SidebarConfig {
  referenceSidebar: SidebarItem[]
}

interface SortError {
  path: string
  message: string
}

function isDoc(item: SidebarItem): item is SidebarDoc {
  return item.type === 'doc'
}

function isCategory(item: SidebarItem): item is SidebarCategory {
  return item.type === 'category'
}

function isDotLabel(label: string): boolean {
  return label.startsWith('.')
}

function isPinnedLabel(label: string): boolean {
  return label === 'Overview' || label === 'Configuration'
}

function sortKey(label: string): string {
  return label.toLowerCase().replace(/^\./, '')
}

function pinnedOrder(label: string): number {
  if (label === 'Overview') return 0
  if (label === 'Configuration') return 1
  return 2
}

function buildExpectedOrder(items: SidebarItem[]): SidebarItem[] {
  const pinnedItems: SidebarDoc[] = []
  const nonDotDocs: SidebarDoc[] = []
  const dotDocs: SidebarDoc[] = []
  const categories: SidebarCategory[] = []

  for (const item of items) {
    if (isCategory(item)) {
      categories.push(item)
    } else if (isDoc(item)) {
      if (isPinnedLabel(item.label)) {
        pinnedItems.push(item)
      } else if (isDotLabel(item.label)) {
        dotDocs.push(item)
      } else {
        nonDotDocs.push(item)
      }
    }
  }

  return [
    ...pinnedItems.sort((a, b) => pinnedOrder(a.label) - pinnedOrder(b.label)),
    ...nonDotDocs.sort((a, b) => sortKey(a.label).localeCompare(sortKey(b.label))),
    ...dotDocs.sort((a, b) => sortKey(a.label).localeCompare(sortKey(b.label))),
    ...categories.sort((a, b) => sortKey(a.label).localeCompare(sortKey(b.label))),
  ]
}

function validateItemOrder(items: SidebarItem[], contextPath: string): SortError[] {
  const errors: SortError[] = []
  const expectedOrder = buildExpectedOrder(items)

  for (let i = 0; i < items.length; i++) {
    const actual = items[i]!
    const expected = expectedOrder[i]!

    if (actual.label !== expected.label) {
      const actualLabels = items.map(it => it.label)
      const expectedLabels = expectedOrder.map(it => it.label)
      errors.push({
        path: contextPath,
        message: `Items are not in the expected order.\n    Actual:   ${formatLabels(actualLabels)}\n    Expected: ${formatLabels(expectedLabels)}`,
      })
      break
    }
  }

  // Recursively validate subcategories
  for (const item of items) {
    if (isCategory(item)) {
      const childPath = contextPath ? `${contextPath} > ${item.label}` : item.label
      errors.push(...validateItemOrder(item.items, childPath))
    }
  }

  return errors
}

function sortItemsRecursive(items: SidebarItem[]): SidebarItem[] {
  // First recursively sort children of any categories
  const itemsWithSortedChildren = items.map(item => {
    if (isCategory(item)) {
      return { ...item, items: sortItemsRecursive(item.items) }
    }
    return item
  })

  return buildExpectedOrder(itemsWithSortedChildren)
}

function serializeItem(item: SidebarItem, indent: number): string {
  const pad = ' '.repeat(indent)
  const innerPad = ' '.repeat(indent + 2)

  if (isDoc(item)) {
    const idStr = `id: '${item.id}'`
    const labelStr = `label: '${item.label.replace(/'/g, "\\'")}'`
    const oneLine = `${pad}{ type: 'doc', ${idStr}, ${labelStr} },`
    if (oneLine.length <= 100) {
      return oneLine
    }
    return [`${pad}{`, `${innerPad}type: 'doc',`, `${innerPad}${idStr},`, `${innerPad}${labelStr},`, `${pad}},`].join(
      '\n',
    )
  }

  // Category
  const cat = item as SidebarCategory
  const lines: string[] = []
  lines.push(`${pad}{`)
  lines.push(`${innerPad}type: 'category',`)
  lines.push(`${innerPad}label: '${cat.label.replace(/'/g, "\\'")}',`)
  if (cat.collapsed !== undefined) {
    lines.push(`${innerPad}collapsed: ${cat.collapsed},`)
  }
  lines.push(`${innerPad}items: [`)
  for (const child of cat.items) {
    lines.push(serializeItem(child, indent + 4))
  }
  lines.push(`${innerPad}],`)
  lines.push(`${pad}},`)
  return lines.join('\n')
}

function serializeSidebar(items: SidebarItem[]): string {
  const lines: string[] = []
  lines.push('/**')
  lines.push(' * Sidebar for Reference')
  lines.push(' */')
  lines.push('')
  lines.push('// @ts-check')
  lines.push('')
  lines.push("/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */")
  lines.push('const sidebars = {')
  lines.push('  referenceSidebar: [')
  for (const item of items) {
    lines.push(serializeItem(item, 4))
  }
  lines.push('  ],')
  lines.push('}')
  lines.push('')
  lines.push('export default sidebars')
  lines.push('')
  return lines.join('\n')
}

function formatLabels(labels: string[]): string {
  if (labels.length <= 8) {
    return labels.join(', ')
  }
  return labels.slice(0, 4).join(', ') + ', ..., ' + labels.slice(-2).join(', ')
}

function printErrors(errors: SortError[]): void {
  for (const error of errors) {
    console.log(`  ${error.path}:`)
    console.log(`    ${error.message}`)
    console.log()
  }
}

async function main(): Promise<void> {
  const fixMode = process.argv.includes('--fix')

  console.log(`${fixMode ? 'Fixing' : 'Validating'} reference sidebar sort order...\n`)

  const sidebarPath = path.join(process.cwd(), 'src/content/en/reference/sidebars.js')

  try {
    await fs.stat(sidebarPath)
  } catch {
    console.error(`Error: Sidebar file not found: ${sidebarPath}`)
    process.exit(1)
  }

  // Dynamic import of the JS sidebar file
  const sidebarModule = await import(sidebarPath)
  const sidebars: SidebarConfig = sidebarModule.default ?? sidebarModule

  const items = sidebars.referenceSidebar
  if (!items || !Array.isArray(items)) {
    console.error('Error: referenceSidebar not found or not an array')
    process.exit(1)
  }

  const errors = validateItemOrder(items, 'referenceSidebar')

  if (errors.length === 0) {
    console.log('All sidebar items are correctly sorted')
    return
  }

  if (!fixMode) {
    console.log(`Found ${errors.length} sorting issue(s):\n`)
    printErrors(errors)
    console.log('Run with --fix to auto-sort: pnpm validate:reference-sidebar:fix')
    process.exit(1)
  }

  // Fix mode: sort and write back
  const sorted = sortItemsRecursive(items)
  const output = serializeSidebar(sorted)
  await fs.writeFile(sidebarPath, output, 'utf-8')

  console.log(`Fixed ${errors.length} sorting issue(s) in sidebars.js`)
}

main().catch(error => {
  console.error('Unhandled error:', error instanceof Error ? error.message : error)
  process.exit(1)
})
