import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ApiContract } from '../../src/api-reference/model'
import { descriptionGaps, traverseSurface } from '../../src/api-reference/traversal'
import { repositoryRoot } from './config'
import { convertPilot, selectRoots } from './generate'
import { normalize } from './normalize'

const files = [
  'packages/core/src/mastra/index.ts',
  'packages/core/src/agent/agent.ts',
  'packages/core/src/storage/domains/schedules/base.ts',
  'packages/core/src/llm/index.ts',
  'packages/_internals/auth/src/ee/interfaces/fga.ts',
  'packages/core/src/stream/types.ts',
  'packages/core/src/stream/base/output.ts',
  'packages/core/src/observability/types/tracing.ts',
  'packages/core/src/agent/message-list/state/types.ts',
  'packages/core/src/processors/step-schema.ts',
  'packages/core/src/server/types.ts',
  'packages/core/src/agent/signals.ts',
  'packages/core/src/schedules/types.ts',
  'packages/core/src/vector/filter/base.ts',
  'packages/core/src/background-tasks/types.ts',
  'packages/core/src/memory/types.ts',
  'packages/core/src/tools/types.ts',
  'packages/core/src/agent/agent.types.ts',
  'packages/core/src/agent/state-signals.ts',
  'packages/core/src/predicate/index.ts',
  'packages/core/src/types/dynamic-argument.ts',
  'packages/core/src/llm/model/provider-types.generated.d.ts',
  'packages/core/src/llm/model/shared.types.ts',
  'packages/core/src/llm/model/provider-options.ts',
  'packages/core/src/evals/base.ts',
  'packages/core/src/evals/types.ts',
  'packages/core/src/observability/types/metrics.ts',
  'packages/core/src/loop/types.ts',
  'packages/core/src/agent/types.ts',
  'packages/core/src/events/types.ts',
  'packages/core/src/bundler/types.ts',
  'packages/core/src/tool-loop-agent/utils.ts',
  'packages/core/src/notifications/workflow.ts',
  'packages/core/src/harness/index.ts',
  'packages/core/src/mastra/types.ts',
  'packages/_internals/auth/src/types/index.ts',
  'packages/_internals/auth/src/provider/index.ts',
  'packages/_internals/auth/src/ee/interfaces/rbac.ts',
  'packages/core/src/workflows/scheduler/types.ts',
  'packages/core/src/agent/message-list/types.ts',
  'packages/core/src/stream/base/schema.ts',
  'packages/core/src/processors/index.ts',
  'packages/core/src/tools/builtin/web-search.ts',
  'packages/core/src/channels/wait-until.ts',
  'packages/core/src/workflows/types.ts',
  'packages/core/src/loop/network/validation.ts',
  'packages/core/src/llm/model/provider-models-map-augmentation.test-d.ts',
]
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

  it('extracts descriptions for stream payloads and their fields from source comments', () => {
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    for (const name of [
      'ChunkFrom',
      'BaseChunkType',
      'ResponseMetadataPayload',
      'TextStartPayload',
      'TextDeltaPayload',
      'TextEndPayload',
      'ReasoningStartPayload',
      'ReasoningDeltaPayload',
      'ReasoningEndPayload',
      'SourcePayload',
      'FilePayload',
      'ReasoningFilePayload',
      'CustomPayload',
      'JSONObject',
      'JSONArray',
      'ReadonlyJSONValue',
      'ReadonlyJSONObject',
      'ReadonlyJSONArray',
      'ToolCallPayload',
      'ToolCallApprovalPayload',
      'ToolCallSuspendedPayload',
      'ToolResultPayload',
      'ToolCallInputStreamingStartPayload',
      'ToolCallDeltaPayload',
      'ToolCallInputStreamingEndPayload',
      'FinishPayload',
      'StepStartPayload',
      'StepFinishPayload',
      'ErrorPayload',
      'RawPayload',
      'StartPayload',
      'ToolErrorPayload',
      'ToolOutputDeniedPayload',
      'AbortPayload',
      'ReasoningSignaturePayload',
      'RedactedReasoningPayload',
      'ToolOutputPayload',
      'DynamicToolOutputPayload',
      'BackgroundTaskStartedPayload',
      'BackgroundTaskResultPayload',
      'BackgroundTaskFailedPayload',
      'BackgroundTaskProgressPayload',
      'BackgroundTaskRunningPayload',
      'BackgroundTaskCancelledPayload',
      'BackgroundTaskOutputPayload',
      'BackgroundTaskSuspendedPayload',
      'BackgroundTaskResumedPayload',
      'LLMStepResult',
      'PendingToolCall',
      'NestedWorkflowOutput',
      'StepOutputPayload',
      'WatchPayload',
      'RoutingAgentStartPayload',
      'RoutingAgentEndPayload',
      'RoutingAgentTextDeltaPayload',
      'RoutingAgentTextStartPayload',
      'AgentExecutionStartPayload',
      'AgentExecutionApprovalPayload',
      'AgentExecutionSuspendedPayload',
      'AgentExecutionEndPayload',
      'WorkflowExecutionStartPayload',
      'WorkflowExecutionEndPayload',
      'WorkflowExecutionSuspendPayload',
      'ToolExecutionStartPayload',
      'ToolExecutionApprovalPayload',
      'ToolExecutionSuspendedPayload',
      'ToolExecutionEndPayload',
      'NetworkStepFinishPayload',
      'NetworkFinishPayload',
      'NetworkValidationStartPayload',
      'NetworkValidationEndPayload',
      'RoutingAgentAbortPayload',
      'AgentExecutionAbortPayload',
      'WorkflowExecutionAbortPayload',
      'ToolExecutionAbortPayload',
    ]) {
      const declaration = Object.values(contract.declarations).find(
        node => node.name === name && node.source?.path === 'packages/core/src/stream/types.ts',
      )
      expect(declaration, name).toBeDefined()
      const shape = declaration!.type?.declaration
        ? contract.declarations[declaration!.type.declaration]!
        : declaration!
      const fields = shape.children.map(id => contract.declarations[id]!)
      const shapes = fields.flatMap(field =>
        field.type?.declaration ? [contract.declarations[field.type.declaration]!] : [],
      )
      for (const node of [
        declaration!,
        ...fields,
        ...shapes.flatMap(shape => shape.children.map(id => contract.declarations[id]!)),
      ]) {
        expect(
          node.comment?.summary.some(part => part.text.trim()),
          `${name}.${node.name}`,
        ).toBe(true)
      }
      for (const shape of shapes) {
        for (const id of shape.indexSignatures) {
          const signature = contract.declarations[id]!
          for (const parameter of signature.parameters) {
            expect(
              contract.declarations[parameter]!.comment?.summary.some(part => part.text.trim()),
              `${name} nested index key`,
            ).toBe(true)
          }
        }
      }
    }
    for (const name of [
      'ResponseMetadataPayload',
      'TextEndPayload',
      'JSONObject',
      'ReadonlyJSONObject',
      'FinishPayload',
      'StepStartPayload',
      'StepFinishPayload',
      'ErrorPayload',
      'RawPayload',
      'StartPayload',
      'AbortPayload',
      'ToolOutputPayload',
      'NestedWorkflowOutput',
      'StepOutputPayload',
      'WatchPayload',
    ]) {
      const declaration = Object.values(contract.declarations).find(node => node.name === name)!
      const shape = declaration.type?.declaration ? contract.declarations[declaration.type.declaration]! : declaration
      expect(shape.indexSignatures, name).toHaveLength(1)
      const signature = contract.declarations[shape.indexSignatures[0]!]!
      expect(signature.parameters).toHaveLength(1)
      const key = contract.declarations[signature.parameters[0]!]!
      expect(
        key.comment?.summary.some(part => part.text.trim()),
        `${name} index key`,
      ).toBe(true)
    }
    const delta = Object.values(contract.declarations).find(node => node.name === 'TextDeltaPayload')!
    const text = delta.children.map(id => contract.declarations[id]!).find(node => node.name === 'text')!
    expect(text.comment?.summary.map(part => part.text).join('')).toContain('Incremental text')
    const scoringData = Object.values(contract.declarations).find(
      node => node.name === 'scoringData' && node.source?.path === 'packages/core/src/stream/base/output.ts',
    )!
    const shape = contract.declarations[scoringData.type!.declaration!]!
    expect(shape.children.map(id => contract.declarations[id]!.name).sort()).toEqual(['input', 'output'])
    expect(shape.children.every(id => contract.declarations[id]!.comment?.summary.some(part => part.text.trim()))).toBe(
      true,
    )
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

  it('preserves source provenance for comment-only links without expanding their target methods', async () => {
    const configuration = contracts.find(contract => contract.root === '@mastra/core!Config')!
    const node = Object.values(configuration.declarations).find(node => node.name === 'agentControllers')!
    const link = node.comment?.summary.find(part => part.text === 'Mastra.getAgentController')
    expect(link?.target).toBeDefined()
    expect(link?.targetSource?.path).toBe('packages/core/src/mastra/index.ts')
    expect(configuration.declarations[link!.target!]).toBeUndefined()
    const source = await readFile(path.join(repositoryRoot, link!.targetSource!.path), 'utf8')
    expect(source.split('\n')[link!.targetSource!.line - 1]).toContain('getAgentController')
  })

  it('extracts source descriptions for every field of all 46 agent chunk variants', () => {
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const chunk = Object.values(contract.declarations).find(node => node.name === 'AgentChunkType')!
    expect(chunk.comment?.summary.map(part => part.text).join('')).toContain('internal processing events')
    expect(chunk.type?.kind).toBe('union')
    const variants = chunk.type!.operands.flatMap(operand =>
      operand.type.operands.flatMap(part =>
        part.type.declaration ? [contract.declarations[part.type.declaration]!] : [],
      ),
    )
    expect(variants).toHaveLength(46)
    const literals = new Set<string>()
    for (const variant of variants) {
      const fields = variant.children.map(id => contract.declarations[id]!)
      expect(fields).toHaveLength(2)
      const discriminator = fields.find(field => field.name === 'type')!
      expect(discriminator.type?.kind).toBe('literal')
      literals.add(discriminator.type!.display)
      for (const field of fields) {
        expect(
          field.comment?.summary.some(part => part.text.trim()),
          field.id,
        ).toBe(true)
      }
    }
    expect(literals.size).toBe(46)
  })

  it('describes all consumed tracing attributes and preserves legacy deprecations', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      const graph = traverseSurface(contract, section)
      expect(
        descriptionGaps(graph, contract.root).filter(
          gap =>
            gap.source?.path === 'packages/core/src/observability/types/tracing.ts' ||
            gap.owner.startsWith('@mastra/core:src/observability/types/tracing.ts:'),
        ),
      ).toEqual([])
      const map = Object.values(contract.declarations).find(node => node.name === 'SpanTypeMap')
      if (!map) continue
      expect(map.children).toHaveLength(32)
      for (const id of map.children) {
        expect(
          contract.declarations[id]!.comment?.summary.some(part => part.text.trim()),
          id,
        ).toBe(true)
      }
      const legacy = Object.values(contract.declarations).find(node => node.name === 'SkillResolutionAttributes')!
      expect(legacy.comment?.summary.some(part => part.text.trim())).toBe(true)
      expect(legacy.comment?.tags.some(tag => tag.name === '@deprecated')).toBe(true)
    }
  })

  it('describes every consumed stored-message owner without conflating storage and SDK versions', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(
          gap =>
            gap.source?.path === 'packages/core/src/agent/message-list/state/types.ts' ||
            gap.owner.startsWith('@mastra/core:src/agent/message-list/state/types.ts:'),
        ),
      ).toEqual([])
    }
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const legacy = Object.values(contract.declarations).find(node => node.name === 'MastraMessageV1')!
    expect(legacy.comment?.summary.map(part => part.text).join('')).toContain('Legacy Mastra message representation')
    const content = Object.values(contract.declarations).find(node => node.name === 'MastraMessageContentV2')!
    const format = content.children.map(id => contract.declarations[id]!).find(node => node.name === 'format')!
    expect(format.type?.display).toBe('2')
    expect(format.comment?.summary.map(part => part.text).join('')).toContain('stored content format')
  })

  it('describes consumed processor step schemas and distinguishes tool values from generation summaries', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(
          gap =>
            gap.source?.path === 'packages/core/src/processors/step-schema.ts' ||
            gap.owner.startsWith('@mastra/core:src/processors/step-schema.ts:'),
        ),
      ).toEqual([])
    }
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const output = Object.values(contract.declarations).find(node => node.name === 'ProcessorStepOutputType')!
    const fields = output.children.map(id => contract.declarations[id]!)
    const result = fields.find(node => node.name === 'result')!
    const toolResult = fields.find(node => node.name === 'toolResultValue')!
    expect(result.comment?.summary.map(part => part.text).join('')).toContain('Generation summary')
    expect(toolResult.comment?.summary.map(part => part.text).join('')).toContain('Raw tool return value')
    expect(toolResult.type?.display).toBe('unknown')
    const step = fields.find(node => node.name === 'stepNumber')!
    expect(step.comment?.summary.map(part => part.text).join('')).toContain('Zero-based')
  })

  it('describes every consumed server configuration owner without changing route contracts', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(
          gap =>
            gap.source?.path === 'packages/core/src/server/types.ts' ||
            gap.owner.startsWith('@mastra/core:src/server/types.ts:'),
        ),
      ).toEqual([])
    }
    const contract = contracts.find(contract => contract.root === '@mastra/core!Config')!
    const route = Object.values(contract.declarations).find(node => node.name === 'SchemaApiRoute')!
    const fields = route.type!.operands.flatMap(operand => {
      const declaration = operand.type.declaration && contract.declarations[operand.type.declaration]
      return declaration ? declaration.children.map(id => contract.declarations[id]!) : []
    })
    const limit = fields.find(node => node.name === 'maxBodySize')!
    expect(limit.comment?.summary.map(part => part.text).join('')).toContain('bytes')
    const flush = fields.find(node => node.name === 'sseFlushOnConnect')!
    expect(flush.comment?.summary.map(part => part.text).join('')).toContain('initial connection comment')
    const summaries = {
      'A2AAgentCardSigningConfig/0/protectedHeader/0/3/__type/0/6/__index/0/2/key/0':
        'Name of an additional protected header.',
      'HonoApiRoute/type/2/0/createHandler/0/3/__type/0/5/__type/0/2/{ mastra }/0':
        'Factory context containing the hosting Mastra instance.',
      'HonoApiRoute/type/2/0/createHandler/0/3/__type/0/5/__type/0/2/{ mastra }/0/3/__type/0/0/mastra/0':
        'Mastra instance hosting the route.',
      'SchemaApiRoute/type/0/0/handler/0':
        'Handles validated route parameters and server context, returning the route result.',
    }
    for (const [owner, summary] of Object.entries(summaries)) {
      const declaration = contract.declarations[`@mastra/core:src/server/types.ts:${owner}`]
      expect(declaration, owner).toBeDefined()
      expect(declaration!.comment?.summary.map(part => part.text).join('')).toBe(summary)
    }
  })

  it('describes every consumed signal owner and distinguishes transport transience from signal persistence', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(gap =>
          gap.owner.startsWith('@mastra/core:src/agent/signals.ts:'),
        ),
      ).toEqual([])
    }
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const dataPart = contract.declarations['@mastra/core:src/agent/signals.ts:AgentSignalDataPart']!
    const transient = dataPart.children.map(id => contract.declarations[id]!).find(node => node.name === 'transient')!
    expect(transient.type?.display).toBe('true')
    expect(transient.comment?.summary.map(part => part.text).join('')).toContain(
      'even when the signal itself is persisted',
    )
    const category = contract.declarations['@mastra/core:src/agent/signals.ts:AgentSignalCategory']!
    expect(category.type?.operands.map(operand => operand.type.display).sort()).toEqual([
      '"notification"',
      '"reactive"',
      '"state"',
      '"user"',
    ])
  })

  it('describes every consumed schedule hook owner and distinguishes dispatch from run completion', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(gap =>
          gap.owner.startsWith('@mastra/core:src/schedules/types.ts:'),
        ),
      ).toEqual([])
    }
    const contract = contracts.find(contract => contract.root === '@mastra/core!Config')!
    const outcome = contract.declarations['@mastra/core:src/schedules/types.ts:ScheduleFinishContext/0/outcome/0']!
    expect(outcome.comment?.summary.map(part => part.text).join('')).toContain(
      'does not wait for the agent run to finish',
    )
    const abort = contract.declarations['@mastra/core:src/schedules/types.ts:ScheduleHooks/0/onAbort/0']!
    expect(abort.comment?.summary.map(part => part.text).join('')).toContain('unthreaded generation')
  })

  it('describes every consumed vector filter owner without claiming universal provider support', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(gap =>
          gap.owner.startsWith('@mastra/core:src/vector/filter/base.ts:'),
        ),
      ).toEqual([])
    }
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const operators = contract.declarations['@mastra/core:src/vector/filter/base.ts:OperatorValueMap']!
    expect(operators.comment?.summary.map(part => part.text).join('')).toContain('may support a subset')
    expect(operators.children.map(id => contract.declarations[id]!.name).sort()).toEqual([
      '$all',
      '$elemMatch',
      '$eq',
      '$exists',
      '$gt',
      '$gte',
      '$in',
      '$lt',
      '$lte',
      '$ne',
      '$nin',
      '$not',
      '$options',
      '$regex',
    ])
  })

  it('describes every consumed background-task owner without changing persisted task fields', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(gap =>
          gap.owner.startsWith('@mastra/core:src/background-tasks/types.ts:'),
        ),
      ).toEqual([])
    }
  })

  it('describes every consumed memory configuration owner without changing configuration types', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(gap =>
          gap.owner.startsWith('@mastra/core:src/memory/types.ts:'),
        ),
      ).toEqual([])
    }
  })

  it.each([
    'tools/types.ts',
    'agent/agent.types.ts',
    'agent/state-signals.ts',
    'predicate/index.ts',
    'types/dynamic-argument.ts',
    'llm/model/provider-types.generated.d.ts',
    'llm/model/shared.types.ts',
    'llm/model/provider-options.ts',
    'evals/base.ts',
    'evals/types.ts',
    'observability/types/metrics.ts',
    'loop/types.ts',
    'agent/types.ts',
    'events/types.ts',
    'bundler/types.ts',
    'tool-loop-agent/utils.ts',
    'notifications/workflow.ts',
    'harness/index.ts',
    'mastra/types.ts',
    'storage/domains/schedules/base.ts',
  ])('describes every consumed %s owner', file => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(gap =>
          gap.owner.startsWith(`@mastra/core:src/${file}:`),
        ),
      ).toEqual([])
    }
  })

  it('describes every owner consumed by the complete pilot surfaces', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(descriptionGaps(traverseSurface(contract, section), contract.root)).toEqual([])
    }
  })

  it('describes every consumed authentication owner', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      expect(
        descriptionGaps(traverseSurface(contract, section), contract.root).filter(gap =>
          gap.owner.startsWith('@internal/auth:'),
        ),
      ).toEqual([])
    }
  })

  it('has source descriptions for every consumed stream type owner', () => {
    for (const contract of contracts) {
      const section = contract.root === '@mastra/core!Config' ? 'properties' : 'method'
      const gaps = descriptionGaps(traverseSurface(contract, section), contract.root)
      expect(
        gaps.filter(
          gap =>
            gap.source?.path === 'packages/core/src/stream/types.ts' ||
            gap.owner.startsWith('@mastra/core:src/stream/types.ts:'),
        ),
      ).toEqual([])
    }
  })

  it('describes all network variants without replacing forwarded-event template types', () => {
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const network = Object.values(contract.declarations).find(node => node.name === 'NetworkChunkType')!
    expect(network.comment?.summary.some(part => part.text.trim())).toBe(true)
    const variants = network.type!.operands.flatMap(operand =>
      operand.type.operands.flatMap(part =>
        part.type.declaration ? [contract.declarations[part.type.declaration]!] : [],
      ),
    )
    expect(variants).toHaveLength(27)
    const kinds = []
    for (const variant of variants) {
      const fields = variant.children.map(id => contract.declarations[id]!)
      expect(fields.map(field => field.name).sort()).toEqual(['payload', 'type'])
      kinds.push(fields.find(field => field.name === 'type')!.type!.kind)
      for (const field of fields) {
        expect(
          field.comment?.summary.some(part => part.text.trim()),
          field.id,
        ).toBe(true)
        if (field.type?.declaration) {
          for (const child of contract.declarations[field.type.declaration]!.children) {
            expect(
              contract.declarations[child]!.comment?.summary.some(part => part.text.trim()),
              child,
            ).toBe(true)
          }
        }
      }
    }
    expect(kinds.filter(kind => kind === 'literal')).toHaveLength(25)
    expect(kinds.filter(kind => kind === 'templateLiteral')).toHaveLength(2)
  })

  it('describes workflow event fields, nested usage and the named step chunk aliases', () => {
    const contract = contracts.find(contract => contract.root === '@mastra/core/agent!Agent.generate')!
    const workflow = Object.values(contract.declarations).find(node => node.name === 'WorkflowStreamEvent')!
    expect(workflow.comment?.summary.some(part => part.text.trim())).toBe(true)
    const variants = workflow.type!.operands.flatMap(operand =>
      operand.type.operands.flatMap(part => (part.type.declaration ? [part.type.declaration] : [])),
    )
    expect(variants).toHaveLength(11)
    const pending = [...variants]
    for (const name of ['ReasoningFileChunk', 'CustomChunk', 'ToolOutputDeniedChunk']) {
      expect(
        Object.values(contract.declarations).some(node => node.name === name),
        name,
      ).toBe(false)
    }
    for (const name of ['SourceChunk', 'FileChunk', 'ToolCallChunk', 'ToolResultChunk', 'ReasoningChunk']) {
      const declaration = Object.values(contract.declarations).find(node => node.name === name)!
      expect(
        declaration.comment?.summary.some(part => part.text.trim()),
        name,
      ).toBe(true)
      const bodies = declaration.type!.operands.flatMap(part => (part.type.declaration ? [part.type.declaration] : []))
      expect(bodies, name).toHaveLength(1)
      pending.push(...bodies)
    }
    const seen = new Set<string>()
    while (pending.length) {
      const id = pending.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      for (const child of contract.declarations[id]!.children) {
        const field = contract.declarations[child]!
        expect(
          field.comment?.summary.some(part => part.text.trim()),
          field.id,
        ).toBe(true)
        if (field.type?.declaration) pending.push(field.type.declaration)
      }
    }
    const usage = Object.values(contract.declarations).filter(
      node => seen.has(node.id) && node.children.some(id => contract.declarations[id]!.name === 'inputTokens'),
    )
    expect(usage).toHaveLength(1)
    expect(usage[0]!.children.map(id => contract.declarations[id]!.name).sort()).toEqual([
      'inputTokens',
      'outputTokens',
      'totalTokens',
    ])
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
