import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseContract } from '../../src/api-reference/schema'
import { artifactDirectory, roots } from './config'
import { generate } from './generate'

async function readArtifacts(directory: string) {
  const entries = await readdir(directory, { withFileTypes: true })
  const expected = roots.map(root => root.file).sort()
  const actual = entries.map(entry => entry.name).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Unexpected API artifact files in ${directory}: expected ${expected.join(', ')}; found ${actual.join(', ')}`,
    )
  }
  const contents = new Map<string, Buffer>()
  for (const { file, id } of roots) {
    if (!entries.find(entry => entry.name === file)?.isFile()) {
      throw new Error(`API artifact must be a regular file: ${path.join(directory, file)}`)
    }
    const bytes = await readFile(path.join(directory, file))
    const contract = parseContract(JSON.parse(bytes.toString('utf8')))
    if (contract.root !== id) throw new Error(`Unexpected API contract root in ${file}: ${contract.root}`)
    contents.set(file, bytes)
  }
  return contents
}

/** Compare a fresh conversion with every committed artifact without changing the checkout. */
export async function checkArtifacts(committedDirectory = artifactDirectory) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'mastra-api-check-'))
  try {
    const output = path.join(temporary, 'artifacts')
    await mkdir(output)
    await generate(output)
    const fresh = await readArtifacts(output)
    const committed = await readArtifacts(committedDirectory)
    const changed = [...fresh].filter(([file, bytes]) => !bytes.equals(committed.get(file)!)).map(([file]) => file)
    if (changed.length) {
      throw new Error(
        `Stale API artifacts: ${changed.join(', ')}. Run pnpm --filter mastra-docs api:generate and commit the updated JSON.`,
      )
    }
    return [...fresh.keys()]
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error('Usage: check.ts')
  const start = performance.now()
  const files = await checkArtifacts()
  console.log(`API artifacts are current: ${files.join(', ')} (${((performance.now() - start) / 1000).toFixed(2)}s)`)
}
