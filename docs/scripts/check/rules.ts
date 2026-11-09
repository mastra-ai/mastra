import type { Category, Severity } from './types'

export interface RuleDefinition {
  id: string
  category: Category
  severity: Severity
  fixable: boolean
  description: string
}

/**
 * Rule families whose IDs are derived from an external tool. `mastra/remark-heading-increment`
 * wraps remark-lint's `heading-increment`, `mastra/vale-mastra-headings` wraps Vale's `Mastra.Headings`.
 */
export const RULE_FAMILIES: RuleDefinition[] = [
  {
    id: 'mastra/remark-*',
    category: 'prose',
    severity: 'error',
    fixable: false,
    description: 'remark-lint rules from `@mastra/lint-docs/remark-preset`, e.g. `mastra/remark-heading-increment`.',
  },
  {
    id: 'mastra/vale-*',
    category: 'prose',
    severity: 'warn',
    fixable: false,
    description:
      'Vale checks from `.vale.ini`, e.g. `mastra/vale-mastra-headings`. Severity follows the Vale level (error → error, warning → warning, suggestion → info).',
  },
]

type RuleRow = [id: string, category: Category, severity: Severity, description: string, fixable?: true]

// prettier-ignore
const RULE_ROWS: RuleRow[] = [
  // frontmatter
  ['mastra/frontmatter-missing', 'frontmatter', 'error', 'The page has no `---` frontmatter block.'],
  ['mastra/frontmatter-parse', 'frontmatter', 'error', 'The frontmatter is not valid YAML.'],
  ['mastra/frontmatter-title', 'frontmatter', 'error', 'The frontmatter has no non-empty `title`.'],
  ['mastra/description-required', 'frontmatter', 'warn', 'The frontmatter has no non-empty `description`.'],
  ['mastra/description-length', 'frontmatter', 'warn', 'The `description` is shorter than 50 or longer than 200 characters.'],
  ['mastra/frontmatter-packages', 'frontmatter', 'error', 'The `packages` field is missing, empty, or lists an invalid package name.'],
  ['mastra/frontmatter-packages-max', 'frontmatter', 'warn', 'The `packages` field lists more than 4 packages. Each package embeds a full copy of the page.'],
  ['mastra/lint-comment-invalid', 'structure', 'error', 'An inline `lint disable`, `enable`, or `ignore` comment names an unknown rule ID.'],
  // sidebar
  ['mastra/sidebar-unlinked-page', 'sidebar', 'error', 'An MDX page is not linked from its section sidebar.'],
  ['mastra/sidebar-reference-sort', 'sidebar', 'error', 'The reference sidebar is not sorted alphabetically.', true],
  ['mastra/sidebar-duplicate-id', 'sidebar', 'error', 'A doc ID appears more than once in the reference sidebar.'],
  ['mastra/sidebar-reference-item', 'sidebar', 'warn', 'A reference sidebar item has an unknown type, or a property the sort fixer would drop.'],
  ['mastra/sidebar-new-tag-stale', 'sidebar', 'warn', 'A sidebar `new` tag was added more than 30 days ago.'],
  // structure
  ['mastra/single-h1', 'structure', 'warn', 'The page must have exactly one `#` heading.'],
  ['mastra/code-block-lang', 'structure', 'warn', 'A fenced code block has no language, e.g. ` ```typescript `.'],
  // links
  ['mastra/internal-link', 'links', 'warn', 'An internal link points to a route that does not exist.'],
  ['mastra/redirected-link', 'links', 'warn', 'An internal link points to a redirect source. The fix rewrites it to the destination.', true],
  ['mastra/no-self-host-url', 'links', 'warn', 'A link uses `https://mastra.ai/...` for a docs route. The fix rewrites it to a root-relative path.', true],
  // prose
  ['mastra/bare-url', 'prose', 'warn', 'A URL appears as plain text instead of a Markdown link.'],
  // format
  ['mastra/format', 'format', 'error', 'The file is not formatted with oxfmt (MDX via `@mastra/lint-docs/oxfmt-mdx`).', true],
  // redirects
  ['mastra/redirect-duplicate', 'redirects', 'error', '`vercel.redirects.json` has two redirects with the same source.'],
  ['mastra/redirect-chain', 'redirects', 'error', 'A redirect points to the source of another redirect.'],
  ['mastra/redirect-destination', 'redirects', 'error', 'An internal redirect destination does not resolve to a page.'],
  ['mastra/redirect-generated-drift', 'redirects', 'error', '`vercel.json` is out of date with `vercel.redirects.json`. The fix regenerates it.', true],
]

export const RULES: RuleDefinition[] = RULE_ROWS.map(([id, category, severity, description, fixable]) => ({
  id,
  category,
  severity,
  description,
  fixable: fixable ?? false,
}))

const RULES_BY_ID = new Map(RULES.map(rule => [rule.id, rule]))

export function getRule(id: string): RuleDefinition {
  const rule = RULES_BY_ID.get(id)
  if (rule) return rule
  const family = RULE_FAMILIES.find(f => id.startsWith(f.id.slice(0, -1)))
  if (family) return family
  throw new Error(`Unknown rule ID: ${id}`)
}

/** True when `id` is a registered rule, or belongs to a tool-derived family like `mastra/remark-*`. */
export function isKnownRuleId(id: string): boolean {
  return RULES_BY_ID.has(id) || RULE_FAMILIES.some(f => id.startsWith(f.id.slice(0, -1)) && id.length > f.id.length - 1)
}

/** True for a known rule ID, or a trailing-`*` pattern such as `mastra/redirect-*` that matches at least one rule. */
export function isKnownRulePattern(pattern: string): boolean {
  if (!pattern.endsWith('*')) return isKnownRuleId(pattern)
  const prefix = pattern.slice(0, -1)
  return (
    RULES.some(rule => rule.id.startsWith(prefix)) ||
    RULE_FAMILIES.some(f => {
      const familyPrefix = f.id.slice(0, -1)
      return familyPrefix.startsWith(prefix) || prefix.startsWith(familyPrefix)
    })
  )
}

/** Matches a rule ID against a filter: exact ID, or a trailing `*` prefix such as `mastra/sidebar-*`. */
export function matchesRuleFilter(id: string, filter: string): boolean {
  return filter.endsWith('*') ? id.startsWith(filter.slice(0, -1)) : id === filter
}

/** Converts an external tool rule name into a stable slug: `Mastra.Headings` → `mastra-headings`. */
export function slugifyRuleName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}
