import * as _vitest_spy from '@vitest/spy';
import vm from 'node:vm';
import * as viteModuleRunner from 'vite/module-runner';
import { ModuleEvaluator, ModuleRunnerImportMeta, ModuleRunnerContext, EvaluatedModuleNode, FetchFunction, EvaluatedModules } from 'vite/module-runner';
import { R as RuntimeRPC, e as ResolveFunctionResult, W as WorkerGlobalState } from './worker.d.DadbA89M.js';
import { MockedModule, MockedModuleType } from '@vitest/mocker';
import { P as PendingSuiteMock, b as MockFactory, a as MockOptions } from './mocker.d.BE_2ls6u.js';

declare class FileMap {
	private fsCache;
	private fsBufferCache;
	readFileAsync(path: string): Promise<string>;
	readFile(path: string): string;
	readBuffer(path: string): Buffer<ArrayBuffer>;
}

interface ModuleEvaluateOptions {
	timeout?: vm.RunningScriptOptions["timeout"] | undefined;
	breakOnSigint?: vm.RunningScriptOptions["breakOnSigint"] | undefined;
}
type ModuleLinker = (specifier: string, referencingModule: VMModule, extra: {
	assert: object;
}) => VMModule | Promise<VMModule>;
type ModuleStatus = "unlinked" | "linking" | "linked" | "evaluating" | "evaluated" | "errored";
declare class VMModule {
	dependencySpecifiers: readonly string[];
	error: any;
	identifier: string;
	context: vm.Context;
	namespace: object;
	status: ModuleStatus;
	evaluate(options?: ModuleEvaluateOptions): Promise<void>;
	link(linker: ModuleLinker): Promise<void>;
}

interface ExternalModulesExecutorOptions {
	context: vm.Context;
	fileMap: FileMap;
	packageCache: Map<string, any>;
	transform: RuntimeRPC["transform"];
	interopDefault?: boolean;
	viteClientModule: Record<string, unknown>;
}
declare class ExternalModulesExecutor {
	#private;
	private options;
	private cjs;
	private esm;
	private vite;
	private context;
	private fs;
	private resolvers;
	constructor(options: ExternalModulesExecutorOptions);
	import(identifier: string): Promise<object>;
	require(identifier: string): any;
	createRequire(identifier: string): NodeJS.Require;
	importModuleDynamically: (specifier: string, referencer: VMModule) => Promise<VMModule>;
	resolveModule: (specifier: string, referencer: string) => Promise<VMModule>;
	resolve(specifier: string, parent: string): string;
	private getModuleInformation;
	private createModule;
	private get isNetworkSupported();
}

type ModuleExecutionInfo = Map<string, ModuleExecutionInfoEntry>;
interface ModuleExecutionInfoEntry {
	startOffset: number;
	/** The duration that was spent executing the module. */
	duration: number;
	/** The time that was spent executing the module itself and externalized imports. */
	selfTime: number;
}

interface VitestModuleEvaluatorOptions {
	interopDefault?: boolean | undefined;
	moduleExecutionInfo?: ModuleExecutionInfo;
	getCurrentTestFilepath?: () => string | undefined;
	compiledFunctionArgumentsNames?: string[];
	compiledFunctionArgumentsValues?: unknown[];
}
declare class VitestModuleEvaluator implements ModuleEvaluator {
	private options;
	stubs: Record<string, any>;
	env: ModuleRunnerImportMeta["env"];
	private vm;
	private compiledFunctionArgumentsNames?;
	private compiledFunctionArgumentsValues;
	private primitives;
	private debug;
	constructor(vmOptions?: VitestVmOptions | undefined, options?: VitestModuleEvaluatorOptions);
	private convertIdToImportUrl;
	runExternalModule(id: string): Promise<any>;
	runInlinedModule(context: ModuleRunnerContext, code: string, module: Readonly<EvaluatedModuleNode>): Promise<any>;
	private createRequire;
	private shouldInterop;
}
declare function createImportMetaEnvProxy(): ModuleRunnerImportMeta["env"];
declare function getDefaultRequestStubs(context?: vm.Context): Record<string, any>;
declare function isPrimitive(v: any): boolean;
declare function wrapId(id: string): string;
declare function unwrapId(id: string): string;

interface VitestTransportOptions {
	fetchModule: FetchFunction;
	resolveId: (id: string, importer?: string) => Promise<ResolveFunctionResult | null>;
}

interface MockContext {
	/**
	* When mocking with a factory, this refers to the module that imported the mock.
	*/
	callstack: null | string[];
}
interface VitestMockerOptions {
	context?: vm.Context;
	spyModule?: typeof _vitest_spy;
	root: string;
	moduleDirectories: string[];
	resolveId: (id: string, importer?: string) => Promise<{
		id: string;
		file: string;
		url: string;
	} | null>;
	getCurrentTestFilepath: () => string | undefined;
}
declare class VitestMocker {
	moduleRunner: VitestModuleRunner;
	private options;
	static pendingIds: PendingSuiteMock[];
	private spyModule?;
	private primitives;
	private filterPublicKeys;
	private registries;
	private mockContext;
	constructor(moduleRunner: VitestModuleRunner, options: VitestMockerOptions);
	private get root();
	private get evaluatedModules();
	private get moduleDirectories();
	initializeSpyModule(): Promise<void>;
	private getMockerRegistry;
	reset(): void;
	private invalidateModuleById;
	private isModuleDirectory;
	getSuiteFilepath(): string;
	private createError;
	resolveId(rawId: string, importer?: string): Promise<{
		id: string;
		url: string;
		external: string | null;
	}>;
	resolveMocks(): Promise<void>;
	private ensureModule;
	private callFunctionMock;
	getMockContext(): MockContext;
	getMockPath(dep: string): string;
	getDependencyMock(id: string): MockedModule | undefined;
	findMockRedirect(mockPath: string, external: string | null): string | null;
	mockObject(object: Record<string | symbol, any>, mockExports?: Record<string | symbol, any>, behavior?: "automock" | "autospy"): Record<string | symbol, any>;
	unmockPath(id: string): void;
	mockPath(originalId: string, id: string, url: string, external: string | null, mockType: MockedModuleType | undefined, factory: MockFactory | undefined): void;
	importActual<T>(rawId: string, importer: string, callstack?: string[] | null): Promise<T>;
	importMock(rawId: string, importer: string): Promise<any>;
	requestWithMockedModule(url: string, evaluatedNode: EvaluatedModuleNode, callstack: string[], mock: MockedModule): Promise<any>;
	mockedRequest(url: string, evaluatedNode: EvaluatedModuleNode, callstack: string[]): Promise<any>;
	queueMock(id: string, importer: string, factoryOrOptions?: MockFactory | MockOptions): void;
	queueUnmock(id: string, importer: string): void;
}
declare module "vite/module-runner" {
	interface EvaluatedModuleNode {
		mockedExports?: Record<string, any>;
	}
}

type CreateImportMeta = NonNullable<viteModuleRunner.ModuleRunnerOptions["createImportMeta"]>;
declare class VitestModuleRunner extends viteModuleRunner.ModuleRunner {
	private vitestOptions;
	mocker: VitestMocker;
	moduleExecutionInfo: ModuleExecutionInfo;
	constructor(vitestOptions: VitestModuleRunnerOptions);
	import(rawId: string): Promise<any>;
	fetchModule(url: string, importer?: string): Promise<EvaluatedModuleNode>;
	private _cachedRequest;
}
interface VitestModuleRunnerOptions {
	transport: VitestTransportOptions;
	evaluator: VitestModuleEvaluator;
	evaluatedModules: EvaluatedModules;
	getWorkerState: () => WorkerGlobalState;
	mocker?: VitestMocker;
	vm?: VitestVmOptions;
	spyModule?: typeof _vitest_spy;
	createImportMeta?: CreateImportMeta;
}
interface VitestVmOptions {
	context: vm.Context;
	externalModulesExecutor: ExternalModulesExecutor;
}

export { VitestModuleRunner as V, VitestModuleEvaluator as b, createImportMetaEnvProxy as c, getDefaultRequestStubs as g, isPrimitive as i, unwrapId as u, wrapId as w };
export type { VitestModuleEvaluatorOptions as a };
