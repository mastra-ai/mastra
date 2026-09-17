export const SITE_SECTION_ROOTS = {
  docs: '/docs',
  integrations: '/integrations',
  models: '/models',
  reference: '/reference',
} as const

const siteSectionRoots = Object.values(SITE_SECTION_ROOTS)

export function normalizeSiteSectionRoot(value: string): string {
  return siteSectionRoots.some(root => value.endsWith(`${root}/`)) ? value.slice(0, -1) : value
}
