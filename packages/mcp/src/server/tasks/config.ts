import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { RequestContext } from '@mastra/core/request-context';
import type { MCPToolType } from '@mastra/core/tools';
import { DEFAULT_TASK_TTL_MS, taskKeyOf } from '../../shared/tasks';
import type { MCPDetailedTask } from '../../shared/tasks';
import type { InMemoryMCPTaskStore } from './in-memory-store';
import type {
  MCPTaskAccess,
  MCPTaskCreateParams,
  MCPTaskLimits,
  MCPTaskRunOptions,
  MCPTaskStore,
  MCPTaskWork,
} from './store';

/**
 * How a tool answers `tools/call` for a client that declared the Tasks extension.
 *
 * - `'off'`: always answers synchronously.
 * - `'always'`: answers with a task straight away.
 * - `'auto'`: answers synchronously when the tool finishes within `syncWindowMs`, and with a task otherwise.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export type MCPServerTaskMode = 'off' | 'auto' | 'always';

/** @experimental SEP-2663 extension; API may change. */
export interface MCPServerToolTaskConfig {
  mode: MCPServerTaskMode;
  /** For `'auto'`: how long to wait for a synchronous answer, in ms. Default 2000. */
  syncWindowMs?: number;
  /** Overrides `tasks.ttlMs` for this tool's tasks. */
  ttlMs?: number | null;
  /** Overrides `tasks.recover` for this tool's tasks. */
  recover?: boolean;
}

/**
 * How one workflow's `run_<key>` tool is served as a task. There is no `recover`: a task whose
 * server restarted re-attaches to its workflow run, which core's workflow recovery continues.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export type MCPServerWorkflowTaskConfig = Omit<MCPServerToolTaskConfig, 'recover'>;

/**
 * What `tasks.authorize` receives on every `tasks/get`, `tasks/update` and `tasks/cancel`.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPServerTaskAuthorizeContext {
  /** The caller, already matched against the principal the task was created by. */
  principal: string;
  task: MCPDetailedTask;
  /** The caller's request context, including `user` when the server maps one from the request's auth info. */
  requestContext: RequestContext;
}

/**
 * Serves `tools/call` as MCP Tasks (`io.modelcontextprotocol/tasks`) for the tools you opt in.
 *
 * @experimental SEP-2663 extension; API may change.
 */
export interface MCPServerTasksOptions {
  /** Mode for every tool, workflow and agent not listed in `tools`, `workflows` or `agents`. Default `'off'`. */
  default?: MCPServerTaskMode;
  /** Per-tool mode, keyed by tool name. */
  tools?: Record<string, MCPServerTaskMode | MCPServerToolTaskConfig>;
  /**
   * Per-workflow mode, keyed by the server's `workflows` key; applies to its `run_<key>` tool. A
   * workflow task follows its workflow run: a suspended step asks the client for input, and
   * cancelling the task cancels the run.
   */
  workflows?: Record<string, MCPServerTaskMode | MCPServerWorkflowTaskConfig>;
  /** Per-agent mode, keyed by the server's `agents` key; applies to its `ask_<key>` tool. */
  agents?: Record<string, MCPServerTaskMode | MCPServerToolTaskConfig>;
  /**
   * Tools that only run as tasks, by the name clients call them (`run_<workflow>` and
   * `ask_<agent>` for workflows and agents): a client that did not declare the Tasks extension
   * gets a -32021 error instead of a synchronous answer.
   */
  required?: string[];
  /** How long a task is kept from creation, in ms; `null` keeps it until the server closes. Default 24 hours. */
  ttlMs?: number | null;
  /**
   * Whether a task whose server crashed or restarted mid-attempt runs the tool or agent again from
   * the start. Only applies to stores that outlive a process (Mastra background tasks). Only turn
   * this on for idempotent tools: `execute` may run twice. When off, such a task fails as lost.
   * Workflow tasks ignore it: they always re-attach to their run. Default `false`.
   */
  recover?: boolean;
  /**
   * Where tasks are kept. By default, Mastra's background tasks when the server is registered on a
   * Mastra instance with `backgroundTasks` enabled and storage that supports task expiry, so every
   * instance sharing that storage serves the same tasks. Otherwise an {@link InMemoryMCPTaskStore},
   * which serves a single instance.
   */
  store?: MCPTaskStore;
  /**
   * Most open (`working` or `input_required`) tasks one client may hold. Past it, a call that
   * would start a task answers with `isError: true` instead. Default 100. A custom `store` that
   * ignores `limits` in `create` enforces no cap.
   */
  maxOpenTasksPerClient?: number;
  /** Most open tasks across all clients. Default 1000. Enforced the same way as `maxOpenTasksPerClient`. */
  maxOpenTasks?: number;
  /**
   * Decides whether the caller may read, answer or cancel a task. Tasks are always bound to the
   * principal that created them; this narrows access further. A refusal answers as an unknown task.
   */
  authorize?: (context: MCPServerTaskAuthorizeContext) => boolean | Promise<boolean>;
}

/** How one tool is served as a task. */
export interface ResolvedToolTaskMode {
  mode: MCPServerTaskMode;
  syncWindowMs: number;
  ttlMs: number | null;
  recover: boolean;
}

export interface ResolvedTasksConfig {
  /** Whether any tool can answer with a task; gates the capability and the `tasks/*` handlers. */
  enabled: boolean;
  /** The store passed in, if any. */
  store?: MCPTaskStore;
  limits: MCPTaskLimits;
  required: ReadonlySet<string>;
  authorize?: MCPServerTasksOptions['authorize'];
  modeFor(name: string, toolType: MCPToolType | undefined): ResolvedToolTaskMode;
}

const MODES: readonly MCPServerTaskMode[] = ['off', 'auto', 'always'];
const DEFAULT_SYNC_WINDOW_MS = 2_000;
const DEFAULT_MAX_OPEN_TASKS_PER_CLIENT = 100;
const DEFAULT_MAX_OPEN_TASKS = 1_000;

function invalid(text: string): MastraError {
  return new MastraError({
    id: 'MCP_SERVER_TASKS_INVALID_CONFIG',
    domain: ErrorDomain.MCP,
    category: ErrorCategory.USER,
    text,
  });
}

function assertMode(owner: string, mode: unknown): asserts mode is MCPServerTaskMode {
  if (!MODES.includes(mode as MCPServerTaskMode)) {
    throw invalid(`${owner} has an unknown task mode "${String(mode)}"; use 'off', 'auto' or 'always'.`);
  }
}

function assertDuration(owner: string, value: number | null | undefined): void {
  if (value === null || value === undefined) return;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw invalid(`${owner} must be a non-negative integer number of milliseconds, got ${value}.`);
  }
}

function assertBoolean(owner: string, value: unknown): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw invalid(`${owner} must be a boolean, got ${String(value)}.`);
  }
}

/** The keys a server serves, for checking `tasks` against. */
export interface TasksConfigSurfaces {
  tools: readonly string[];
  workflows?: readonly string[];
  agents?: readonly string[];
}

function positiveInteger(owner: string, value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) throw invalid(`${owner} must be a positive integer, got ${value}.`);
  return value;
}

/** Validates `tasks` against the configured tools, workflows and agents. Throws on anything a server could not serve. */
export function resolveTasksConfig(
  options: MCPServerTasksOptions | undefined,
  surfaces: TasksConfigSurfaces,
): ResolvedTasksConfig {
  const config = options ?? {};
  const defaultMode = config.default ?? 'off';
  assertMode('tasks.default', defaultMode);
  assertDuration('tasks.ttlMs', config.ttlMs);
  const ttlMs = config.ttlMs === undefined ? DEFAULT_TASK_TTL_MS : config.ttlMs;
  assertBoolean('tasks.recover', config.recover);
  const recover = config.recover ?? false;
  const limits: MCPTaskLimits = {
    perPrincipal: positiveInteger(
      'tasks.maxOpenTasksPerClient',
      config.maxOpenTasksPerClient,
      DEFAULT_MAX_OPEN_TASKS_PER_CLIENT,
    ),
    total: positiveInteger('tasks.maxOpenTasks', config.maxOpenTasks, DEFAULT_MAX_OPEN_TASKS),
  };

  /** Resolves one surface's per-key entries, keyed by the tool name each key is exposed as. */
  const resolveSurface = (
    option: 'tools' | 'workflows' | 'agents',
    keys: readonly string[],
    exposedAs: (key: string) => string,
    surfaceRecover: (entry: MCPServerToolTaskConfig) => boolean,
  ) => {
    const known = new Set(keys);
    const tools = new Set(surfaces.tools);
    const resolved = new Map<string, ResolvedToolTaskMode>();
    const entries = (config[option] ?? {}) as Record<string, MCPServerTaskMode | MCPServerToolTaskConfig>;
    const noun = option.slice(0, -1);
    for (const [key, entry] of Object.entries(entries)) {
      if (!known.has(key))
        throw invalid(`tasks.${option} names "${key}", which is not one of this server's ${option}.`);
      const owner = `tasks.${option}.${key}`;
      // The server skips a workflow or agent whose run_/ask_ name a tool already has.
      if (option !== 'tools' && tools.has(exposedAs(key))) {
        throw invalid(`${owner} names a ${noun} hidden by the tool "${exposedAs(key)}", so it is never served.`);
      }
      const surface = typeof entry === 'string' ? { mode: entry } : entry;
      assertMode(owner, surface.mode);
      assertDuration(`${owner}.syncWindowMs`, surface.syncWindowMs);
      assertDuration(`${owner}.ttlMs`, surface.ttlMs);
      if (option === 'workflows' && 'recover' in surface) {
        throw invalid(`${owner}.recover is not a ${noun} option: a workflow task always re-attaches to its run.`);
      }
      assertBoolean(`${owner}.recover`, surface.recover);
      resolved.set(exposedAs(key), {
        mode: surface.mode,
        syncWindowMs: surface.syncWindowMs ?? DEFAULT_SYNC_WINDOW_MS,
        ttlMs: surface.ttlMs === undefined ? ttlMs : surface.ttlMs,
        recover: surfaceRecover(surface),
      });
    }
    return resolved;
  };
  const perTool = resolveSurface(
    'tools',
    surfaces.tools,
    key => key,
    tool => tool.recover ?? recover,
  );
  // Re-attaching never runs a step again (core's workflow recovery continues the run), so it is always safe.
  const perWorkflow = resolveSurface(
    'workflows',
    surfaces.workflows ?? [],
    key => `run_${key}`,
    () => true,
  );
  const perAgent = resolveSurface(
    'agents',
    surfaces.agents ?? [],
    key => `ask_${key}`,
    agent => agent.recover ?? recover,
  );

  const fallback: ResolvedToolTaskMode = {
    mode: defaultMode,
    syncWindowMs: DEFAULT_SYNC_WINDOW_MS,
    ttlMs,
    recover,
  };
  const modeFor = (name: string, toolType: MCPToolType | undefined): ResolvedToolTaskMode => {
    if (toolType === 'workflow') return perWorkflow.get(name) ?? { ...fallback, recover: true };
    if (toolType === 'agent') return perAgent.get(name) ?? fallback;
    return perTool.get(name) ?? fallback;
  };

  const exposed = new Map<string, MCPToolType | undefined>([
    ...surfaces.tools.map(name => [name, undefined] as const),
    ...(surfaces.workflows ?? []).map(key => [`run_${key}`, 'workflow'] as const),
    ...(surfaces.agents ?? []).map(key => [`ask_${key}`, 'agent'] as const),
  ]);
  const required = new Set(config.required ?? []);
  for (const name of required) {
    if (!exposed.has(name)) throw invalid(`tasks.required names "${name}", which is not one of this server's tools.`);
    if (modeFor(name, exposed.get(name)).mode === 'off') {
      throw invalid(`tasks.required names "${name}", which is not served as a task.`);
    }
  }

  const enabled =
    defaultMode !== 'off' ||
    [...perTool.values(), ...perWorkflow.values(), ...perAgent.values()].some(surface => surface.mode !== 'off');
  return {
    enabled,
    store: config.store,
    limits,
    required,
    authorize: config.authorize,
    modeFor,
  };
}

/**
 * Picks the store on first use, once the server knows whether it runs on a Mastra instance with
 * durable background tasks. `run` follows the `create` it pairs with, so the choice is made by then.
 */
export class SelectingMCPTaskStore implements MCPTaskStore {
  readonly #select: () => Promise<MCPTaskStore>;
  #selecting?: Promise<MCPTaskStore>;
  #selected?: MCPTaskStore;

  constructor(select: () => Promise<MCPTaskStore>) {
    this.#select = select;
  }

  /** The chosen store, once a task request has made the choice. */
  get selected(): MCPTaskStore | undefined {
    return this.#selected;
  }

  /** The chosen store, choosing it if no task request has yet. */
  resolve(): Promise<MCPTaskStore> {
    return this.#store();
  }

  #store(): Promise<MCPTaskStore> {
    // A failed choice (e.g. storage briefly unreachable) is not remembered: the next request chooses again.
    this.#selecting ??= this.#select().then(
      store => (this.#selected = store),
      error => {
        this.#selecting = undefined;
        throw error;
      },
    );
    return this.#selecting;
  }

  async create(params: MCPTaskCreateParams) {
    return (await this.#store()).create(params);
  }

  async get(taskId: string, access: MCPTaskAccess) {
    return (await this.#store()).get(taskId, access);
  }

  async update(taskId: string, inputResponses: Parameters<MCPTaskStore['update']>[1], access: MCPTaskAccess) {
    return (await this.#store()).update(taskId, inputResponses, access);
  }

  async cancel(taskId: string, access: MCPTaskAccess) {
    return (await this.#store()).cancel(taskId, access);
  }

  async traceOf(taskId: string, access: MCPTaskAccess) {
    return (await this.#store()).traceOf?.(taskId, access);
  }

  run(taskId: string, work: MCPTaskWork, options?: MCPTaskRunOptions): void {
    if (!this.#selected) throw new Error(`MCP task ${taskKeyOf(taskId)} not found`);
    this.#selected.run(taskId, work, options);
  }
}
