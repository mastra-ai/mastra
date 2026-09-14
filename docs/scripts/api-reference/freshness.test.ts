import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiContract } from '../../src/api-reference/model'
import { checkArtifacts } from './check'
import { roots } from './config'
import { generate } from './generate'

vi.mock('./generate', () => ({ generate: vi.fn() }))

const contracts = roots.map(root => {
  const contract: ApiContract = {
    version: 1,
    root: root.id,
    declarations: {
      [root.id]: {
        id: root.id,
        name: root.name,
        kind: root.parent ? 'Method' : 'Interface',
        flags: [],
        children: [],
        signatures: [],
        parameters: [],
        typeParameters: [],
        indexSignatures: [],
      },
    },
    diagnostics: [],
  }
  return { file: root.file, contract }
})

async function emit(directory: string) {
  for (const { file, contract } of contracts) await writeFile(path.join(directory, file), JSON.stringify(contract))
  return contracts
}

describe('API artifact freshness', () => {
  let directory: string
  let generated: string[]

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'mastra-api-check-test-'))
    await emit(directory)
    generated = []
    vi.mocked(generate)
      .mockReset()
      .mockImplementation(async output => {
        if (!output) throw new Error('Check must supply an isolated output directory')
        generated.push(output)
        expect(await readdir(output)).toEqual([])
        expect(path.relative(directory, output)).toMatch(/^\.\./)
        return emit(output)
      })
  })

  afterEach(async () => {
    for (const output of generated) await expect(access(path.dirname(output))).rejects.toMatchObject({ code: 'ENOENT' })
    await rm(directory, { recursive: true, force: true })
  })

  it('compares every file byte-for-byte without rewriting committed files and always generates afresh', async () => {
    const before = await Promise.all(
      roots.map(async ({ file }) => {
        const location = path.join(directory, file)
        return { bytes: await readFile(location), mtime: (await stat(location)).mtimeMs }
      }),
    )
    await expect(checkArtifacts(directory)).resolves.toEqual(roots.map(root => root.file))
    await expect(checkArtifacts(directory)).resolves.toEqual(roots.map(root => root.file))
    expect(new Set(generated).size).toBe(2)
    for (const [index, { file }] of roots.entries()) {
      const location = path.join(directory, file)
      expect(await readFile(location)).toEqual(before[index]!.bytes)
      expect((await stat(location)).mtimeMs).toBe(before[index]!.mtime)
    }
  })

  it.each(roots.map(root => root.file))(
    'rejects stale bytes in %s, even when JSON is semantically equal',
    async file => {
      const location = path.join(directory, file)
      const stale = `${await readFile(location, 'utf8')}\n`
      await writeFile(location, stale)
      await expect(checkArtifacts(directory)).rejects.toThrow(`Stale API artifacts: ${file}`)
      expect(await readFile(location, 'utf8')).toBe(stale)
    },
  )

  it('rejects a changed source contract without updating the committed artifact', async () => {
    vi.mocked(generate).mockImplementationOnce(async output => {
      generated.push(output!)
      await emit(output!)
      const { file, contract } = contracts[0]!
      const updated = structuredClone(contract)
      updated.declarations[updated.root]!.comment = {
        summary: [{ kind: 'text', text: 'Changed source description.' }],
        tags: [],
        modifiers: [],
      }
      await writeFile(path.join(output!, file), JSON.stringify(updated))
      return contracts
    })
    await expect(checkArtifacts(directory)).rejects.toThrow('Stale API artifacts')
    expect(await readFile(path.join(directory, contracts[0]!.file), 'utf8')).toBe(
      JSON.stringify(contracts[0]!.contract),
    )
  })

  it.each(['obsolete.json', 'notes.txt', 'nested'])('rejects extra entries including %s', async name => {
    const extra = path.join(directory, name)
    if (name === 'nested') {
      await mkdir(extra)
      await writeFile(path.join(extra, 'obsolete.json'), '{}')
    } else await writeFile(extra, '{}')
    await expect(checkArtifacts(directory)).rejects.toThrow('Unexpected API artifact files')
    await expect(access(extra)).resolves.toBeUndefined()
  })

  it('rejects a missing committed artifact', async () => {
    await rm(path.join(directory, roots[0]!.file))
    await expect(checkArtifacts(directory)).rejects.toThrow('Unexpected API artifact files')
  })

  it('rejects a symlink instead of reading outside the artifact directory', async () => {
    const target = path.join(directory, roots[0]!.file)
    await rm(target)
    await symlink(roots[1]!.file, target)
    await expect(checkArtifacts(directory)).rejects.toThrow('API artifact must be a regular file')
  })

  it('rejects invalid committed JSON', async () => {
    await writeFile(path.join(directory, roots[0]!.file), '{')
    await expect(checkArtifacts(directory)).rejects.toBeInstanceOf(SyntaxError)
  })

  it('rejects an empty successful conversion instead of reusing committed files', async () => {
    vi.mocked(generate).mockImplementationOnce(async output => {
      generated.push(output!)
      return []
    })
    await expect(checkArtifacts(directory)).rejects.toThrow('Unexpected API artifact files')
    expect(await readdir(directory)).toHaveLength(roots.length)
  })

  it('does not use partial output after conversion fails', async () => {
    vi.mocked(generate).mockImplementationOnce(async output => {
      generated.push(output!)
      await emit(output!)
      throw new Error('Required owned declaration could not be converted')
    })
    await expect(checkArtifacts(directory)).rejects.toThrow('Required owned declaration could not be converted')
    expect(await readdir(directory)).toHaveLength(roots.length)
  })

  it.each(['invalid schema', 'wrong root'])('validates generated contracts: %s', async mode => {
    vi.mocked(generate).mockImplementationOnce(async output => {
      generated.push(output!)
      await emit(output!)
      await writeFile(
        path.join(output!, roots[0]!.file),
        JSON.stringify(mode === 'invalid schema' ? { version: 999 } : contracts[1]!.contract),
      )
      return contracts
    })
    await expect(checkArtifacts(directory)).rejects.toThrow()
    expect(await readdir(directory)).toHaveLength(roots.length)
  })
})
