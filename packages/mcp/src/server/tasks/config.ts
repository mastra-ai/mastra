import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { RequestContext } from '@mastra/core/request-context';
import type { MCPToolType } from '@mastra/core/tools';
import { DEFAULT_TASK_TTL_MS } from '../../shared/tasks';
import type { MCPDetailedTask } from '../../shared/tasks';
import type { InMemoryMCPTaskStore } from './in-memory-store';
import { isMCPTaskStoreAdmin } from './store';
import type {
  MCPTaskAccess,
  MCPTaskCreateParams,
  MCPTaskRunOptions,
  MCPTaskStore,
  MCPTaskStoreAdmin,
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
  /** Mode for tools not listed in `tools`. Default `'off'`. */
  default?: MCPServerTaskMode;
  /** Per-tool mode, keyed by tool name. */
  tools?: Record<string, MCPServerTaskMode | MCPServerToolTaskConfig>;
  /** Tasks for workflows are not supported yet. */
  workflows?: never;
  /** Tasks for agents are not supported yet. */
  agents?: never;
  /**
   * Tools that only run as tasks: a client that did not declare the Tasks extension gets a -32021
   * error instead of a synchronous answer.
   */
  required?: string[];
  /** How long a task is kept from creation, in ms; `null` keeps it until the server closes. Default 24 hours. */
  ttlMs?: number | null;
  /**
   * Whether a task whose server crashed or restarted mid-attempt runs the tool again from the start.
   * Only applies to stores that outlive a process (Mastra background tasks). Only turn this on for
   * idempotent tools: `execute` may run twice. When off, such a task fails as lost. Default `false`.
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
  required: ReadonlySet<string>;
  authorize?: MCPServerTasksOptions['authorize'];
  modeFor(name: string, toolType: MCPToolType | undefined): ResolvedToolTaskMode;
}

const MODES: readonly MCPServerTaskMode[] = ['off', 'auto', 'always'];
const DEFAULT_SYNC_WINDOW_MS = 2_000;

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

/** Validates `tasks` against the configured tools. Throws on anything a server could not serve. */
export function resolveTasksConfig(
  options: MCPServerTasksOptions | undefined,
  toolNames: readonly string[],
): ResolvedTasksConfig {
  const config = options ?? {};
  // TODO(MCP Tasks PR 4): serve workflows (`run_*`) as tasks.
  if (config.workflows !== undefined) throw invalid('tasks.workflows is not supported yet.');
  // TODO(MCP Tasks PR 5): serve agents (`ask_*`) as tasks.
  if (config.agents !== undefined) throw invalid('tasks.agents is not supported yet.');

  const defaultMode = config.default ?? 'off';
  assertMode('tasks.default', defaultMode);
  assertDuration('tasks.ttlMs', config.ttlMs);
  const ttlMs = config.ttlMs === undefined ? DEFAULT_TASK_TTL_MS : config.ttlMs;
  assertBoolean('tasks.recover', config.recover);
  const recover = config.recover ?? false;

  const known = new Set(toolNames);
  const perTool = new Map<string, ResolvedToolTaskMode>();
  for (const [name, entry] of Object.entries(config.tools ?? {})) {
    if (!known.has(name)) throw invalid(`tasks.tools names "${name}", which is not one of this server's tools.`);
    const tool = typeof entry === 'string' ? { mode: entry } : entry;
    assertMode(`tasks.tools.${name}`, tool.mode);
    assertDuration(`tasks.tools.${name}.syncWindowMs`, tool.syncWindowMs);
    assertDuration(`tasks.tools.${name}.ttlMs`, tool.ttlMs);
    assertBoolean(`tasks.tools.${name}.recover`, tool.recover);
    perTool.set(name, {
      mode: tool.mode,
      syncWindowMs: tool.syncWindowMs ?? DEFAULT_SYNC_WINDOW_MS,
      ttlMs: tool.ttlMs === undefined ? ttlMs : tool.ttlMs,
      recover: tool.recover ?? recover,
    });
  }
  const fallback: ResolvedToolTaskMode = {
    mode: defaultMode,
    syncWindowMs: DEFAULT_SYNC_WINDOW_MS,
    ttlMs,
    recover,
  };
  const off: ResolvedToolTaskMode = { ...fallback, mode: 'off' };
  const modeFor = (name: string, toolType: MCPToolType | undefined) =>
    // Agent and workflow tools stay synchronous until they are served as tasks of their own.
    toolType ? off : (perTool.get(name) ?? fallback);

  const required = new Set(config.required ?? []);
  for (const name of required) {
    if (!known.has(name)) throw invalid(`tasks.required names "${name}", which is not one of this server's tools.`);
    if (modeFor(name, undefined).mode === 'off') {
      throw invalid(`tasks.required names "${name}", which is not served as a task.`);
    }
  }

  const enabled = defaultMode !== 'off' || [...perTool.values()].some(tool => tool.mode !== 'off');
  return {
    enabled,
    store: config.store,
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

  run(taskId: string, work: MCPTaskWork, options?: MCPTaskRunOptions): void {
    if (!this.#selected) throw new Error(`MCP task "${taskId}" not found`);
    this.#selected.run(taskId, work, options);
  }
  /** The chosen store's admin view, or `undefined` when it has none. */
  async admin(): Promise<MCPTaskStoreAdmin | undefined> {
    const store = await this.#store();
    return isMCPTaskStoreAdmin(store) ? store : undefined;
  }
}
