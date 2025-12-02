import { CancelReason, File, TestAnnotation, TaskResultPack, TaskEventPack, FileSpecification, Task } from '@vitest/runner';
import { FetchFunctionOptions, FetchResult, EvaluatedModules } from 'vite/module-runner';
import { S as SerializedConfig } from './config.d.BTfZNUu9.js';
import { E as Environment } from './environment.d.CrsxCzP1.js';
import { SnapshotResult } from '@vitest/snapshot';

interface AfterSuiteRunMeta {
	coverage?: unknown;
	testFiles: string[];
	environment: string;
	projectName?: string;
}
interface UserConsoleLog {
	content: string;
	origin?: string;
	browser?: boolean;
	type: "stdout" | "stderr";
	taskId?: string;
	time: number;
	size: number;
}
interface ModuleGraphData {
	graph: Record<string, string[]>;
	externalized: string[];
	inlined: string[];
}
interface ProvidedContext {}
interface ResolveFunctionResult {
	id: string;
	file: string;
	url: string;
}
interface FetchCachedFileSystemResult {
	cached: true;
	tmp: string;
	id: string;
	file: string | null;
	url: string;
	invalidate: boolean;
}
type LabelColor = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white";

type ArgumentsType<T> = T extends (...args: infer A) => any ? A : never;
type ReturnType<T> = T extends (...args: any) => infer R ? R : never;
type PromisifyFn<T> = ReturnType<T> extends Promise<any> ? T : (...args: ArgumentsType<T>) => Promise<Awaited<ReturnType<T>>>;
type Thenable<T> = T | PromiseLike<T>;
type BirpcResolver = (name: string, resolved: (...args: unknown[]) => unknown) => Thenable<((...args: unknown[]) => unknown) | undefined>;
interface ChannelOptions {
    /**
     * Function to post raw message
     */
    post: (data: any, ...extras: any[]) => any | Promise<any>;
    /**
     * Listener to receive raw message
     */
    on: (fn: (data: any, ...extras: any[]) => void) => any | Promise<any>;
    /**
     * Clear the listener when `$close` is called
     */
    off?: (fn: (data: any, ...extras: any[]) => void) => any | Promise<any>;
    /**
     * Custom function to serialize data
     *
     * by default it passes the data as-is
     */
    serialize?: (data: any) => any;
    /**
     * Custom function to deserialize data
     *
     * by default it passes the data as-is
     */
    deserialize?: (data: any) => any;
    /**
     * Call the methods with the RPC context or the original functions object
     */
    bind?: 'rpc' | 'functions';
}
interface EventOptions<Remote> {
    /**
     * Names of remote functions that do not need response.
     */
    eventNames?: (keyof Remote)[];
    /**
     * Maximum timeout for waiting for response, in milliseconds.
     *
     * @default 60_000
     */
    timeout?: number;
    /**
     * Custom resolver to resolve function to be called
     *
     * For advanced use cases only
     */
    resolver?: BirpcResolver;
    /**
     * Hook triggered before an event is sent to the remote
     *
     * @param req - Request parameters
     * @param next - Function to continue the request
     * @param resolve - Function to resolve the response directly
     */
    onRequest?: (req: Request, next: (req?: Request) => Promise<any>, resolve: (res: any) => void) => void | Promise<void>;
    /**
     * Custom error handler
     *
     * @deprecated use `onFunctionError` and `onGeneralError` instead
     */
    onError?: (error: Error, functionName: string, args: any[]) => boolean | void;
    /**
     * Custom error handler for errors occurred in local functions being called
     *
     * @returns `true` to prevent the error from being thrown
     */
    onFunctionError?: (error: Error, functionName: string, args: any[]) => boolean | void;
    /**
     * Custom error handler for errors occurred during serialization or messsaging
     *
     * @returns `true` to prevent the error from being thrown
     */
    onGeneralError?: (error: Error, functionName?: string, args?: any[]) => boolean | void;
    /**
     * Custom error handler for timeouts
     *
     * @returns `true` to prevent the error from being thrown
     */
    onTimeoutError?: (functionName: string, args: any[]) => boolean | void;
}
type BirpcOptions<Remote> = EventOptions<Remote> & ChannelOptions;
type BirpcFn<T> = PromisifyFn<T> & {
    /**
     * Send event without asking for response
     */
    asEvent: (...args: ArgumentsType<T>) => Promise<void>;
};
type BirpcReturn<RemoteFunctions, LocalFunctions = Record<string, never>> = {
    [K in keyof RemoteFunctions]: BirpcFn<RemoteFunctions[K]>;
} & {
    $functions: LocalFunctions;
    $close: (error?: Error) => void;
    $closed: boolean;
    $rejectPendingCalls: (handler?: PendingCallHandler) => Promise<void>[];
};
type PendingCallHandler = (options: Pick<PromiseEntry, 'method' | 'reject'>) => void | Promise<void>;
interface PromiseEntry {
    resolve: (arg: any) => void;
    reject: (error: any) => void;
    method: string;
    timeoutId?: ReturnType<typeof setTimeout>;
}
declare const TYPE_REQUEST: "q";
interface Request {
    /**
     * Type
     */
    t: typeof TYPE_REQUEST;
    /**
     * ID
     */
    i?: string;
    /**
     * Method
     */
    m: string;
    /**
     * Arguments
     */
    a: any[];
}
declare const setTimeout: typeof globalThis.setTimeout;

interface RuntimeRPC {
	fetch: (id: string, importer: string | undefined, environment: string, options?: FetchFunctionOptions) => Promise<FetchResult | FetchCachedFileSystemResult>;
	resolve: (id: string, importer: string | undefined, environment: string) => Promise<ResolveFunctionResult | null>;
	transform: (id: string) => Promise<{
		code?: string;
	}>;
	onUserConsoleLog: (log: UserConsoleLog) => void;
	onUnhandledError: (err: unknown, type: string) => void;
	onQueued: (file: File) => void;
	onCollected: (files: File[]) => Promise<void>;
	onAfterSuiteRun: (meta: AfterSuiteRunMeta) => void;
	onTaskAnnotate: (testId: string, annotation: TestAnnotation) => Promise<TestAnnotation>;
	onTaskUpdate: (pack: TaskResultPack[], events: TaskEventPack[]) => Promise<void>;
	onCancel: (reason: CancelReason) => void;
	getCountOfFailedTests: () => number;
	snapshotSaved: (snapshot: SnapshotResult) => void;
	resolveSnapshotPath: (testPath: string) => string;
}
interface RunnerRPC {
	onCancel: (reason: CancelReason) => void;
}

type WorkerRPC = BirpcReturn<RuntimeRPC, RunnerRPC>;
interface ContextTestEnvironment {
	name: string;
	options: Record<string, any> | null;
}
interface WorkerTestEnvironment {
	name: string;
	options: Record<string, any> | null;
}
type TestExecutionMethod = "run" | "collect";
interface WorkerExecuteContext {
	files: FileSpecification[];
	providedContext: Record<string, any>;
	invalidates?: string[];
	/** Exposed to test runner as `VITEST_WORKER_ID`. Value is unique per each isolated worker. */
	workerId: number;
}
interface ContextRPC {
	pool: string;
	config: SerializedConfig;
	projectName: string;
	environment: WorkerTestEnvironment;
	rpc: WorkerRPC;
	files: FileSpecification[];
	providedContext: Record<string, any>;
	invalidates?: string[];
	/** Exposed to test runner as `VITEST_WORKER_ID`. Value is unique per each isolated worker. */
	workerId: number;
}
interface WorkerSetupContext {
	environment: WorkerTestEnvironment;
	pool: string;
	config: SerializedConfig;
	projectName: string;
	rpc: WorkerRPC;
}
interface WorkerGlobalState {
	ctx: ContextRPC;
	config: SerializedConfig;
	rpc: WorkerRPC;
	current?: Task;
	filepath?: string;
	metaEnv: {
		[key: string]: any;
		BASE_URL: string;
		MODE: string;
		DEV: boolean;
		PROD: boolean;
		SSR: boolean;
	};
	environment: Environment;
	evaluatedModules: EvaluatedModules;
	resolvingModules: Set<string>;
	moduleExecutionInfo: Map<string, any>;
	onCancel: (listener: (reason: CancelReason) => unknown) => void;
	onCleanup: (listener: () => unknown) => void;
	providedContext: Record<string, any>;
	durations: {
		environment: number;
		prepare: number;
	};
	onFilterStackTrace?: (trace: string) => string;
}

export type { AfterSuiteRunMeta as A, BirpcOptions as B, ContextRPC as C, LabelColor as L, ModuleGraphData as M, ProvidedContext as P, RuntimeRPC as R, TestExecutionMethod as T, UserConsoleLog as U, WorkerGlobalState as W, WorkerSetupContext as a, BirpcReturn as b, RunnerRPC as c, ContextTestEnvironment as d, ResolveFunctionResult as e, WorkerTestEnvironment as f, WorkerExecuteContext as g };
