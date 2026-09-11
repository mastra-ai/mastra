import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ApiSource } from './model'

export interface SourceLinks {
  links: Map<string, string>
  diagnostics: string[]
}

export function verifySourceLinks(
  sources: ApiSource[],
  options: { cwd: string; revision?: string; production: boolean },
): SourceLinks {
  const links = new Map<string, string>()
  const diagnostics: string[] = []
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: options.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    const { revision } = options
    if (!revision || !/^[a-f0-9]{40}$/.test(revision))
      throw new Error('API_REFERENCE_SOURCE_REVISION must be a full commit SHA')
    if (git('rev-parse', 'HEAD') !== revision) throw new Error('Source revision does not match checked-out HEAD')
    const origin = git('remote', 'get-url', 'origin')
    const match = /^(?:git@github\.com:|https:\/\/github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(origin)
    if (!match) throw new Error('Source origin must identify a GitHub repository')
    const paths = [...new Set(sources.map(source => source.path))]
    for (const path of paths) {
      if (!path || /(^\/|\\|:|(?:^|\/)\.\.(?:\/|$))/.test(path)) throw new Error(`Invalid source path: ${path}`)
      const committed = execFileSync('git', ['show', `${revision}:${path}`], {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      if (!committed.equals(readFileSync(resolve(options.cwd, path))))
        throw new Error(`Source file differs from revision: ${path}`)
    }
    for (const source of sources) {
      const path = source.path.split('/').map(encodeURIComponent).join('/')
      links.set(
        `${source.path}:${source.line}`,
        `https://github.com/${match[1]}/blob/${revision}/${path}#L${source.line}`,
      )
    }
  } catch (error) {
    links.clear()
    const message = error instanceof Error ? error.message : String(error)
    if (options.production) throw new Error(`API reference source verification failed: ${message}`)
    diagnostics.push(message)
  }
  return { links, diagnostics }
}
