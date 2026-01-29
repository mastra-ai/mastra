import path from 'path'

const DOCS_DIR = path.join('src', 'content', 'en')

export function getSidebarLocations(siteDir: string) {
  return [
    {
      id: 'Docs',
      path: path.join(siteDir, DOCS_DIR, 'docs', 'sidebars.js'),
    },
    {
      id: 'Models',
      path: path.join(siteDir, DOCS_DIR, 'models', 'sidebars.js'),
      // Condense these categories to just their overview link
      condensedCategories: ['Gateways', 'Providers'],
    },
    {
      id: 'Guides',
      path: path.join(siteDir, DOCS_DIR, 'guides', 'sidebars.js'),
    },
    {
      id: 'Reference',
      path: path.join(siteDir, DOCS_DIR, 'reference', 'sidebars.js'),
    },
  ]
}

type SidebarDoc = {
  type: 'doc'
  id: string
  label: string
  key?: string
  customProps?: Record<string, unknown>
}

type SidebarCategory = {
  type: 'category'
  label: string
  collapsed?: boolean
  customProps?: Record<string, unknown>
  items: SidebarItem[]
}

export type SidebarItem = string | SidebarDoc | SidebarCategory

export type SidebarsConfig = {
  [key: string]: SidebarItem[]
}

/**
 * Get the base URL for a documentation section
 */
export function getBaseUrl(sectionId: string): string {
  const baseUrls: Record<string, string> = {
    Docs: 'https://mastra.ai/docs',
    Models: 'https://mastra.ai/models',
    Guides: 'https://mastra.ai/guides',
    Reference: 'https://mastra.ai/reference',
  }
  return baseUrls[sectionId] || 'https://mastra.ai'
}

/**
 * Get the label for a sidebar item
 */
function getItemLabel(item: SidebarItem): string {
  if (typeof item === 'string') {
    // For string items like "index", capitalize first letter
    if (item === 'index') return 'Overview'
    return item.charAt(0).toUpperCase() + item.slice(1)
  }
  if (item.type === 'doc') {
    return item.label
  }
  if (item.type === 'category') {
    return item.label
  }
  return ''
}

/**
 * Get the doc ID for a sidebar item (for URL generation)
 */
function getDocId(item: SidebarItem): string | null {
  if (typeof item === 'string') {
    return item
  }
  if (item.type === 'doc') {
    return item.id
  }
  return null
}

/**
 * Find the overview/index doc in a category's items
 */
function findCategoryOverviewUrl(items: SidebarItem[], baseUrl: string): string | null {
  for (const item of items) {
    const docId = getDocId(item)
    if (docId && (docId.endsWith('/index') || docId === 'index')) {
      return `${baseUrl}/${docId}`
    }
  }
  return null
}

function addLlmsPostfix(url: string): string {
  if (url.endsWith('/')) {
    return `${url}llms.txt`
  } else {
    return `${url}/llms.txt`
  }
}

/**
 * Generate markdown list for sidebar items recursively
 */
export function generateMarkdownList(
  items: SidebarItem[],
  baseUrl: string,
  depth: number = 0,
  condensedCategories: string[] = [],
): string {
  const indent = '  '.repeat(depth)
  let output = ''

  for (const item of items) {
    const label = getItemLabel(item)
    const docId = getDocId(item)

    if (typeof item === 'string' || item.type === 'doc') {
      // It's a doc item - create a link
      const url = docId === 'index' ? addLlmsPostfix(baseUrl) : addLlmsPostfix(`${baseUrl}/${docId}`)
      output += `${indent}- [${label}](${url})\n`
    } else if (item.type === 'category') {
      // Check if this category should be condensed to just its overview link
      if (condensedCategories.includes(label)) {
        const overviewUrl = findCategoryOverviewUrl(item.items, baseUrl)
        if (overviewUrl) {
          output += `${indent}- [${label}](${addLlmsPostfix(overviewUrl)})\n`
        } else {
          // Fallback: just show category name without link
          output += `${indent}- ${label}\n`
        }
      } else {
        // It's a category - create a label and recurse
        output += `${indent}- ${label}\n`
        output += generateMarkdownList(item.items, baseUrl, depth + 1, condensedCategories)
      }
    }
  }

  return output
}

/**
 * Parse a sidebars.js file and extract the sidebar items using dynamic import
 */
export async function parseSidebarFile(filePath: string): Promise<SidebarItem[]> {
  // Convert to file:// URL for dynamic import
  const fileUrl = `file://${filePath}`
  const module = await import(fileUrl)
  const sidebars = module.default as SidebarsConfig

  const sidebarKey = Object.keys(sidebars)[0]
  return sidebars[sidebarKey]
}
