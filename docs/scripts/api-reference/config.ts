import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const artifactDirectory = path.join(repositoryRoot, 'docs/src/data/api-reference')
export const entryPoints = ['packages/core/src/index.ts', 'packages/core/src/agent/index.ts']
export const ownedPackages = new Map([
  ['@mastra/core', 'packages/core'],
  ['@internal/auth', 'packages/_internals/auth'],
])

export const roots = [
  { name: 'Config', parent: undefined, id: '@mastra/core!Config', file: 'configuration.json' },
  { name: 'generate', parent: 'Agent', id: '@mastra/core/agent!Agent.generate', file: 'agent-generate.json' },
]

export const canonicalDestinations = new Map([
  ['@mastra/core!Config', '/reference/configuration'],
  ['@mastra/core/agent!Agent', '/reference/agents/agent'],
  ['@mastra/core/agent!Agent.generate', '/reference/agents/generate'],
])

// These are behavioral dependencies, not data records. Unlisted declarations expand,
// including classes and options/result records that happen to contain callbacks.
const serviceGroups: { path: string; names: string[]; reason: string }[] = [
  { path: 'agent/agent.ts', names: ['Agent'], reason: 'Agent execution and resource lifecycle' },
  { path: 'mastra/index.ts', names: ['Mastra'], reason: 'Dependency registry and application lifecycle' },
  { path: 'agent/types.ts', names: ['DurableAgentLike'], reason: 'Durable execution engine wrapper' },
  { path: 'agent/subagent.ts', names: ['SubAgent'], reason: 'Delegated agent execution service' },
  {
    path: 'browser/browser.ts',
    names: ['MastraBrowser', 'ScreencastStream'],
    reason: 'Browser session and screencast lifecycle',
  },
  { path: 'schedules/schedules.ts', names: ['Schedules'], reason: 'Persisted schedule management service' },
  {
    path: 'signals/signal-provider.ts',
    names: ['SignalProvider'],
    reason: 'External signal connection and polling lifecycle',
  },
  {
    path: 'signals/webhook-signal-provider.ts',
    names: ['WebhookSignalProvider'],
    reason: 'Webhook signal connection lifecycle',
  },
  {
    path: 'agent-controller/agent-controller.ts',
    names: ['AgentController'],
    reason: 'Session and agent lifecycle controller',
  },
  {
    path: 'agent/message-list/message-list.ts',
    names: ['MessageList'],
    reason: 'Mutable message conversion and persistence manager',
  },
  { path: 'agent/save-queue/index.ts', names: ['SaveQueueManager'], reason: 'Message persistence queue' },
  {
    path: 'background-tasks/manager.ts',
    names: ['BackgroundTaskManager'],
    reason: 'Background task lifecycle manager',
  },
  { path: 'storage/base.ts', names: ['MastraCompositeStore'], reason: 'Storage connection and domain access' },
  { path: 'deployer/index.ts', names: ['MastraDeployer'], reason: 'Build and deployment operations' },
  { path: 'memory/memory.ts', names: ['MastraMemory'], reason: 'Conversation persistence and retrieval operations' },
  { path: 'evals/base.ts', names: ['MastraScorer'], reason: 'Scoring execution service' },
  { path: 'cache/base.ts', names: ['MastraServerCache'], reason: 'Cache storage operations' },
  { path: 'tts/index.ts', names: ['MastraTTS'], reason: 'Speech generation service' },
  { path: 'vector/vector.ts', names: ['MastraVector'], reason: 'Vector database operations' },
  { path: 'worker/worker.ts', names: ['MastraWorker'], reason: 'Background worker lifecycle' },
  { path: 'mcp/index.ts', names: ['MCPServerBase'], reason: 'MCP server lifecycle and tool execution' },
  { path: 'events/pubsub.ts', names: ['PubSub'], reason: 'Event publication and subscription service' },
  { path: 'tools/tool.ts', names: ['Tool'], reason: 'Executable tool with validation and resource context' },
  { path: 'tools/stream.ts', names: ['ToolStream'], reason: 'Writable stream resource' },
  { path: 'workflows/workflow.ts', names: ['Workflow'], reason: 'Workflow definition and execution lifecycle' },
  { path: 'workspace/workspace.ts', names: ['Workspace'], reason: 'Filesystem and sandbox resource lifecycle' },
  { path: 'workspace/filesystem/filesystem.ts', names: ['WorkspaceFilesystem'], reason: 'Filesystem operations' },
  {
    path: 'workspace/sandbox/sandbox.ts',
    names: ['WorkspaceSandbox', 'SandboxComputer', 'SandboxNetworking'],
    reason: 'Sandbox execution and attached resource operations',
  },
  { path: 'workspace/sandbox/mastra-sandbox.ts', names: ['MastraSandbox'], reason: 'Sandbox provider lifecycle' },
  { path: 'workspace/sandbox/mount-manager.ts', names: ['MountManager'], reason: 'Mutable filesystem mount manager' },
  {
    path: 'workspace/sandbox/process-manager/process-manager.ts',
    names: ['SandboxProcessManager'],
    reason: 'Spawned process lifecycle manager',
  },
  { path: 'channels/types.ts', names: ['ChannelProvider'], reason: 'Channel integration lifecycle' },
  { path: 'agent-builder/ee/types.ts', names: ['IAgentBuilder'], reason: 'Builder configuration and registry service' },
  { path: 'editor/types.ts', names: ['IMastraEditor'], reason: 'Stored entity management service' },
  {
    path: 'llm/model/gateways/base.ts',
    names: ['MastraModelGatewayInterface'],
    reason: 'Model gateway authentication and execution routing',
  },
  {
    path: 'observability/types/core.ts',
    names: ['ObservabilityBridge', 'ObservabilityEntrypoint', 'ObservabilityExporter', 'ObservabilityInstance'],
    reason: 'Telemetry lifecycle and export operations',
  },
  { path: 'observability/types/client.ts', names: ['ClientObservabilityProxy'], reason: 'Telemetry transport proxy' },
  {
    path: 'observability/types/tracing.ts',
    names: [
      'Span',
      'AIModelGenerationSpan',
      'IModelSpanTracker',
      'SpanOutputProcessor',
      'RecordedSpan',
      'RecordedTrace',
    ],
    reason: 'Live or rehydrated tracing resource with execution or annotation operations',
  },
  { path: 'observability/types/logging.ts', names: ['LoggerContext'], reason: 'Structured logging operations' },
  {
    path: 'observability/types/metrics.ts',
    names: ['MetricsContext', 'Counter', 'Gauge', 'Histogram'],
    reason: 'Metric emission operations',
  },
  {
    path: 'processors/index.ts',
    names: ['Processor', 'ProcessorStreamWriter'],
    reason: 'Processing implementation or writable processing stream',
  },
  {
    path: 'processor-provider/types.ts',
    names: ['ProcessorProvider'],
    reason: 'Processor discovery and creation provider',
  },
  {
    path: 'tool-provider/types.ts',
    names: ['ToolProvider'],
    reason: 'Tool discovery, authorization and connection provider',
  },
  { path: 'storage/source-control.ts', names: ['SourceControlProvider'], reason: 'Source repository operations' },
  { path: 'tools/types.ts', names: ['ToolObserve'], reason: 'Tracing and logging operations scoped to a tool' },
  {
    path: 'tools/types.ts',
    names: ['ToolAction'],
    reason: 'Executable tool implementation with input and output schemas',
  },
  {
    path: 'tools/types.ts',
    names: ['MCPServerContext'],
    reason: 'Live MCP protocol session with request and notification operations',
  },
  {
    path: 'channels/agent-channels.ts',
    names: ['AgentChannels'],
    reason: 'Agent bot identity and channel connection lifecycle',
  },
  { path: 'storage/domains/memory/base.ts', names: ['MemoryStorage'], reason: 'Conversation storage operations' },
  {
    path: 'storage/domains/observability/base.ts',
    names: ['ObservabilityStorage'],
    reason: 'Telemetry storage operations',
  },
]

export const serviceClassifications = new Map(
  serviceGroups.flatMap(group => group.names.map(name => [`@mastra/core:src/${group.path}:${name}`, group.reason])),
)

export function symbolIdentity(packageName: string, packagePath: string, qualifiedName: string): string {
  return `${packageName}:${packagePath}:${qualifiedName}`
}
