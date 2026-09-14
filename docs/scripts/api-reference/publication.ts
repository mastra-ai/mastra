import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as v from 'valibot'
import { repositoryRoot } from './config'

const revisionSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/))
const repositorySchema = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/))
const commitSchema = v.object({ sha: revisionSchema })
const checksSchema = v.object({
  check_runs: v.array(
    v.object({
      id: v.pipe(v.number(), v.integer(), v.minValue(1)),
      name: v.string(),
      head_sha: revisionSchema,
      external_id: v.nullable(v.string()),
      status: v.string(),
      conclusion: v.nullable(v.string()),
      app: v.object({ slug: v.string() }),
    }),
  ),
})

export function requireSuccessfulCheck(value: unknown, revision: string) {
  v.parse(revisionSchema, revision)
  const checks = v.parse(checksSchema, value).check_runs.filter(check => check.name === 'api-reference')
  const attempts = checks.map(check => {
    const identity = /^api-reference:([1-9][0-9]*):([1-9][0-9]*)$/.exec(check.external_id ?? '')
    if (!identity) throw new Error('Unrecognized api-reference check identity')
    return { check, run: BigInt(identity[1]!), attempt: BigInt(identity[2]!) }
  })
  attempts.sort((a, b) =>
    a.run !== b.run
      ? a.run > b.run
        ? -1
        : 1
      : a.attempt !== b.attempt
        ? a.attempt > b.attempt
          ? -1
          : 1
        : b.check.id - a.check.id,
  )
  const latest = attempts[0]?.check
  if (
    !latest ||
    latest.head_sha !== revision ||
    latest.app.slug !== 'github-actions' ||
    latest.status !== 'completed' ||
    latest.conclusion !== 'success'
  )
    throw new Error(`Missing successful api-reference check for ${revision}`)
  return latest
}

export async function verifyPublicRevision(
  repository: string,
  revision: string,
  { cwd = repositoryRoot, request = fetch }: { cwd?: string; request?: typeof fetch } = {},
) {
  v.parse(repositorySchema, repository)
  v.parse(revisionSchema, revision)
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
  if (head !== revision) throw new Error('Source revision must equal checked-out HEAD')
  // No credentials: a successful response must establish public source reachability.
  const response = await request(`https://api.github.com/repos/${repository}/commits/${revision}`, {
    headers: { Accept: 'application/vnd.github+json' },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Source revision is not publicly reachable (HTTP ${response.status})`)
  const commit = v.parse(commitSchema, await response.json())
  if (commit.sha !== revision) throw new Error('GitHub returned a different source revision')
  return commit.sha
}

async function main() {
  const revision = v.parse(revisionSchema, process.env.API_REFERENCE_SOURCE_REVISION)
  const repository = v.parse(repositorySchema, process.env.GITHUB_REPOSITORY)
  if (process.argv.slice(2).some(arg => arg !== '--audit-checks'))
    throw new Error('Supported option: --audit-checks. Vercel auditing is deferred; no deployment APIs are called.')
  await verifyPublicRevision(repository, revision)
  if (process.argv.includes('--audit-checks')) {
    const checks = []
    for (let page = 1; ; page++) {
      const response = await fetch(
        `https://api.github.com/repos/${repository}/commits/${revision}/check-runs?check_name=api-reference&filter=all&per_page=100&page=${page}`,
        {
          headers: { Accept: 'application/vnd.github+json' },
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
        },
      )
      if (!response.ok) throw new Error(`Cannot audit GitHub checks (HTTP ${response.status})`)
      const batch = v.parse(checksSchema, await response.json()).check_runs
      checks.push(...batch)
      if (batch.length < 100) break
    }
    requireSuccessfulCheck({ check_runs: checks }, revision)
  }
  console.log(
    `Public source revision verified: ${repository}@${revision}. No deployment or promotion verification performed.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
