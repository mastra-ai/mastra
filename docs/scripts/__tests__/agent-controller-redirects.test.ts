import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { toLlmsTxtPath } from '../generate-vercel-redirects.mjs'

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const overview = fs.readFileSync(path.join(docsRoot, 'src/content/en/docs/agent-controller/overview.mdx'), 'utf-8')
const authored = JSON.parse(fs.readFileSync(path.join(docsRoot, 'vercel.redirects.json'), 'utf-8'))
  .redirects as Redirect[]
const generated = JSON.parse(fs.readFileSync(path.join(docsRoot, 'vercel.json'), 'utf-8')).redirects as Redirect[]

type Redirect = {
  source: string
  destination: string
  permanent: boolean
}

const removedRoutes = new Map([
  ['/docs/agent-controller/session', '/docs/agent-controller/overview#sessions-and-threads'],
  ['/docs/agent-controller/modes', '/docs/agent-controller/overview#switch-modes-and-models'],
  ['/docs/agent-controller/threads-and-state', '/docs/agent-controller/overview#manage-threads-and-state'],
  ['/docs/agent-controller/subagents', '/docs/agent-controller/overview#delegate-to-subagents'],
  ['/docs/agent-controller/tool-approvals', '/docs/agent-controller/overview#approve-tools-and-resume-suspensions'],
  ['/docs/agent-controller/channels', '/docs/agent-controller/overview#connect-chat-channels'],
])

const harnessRoutes = new Map([
  ['/docs/harness/session', '/docs/agent-controller/overview#sessions-and-threads'],
  ['/docs/harness/modes', '/docs/agent-controller/overview#switch-modes-and-models'],
  ['/docs/harness/threads-and-state', '/docs/agent-controller/overview#manage-threads-and-state'],
  ['/docs/harness/subagents', '/docs/agent-controller/overview#delegate-to-subagents'],
  ['/docs/harness/tool-approvals', '/docs/agent-controller/overview#approve-tools-and-resume-suspensions'],
])

const unchangedAliases = new Map([
  ['/docs/harness/overview', '/docs/agent-controller/overview'],
  ['/reference/harness/harness-class', '/reference/agent-controller/agent-controller-class'],
  ['/reference/harness/session', '/reference/agent-controller/session'],
])

function expectRedirect(redirects: Redirect[], source: string, destination: string) {
  expect(redirects.filter(redirect => redirect.source === source)).toEqual([{ source, destination, permanent: true }])
}

describe('AgentController redirect contract', () => {
  test('the overview contains every redirect heading', () => {
    expect(overview).toMatch(/^## Sessions and threads$/m)
    expect(overview).toMatch(/^## Switch modes and models$/m)
    expect(overview).toMatch(/^## Manage threads and state$/m)
    expect(overview).toMatch(/^## Delegate to subagents$/m)
    expect(overview).toMatch(/^## Approve tools and resume suspensions$/m)
    expect(overview).toMatch(/^## Connect chat channels$/m)
  })

  test('removed AgentController routes point to their matching sections', () => {
    for (const [source, destination] of removedRoutes) {
      expectRedirect(authored, source, destination)
    }
  })

  test('historical Harness routes resolve directly to the surviving guide', () => {
    for (const [source, destination] of harnessRoutes) {
      expectRedirect(authored, source, destination)
    }
  })

  test('unchanged Harness aliases remain intact', () => {
    for (const [source, destination] of unchangedAliases) {
      expectRedirect(authored, source, destination)
    }
  })

  test('generated redirects include fragment-safe llms.txt companions', () => {
    for (const [source, destination] of [...removedRoutes, ...harnessRoutes, ...unchangedAliases]) {
      expectRedirect(generated, source, destination)
      expectRedirect(generated, toLlmsTxtPath(source), toLlmsTxtPath(destination))
    }
  })
})
