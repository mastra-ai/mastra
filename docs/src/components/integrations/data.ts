import sidebar from '../../content/en/integrations/sidebars'

interface IntegrationCustomProps {
  icon?: string
  iconDark?: string
  customCSS?: string
}

interface IntegrationDocItem {
  type: 'doc'
  id: string
  label: string
  customProps?: IntegrationCustomProps
}

interface IntegrationLinkItem {
  type: 'link'
  href: string
  label: string
  customProps?: IntegrationCustomProps
}

export type IntegrationItem = IntegrationDocItem | IntegrationLinkItem

export interface IntegrationCategory {
  type: 'category'
  label: string
  items: IntegrationItem[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function hasIntegrationCustomProps(value: Record<string, unknown>): boolean {
  return (
    value.customProps === undefined ||
    (isRecord(value.customProps) &&
      isOptionalString(value.customProps.icon) &&
      isOptionalString(value.customProps.iconDark) &&
      isOptionalString(value.customProps.customCSS))
  )
}

function isIntegrationItem(value: unknown): value is IntegrationItem {
  if (!isRecord(value) || typeof value.label !== 'string' || !hasIntegrationCustomProps(value)) {
    return false
  }

  if (value.type === 'doc') {
    return typeof value.id === 'string'
  }

  return value.type === 'link' && typeof value.href === 'string'
}

function isIntegrationCategory(value: unknown): value is IntegrationCategory {
  return (
    isRecord(value) &&
    value.type === 'category' &&
    typeof value.label === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isIntegrationItem)
  )
}

const integrationsSidebar: unknown = sidebar.integrationsSidebar

export const integrationCategories = Array.isArray(integrationsSidebar)
  ? integrationsSidebar.filter(isIntegrationCategory)
  : []

export function getIntegrationItemKey(item: IntegrationItem): string {
  return item.type === 'doc' ? item.id : item.href
}

export function getIntegrationItemHref(item: IntegrationItem): string {
  return item.type === 'doc' ? `/integrations/${item.id}` : item.href
}

export function getIntegrationItems(
  section: string,
  allowlist?: readonly string[],
  blocklist?: readonly string[],
): IntegrationItem[] {
  const category = integrationCategories.find(candidate => candidate.label === section)
  if (!category) return []

  const blockedKeys = new Set(blocklist)
  const items = allowlist
    ? allowlist.flatMap(key => {
        const item = category.items.find(candidate => getIntegrationItemKey(candidate) === key)
        return item ? [item] : []
      })
    : category.items

  return items.filter(item => !blockedKeys.has(getIntegrationItemKey(item)))
}
