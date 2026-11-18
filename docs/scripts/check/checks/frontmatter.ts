import { DEFAULT_CONFIG, shouldSkipPath, validateFileContent } from '../../validate-frontmatter'
import { CONTENT_ROOT, frontmatterKeyLine, isPartial } from '../content'
import { finding } from '../finding'
import type { Check, ContentFile, Finding } from '../types'

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

  if (isPartial(file)) return findings

  if (typeof data.title !== 'string' || data.title.trim() === '') {
    findings.push(
      finding('mastra/frontmatter-title', 'Missing `title` in frontmatter', at(frontmatterKeyLine(file, 'title') ?? 1)),
    )
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
