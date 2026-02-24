import { execFileSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

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

/** Locale-independent comparison using pre-lowercased sort keys. */
function compareKeys(a: string, b: string): number {
  const ka = sortKey(a)
  const kb = sortKey(b)
  return ka < kb ? -1 : ka > kb ? 1 : 0
}

/** Escape a string for safe embedding in a single-quoted JS string literal. */
function escapeJsString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
  const unknowns: SidebarItem[] = []

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
    } else {
      // Preserve unknown types (e.g. 'link', 'html') so they aren't silently dropped
      unknowns.push(item)
    }
  }

  return [
    ...pinnedItems.sort((a, b) => pinnedOrder(a.label) - pinnedOrder(b.label)),
    ...nonDotDocs.sort((a, b) => compareKeys(a.label, b.label)),
    ...dotDocs.sort((a, b) => compareKeys(a.label, b.label)),
    ...categories.sort((a, b) => compareKeys(a.label, b.label)),
    ...unknowns,
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
    const idStr = `id: '${escapeJsString(item.id)}'`
    const labelStr = `label: '${escapeJsString(item.label)}'`
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
  lines.push(`${innerPad}label: '${escapeJsString(cat.label)}',`)
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

const KNOWN_DOC_KEYS = new Set(['type', 'id', 'label'])
const KNOWN_CATEGORY_KEYS = new Set(['type', 'label', 'collapsed', 'items'])

/** Warn about item types that the script doesn't know how to sort/serialize. */
function validateItemTypes(items: SidebarItem[], contextPath: string): SortError[] {
  const errors: SortError[] = []
  for (const item of items) {
    if (!isDoc(item) && !isCategory(item)) {
      errors.push({
        path: contextPath,
        message: `Unknown item type "${(item as Record<string, unknown>).type}" — item will be preserved but not sorted`,
      })
    }
    if (isCategory(item)) {
      const childPath = contextPath ? `${contextPath} > ${item.label}` : item.label
      errors.push(...validateItemTypes(item.items, childPath))
    }
  }
  return errors
}

/** Warn about properties that the serializer would drop in --fix mode. */
function validateKnownProperties(items: SidebarItem[], contextPath: string): SortError[] {
  const errors: SortError[] = []
  for (const item of items) {
    const knownKeys = isDoc(item) ? KNOWN_DOC_KEYS : isCategory(item) ? KNOWN_CATEGORY_KEYS : null
    if (knownKeys) {
      const extraKeys = Object.keys(item).filter(k => !knownKeys.has(k))
      if (extraKeys.length > 0) {
        errors.push({
          path: contextPath,
          message: `"${item.label}" has unrecognized properties: ${extraKeys.join(', ')}. These will be lost if --fix is used.`,
        })
      }
    }
    if (isCategory(item)) {
      const childPath = contextPath ? `${contextPath} > ${item.label}` : item.label
      errors.push(...validateKnownProperties(item.items, childPath))
    }
  }
  return errors
}

/** Detect duplicate doc IDs across the entire sidebar tree. */
function validateDuplicateIds(
  items: SidebarItem[],
  contextPath: string,
  seen: Map<string, string> = new Map(),
): SortError[] {
  const errors: SortError[] = []
  for (const item of items) {
    if (isDoc(item)) {
      const existing = seen.get(item.id)
      if (existing) {
        errors.push({
          path: contextPath,
          message: `Duplicate doc id "${item.id}" — first seen at "${existing}"`,
        })
      } else {
        seen.set(item.id, contextPath)
      }
    }
    if (isCategory(item)) {
      const childPath = contextPath ? `${contextPath} > ${item.label}` : item.label
      errors.push(...validateDuplicateIds(item.items, childPath, seen))
    }
  }
  return errors
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

  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const sidebarPath = path.resolve(scriptDir, '../src/content/en/reference/sidebars.js')

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

  // Run all validations
  const sortErrors = validateItemOrder(items, 'referenceSidebar')
  const typeWarnings = validateItemTypes(items, 'referenceSidebar')
  const propertyWarnings = validateKnownProperties(items, 'referenceSidebar')
  const duplicateErrors = validateDuplicateIds(items, 'referenceSidebar')

  // Always print warnings (non-blocking)
  if (typeWarnings.length > 0) {
    console.log(`Warnings — unknown item types:\n`)
    printErrors(typeWarnings)
  }
  if (propertyWarnings.length > 0) {
    console.log(`Warnings — unrecognized properties (would be lost with --fix):\n`)
    printErrors(propertyWarnings)
  }

  const errors = [...duplicateErrors, ...sortErrors]

  if (errors.length === 0) {
    console.log('All sidebar items are correctly sorted')
    return
  }

  if (duplicateErrors.length > 0) {
    console.log(`Found ${duplicateErrors.length} duplicate ID(s):\n`)
    printErrors(duplicateErrors)
  }

  if (!fixMode) {
    if (sortErrors.length > 0) {
      console.log(`Found ${sortErrors.length} sorting issue(s):\n`)
      printErrors(sortErrors)
    }
    console.log('Run with --fix to auto-sort: pnpm validate:reference-sidebar:fix')
    process.exit(1)
  }

  if (sortErrors.length > 0) {
    // Fix mode: sort and write back atomically
    const sorted = sortItemsRecursive(items)
    const output = serializeSidebar(sorted)
    const tmpPath = sidebarPath + '.tmp'
    await fs.writeFile(tmpPath, output, 'utf-8')
    await fs.rename(tmpPath, sidebarPath)
    execFileSync('pnpm', ['prettier', '--write', sidebarPath], { stdio: 'ignore' })
    console.log(`Fixed ${sortErrors.length} sorting issue(s) in sidebars.js`)
  }

  // Duplicate IDs can't be auto-fixed — always fail CI
  if (duplicateErrors.length > 0) {
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Unhandled error:', error instanceof Error ? error.message : error)
  process.exit(1)
})
