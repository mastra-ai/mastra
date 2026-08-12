import sidebar from '../../content/en/integrations/sidebars'

export interface IntegrationItem {
  type: 'doc'
  id: string
  label: string
  customProps?: {
    icon?: string
    iconDark?: string
    customCSS?: string
  }
}

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

function isIntegrationItem(value: unknown): value is IntegrationItem {
  if (!isRecord(value) || value.type !== 'doc' || typeof value.id !== 'string' || typeof value.label !== 'string') {
    return false
  }

  if (value.customProps === undefined) {
    return true
  }

  return (
    isRecord(value.customProps) &&
    isOptionalString(value.customProps.icon) &&
    isOptionalString(value.customProps.iconDark) &&
    isOptionalString(value.customProps.customCSS)
  )
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

export const integrationCategories = Array.isArray(sidebar.integrationsSidebar)
  ? sidebar.integrationsSidebar.filter(isIntegrationCategory)
  : []

export function getIntegrationItems(section: string, allowlist?: readonly string[]): IntegrationItem[] {
  const category = integrationCategories.find(candidate => candidate.label === section)
  if (!category) return []
  if (!allowlist) return category.items

  const itemsById = new Map(category.items.map(item => [item.id, item]))
  return allowlist.flatMap(id => {
    const item = itemsById.get(id)
    return item ? [item] : []
  })
}
