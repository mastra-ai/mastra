import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ApiContract } from '../../src/api-reference/model'
import { repositoryRoot } from './config'
import { convertPilot, selectRoots } from './generate'
import { normalize } from './normalize'

const files = ['packages/core/src/mastra/index.ts', 'packages/core/src/agent/agent.ts']
function withoutComments(source: string, file: string) {
  return ts
    .createPrinter({ removeComments: true })
    .printFile(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true))
}

describe('real source extraction', () => {
  let contracts: ApiContract[]
  beforeAll(async () => {
    const { project } = await convertPilot()
    contracts = selectRoots(project).map(root => normalize(project, root.reflection, root.id))
  }, 120_000)

  it('includes every public Config member independently enumerated from the source AST', async () => {
    const source = ts.createSourceFile(
      files[0]!,
      await readFile(path.join(repositoryRoot, files[0]!), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const config = source.statements.find(
      statement => ts.isInterfaceDeclaration(statement) && statement.name.text === 'Config',
    )
    if (!config || !ts.isInterfaceDeclaration(config)) throw new Error('Config source missing')
    const expected = config.members
      .filter(member => !ts.getJSDocTags(member).some(tag => tag.tagName.text === 'internal'))
      .map(member => member.name?.getText(source))
      .sort()
    const contract = contracts.find(contract => contract.root === '@mastra/core!Config')!
    const actual = contract.declarations[contract.root]!.children.map(id => contract.declarations[id]!.name).sort()
    expect(actual).toEqual(expected)
    expect(actual).toHaveLength(36)
  })

  it('preserves only the four declared public overloads and resolves their FullOutput data', async () => {
    const source = ts.createSourceFile(
      files[1]!,
      await readFile(path.join(repositoryRoot, files[1]!), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const agent = source.statements.find(
      statement => ts.isClassDeclaration(statement) && statement.name?.text === 'Agent',
    )
    if (!agent || !ts.isClassDeclaration(agent)) throw new Error('Agent source missing')
    const overloads = agent.members.filter(
      member => ts.isMethodDeclaration(member) && member.name.getText(source) === 'generate' && !member.body,
    )
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const signatures = contract.declarations[contract.root]!.signatures.map(id => contract.declarations[id]!)
    expect(signatures).toHaveLength(overloads.length)
    expect(signatures).toHaveLength(4)
    expect(signatures.every(signature => signature.type?.display.startsWith('Promise<FullOutput<'))).toBe(true)
    expect(signatures.map(signature => signature.parameters.length)).toEqual([2, 2, 2, 1])
    const fullOutput = Object.values(contract.declarations).find(node => node.name === 'FullOutput')!
    const outputSource = ts.createSourceFile(
      'output.ts',
      await readFile(path.join(repositoryRoot, 'packages/core/src/stream/base/output.ts'), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const declaration = outputSource.statements.find(
      statement => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'FullOutput',
    )
    if (!declaration || !ts.isTypeAliasDeclaration(declaration) || !ts.isTypeLiteralNode(declaration.type))
      throw new Error('FullOutput source missing')
    expect(fullOutput.children.map(id => contract.declarations[id]!.name).sort()).toEqual(
      declaration.type.members.map(member => member.name?.getText(outputSource)).sort(),
    )
    expect(fullOutput.children).toHaveLength(26)
  })

  it('associates source comments and generic return types with the correct overload', () => {
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const signatures = contract.declarations[contract.root]!.signatures.map(id => contract.declarations[id]!)
    expect(signatures.map(signature => signature.type?.display)).toEqual([
      'Promise<FullOutput<T>>',
      'Promise<FullOutput<OUTPUT>>',
      'Promise<FullOutput<TOutput>>',
      'Promise<FullOutput<OUTPUT>>',
    ])
    expect(new Set(signatures.map(signature => signature.comment?.summary.map(part => part.text).join(''))).size).toBe(
      4,
    )
    for (const signature of signatures) {
      expect(signature.comment?.tags.some(tag => tag.name === '@returns')).toBe(true)
      for (const id of signature.parameters) {
        expect(contract.declarations[id]!.comment?.summary.some(part => part.text.trim())).toBe(true)
        expect(contract.declarations[id]!.flags).not.toContain('isOptional')
      }
    }
    expect(signatures[3]!.comment?.tags.some(tag => tag.name === '@example')).toBe(true)
    const schema = contract.declarations[signatures[0]!.typeParameters[0]!]!
    expect(schema.type?.display).toBe('StandardSchemaWithJSON<any, any>')
    const inferred = contract.declarations[signatures[0]!.typeParameters[1]!]!
    expect(inferred.defaultType?.display).toBe('InferOutput<OUTPUT>')
    expect(inferred.defaultType?.target?.id).toContain('@mastra/schema-compat')
  })

  it('resolves the corrected deprecation link and reads owned auth declarations from source', () => {
    const configuration = contracts.find(contract => contract.root === '@mastra/core!Config')!
    const harnesses = Object.values(configuration.declarations).find(node => node.name === 'harnesses')!
    const parts = harnesses.comment!.tags.flatMap(tag => tag.content)
    expect(parts.some(part => part.target?.includes('agentControllers'))).toBe(true)
    const agentsParameter = Object.values(configuration.declarations).find(node => node.name === 'TAgents')!
    const agentReference = agentsParameter.type?.operands.find(operand => operand.type.target?.name === 'Agent')?.type
      .target
    expect(agentReference?.id).toBe('@mastra/core/agent!Agent')
    expect(agentReference?.canonical).toBe('/reference/agents/agent')
    expect(
      configuration.diagnostics.some(
        diagnostic => diagnostic.owner === harnesses.id && diagnostic.code === 'unresolved-link',
      ),
    ).toBe(false)
    for (const contract of contracts) {
      expect(Object.values(contract.declarations).some(node => node.source?.path.includes('/dist/'))).toBe(false)
    }
  })

  it('keeps external MCP schema aliases intact and does not admit truncated types', () => {
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const contents = JSON.stringify(contract)
    expect(contents).toContain('ElicitRequest')
    expect(contents).toContain('ElicitResult')
    expect(contents).not.toContain('"display":"..."')
    expect(contents).not.toContain('"kind":"unknown"')
    expect(contents).not.toContain('/Users/')
    expect(contents).not.toContain('isPrivate')
    expect(contents).not.toContain('isProtected')
    expect(contents).not.toContain('"@internal"')
  })

  it('retains deprecations and does not fail on undocumented extracted members', () => {
    const nodes = contracts.flatMap(contract => Object.values(contract.declarations))
    const harnesses = nodes.find(node => node.name === 'harnesses')!
    expect(harnesses.comment?.tags.some(tag => tag.name === '@deprecated')).toBe(true)
    expect(nodes.some(node => !node.comment?.summary.some(part => part.text.trim()))).toBe(true)
  })

  it('leaves source declaration and runtime AST unchanged by the documentation edits', async () => {
    const baseline = process.env.API_REFERENCE_BASELINE ?? 'HEAD'
    for (const file of files) {
      const before = execFileSync('git', ['show', `${baseline}:${file}`], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
      })
      const after = await readFile(path.join(repositoryRoot, file), 'utf8')
      expect(withoutComments(after, file)).toBe(withoutComments(before, file))
    }
  })
})
