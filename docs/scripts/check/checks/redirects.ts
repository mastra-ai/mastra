import fs from 'fs/promises'
import path from 'path'
import { renderVercelConfig } from '../../generate-vercel-redirects.mjs'
import { finding } from '../finding'
import { buildRouteIndex, isSectionPath, loadRedirects, normalizeRoute, type Redirect } from '../routes'
import type { Check, CheckResult, Finding } from '../types'

const SOURCE_FILE = 'vercel.redirects.json'
const GENERATED_FILE = 'vercel.json'

function sourceLines(raw: string): Map<string, number> {
  // First line on which each `"source": "..."` appears, for locating findings.
  const lines = new Map<string, number>()
  raw.split('\n').forEach((line, index) => {
    const match = line.match(/"source"\s*:\s*"([^"]+)"/)
    if (match && !lines.has(match[1])) lines.set(match[1], index + 1)
  })
  return lines
}

function isWildcard(value: string): boolean {
  return value.includes(':') || value.includes('*')
}

export function checkRedirectList(redirects: Redirect[], routes: Set<string>, lines: Map<string, number>): Finding[] {
  const findings: Finding[] = []
  const at = (source: string) => ({ file: SOURCE_FILE, line: lines.get(source) })

  const seen = new Set<string>()
  for (const redirect of redirects) {
    if (seen.has(redirect.source)) {
      findings.push(
        finding('mastra/redirect-duplicate', `Duplicate redirect source ${redirect.source}`, at(redirect.source)),
      )
    }
    seen.add(redirect.source)
  }

  const bySource = new Map(redirects.map(redirect => [redirect.source.split('#', 1)[0], redirect]))
  for (const redirect of redirects) {
    const destination = redirect.destination.split('#', 1)[0]
    const next = bySource.get(destination)
    if (next) {
      findings.push(
        finding(
          'mastra/redirect-chain',
          `Redirect chain ${redirect.source} → ${redirect.destination} → ${next.destination}`,
          at(redirect.source),
          { suggestion: `Point ${redirect.source} at ${next.destination}` },
        ),
      )
      continue
    }
    if (destination.startsWith('/') && !isWildcard(destination) && isSectionPath(normalizeRoute(destination))) {
      if (!routes.has(normalizeRoute(destination))) {
        findings.push(
          finding(
            'mastra/redirect-destination',
            `Redirect destination ${redirect.destination} is not a page`,
            at(redirect.source),
          ),
        )
      }
    }
  }
  return findings
}

export const redirectsCheck: Check = {
  name: 'redirects',
  categories: ['redirects'],
  scope: 'repo',
  async run(ctx): Promise<CheckResult> {
    const result: CheckResult = { findings: [], fixed: 0 }
    const raw = await fs.readFile(path.join(ctx.rootDir, SOURCE_FILE), 'utf-8')
    const redirects = await loadRedirects(ctx.rootDir)
    const index = buildRouteIndex(await ctx.allFiles(), [])
    result.findings.push(...checkRedirectList(redirects, index.routes, sourceLines(raw)))

    // The generator refuses to run on duplicates or chains, which are already reported above.
    if (result.findings.some(f => f.ruleId === 'mastra/redirect-duplicate' || f.ruleId === 'mastra/redirect-chain')) {
      return result
    }
    let expected: string
    try {
      expected = renderVercelConfig(JSON.parse(raw))
    } catch (error) {
      result.skipped = [
        {
          check: 'mastra/redirect-generated-drift',
          reason: `Could not generate ${GENERATED_FILE}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
        },
      ]
      return result
    }
    const generatedPath = path.join(ctx.rootDir, GENERATED_FILE)
    const actual = await fs.readFile(generatedPath, 'utf-8').catch(() => '')
    if (expected !== actual) {
      if (ctx.fix && ctx.isRuleActive('mastra/redirect-generated-drift')) {
        await fs.writeFile(generatedPath, expected)
        result.fixed = 1
      } else {
        result.findings.push(
          finding(
            'mastra/redirect-generated-drift',
            `${GENERATED_FILE} is out of date with ${SOURCE_FILE}; run \`pnpm generate-vercel-redirects\``,
            { file: GENERATED_FILE },
          ),
        )
      }
    }
    return result
  },
}
