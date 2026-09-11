import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { verifySourceLinks } from './links'

const cwd = mkdtempSync(join(tmpdir(), 'api-source-links-'))
const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
git('init', '--quiet')
git('remote', 'add', 'origin', 'git@github.com:mastra-ai/mastra.git')
mkdirSync(join(cwd, 'src'))
writeFileSync(join(cwd, 'src/api.ts'), '/** Source description. */\nexport type Api = string\n')
git('add', 'src/api.ts')
git(
  '-c',
  'user.name=API test',
  '-c',
  'user.email=api-test@example.invalid',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'core.hooksPath=/dev/null',
  'commit',
  '--quiet',
  '-m',
  'Source verification fixture',
)
const revision = git('rev-parse', 'HEAD')
const source = { path: 'src/api.ts', line: 2, character: 0 }
afterAll(() => rmSync(cwd, { recursive: true, force: true }))

describe('revision-pinned source links', () => {
  it('verifies committed blobs and produces a declaration line permalink', () => {
    const result = verifySourceLinks([source], { cwd, revision, production: true })
    expect(result.diagnostics).toEqual([])
    expect(result.links.get('src/api.ts:2')).toBe(`https://github.com/mastra-ai/mastra/blob/${revision}/src/api.ts#L2`)
  })

  it('fails production on absent or mismatched revisions', () => {
    expect(() => verifySourceLinks([source], { cwd, production: true })).toThrow('full commit SHA')
    expect(() => verifySourceLinks([source], { cwd, revision: '0'.repeat(40), production: true })).toThrow(
      'does not match',
    )
  })

  it('leaves source text unlinked in local previews without a matching revision', () => {
    const result = verifySourceLinks([source], { cwd, production: false })
    expect(result.links.size).toBe(0)
    expect(result.diagnostics).toHaveLength(1)
  })

  it('rejects missing files and path traversal rather than inventing URLs', () => {
    expect(() =>
      verifySourceLinks([{ ...source, path: 'src/missing.ts' }], { cwd, revision, production: true }),
    ).toThrow('source verification failed')
    expect(() => verifySourceLinks([{ ...source, path: '../api.ts' }], { cwd, revision, production: true })).toThrow(
      'Invalid source path',
    )
  })

  it('fails closed for working-tree edits even when HEAD matches', () => {
    const file = join(cwd, source.path)
    try {
      writeFileSync(file, 'export type Api = number\n')
      expect(() => verifySourceLinks([source], { cwd, revision, production: true })).toThrow('differs from revision')
      expect(verifySourceLinks([source], { cwd, revision, production: false }).links.size).toBe(0)
    } finally {
      writeFileSync(file, '/** Source description. */\nexport type Api = string\n')
    }
  })
})
