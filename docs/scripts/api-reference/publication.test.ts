import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { repositoryRoot } from './config'
import { requireSuccessfulCheck, verifyPublicRevision } from './publication'

const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim()
const other = 'a'.repeat(40) === revision ? 'b'.repeat(40) : 'a'.repeat(40)
const successful = {
  id: 1,
  name: 'api-reference',
  head_sha: revision,
  external_id: 'api-reference:12:1',
  status: 'completed',
  conclusion: 'success',
  app: { slug: 'github-actions' },
}

describe('read-only publication prerequisites', () => {
  it('accepts only the latest successful exact-SHA result from GitHub Actions', () => {
    expect(requireSuccessfulCheck({ check_runs: [successful] }, revision)).toEqual(successful)
    expect(() => requireSuccessfulCheck({ check_runs: [] }, revision)).toThrow('Missing successful')
    expect(() =>
      requireSuccessfulCheck({ check_runs: [successful, { ...successful, id: 2, conclusion: 'failure' }] }, revision),
    ).toThrow('Missing successful')
  })
  it('orders workflow runs and attempts rather than late check creation', () => {
    const lateOldSuccess = { ...successful, id: 100, external_id: 'api-reference:11:9' }
    const newPending = { ...successful, id: 2, external_id: 'api-reference:12:2', status: 'queued', conclusion: null }
    expect(() => requireSuccessfulCheck({ check_runs: [lateOldSuccess, successful, newPending] }, revision)).toThrow(
      'Missing successful',
    )
    expect(() => requireSuccessfulCheck({ check_runs: [{ ...successful, external_id: null }] }, revision)).toThrow(
      'check identity',
    )
  })
  it.each([
    { status: 'queued', conclusion: null },
    { status: 'in_progress', conclusion: null },
    { conclusion: 'cancelled' },
    { conclusion: 'failure' },
    { conclusion: 'skipped' },
    { conclusion: 'neutral' },
    { conclusion: 'timed_out' },
    { head_sha: other },
    { app: { slug: 'another-app' } },
    { name: 'unrelated-check' },
  ])('rejects an invalid check: %j', change => {
    expect(() => requireSuccessfulCheck({ check_runs: [{ ...successful, ...change }] }, revision)).toThrow()
  })
  it('checks the public commit without credentials or redirects', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ sha: revision })))
    await expect(verifyPublicRevision('mastra-ai/mastra', revision, { request })).resolves.toBe(revision)
    expect(request).toHaveBeenCalledWith(
      `https://api.github.com/repos/mastra-ai/mastra/commits/${revision}`,
      expect.objectContaining({
        headers: { Accept: 'application/vnd.github+json' },
        redirect: 'error',
      }),
    )
  })
  it.each([403, 404, 429, 500])('fails closed on unreachable source (HTTP %i)', async status => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))
    await expect(verifyPublicRevision('mastra-ai/mastra', revision, { request })).rejects.toThrow(
      'not publicly reachable',
    )
  })
  it('rejects wrong HEAD and malformed revision before requesting GitHub', async () => {
    const request = vi.fn<typeof fetch>()
    await expect(verifyPublicRevision('mastra-ai/mastra', other, { request })).rejects.toThrow('checked-out HEAD')
    await expect(verifyPublicRevision('mastra-ai/mastra', 'main', { request })).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  })
  it('rejects a different remote commit and transport failure', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: other })))
      .mockRejectedValueOnce(new Error('network unavailable'))
    await expect(verifyPublicRevision('mastra-ai/mastra', revision, { request })).rejects.toThrow(
      'different source revision',
    )
    await expect(verifyPublicRevision('mastra-ai/mastra', revision, { request })).rejects.toThrow('network unavailable')
  })
})

const resultWorkflow = readFileSync(join(repositoryRoot, '.github/workflows/api-reference-result.yml'), 'utf8')
const marker = '          script: |\n'
if (!resultWorkflow.includes(marker)) throw new Error('Missing reporter script')
const script = resultWorkflow
  .slice(resultWorkflow.indexOf(marker) + marker.length)
  .split('\n')
  .map(line => line.slice(12))
  .join('\n')
const report = new Function('github', 'context', `return (async () => {\n${script}\n})()`)
function fixture() {
  const run = {
    id: 12,
    run_attempt: 1,
    head_sha: revision,
    repository: { full_name: 'mastra-ai/mastra' },
    path: '.github/workflows/api-reference.yml@main',
    event: 'pull_request',
    status: 'completed',
    conclusion: 'success',
    html_url: 'run-detail',
  }
  const job = {
    name: 'Validate API reference',
    head_sha: revision,
    conclusion: 'success',
    steps: [
      'Verify checked-out revision',
      'Build extraction prerequisites',
      'Check API artifact freshness',
      'Validate source-backed pages',
      'Verify public source revision',
    ].map(name => ({ name, conclusion: 'success' })),
  }
  const listJobsForWorkflowRun = vi.fn()
  const github = {
    rest: {
      actions: { getWorkflowRun: vi.fn().mockResolvedValue({ data: run }), listJobsForWorkflowRun },
      checks: { listForRef: vi.fn(), create: vi.fn(), update: vi.fn() },
    },
    paginate: vi.fn(async method => (method === listJobsForWorkflowRun ? [job] : [])),
  }
  const context = {
    repo: { owner: 'mastra-ai', repo: 'mastra' },
    payload: { workflow_run: { id: run.id, head_sha: other } },
  }
  return { github, context, run, job }
}

describe('exact-SHA result reporter', () => {
  it.each(['pull_request', 'push'])('reports the API-verified head for %s, not the event payload SHA', async event => {
    const f = fixture()
    f.run.event = event
    await report(f.github, f.context)
    expect(f.github.rest.checks.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'api-reference', head_sha: revision, conclusion: 'success' }),
    )
  })
  it.each(['queued', 'in_progress'])('keeps %s runs pending', async status => {
    const f = fixture()
    f.run.status = status
    await report(f.github, f.context)
    expect(f.github.rest.checks.create.mock.calls[0]?.[0]).not.toHaveProperty('conclusion')
  })
  it.each(['failure', 'cancelled', 'skipped'])('does not report %s as success', async conclusion => {
    const f = fixture()
    f.run.conclusion = conclusion
    await report(f.github, f.context)
    expect(f.github.rest.checks.create.mock.calls[0]?.[0].conclusion).not.toBe('success')
  })
  it('rejects successful workflows with skipped page validation or wrong job SHA', async () => {
    const f = fixture()
    f.job.steps.find(step => step.name === 'Validate source-backed pages')!.conclusion = 'skipped'
    await report(f.github, f.context)
    expect(f.github.rest.checks.create.mock.calls[0]?.[0].conclusion).toBe('failure')
    f.job.steps.forEach(step => {
      step.conclusion = 'success'
    })
    f.job.head_sha = other
    await report(f.github, f.context)
    expect(f.github.rest.checks.create.mock.calls[1]?.[0].conclusion).toBe('failure')
  })
  it('refuses another workflow or repository and has no PR checkout in the privileged workflow', async () => {
    const f = fixture()
    f.run.path = '.github/workflows/unrelated.yml'
    await expect(report(f.github, f.context)).rejects.toThrow('workflow identity')
    f.run.path = '.github/workflows/api-reference.yml'
    f.run.repository.full_name = 'someone/else'
    await expect(report(f.github, f.context)).rejects.toThrow('workflow identity')
    expect(f.github.rest.checks.create).not.toHaveBeenCalled()
    expect(resultWorkflow).not.toContain('uses: actions/checkout')
    expect(resultWorkflow).not.toContain('download-artifact')
  })
})
