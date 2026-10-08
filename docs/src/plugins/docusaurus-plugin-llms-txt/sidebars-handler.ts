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
      id: 'Integrations',
      path: path.join(siteDir, DOCS_DIR, 'integrations', 'sidebars.js'),
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

type SidebarCategoryLink =
  | string
  | { type: 'doc'; id: string }
  | { type: 'generated-index' }
  | { type: 'ref'; id: string }

type SidebarCategory = {
  type: 'category'
  label: string
  collapsed?: boolean
  link?: SidebarCategoryLink
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
    Integrations: 'https://mastra.ai/integrations',
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
 * Build the sibling markdown URL for an "index" doc.
 *
 * The index doc maps to the section's own route. With trailingSlash: false the
 * sibling file is "<route>.md", except the site root ("/") whose file is
 * "index.md". For a nested section baseUrl already carries the path segment
 * (e.g. ".../docs"), so the sibling is "${baseUrl}.md". For the root section
 * baseUrl is the bare origin, so the sibling is "${baseUrl}/index.md".
 */
function indexMarkdownUrl(baseUrl: string): string {
  const hasPathSegment = new URL(baseUrl).pathname !== '/'
  return hasPathSegment ? `${baseUrl}.md` : `${baseUrl}/index.md`
}

/**
 * Build the markdown URL for a doc id.
 *
 * Index docs map to their parent route, so "x/index" is served as "<baseUrl>/x.md"
 * and never as "<baseUrl>/x/index.md".
 */
function docMarkdownUrl(docId: string, baseUrl: string): string {
  if (docId === 'index') {
    return indexMarkdownUrl(baseUrl)
  }

  if (docId.endsWith('/index')) {
    return `${baseUrl}/${docId.slice(0, -'/index'.length)}.md`
  }

  return `${baseUrl}/${docId}.md`
}

/**
 * Get the doc a category links to.
 *
 * Docusaurus lets a category declare its overview page on `link` instead of listing
 * it in `items`, so the link is the first place to look for a category's overview.
 */
function getCategoryLinkDocId(category: SidebarCategory): string | null {
  const link = category.link

  if (typeof link === 'string') {
    return link
  }

  if (link && typeof link === 'object' && link.type === 'doc') {
    return link.id
  }

  return null
}

/**
 * Find an index doc listed in a category's items.
 */
function findIndexDocId(items: SidebarItem[]): string | null {
  for (const item of items) {
    const docId = getDocId(item)
    if (docId && (docId.endsWith('/index') || docId === 'index')) {
      return docId
    }
  }

  return null
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

    if (typeof item === 'string' || item.type === 'doc') {
      // It's a doc item - link to the page's sibling markdown file
      const docId = typeof item === 'string' ? item : item.id
      output += `${indent}- [${label}](${docMarkdownUrl(docId, baseUrl)})\n`
    } else if (item.type === 'category') {
      const condensed = condensedCategories.includes(label)

      // Condensed categories collapse to one link, so an index doc in their items is a
      // valid overview. Normal categories only link the label when they declare a link,
      // otherwise the overview doc listed in their items would appear twice.
      const overviewDocId = condensed
        ? (getCategoryLinkDocId(item) ?? findIndexDocId(item.items))
        : getCategoryLinkDocId(item)

      output += overviewDocId
        ? `${indent}- [${label}](${docMarkdownUrl(overviewDocId, baseUrl)})\n`
        : `${indent}- ${label}\n`

      if (!condensed) {
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

  return Object.values(sidebars).flat()
}
