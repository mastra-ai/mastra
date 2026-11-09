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

export const RULES: RuleDefinition[] = [
  // frontmatter
  {
    id: 'mastra/frontmatter-missing',
    category: 'frontmatter',
    severity: 'error',
    fixable: false,
    description: 'The page has no `---` frontmatter block.',
  },
  {
    id: 'mastra/frontmatter-parse',
    category: 'frontmatter',
    severity: 'error',
    fixable: false,
    description: 'The frontmatter is not valid YAML.',
  },
  {
    id: 'mastra/frontmatter-title',
    category: 'frontmatter',
    severity: 'error',
    fixable: false,
    description: 'The frontmatter has no non-empty `title`.',
  },
  {
    id: 'mastra/description-required',
    category: 'frontmatter',
    severity: 'warn',
    fixable: false,
    description: 'The frontmatter has no non-empty `description`.',
  },
  {
    id: 'mastra/description-length',
    category: 'frontmatter',
    severity: 'warn',
    fixable: false,
    description: 'The `description` is shorter than 50 or longer than 200 characters.',
  },
  {
    id: 'mastra/frontmatter-packages',
    category: 'frontmatter',
    severity: 'error',
    fixable: false,
    description: 'The `packages` field is missing, empty, or lists an invalid package name.',
  },
  {
    id: 'mastra/frontmatter-packages-max',
    category: 'frontmatter',
    severity: 'warn',
    fixable: false,
    description: 'The `packages` field lists more than 4 packages. Each package embeds a full copy of the page.',
  },
  {
    id: 'mastra/lint-comment-invalid',
    category: 'structure',
    severity: 'error',
    fixable: false,
    description: 'An inline `lint disable`, `enable`, or `ignore` comment names an unknown rule ID.',
  },
  // sidebar
  {
    id: 'mastra/sidebar-unlinked-page',
    category: 'sidebar',
    severity: 'error',
    fixable: false,
    description: 'An MDX page is not linked from its section sidebar.',
  },
  {
    id: 'mastra/sidebar-reference-sort',
    category: 'sidebar',
    severity: 'error',
    fixable: true,
    description: 'The reference sidebar is not sorted alphabetically.',
  },
  {
    id: 'mastra/sidebar-duplicate-id',
    category: 'sidebar',
    severity: 'error',
    fixable: false,
    description: 'A doc ID appears more than once in the reference sidebar.',
  },
  {
    id: 'mastra/sidebar-reference-item',
    category: 'sidebar',
    severity: 'warn',
    fixable: false,
    description: 'A reference sidebar item has an unknown type, or a property the sort fixer would drop.',
  },
  {
    id: 'mastra/sidebar-new-tag-stale',
    category: 'sidebar',
    severity: 'warn',
    fixable: false,
    description: 'A sidebar `new` tag was added more than 30 days ago.',
  },
  // structure
  {
    id: 'mastra/single-h1',
    category: 'structure',
    severity: 'warn',
    fixable: false,
    description: 'The page must have exactly one `#` heading.',
  },
  {
    id: 'mastra/code-block-lang',
    category: 'structure',
    severity: 'warn',
    fixable: false,
    description: 'A fenced code block has no language, e.g. ` ```typescript `.',
  },
  // links
  {
    id: 'mastra/internal-link',
    category: 'links',
    severity: 'warn',
    fixable: false,
    description: 'An internal link points to a route that does not exist.',
  },
  {
    id: 'mastra/redirected-link',
    category: 'links',
    severity: 'warn',
    fixable: true,
    description: 'An internal link points to a redirect source. The fix rewrites it to the destination.',
  },
  {
    id: 'mastra/no-self-host-url',
    category: 'links',
    severity: 'warn',
    fixable: true,
    description: 'A link uses `https://mastra.ai/...` for a docs route. The fix rewrites it to a root-relative path.',
  },
  // prose
  {
    id: 'mastra/bare-url',
    category: 'prose',
    severity: 'warn',
    fixable: false,
    description: 'A URL appears as plain text instead of a Markdown link.',
  },
  // format
  {
    id: 'mastra/format',
    category: 'format',
    severity: 'error',
    fixable: true,
    description: 'The file is not formatted with oxfmt (MDX via `@mastra/lint-docs/oxfmt-mdx`).',
  },
  // redirects
  {
    id: 'mastra/redirect-duplicate',
    category: 'redirects',
    severity: 'error',
    fixable: false,
    description: '`vercel.redirects.json` has two redirects with the same source.',
  },
  {
    id: 'mastra/redirect-chain',
    category: 'redirects',
    severity: 'error',
    fixable: false,
    description: 'A redirect points to the source of another redirect.',
  },
  {
    id: 'mastra/redirect-destination',
    category: 'redirects',
    severity: 'error',
    fixable: false,
    description: 'An internal redirect destination does not resolve to a page.',
  },
  {
    id: 'mastra/redirect-generated-drift',
    category: 'redirects',
    severity: 'error',
    fixable: true,
    description: '`vercel.json` is out of date with `vercel.redirects.json`. The fix regenerates it.',
  },
]

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
