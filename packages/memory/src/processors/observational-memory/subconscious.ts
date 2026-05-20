import { randomUUID } from 'node:crypto';

import { Agent } from '@mastra/core/agent';
import type { AgentConfig, SendAgentSignalOptions, ToolsInput } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import { createWorkspaceTools, Workspace, WORKSPACE_TOOLS_PREFIX } from '@mastra/core/workspace';
import type { WorkspaceConfig, WorkspaceFilesystem, WorkspaceToolsConfig } from '@mastra/core/workspace';
import { z } from 'zod';

import { omError } from './debug';
import { Extractor } from './extractor';
import type { ExtractorOnExtractedContext } from './extractor';
import { builtInPsycheDefinitions } from './subconscious-builtins';
export type { BuiltInPsycheName } from './subconscious-builtins';
import type { BuiltInPsycheName } from './subconscious-builtins';

type AgentModel = AgentConfig['model'];

export type PsycheName = BuiltInPsycheName | (string & {});
export type PsycheSelection = PsycheName[] | PsycheExtractionOptions;
export type SubconsciousWorkspace = Workspace | WorkspaceConfig<any, any, any> | undefined;
export type PsycheSignalIdleBehavior = NonNullable<SendAgentSignalOptions['ifIdle']>['behavior'];

export type SubconsciousActivityOperation =
  | 'write_file'
  | 'edit_file'
  | 'mkdir'
  | 'delete'
  | 'execute_command'
  | 'read_file'
  | 'search'
  | 'agent_run'
  | 'other';

export interface SubconsciousActivity {
  psyche: PsycheName;
  toolName: string;
  operation: SubconsciousActivityOperation;
  path?: string;
  command?: string;
  includedInSummary: boolean;
}

export interface SubconsciousStreamPartLog {
  psyche: PsycheName;
  index: number;
  type?: string;
  toolName?: string;
  content: string;
}

export interface SubconsciousActivityReport {
  activities: SubconsciousActivity[];
  streamParts: SubconsciousStreamPartLog[];
  summary: string;
  observation?: string;
}

export type SubconsciousNotificationInput = string | string[] | SubconsciousActivityReport;

export interface SubconsciousRuntime {
  readonly source: Subconscious;
  readonly active: PsycheName[];
  readonly phase?: 'observation' | 'reflection';
  run(extracted?: Record<string, unknown>): Promise<SubconsciousActivityReport>;
  notify(input: SubconsciousNotificationInput): Promise<SubconsciousNotificationStatus>;
  runAndNotify(extracted?: Record<string, unknown>): Promise<SubconsciousActivityReport>;
}

export interface PsycheDefinition<T = unknown> {
  schema?: z.ZodType<T>;
  extractionInstructions?: string;
  instructions?: string;
  agentInstructions?: string;
  agent?: Agent<any, any, any, any>;
  model?: AgentModel;
  tools?: ToolsInput | ((ctx: { requestContext: RequestContext }) => ToolsInput | Promise<ToolsInput>);
  workspace?: SubconsciousWorkspace;
  workspaceTools?: WorkspaceToolsConfig | false;
  workspaceDomain?: string | readonly string[];
}

export interface PsycheOnExtractedContext extends Omit<
  ExtractorOnExtractedContext<Record<string, unknown>>,
  'extracted'
> {
  subconscious: SubconsciousRuntime;
  extracted: Record<string, unknown>;
  phase?: 'observation' | 'reflection';
  active: PsycheName[];
}

export interface PsycheExtractionOptions {
  active: PsycheName[];
  phase?: 'observation' | 'reflection';
  schemas?: Partial<Record<PsycheName, z.ZodType<any>>>;
  instructions?: Partial<Record<PsycheName, string>>;
  models?: Partial<Record<PsycheName, AgentModel>>;
  psyches?: Partial<Record<PsycheName, PsycheDefinition<any>>>;
  onExtracted?: (ctx: PsycheOnExtractedContext) => void | Promise<void>;
}

export interface SubconsciousOptions {
  model?: AgentModel;
  instructions?: string;
  psyches?: Partial<Record<PsycheName, PsycheDefinition<any>>>;
  workspace?: SubconsciousWorkspace;
  workspaceTools?: WorkspaceToolsConfig | false;
  workspaceDomains?: Partial<Record<PsycheName, string | readonly string[]>>;
  signal?: Pick<Extract<SendAgentSignalOptions, { resourceId: string; threadId: string }>, 'ifActive' | 'ifIdle'>;
}

export interface PsycheHandle<T = unknown> {
  name: PsycheName;
  schema: z.ZodType<T>;
  extractionInstructions: string;
  agentInstructions: string;
  workspaceDomain?: string | readonly string[];
  agent: Agent<any, any, any, any>;
  model?: AgentModel;
  managedAgent: boolean;
}

const DEFAULT_MODEL = 'default' as unknown as AgentModel;
const DEFAULT_PSYCHE_MAX_STEPS = 100;
const ACTIVITY_LOG_DIR = 'activity';
const ACTIVITY_LOG_PATH = 'activity/subconscious-log.md';

type SubconsciousRunContext = Omit<ExtractorOnExtractedContext<Record<string, unknown>>, 'extracted'> & {
  phase?: 'observation' | 'reflection';
  active?: PsycheName[];
};

export type SubconsciousNotificationStatus = {
  status: 'sent' | 'skipped' | 'failed';
  reason?: string;
  error?: string;
};

const DEFAULT_WORKSPACE_TOOLS: WorkspaceToolsConfig = {
  enabled: true,
  mastra_workspace_read_file: { enabled: true },
  mastra_workspace_write_file: { enabled: true },
  mastra_workspace_edit_file: { enabled: true },
  mastra_workspace_list_files: { enabled: true },
  mastra_workspace_file_stat: { enabled: true },
  mastra_workspace_mkdir: { enabled: true },
  mastra_workspace_grep: { enabled: true },
  mastra_workspace_search: { enabled: true },
  mastra_workspace_delete: { enabled: false },
  mastra_workspace_execute_command: { enabled: false },
  mastra_workspace_get_process_output: { enabled: false },
  mastra_workspace_kill_process: { enabled: false },
};

const MAIN_AGENT_WORKSPACE_TOOLS: WorkspaceToolsConfig = {
  enabled: true,
  mastra_workspace_read_file: { enabled: true },
  mastra_workspace_list_files: { enabled: true },
  mastra_workspace_file_stat: { enabled: true },
  mastra_workspace_grep: { enabled: true },
  mastra_workspace_search: { enabled: true },
  mastra_workspace_write_file: { enabled: false },
  mastra_workspace_edit_file: { enabled: false },
  mastra_workspace_mkdir: { enabled: false },
  mastra_workspace_delete: { enabled: false },
  mastra_workspace_execute_command: { enabled: false },
  mastra_workspace_get_process_output: { enabled: false },
  mastra_workspace_kill_process: { enabled: false },
};

function isWorkspace(value: SubconsciousWorkspace): value is Workspace {
  return value instanceof Workspace;
}

function toWorkspace(workspace: SubconsciousWorkspace): Workspace | undefined {
  if (!workspace) return undefined;
  return isWorkspace(workspace) ? workspace : new Workspace(workspace);
}

function mergeWorkspaceTools(
  base: WorkspaceToolsConfig | undefined,
  override: WorkspaceToolsConfig | false | undefined,
) {
  if (override === false) return false;
  return { ...DEFAULT_WORKSPACE_TOOLS, ...base, ...override } satisfies WorkspaceToolsConfig;
}

function withWorkspaceToolsConfig(workspace: Workspace, toolsConfig: WorkspaceToolsConfig): Workspace {
  return new Proxy(workspace, {
    get(target: any, prop: string | symbol) {
      if (prop === 'getToolsConfig') {
        return () => toolsConfig;
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Workspace;
}

function domainToText(domain?: string | readonly string[]) {
  if (!domain) return 'the configured workspace domain';
  return Array.isArray(domain) ? domain.join(', ') : domain;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return Boolean(value);
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return true;
}

function primitiveAttributes(attributes: Record<string, unknown>) {
  const filtered: Record<string, string | number | boolean | null | undefined> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (['string', 'number', 'boolean'].includes(typeof value) || value === null || value === undefined) {
      filtered[key] = value as string | number | boolean | null | undefined;
    }
  }
  return filtered;
}

function shouldInheritMainAgentModel(model: AgentModel | undefined): boolean {
  return !model || model === DEFAULT_MODEL || model === 'default';
}

function modelFromContext(context: { currentModel?: { provider?: string; modelId?: string } }): string | undefined {
  const { provider, modelId } = context.currentModel ?? {};
  if (provider && modelId) return `${provider}/${modelId}`;
  return modelId;
}

async function getMainAgentModel(context: {
  mainAgent?: Agent<any, any, any, any>;
  requestContext: RequestContext;
}): Promise<AgentModel | undefined> {
  if (!context.mainAgent) return undefined;
  try {
    return await context.mainAgent.getModel({ requestContext: context.requestContext });
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getNestedValue(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function getToolInput(part: Record<string, unknown>): unknown {
  return parseMaybeJson(
    part.input ??
      part.args ??
      part.arguments ??
      part.toolInput ??
      part.inputText ??
      getNestedValue(part, ['data', 'input']) ??
      getNestedValue(part, ['data', 'args']),
  );
}

function getToolName(part: unknown): string | undefined {
  if (!isRecord(part)) return undefined;
  return firstString(
    part.toolName,
    part.name,
    getNestedValue(part, ['data', 'toolName']),
    getNestedValue(part, ['toolCall', 'toolName']),
  );
}

function getPathFromInput(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;
  return firstString(
    input.path,
    input.filePath,
    input.targetPath,
    input.destinationPath,
    input.dirPath,
    input.directory,
    input.cwd,
  );
}

function getToolResultText(part: Record<string, unknown>): string | undefined {
  const result =
    part.result ??
    part.output ??
    part.text ??
    getNestedValue(part, ['data', 'result']) ??
    getNestedValue(part, ['data', 'output']);
  if (typeof result === 'string') return result;
  if (Array.isArray(result)) {
    return result
      .map(item =>
        typeof item === 'string' ? item : isRecord(item) && typeof item.text === 'string' ? item.text : undefined,
      )
      .filter(Boolean)
      .join('\n');
  }
  return undefined;
}

function getPathFromResult(operation: SubconsciousActivityOperation, resultText?: string): string | undefined {
  if (!resultText) return undefined;
  const patterns =
    operation === 'mkdir'
      ? [/Created directory\s+(.+)$/m]
      : operation === 'write_file'
        ? [/Wrote\s+\d+\s+bytes\s+to\s+(.+)$/m]
        : operation === 'delete'
          ? [/Deleted\s+(.+)$/m]
          : [];
  for (const pattern of patterns) {
    const match = resultText.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function getCommandFromInput(input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;
  return firstString(input.command, input.cmd);
}

function normalizePath(path: string): string {
  return path.replace(/^\.\//, '');
}

function classifyWorkspaceOperation(toolName: string): SubconsciousActivityOperation {
  if (toolName.endsWith('_write_file')) return 'write_file';
  if (toolName.endsWith('_edit_file') || toolName.endsWith('_ast_edit')) return 'edit_file';
  if (toolName.endsWith('_mkdir')) return 'mkdir';
  if (toolName.endsWith('_delete')) return 'delete';
  if (toolName.endsWith('_execute_command')) return 'execute_command';
  if (toolName.endsWith('_read_file')) return 'read_file';
  if (toolName.endsWith('_grep') || toolName.endsWith('_search') || toolName.endsWith('_list_files')) return 'search';
  return 'other';
}

function shouldSummarizeOperation(operation: SubconsciousActivityOperation): boolean {
  return ['write_file', 'edit_file', 'mkdir', 'delete', 'execute_command'].includes(operation);
}

function agentRunActivity(
  psyche: PsycheName,
  streamPartCount: number,
  workspaceActivityCount: number,
): SubconsciousActivity {
  return {
    psyche,
    toolName: 'subconscious_agent',
    operation: 'agent_run',
    command: `${streamPartCount} stream part${streamPartCount === 1 ? '' : 's'}, ${workspaceActivityCount} workspace operation${workspaceActivityCount === 1 ? '' : 's'}, maxSteps=${DEFAULT_PSYCHE_MAX_STEPS}`,
    includedInSummary: false,
  };
}

function streamPartLog(psyche: PsycheName, index: number, part: unknown): SubconsciousStreamPartLog {
  const type = isRecord(part) ? firstString(part.type) : undefined;
  const toolName = isRecord(part) ? getToolName(part) : undefined;
  const content = formatExtractedPayload(part);
  return {
    psyche,
    index,
    type,
    toolName,
    content: content.length > 4_000 ? `${content.slice(0, 4_000)}\n... <truncated>` : content,
  };
}

function activityFromStreamPart(psyche: PsycheName, part: unknown): SubconsciousActivity | undefined {
  if (!isRecord(part)) return undefined;
  const toolName = getToolName(part);
  if (!toolName?.startsWith(WORKSPACE_TOOLS_PREFIX)) return undefined;

  const input = getToolInput(part);
  const operation = classifyWorkspaceOperation(toolName);
  const resultText = getToolResultText(part);
  const path = getPathFromInput(input) ?? getPathFromResult(operation, resultText);
  const command = getCommandFromInput(input);

  return {
    psyche,
    toolName,
    operation,
    path: path ? normalizePath(path) : undefined,
    command,
    includedInSummary: shouldSummarizeOperation(operation),
  };
}

async function consumeStreamParts(stream: unknown, onPart: (part: unknown) => void): Promise<void> {
  const fullStream = isRecord(stream) ? stream.fullStream : undefined;
  const source = fullStream ?? stream;

  if (isRecord(source) && typeof source.getReader === 'function') {
    const reader = source.getReader() as ReadableStreamDefaultReader<unknown>;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onPart(value);
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }

  if (source && typeof (source as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    for await (const part of source as AsyncIterable<unknown>) {
      onPart(part);
    }
  }
}

function uniqueActivities(activities: SubconsciousActivity[]): SubconsciousActivity[] {
  const seen = new Set<string>();
  const unique: SubconsciousActivity[] = [];
  for (const activity of activities) {
    const key = [activity.psyche, activity.operation, activity.path, activity.command].join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(activity);
  }
  return unique;
}

function pathKind(path?: string): string {
  if (!path) return 'workspace item';
  if (path.startsWith('skills/')) return 'skill';
  if (path.startsWith('knowledge/')) return 'knowledge';
  if (path.startsWith('review/')) return 'review note';
  if (path.startsWith('artifacts/')) return 'artifact';
  if (path.startsWith('mental-model/')) return 'mental model';
  return 'workspace item';
}

function activityVerb(activity: SubconsciousActivity): string {
  if (activity.operation === 'write_file') return 'created/updated';
  if (activity.operation === 'edit_file') return 'updated';
  if (activity.operation === 'mkdir') return 'created directory';
  if (activity.operation === 'delete') return 'deleted';
  if (activity.operation === 'execute_command') return 'ran command';
  return 'used';
}

function formatActivity(activity: SubconsciousActivity): string {
  if (activity.operation === 'execute_command') {
    return `${activity.psyche} ran workspace command ${activity.command ? `\`${activity.command}\`` : `via \`${activity.toolName}\``}`;
  }
  if (activity.operation === 'agent_run') {
    return `${activity.psyche} ran psyche agent${activity.command ? ` (${activity.command})` : ''}`;
  }

  const target = activity.path ? `\`${activity.path}\`` : `via \`${activity.toolName}\``;
  const kind = activity.operation === 'mkdir' ? '' : ` ${pathKind(activity.path)}`;
  return `${activity.psyche} ${activityVerb(activity)}${kind} ${target}`;
}

function formatReport(activities: SubconsciousActivity[]): Pick<SubconsciousActivityReport, 'summary' | 'observation'> {
  const summarized = uniqueActivities(activities.filter(activity => activity.includedInSummary));
  if (summarized.length === 0) return { summary: '', observation: undefined };

  const summary = summarized.map(activity => `- ${formatActivity(activity)}`).join('\n');
  return {
    summary,
    observation: `<subconscious>\n${summary}\n</subconscious>`,
  };
}

function textFromNotificationInput(input: SubconsciousNotificationInput): string[] {
  if (typeof input === 'string') return [input];
  if (Array.isArray(input)) return input;
  if (input.observation) return [input.observation];
  if (input.summary) return [`<subconscious>\n${input.summary}\n</subconscious>`];
  return [];
}

function workspaceLocation(workspace: Workspace | undefined): string {
  const filesystem = workspace?.filesystem as { basePath?: string } | undefined;
  return filesystem?.basePath ?? workspace?.name ?? 'the configured Subconscious workspace';
}

function formatExtractedPayload(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatActivityLogEntry({
  extracted,
  report,
  context,
  active,
  notification,
}: {
  extracted: Record<string, unknown>;
  report: SubconsciousActivityReport;
  context: SubconsciousRunContext;
  active: PsycheName[];
  notification: SubconsciousNotificationStatus;
}): string {
  const timestamp = new Date().toISOString();
  const phase = context.phase ?? 'unknown';
  const summarized = uniqueActivities(report.activities.filter(activity => activity.includedInSummary));
  const activityLines =
    summarized.length > 0
      ? summarized.map(activity => `- ${formatActivity(activity)}`)
      : ['- No durable workspace changes detected.'];
  const psycheRunLines = report.activities
    .filter(activity => activity.operation === 'agent_run')
    .map(activity => `- ${formatActivity(activity)}`);
  const rawActivityLines =
    report.activities.length > 0
      ? uniqueActivities(report.activities).map(activity => {
          const target = activity.path ? ` path=\`${activity.path}\`` : '';
          const command = activity.command ? ` command=\`${activity.command}\`` : '';
          return `- ${activity.psyche}: ${activity.operation}${target}${command}`;
        })
      : ['- none'];
  const streamPartLines =
    report.streamParts.length > 0
      ? report.streamParts.flatMap(part => [
          `#### ${part.psyche} part ${part.index}${part.type ? ` — ${part.type}` : ''}${part.toolName ? ` — ${part.toolName}` : ''}`,
          '```json',
          part.content,
          '```',
        ])
      : ['- none'];
  const notificationLine =
    notification.status === 'failed'
      ? `failed: ${notification.error ?? 'unknown error'}`
      : notification.status === 'skipped'
        ? `skipped: ${notification.reason ?? 'unknown reason'}`
        : notification.status;
  const extractionLines = active.flatMap(psyche => {
    const payload = extracted[psyche];
    if (!hasMeaningfulValue(payload)) return [`- ${psyche}: no meaningful payload`];
    return [`#### ${psyche}`, '```json', formatExtractedPayload(payload), '```'];
  });

  return [
    `## ${timestamp} — ${phase} — ${active.join(', ') || 'none'}`,
    '',
    `Thread: \`${context.threadId}\``,
    `Resource: \`${context.resourceId ?? context.mainAgent?.id ?? 'global'}\``,
    `Notification: \`${notificationLine}\``,
    '',
    '### Extractions',
    ...(extractionLines.length > 0 ? extractionLines : ['- none']),
    '',
    '### Psyche activity',
    ...(psycheRunLines.length > 0 ? psycheRunLines : ['- No psyche agents ran.']),
    '',
    '### Stream parts',
    ...streamPartLines,
    '',
    '### Workspace activity',
    ...activityLines,
    '',
    '### Raw operations',
    ...rawActivityLines,
    '',
  ].join('\n');
}

async function appendActivityLogFile(filesystem: WorkspaceFilesystem, entry: string): Promise<void> {
  try {
    await filesystem.appendFile(ACTIVITY_LOG_PATH, entry);
    return;
  } catch (error) {
    try {
      const existing = await filesystem.readFile(ACTIVITY_LOG_PATH, { encoding: 'utf-8' });
      await filesystem.writeFile(ACTIVITY_LOG_PATH, `${existing}${entry}`, { recursive: true });
      return;
    } catch {
      throw error;
    }
  }
}

export class Subconscious {
  readonly options: SubconsciousOptions;
  private readonly agents = new Map<PsycheName, Agent<any, any, any, any>>();

  constructor(options: SubconsciousOptions = {}) {
    this.options = options;
  }

  get learner() {
    return this.get('learner');
  }

  get critic() {
    return this.get('critic');
  }

  get dreamer() {
    return this.get('dreamer');
  }

  get modeler() {
    return this.get('modeler');
  }

  get<T = unknown>(name: PsycheName, overrides: PsycheDefinition<T> = {}): PsycheHandle<T> {
    const definition = this.resolveDefinition<T>(name, overrides);
    return {
      name,
      schema: definition.schema,
      extractionInstructions: definition.extractionInstructions,
      agentInstructions: definition.agentInstructions,
      workspaceDomain: definition.workspaceDomain,
      agent: definition.agent ?? this.getOrCreateAgent(name, definition),
      model: definition.model,
      managedAgent: !definition.agent,
    };
  }

  psyches(namesOrOptions: PsycheSelection): Extractor<Record<string, unknown>> {
    const options = Array.isArray(namesOrOptions) ? { active: namesOrOptions } : namesOrOptions;
    const active = options.active;
    const handles = active.map(name =>
      this.get(name, {
        ...(options.psyches?.[name] ?? {}),
        schema: options.schemas?.[name] ?? options.psyches?.[name]?.schema,
        extractionInstructions: options.instructions?.[name] ?? options.psyches?.[name]?.extractionInstructions,
        instructions: options.instructions?.[name] ?? options.psyches?.[name]?.instructions,
        model: options.models?.[name] ?? options.psyches?.[name]?.model,
      }),
    );
    const shape = Object.fromEntries(handles.map(handle => [handle.name, handle.schema.optional()]));

    return new Extractor<Record<string, unknown>>({
      name: 'subconscious',
      schema: z.object(shape).passthrough() as z.ZodType<Record<string, unknown>>,
      instructions: this.buildExtractionInstructions(handles, options.phase),
      onExtracted: async ctx => {
        const current = ctx.extracted.current ?? {};
        const runtime = this.createRuntime(current, { ...ctx, phase: options.phase, active });
        if (options.onExtracted) {
          await options.onExtracted({
            ...ctx,
            subconscious: runtime,
            extracted: current,
            phase: options.phase,
            active,
          });
          return current;
        }
        await runtime.runAndNotify(current);
        return current;
      },
    });
  }

  createRuntime(extracted: Record<string, unknown>, context: SubconsciousRunContext): SubconsciousRuntime {
    const active = context.active ?? (Object.keys(extracted) as PsycheName[]);
    return {
      source: this,
      active,
      phase: context.phase,
      run: runExtracted => this.run(runExtracted ?? extracted, { ...context, active }),
      notify: async input => {
        const text = textFromNotificationInput(input).filter(value => value.trim().length > 0);
        if (text.length === 0) {
          return { status: 'skipped', reason: 'notification input produced no non-empty text' };
        }

        const resourceId = context.resourceId ?? context.mainAgent?.id ?? 'global';
        const result = context.mainAgent.sendSignal(
          {
            type: 'om.subconscious.notification',
            contents: [
              'Your subconscious bubbled up an internal thought notification:',
              '',
              ...text,
              '',
              'Continue with the knowledge your subconscious surfaced, but do not respond directly to this notification or stop what you were doing.',
            ].join('\n'),
            attributes: primitiveAttributes({
              source: 'observational-memory',
              phase: context.phase,
              threadId: context.threadId,
              resourceId,
              active: active.join(','),
            }),
          },
          {
            resourceId,
            threadId: context.threadId,
            ifActive: this.options.signal?.ifActive ?? { behavior: 'deliver' },
            ifIdle: {
              behavior: this.options.signal?.ifIdle?.behavior ?? 'persist',
              streamOptions: {
                ...(this.options.signal?.ifIdle?.streamOptions as any),
                requestContext: context.requestContext,
                memory: {
                  ...(this.options.signal?.ifIdle?.streamOptions as any)?.memory,
                  resource: resourceId,
                  thread: context.threadId,
                },
              },
            },
          },
        );
        await result.persisted;
        return { status: 'sent' };
      },
      runAndNotify: async runExtracted => {
        const runInput = runExtracted ?? extracted;
        const runtimeContext = { ...context, active };
        const report = await this.run(runInput, runtimeContext);
        let notification: SubconsciousNotificationStatus;
        try {
          notification = await this.createRuntime(runInput, runtimeContext).notify(report);
        } catch (error) {
          notification = { status: 'failed', error: error instanceof Error ? error.message : String(error) };
          await this.appendActivityLog(runInput, report, runtimeContext, notification);
          throw error;
        }
        await this.appendActivityLog(runInput, report, runtimeContext, notification);
        return report;
      },
    };
  }

  async run(extracted: Record<string, unknown>, context: SubconsciousRunContext): Promise<SubconsciousActivityReport> {
    const activities: SubconsciousActivity[] = [];
    const streamParts: SubconsciousStreamPartLog[] = [];
    const active = context.active ?? (Object.keys(extracted) as PsycheName[]);

    await Promise.all(
      active.map(async psyche => {
        const payload = extracted[psyche];
        if (!hasMeaningfulValue(payload)) return;

        const handle = this.get(psyche);
        const stream = await this.streamPsyche(handle, payload, context);
        let streamPartCount = 0;
        let workspaceActivityCount = 0;
        await consumeStreamParts(stream, part => {
          streamPartCount += 1;
          streamParts.push(streamPartLog(psyche, streamPartCount, part));
          const activity = activityFromStreamPart(psyche, part);
          if (activity) {
            workspaceActivityCount += 1;
            activities.push(activity);
          }
        });
        activities.push(agentRunActivity(psyche, streamPartCount, workspaceActivityCount));
      }),
    );

    const formatted = formatReport(activities);
    return { activities, streamParts, ...formatted };
  }

  async sendSignals(extracted: Record<string, unknown>, context: SubconsciousRunContext) {
    return this.run(extracted, context);
  }

  private async appendActivityLog(
    extracted: Record<string, unknown>,
    report: SubconsciousActivityReport,
    context: SubconsciousRunContext,
    notification: SubconsciousNotificationStatus,
  ): Promise<void> {
    const workspace = toWorkspace(this.options.workspace);
    if (!workspace) return;

    try {
      const filesystem = await workspace.resolveFilesystem({ requestContext: context.requestContext });
      if (!filesystem) return;
      await filesystem.mkdir(ACTIVITY_LOG_DIR, { recursive: true });
      await appendActivityLogFile(
        filesystem,
        `${formatActivityLogEntry({
          extracted,
          report,
          context,
          active: context.active ?? [],
          notification,
        })}\n`,
      );
    } catch (error) {
      omError('[OM] failed to append Subconscious activity log', error);
    }
  }

  async workspaceToolsFor(name: PsycheName, requestContext: RequestContext) {
    const definition = this.resolveDefinition(name);
    const workspace = toWorkspace(definition.workspace);
    if (!workspace || definition.workspaceTools === false) return {};

    const toolsConfig = mergeWorkspaceTools(workspace.getToolsConfig(), definition.workspaceTools);
    if (toolsConfig === false) return {};

    return createWorkspaceTools(withWorkspaceToolsConfig(workspace, toolsConfig), {
      requestContext,
      agentId: `subconscious-${name}`,
    } as any);
  }

  mainAgentInstructions(): string | undefined {
    const workspace = toWorkspace(this.options.workspace);
    if (!workspace) return undefined;

    return [
      '<subconscious-workspace>',
      `Your memory includes a subconscious aspect. Your mind will process what is happening in the background and write or update mental artifacts, knowledge, and skills in ${workspaceLocation(workspace)}.`,
      `A deterministic runtime activity log is kept at ${ACTIVITY_LOG_PATH.replace(/^\//, '')}. Use it to debug whether subconscious processing ran, which psyches executed, what artifacts changed, and whether you were notified.`,
      'Feel free to ponder in this space as needed; it is your subconscious.',
      'Treat these artifacts as your own, not as a user-authored source of truth.',
      '</subconscious-workspace>',
    ].join('\n');
  }

  async workspaceToolsForMainAgent(
    requestContext: RequestContext,
    options: { agentId?: string; tools?: WorkspaceToolsConfig | false } = {},
  ) {
    const workspace = toWorkspace(this.options.workspace);
    if (!workspace || options.tools === false) return {};

    const toolsConfig = {
      ...MAIN_AGENT_WORKSPACE_TOOLS,
      ...workspace.getToolsConfig(),
      ...options.tools,
    } satisfies WorkspaceToolsConfig;
    return createWorkspaceTools(withWorkspaceToolsConfig(workspace, toolsConfig), {
      requestContext,
      agentId: options.agentId ?? 'main-agent',
    } as any);
  }

  private async streamPsyche(
    handle: PsycheHandle,
    payload: unknown,
    context: Omit<ExtractorOnExtractedContext<Record<string, unknown>>, 'extracted'> & {
      phase?: 'observation' | 'reflection';
    },
  ) {
    const scopeId = context.resourceId ?? context.mainAgent?.id ?? 'global';
    const threadId = `subconscious:${scopeId}:${handle.name}`;
    const resourceId = context.resourceId ?? context.mainAgent?.id ?? 'global';
    const signalType = `om.subconscious.${handle.name}.extracted`;
    const inheritedModel =
      handle.managedAgent && shouldInheritMainAgentModel(handle.model)
        ? ((await getMainAgentModel(context)) ?? modelFromContext(context))
        : undefined;

    if (inheritedModel) {
      handle.agent.__updateModel({ model: inheritedModel as any });
    }

    const signal = {
      type: signalType,
      contents: JSON.stringify(payload),
      attributes: primitiveAttributes({
        source: 'observational-memory',
        phase: context.phase,
        threadId: context.threadId,
        resourceId: context.resourceId,
        agentId: context.mainAgent?.id,
        causationId: context.threadId,
        depth: 0,
        psyche: handle.name,
        workspaceDomain: domainToText(handle.workspaceDomain),
      }),
    };

    const message = [
      `Signal: ${signalType}`,
      `Attributes: ${JSON.stringify(signal.attributes)}`,
      '',
      'Extracted payload:',
      signal.contents,
    ].join('\n');

    const streamOptions = this.options.signal?.ifIdle?.streamOptions as any;

    return handle.agent.stream(message, {
      maxSteps: DEFAULT_PSYCHE_MAX_STEPS,
      ...streamOptions,
      runId: randomUUID(),
      requestContext: context.requestContext,
      ...(inheritedModel ? { model: inheritedModel } : {}),
      memory: {
        ...streamOptions?.memory,
        resource: resourceId,
        thread: threadId,
      },
    } as any);
  }

  private resolveDefinition<T = unknown>(name: PsycheName, overrides: PsycheDefinition<T> = {}) {
    const builtIn = builtInPsycheDefinitions[name as BuiltInPsycheName];
    const global = this.options.psyches?.[name] ?? {};
    const workspaceDomain =
      overrides.workspaceDomain ??
      global.workspaceDomain ??
      this.options.workspaceDomains?.[name] ??
      builtIn?.workspaceDomain;
    const extractionInstructions =
      overrides.extractionInstructions ??
      overrides.instructions ??
      global.extractionInstructions ??
      global.instructions ??
      builtIn?.extractionInstructions ??
      `Extract durable signals for the ${name} psyche.`;
    const agentInstructions =
      overrides.agentInstructions ??
      overrides.instructions ??
      global.agentInstructions ??
      global.instructions ??
      builtIn?.agentInstructions ??
      `You are the ${name} psyche for Observational Memory.`;

    return {
      schema: (overrides.schema ?? global.schema ?? builtIn?.schema ?? z.unknown()) as z.ZodType<T>,
      extractionInstructions,
      agentInstructions: this.withWorkspaceInstructions(agentInstructions, workspaceDomain),
      agent: overrides.agent ?? global.agent,
      model: overrides.model ?? global.model ?? this.options.model ?? DEFAULT_MODEL,
      tools: overrides.tools ?? global.tools,
      workspace: overrides.workspace ?? global.workspace ?? this.options.workspace,
      workspaceTools: overrides.workspaceTools ?? global.workspaceTools ?? this.options.workspaceTools,
      workspaceDomain,
    };
  }

  private withWorkspaceInstructions(instructions: string, workspaceDomain?: string | readonly string[]) {
    return [
      this.options.instructions,
      instructions,
      `Workspace responsibility: use available workspace tools to keep durable artifacts in ${domainToText(workspaceDomain)} up to date.`,
      'Prefer read/list/search before write/edit/mkdir. Do not delete files or execute commands unless tools are explicitly provided for that purpose.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private getOrCreateAgent(name: PsycheName, definition: ReturnType<Subconscious['resolveDefinition']>) {
    const existing = this.agents.get(name);
    if (existing) return existing;

    const agentId = `subconscious-${name}`;
    const workspace = toWorkspace(definition.workspace);
    const userTools = definition.tools;
    const agent = new Agent({
      id: agentId,
      name: agentId,
      model: definition.model,
      instructions: definition.agentInstructions,
      tools: async ({ requestContext }) => {
        const resolvedUserTools =
          typeof userTools === 'function' ? await userTools({ requestContext }) : (userTools ?? {});
        if (!workspace || definition.workspaceTools === false) return resolvedUserTools;

        const toolsConfig = mergeWorkspaceTools(workspace.getToolsConfig(), definition.workspaceTools);
        if (toolsConfig === false) return resolvedUserTools;

        const workspaceTools = await createWorkspaceTools(withWorkspaceToolsConfig(workspace, toolsConfig), {
          requestContext,
          agentId,
        } as any);
        return { ...workspaceTools, ...resolvedUserTools };
      },
    });
    this.agents.set(name, agent);
    return agent;
  }

  private buildExtractionInstructions(handles: Array<PsycheHandle<any>>, phase?: 'observation' | 'reflection') {
    const phaseText = phase ? ` during ${phase}` : '';
    return [
      `Extract subconscious psyche payloads${phaseText}.`,
      'Return valid JSON as one object. Include one property per active psyche only when there is meaningful data for that psyche.',
      'Each property value must match that psyche schema. Omit missing or empty psyche payloads rather than returning empty placeholders.',
      ...handles.map(handle => [`Property "${handle.name}":`, handle.extractionInstructions].join('\n')),
    ].join('\n\n');
  }
}
