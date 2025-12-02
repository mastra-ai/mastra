declare type BeforeunloadReason = 'cpu' | 'memory' | 'wall_clock' | 'early_drop' | 'termination'

declare interface WindowEventMap {
  load: Event
  unload: Event
  beforeunload: CustomEvent<BeforeunloadReason>
  drain: Event
}

// TODO(Nyannyacha): These two type defs will be provided later.

// deno-lint-ignore no-explicit-any
type S3FsConfig = any

// deno-lint-ignore no-explicit-any
type TmpFsConfig = any

type OtelPropagators = 'TraceContext' | 'Baggage'
type OtelConsoleConfig = 'Ignore' | 'Capture' | 'Replace'
type OtelConfig = {
  tracing_enabled?: boolean
  metrics_enabled?: boolean
  console?: OtelConsoleConfig
  propagators?: OtelPropagators[]
}

interface UserWorkerFetchOptions {
  signal?: AbortSignal
}

interface PermissionsOptions {
  allow_all?: boolean | null
  allow_env?: string[] | null
  deny_env?: string[] | null
  allow_net?: string[] | null
  deny_net?: string[] | null
  allow_ffi?: string[] | null
  deny_ffi?: string[] | null
  allow_read?: string[] | null
  deny_read?: string[] | null
  allow_run?: string[] | null
  deny_run?: string[] | null
  allow_sys?: string[] | null
  deny_sys?: string[] | null
  allow_write?: string[] | null
  deny_write?: string[] | null
  allow_import?: string[] | null
}

interface UserWorkerCreateContext {
  sourceMap?: boolean | null
  importMapPath?: string | null
  shouldBootstrapMockFnThrowError?: boolean | null
  suppressEszipMigrationWarning?: boolean | null
  useReadSyncFileAPI?: boolean | null
  supervisor?: {
    requestAbsentTimeoutMs?: number | null
  }
  otel?: {
    [attribute: string]: string
  }
}

interface UserWorkerCreateOptions {
  servicePath?: string | null
  envVars?: string[][] | [string, string][] | null
  noModuleCache?: boolean | null

  forceCreate?: boolean | null
  allowRemoteModules?: boolean | null
  customModuleRoot?: string | null
  permissions?: PermissionsOptions | null

  maybeEszip?: Uint8Array | null
  maybeEntrypoint?: string | null
  maybeModuleCode?: string | null

  memoryLimitMb?: number | null
  lowMemoryMultiplier?: number | null
  workerTimeoutMs?: number | null
  cpuTimeSoftLimitMs?: number | null
  cpuTimeHardLimitMs?: number | null
  staticPatterns?: string[] | null

  s3FsConfig?: S3FsConfig | null
  tmpFsConfig?: TmpFsConfig | null
  otelConfig?: OtelConfig | null

  context?: UserWorkerCreateContext | null
}

interface HeapStatistics {
  totalHeapSize: number
  totalHeapSizeExecutable: number
  totalPhysicalSize: number
  totalAvailableSize: number
  totalGlobalHandlesSize: number
  usedGlobalHandlesSize: number
  usedHeapSize: number
  mallocedMemory: number
  externalMemory: number
  peakMallocedMemory: number
}

interface RuntimeMetrics {
  mainWorkerHeapStats: HeapStatistics
  eventWorkerHeapStats?: HeapStatistics
}

interface MemInfo {
  total: number
  free: number
  available: number
  buffers: number
  cached: number
  swapTotal: number
  swapFree: number
}

declare namespace EdgeRuntime {
  export namespace ai {
    function tryCleanupUnusedSession(): Promise<number>
  }

  class UserWorker {
    constructor(key: string)

    fetch(request: Request, options?: UserWorkerFetchOptions): Promise<Response>

    static create(opts: UserWorkerCreateOptions): Promise<UserWorker>
    static tryCleanupIdleWorkers(timeoutMs: number): Promise<number>
  }

  export function scheduleTermination(): void
  export function waitUntil<T>(promise: Promise<T>): Promise<T>
  export function getRuntimeMetrics(): Promise<RuntimeMetrics>
  export function applySupabaseTag(src: Request, dest: Request): void
  export function systemMemoryInfo(): MemInfo
  export function raiseSegfault(): void

  export { UserWorker as userWorkers }
}

declare namespace Supabase {
  export namespace ai {
    interface ModelOptions {
      /**
       * Pool embeddings by taking their mean. Applies only for `gte-small` model
       */
      mean_pool?: boolean

      /**
       * Normalize the embeddings result. Applies only for `gte-small` model
       */
      normalize?: boolean

      /**
       * Stream response from model. Applies only for LLMs like `mistral` (default: false)
       */
      stream?: boolean

      /**
       * Automatically abort the request to the model after specified time (in seconds). Applies only for LLMs like `mistral` (default: 60)
       */
      timeout?: number

      /**
       * Mode for the inference API host. (default: 'ollama')
       */
      mode?: 'ollama' | 'openaicompatible'
      signal?: AbortSignal
    }

    export class Session {
      /**
       * Create a new model session using given model
       */
      constructor(model: string)

      /**
       * Execute the given prompt in model session
       */
      run(
        prompt:
          | string
          | Omit<import('openai').OpenAI.Chat.ChatCompletionCreateParams, 'model' | 'stream'>,
        modelOptions?: ModelOptions
      ): unknown
    }
  }
}

declare namespace Deno {
  export namespace errors {
    class WorkerRequestCancelled extends Error {}
    class WorkerAlreadyRetired extends Error {}
  }
}
