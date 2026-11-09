import { DEFAULT_CONFIG, shouldSkipPath, validateFileContent } from '../../validate-frontmatter'
import { CONTENT_ROOT, frontmatterKeyLine, isPartial } from '../content'
import { finding } from '../finding'
import { isKnownRuleId } from '../rules'
import type { Check, ContentFile, Finding } from '../types'

export const DESCRIPTION_MIN = 50
export const DESCRIPTION_MAX = 200

export function checkFrontmatter(file: ContentFile): Finding[] {
  const findings: Finding[] = []
  const at = (line?: number) => ({ file: file.path, line })

  if (file.bodyStartLine === 1) {
    // Partials are imported into other pages and do not need their own frontmatter.
    if (isPartial(file)) return findings
    return [finding('mastra/frontmatter-missing', 'No frontmatter block found', at(1))]
  }
  if (file.frontmatterError) {
    return [
      finding(
        'mastra/frontmatter-parse',
        `Invalid YAML: ${file.frontmatterError.message}`,
        at(file.frontmatterError.line ?? 1),
      ),
    ]
  }
  const data = file.frontmatter ?? {}

  // lintDisable is validated on every page, including partials.
  if (data.lintDisable !== undefined) {
    const line = frontmatterKeyLine(file, 'lintDisable')
    if (!Array.isArray(data.lintDisable) || data.lintDisable.some(v => typeof v !== 'string')) {
      findings.push(finding('mastra/lint-disable-invalid', '`lintDisable` must be a list of rule IDs', at(line)))
    } else {
      for (const id of data.lintDisable as string[]) {
        if (!isKnownRuleId(id)) {
          findings.push(finding('mastra/lint-disable-invalid', `Unknown rule ID in \`lintDisable\`: ${id}`, at(line)))
        }
      }
    }
  }

  if (isPartial(file)) return findings

  if (typeof data.title !== 'string' || data.title.trim() === '') {
    findings.push(
      finding('mastra/frontmatter-title', 'Missing `title` in frontmatter', at(frontmatterKeyLine(file, 'title') ?? 1)),
    )
  }

  if (typeof data.description !== 'string' || data.description.trim() === '') {
    findings.push(
      finding(
        'mastra/frontmatter-description',
        'Missing `description` in frontmatter',
        at(frontmatterKeyLine(file, 'description') ?? 1),
      ),
    )
  } else {
    const length = data.description.trim().length
    if (length < DESCRIPTION_MIN || length > DESCRIPTION_MAX) {
      findings.push(
        finding(
          'mastra/frontmatter-description-length',
          `\`description\` is ${length} characters; keep it between ${DESCRIPTION_MIN} and ${DESCRIPTION_MAX}`,
          at(frontmatterKeyLine(file, 'description')),
        ),
      )
    }
  }

  // Package checks reuse validate-frontmatter.ts, including its skip list.
  const contentPath = file.path.slice(CONTENT_ROOT.length + 1)
  if (file.path.startsWith(`${CONTENT_ROOT}/`) && !shouldSkipPath(contentPath, DEFAULT_CONFIG.skipPaths)) {
    const result = validateFileContent(file.source, contentPath, DEFAULT_CONFIG)
    for (const error of result.errors) {
      if (error.type === 'missing_packages' || error.type === 'invalid_packages') {
        findings.push(
          finding(
            'mastra/frontmatter-packages',
            capitalize(error.message),
            at(error.lineNumber ?? frontmatterKeyLine(file, 'packages') ?? 1),
          ),
        )
      }
    }
    if (result.warnings.length > 0) {
      const count = Array.isArray(data.packages) ? data.packages.length : 0
      findings.push(
        finding(
          'mastra/frontmatter-packages-max',
          `Lists ${count} packages (max ${DEFAULT_CONFIG.maxPackages}); keep only packages whose users need this page`,
          at(frontmatterKeyLine(file, 'packages')),
        ),
      )
    }
  }

  return findings
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const frontmatterCheck: Check = {
  name: 'frontmatter',
  categories: ['frontmatter'],
  scope: 'files',
  async run(ctx) {
    return { findings: ctx.files.flatMap(checkFrontmatter) }
  },
}
