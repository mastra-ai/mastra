import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ApiContract, ApiDeclaration, ApiReference, ApiType } from '../../src/api-reference/model'
import { parseContract } from '../../src/api-reference/schema'
import { artifactDirectory, repositoryRoot } from './config'

export function inventory(contracts: ApiContract[]) {
  const owners = new Map<string, { node: ApiDeclaration; occurrences: string[] }>()
  const references = new Map<string, ApiReference>()
  const shapes = new Set<string>()
  function inspect(type: ApiType) {
    shapes.add(type.kind)
    if (type.target) references.set(type.target.id, type.target)
    type.operands.forEach(operand => inspect(operand.type))
  }
  for (const contract of contracts) {
    for (const node of Object.values(contract.declarations)) {
      if (node.type) inspect(node.type)
      if (node.defaultType) inspect(node.defaultType)
      if (
        node.name.startsWith('__') ||
        !['Property', 'Parameter', 'Method', 'Function', 'Interface', 'TypeAlias'].includes(node.kind)
      )
        continue
      if (node.comment?.summary.some(part => part.text.trim())) continue
      const key = node.source
        ? `${node.source.path}:${node.source.line}:${node.source.character}:${node.name}`
        : node.id
      const existing = owners.get(key)
      if (existing) existing.occurrences.push(`${contract.root}: ${node.id}`)
      else owners.set(key, { node, occurrences: [`${contract.root}: ${node.id}`] })
    }
  }
  return {
    owners: [...owners.values()].sort((a, b) => a.node.id.localeCompare(b.node.id, 'en')),
    references: [...references.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')),
    shapes: [...shapes].sort(),
  }
}

export async function writeInventory(directory = artifactDirectory) {
  const files = (await readdir(directory)).filter(file => file.endsWith('.json')).sort()
  const contents = await Promise.all(files.map(file => readFile(path.join(directory, file), 'utf8')))
  const contracts = contents.map(content => parseContract(JSON.parse(content)))
  const report = inventory(contracts)
  const occurrences = report.owners.reduce((sum, owner) => sum + owner.occurrences.length, 0)
  const lines = [
    '# Pilot extraction inventory',
    '',
    `Missing descriptions: ${report.owners.length} unique source owners; ${occurrences} extracted occurrences.`,
    '',
    'This is an extraction inventory, not the page-consumed description validation set. Reused owners are counted once; composition determines which occurrences render.',
    '',
    `Type shapes: ${report.shapes.join(', ')}.`,
    '',
    '## Contracts',
    '',
    ...contracts.map(
      (contract, index) =>
        `- ${files[index]}: ${Object.keys(contract.declarations).length} declarations; ${Buffer.byteLength(contents[index]!)} bytes.`,
    ),
    '',
    '## Service boundaries',
    '',
    ...report.references
      .filter(reference => reference.boundary === 'service')
      .map(reference => `- \`${reference.id}\`: ${reference.reason}.`),
    '',
    '## Missing descriptions by source owner',
    '',
    ...report.owners.flatMap(({ node, occurrences: uses }) => [
      `- \`${node.source ? `${node.source.path}:${node.source.line}` : 'No direct TypeDoc source location'}\` — \`${node.name}\` (${uses.length} occurrences)`,
      ...uses.map(use => `  - \`${use}\``),
    ]),
    '',
    '## Link and tag diagnostics',
    '',
    ...contracts.flatMap(contract =>
      contract.diagnostics.map(
        diagnostic => `- ${diagnostic.code}: \`${diagnostic.owner}\` — ${diagnostic.message.replaceAll('\n', ' ')}`,
      ),
    ),
    '',
  ]
  const output = path.join(repositoryRoot, '.mastracode/plans/typedoc-reference.proof/inventory.md')
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, lines.join('\n'))
  console.log(`Missing descriptions: ${report.owners.length} unique owners; ${occurrences} extracted occurrences`)
  console.log(`Inventory: ${path.relative(repositoryRoot, output)}`)
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== '--input-dir' || !args[1]))
    throw new Error('Usage: inventory.ts [--input-dir DIRECTORY]')
  await writeInventory(args[1])
}
