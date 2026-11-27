import path from 'path'
import {
  analyzeReferenceSidebar,
  loadReferenceSidebar,
  REFERENCE_SIDEBAR_PATH,
  writeSortedReferenceSidebar,
} from '../../validate-reference-sidebar-sort'
import { SECTIONS, validateSection } from '../../validate-sidebar-docs'
import { DEFAULT_SIDEBAR_NEW_TAG_DAYS, findStaleNewTags } from '../../validate-sidebar-new-tags'
import { toPosix } from '../content'
import { finding } from '../finding'
import type { Check, CheckResult, Finding } from '../types'

export const sidebarCheck: Check = {
  name: 'sidebar',
  categories: ['sidebar'],
  scope: 'repo',
  async run(ctx) {
    const findings: Finding[] = []
    const result: CheckResult = { findings, fixed: 0, skipped: [] }

    const sections = await Promise.all(SECTIONS.map(section => validateSection(section, ctx.rootDir)))
    for (const [index, section] of sections.entries()) {
      const config = SECTIONS[index]
      for (const docId of section.ghostPages) {
        findings.push(
          finding('mastra/sidebar-unlinked-page', `Page \`${docId}\` is not linked in ${config.sidebarPath}`, {
            file: `${config.contentDir}/${docId}.mdx`,
          }),
        )
      }
    }

    const sidebarFile = toPosix(path.relative(ctx.rootDir, REFERENCE_SIDEBAR_PATH))
    const items = await loadReferenceSidebar()
    const analysis = analyzeReferenceSidebar(items)
    const at = { file: sidebarFile }

    for (const error of analysis.duplicateErrors) {
      findings.push(finding('mastra/sidebar-duplicate-id', `${error.path}: ${error.message}`, at))
    }
    for (const warning of [...analysis.typeWarnings, ...analysis.propertyWarnings]) {
      findings.push(finding('mastra/sidebar-reference-item', `${warning.path}: ${warning.message}`, at))
    }
    // Sorting rewrites the whole file, which would drop properties the serializer doesn't know about.
    const canFix = analysis.propertyWarnings.length === 0
    if (analysis.sortErrors.length > 0 && ctx.fix && canFix && ctx.isRuleActive('mastra/sidebar-reference-sort')) {
      await writeSortedReferenceSidebar(items)
      result.fixed = analysis.sortErrors.length
    } else {
      for (const error of analysis.sortErrors) {
        findings.push(
          finding('mastra/sidebar-reference-sort', `${error.path}: ${error.message}`, at, {
            fixable: canFix,
          }),
        )
      }
    }

    try {
      const { stale } = await findStaleNewTags(DEFAULT_SIDEBAR_NEW_TAG_DAYS, ctx.rootDir)
      for (const tag of stale) {
        findings.push(
          finding(
            'mastra/sidebar-new-tag-stale',
            `"${tag.label}" has had a \`new\` tag since ${tag.date} (${tag.ageDays} days); remove it`,
            { file: tag.file, line: tag.lineNo },
          ),
        )
      }
    } catch (error) {
      result.skipped!.push({
        check: 'mastra/sidebar-new-tag-stale',
        reason: `git blame unavailable: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
      })
    }

    return result
  },
}
