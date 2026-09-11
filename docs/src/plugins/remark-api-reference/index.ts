import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Root } from 'mdast'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { artifactDirectory, canonicalDestinations, repositoryRoot, roots } from '../../../scripts/api-reference/config'
import { composeSurfaces } from '../../api-reference/compose'
import { prepareExamples } from '../../api-reference/npm-examples'
import { verifySourceLinks } from '../../api-reference/links'
import type { ApiSource, ApiType } from '../../api-reference/model'
import { parseContract } from '../../api-reference/schema'
import { descriptionGaps, traverseSurface, validateDescriptions } from '../../api-reference/traversal'
import type { ApiSection } from '../../api-reference/traversal'

interface Options {
  inputDirectory?: string
  outputDirectory?: string
  cwd?: string
  revision?: string
  production?: boolean
}

export function discoverSurfaces(tree: Root) {
  const selections: {
    node: Extract<Root['children'][number], { type: 'mdxJsxFlowElement' }>
    root: (typeof roots)[number]
    section: ApiSection
  }[] = []
  visit(tree, node => {
    if ((node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') || node.name !== 'ApiReference') return
    if (node.type !== 'mdxJsxFlowElement') throw new Error('ApiReference must be a standalone block')
    const attributes = new Map<string, string>()
    for (const attribute of node.attributes) {
      if (
        attribute.type !== 'mdxJsxAttribute' ||
        typeof attribute.name !== 'string' ||
        typeof attribute.value !== 'string'
      )
        throw new Error('ApiReference only accepts literal root and section attributes')
      if (!['root', 'section'].includes(attribute.name) || attributes.has(attribute.name))
        throw new Error(`Unsupported or duplicate ApiReference attribute: ${attribute.name}`)
      attributes.set(attribute.name, attribute.value)
    }
    if (node.children.length) throw new Error('ApiReference cannot contain authored children')
    const name = attributes.get('root')
    const root = roots.find(root => (root.parent ? `${root.parent}.${root.name}` : root.name) === name)
    if (!root) throw new Error(`Unknown API root: ${name ?? '(missing)'}`)
    const section = attributes.get('section')
    if (section !== 'properties' && section !== 'signatures' && section !== 'parameters' && section !== 'returns')
      throw new Error(`Unknown API section: ${section ?? '(missing)'}`)
    selections.push({ node, root, section })
  })
  return selections
}

export default function remarkApiReference(options: Options = {}) {
  return async (tree: Root, file: { path: string; message: (message: string) => unknown }) => {
    const selections = discoverSurfaces(tree)
    if (!selections.length) return
    const contracts = new Map<string, ReturnType<typeof parseContract>>()
    const requests = selections.map(selection => {
      let contract = contracts.get(selection.root.id)
      if (!contract) {
        contract = parseContract(
          JSON.parse(readFileSync(join(options.inputDirectory ?? artifactDirectory, selection.root.file), 'utf8')),
        )
        if (contract.root !== selection.root.id) throw new Error(`Unexpected contract root in ${selection.root.file}`)
        contracts.set(selection.root.id, contract)
      }
      return { contract, section: selection.section }
    })
    const graphs = requests.map(({ contract, section }) => traverseSurface(contract, section))
    const production = options.production ?? process.env.NODE_ENV === 'production'
    for (const graph of graphs) {
      if (production) validateDescriptions(graph, file.path)
      else for (const gap of descriptionGaps(graph, file.path)) file.message(`Missing API description: ${gap.path}`)
    }
    const sources: ApiSource[] = []
    const types: ApiType[] = []
    function collect(type: ApiType | undefined) {
      if (!type) return
      types.push(type)
      if (type.target?.source) sources.push(type.target.source)
      for (const operand of type.operands) collect(operand.type)
    }
    for (const graph of graphs)
      for (const { declaration } of graph.nodes.values()) {
        if (declaration.source) sources.push(declaration.source)
        collect(declaration.type)
        collect(declaration.defaultType)
      }
    const verified = verifySourceLinks(sources, {
      cwd: options.cwd ?? repositoryRoot,
      revision: options.revision ?? process.env.API_REFERENCE_SOURCE_REVISION,
      production,
    })
    for (const message of verified.diagnostics) file.message(message)
    const destinations = new Map(canonicalDestinations)
    for (const type of types) {
      const target = type.target
      if (!target) continue
      const source = target.source ? verified.links.get(`${target.source.path}:${target.source.line}`) : undefined
      const destination = destinations.get(target.id) ?? target.canonical ?? source
      if (destination) destinations.set(target.id, destination)
    }
    const included = new Set(graphs.flatMap(graph => [...graph.nodes.keys()]))
    const warnings = new Set<string>()
    for (const type of types) {
      if (type.target?.boundary === 'external' && !destinations.has(type.target.id))
        warnings.add(`Unmapped external API type: ${type.target.name}`)
    }
    for (const { contract } of requests) {
      for (const diagnostic of contract.diagnostics) {
        if (!included.has(diagnostic.owner)) continue
        if (production && diagnostic.code === 'unresolved-link')
          throw new Error(`${file.path}: ${diagnostic.owner}: ${diagnostic.message}`)
        warnings.add(`${diagnostic.owner}: ${diagnostic.message}`)
      }
      for (const id of included) {
        const node = contract.declarations[id]
        if (!node?.comment) continue
        for (const part of [...node.comment.summary, ...node.comment.tags.flatMap(tag => tag.content)]) {
          if (part.kind !== 'inline-tag' || !part.tag?.startsWith('@link')) continue
          if (part.target && /^https?:\/\//.test(part.target)) destinations.set(part.target, part.target)
          if (part.target && (included.has(part.target) || destinations.has(part.target))) continue
          const message = `${file.path}: unresolved authored API link ${part.text} in ${id}`
          if (production) throw new Error(message)
          warnings.add(message)
        }
      }
    }
    for (const warning of warnings) file.message(warning)
    const surfaces = composeSurfaces(requests, { sourceLinks: verified.links, destinations })
    await prepareExamples(surfaces)
    const directory = options.outputDirectory ?? join(repositoryRoot, 'docs/.docusaurus/api-reference')
    mkdirSync(directory, { recursive: true })
    const imports: Root['children'] = []
    const replacements = new Map(
      selections.map((selection, index) => {
        const surface = { ...surfaces[index], externalHeading: true }
        const content = JSON.stringify(surface)
        const digest = createHash('sha256').update(content).digest('hex')
        const variable = `__apiReference${digest.slice(0, 16)}`
        const output = join(directory, `${digest}.json`)
        if (!existsSync(output) || readFileSync(output, 'utf8') !== content) {
          const temporary = `${output}.${randomUUID()}.tmp`
          writeFileSync(temporary, content)
          renameSync(temporary, output)
        }
        const parser = unified().use(remarkParse).use(remarkMdx)
        const generated = parser.parse(
          `import ${variable} from ${JSON.stringify(output)}\n\n<ApiReference data={${variable}} />`,
        )
        imports.push(...generated.children.filter(node => node.type === 'mdxjsEsm'))
        const component = generated.children.find(node => node.type === 'mdxJsxFlowElement')
        if (!component) throw new Error('Failed to construct API component AST')
        return [selection.node, { component, title: surface.title, id: surface.id }]
      }),
    )
    visit(tree, (node, index, parent) => {
      if (node.type !== 'mdxJsxFlowElement' || index === undefined || !parent) return
      const replacement = replacements.get(node)
      if (!replacement) return
      parent.children.splice(
        index,
        1,
        { type: 'heading', depth: 2, children: [{ type: 'text', value: `${replacement.title} {#${replacement.id}}` }] },
        replacement.component,
      )
      return index + 2
    })
    tree.children.unshift(...imports)
  }
}
