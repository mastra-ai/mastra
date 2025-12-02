import * as storybook_internal_types from 'storybook/internal/types';
import { PresetConfig, CoreCommon_ResolvedAddonPreset, CoreCommon_ResolvedAddonVirtual, CLIOptions, LoadOptions, BuilderOptions, StorybookConfigRaw, LoadedPreset, Presets, PackageJson, CoreCommon_AddonInfo, SupportedFrameworks, SupportedRenderers, Options as Options$1, CoreCommon_StorybookInfo, Ref, StorybookConfig, StoriesEntry, NormalizedStoriesSpecifier } from 'storybook/internal/types';
export { PackageJson } from 'storybook/internal/types';
import { WriteStream } from 'node:fs';
import { Buffer } from 'node:buffer';
import { ChildProcess } from 'node:child_process';
import { Readable, Writable, Stream } from 'node:stream';
import { ConfigFile } from 'storybook/internal/csf-tools';

declare const _default: {
    '@storybook/addon-a11y': string;
    '@storybook/addon-docs': string;
    '@storybook/addon-jest': string;
    '@storybook/addon-links': string;
    '@storybook/addon-onboarding': string;
    'storybook-addon-pseudo-states': string;
    '@storybook/addon-themes': string;
    '@storybook/addon-vitest': string;
    '@storybook/builder-vite': string;
    '@storybook/builder-webpack5': string;
    storybook: string;
    '@storybook/angular': string;
    '@storybook/ember': string;
    '@storybook/html-vite': string;
    '@storybook/nextjs': string;
    '@storybook/nextjs-vite': string;
    '@storybook/preact-vite': string;
    '@storybook/react-native-web-vite': string;
    '@storybook/react-vite': string;
    '@storybook/react-webpack5': string;
    '@storybook/server-webpack5': string;
    '@storybook/svelte-vite': string;
    '@storybook/sveltekit': string;
    '@storybook/vue3-vite': string;
    '@storybook/web-components-vite': string;
    sb: string;
    '@storybook/cli': string;
    '@storybook/codemod': string;
    '@storybook/core-webpack': string;
    'create-storybook': string;
    '@storybook/csf-plugin': string;
    'eslint-plugin-storybook': string;
    '@storybook/react-dom-shim': string;
    '@storybook/preset-create-react-app': string;
    '@storybook/preset-react-webpack': string;
    '@storybook/preset-server-webpack': string;
    '@storybook/html': string;
    '@storybook/preact': string;
    '@storybook/react': string;
    '@storybook/server': string;
    '@storybook/svelte': string;
    '@storybook/vue3': string;
    '@storybook/web-components': string;
};

type InterPresetOptions = Omit<CLIOptions & LoadOptions & BuilderOptions & {
    isCritical?: boolean;
    build?: StorybookConfigRaw['build'];
}, 'frameworkPresets'>;
declare function filterPresetsConfig(presetsConfig: PresetConfig[]): PresetConfig[];
/**
 * Parse an addon into either a managerEntries or a preset. Throw on invalid input.
 *
 * Valid inputs:
 *
 * - `'@storybook/addon-docs/preset' => { type: 'presets', item }`
 * - `'@storybook/addon-docs' => { type: 'presets', item: '@storybook/addon-docs/preset' }`
 * - `{ name: '@storybook/addon-docs(/preset)?', options: { } } => { type: 'presets', item: { name:
 *   '@storybook/addon-docs/preset', options } }`
 */
declare const resolveAddonName: (configDir: string, name: string, options: any) => CoreCommon_ResolvedAddonPreset | CoreCommon_ResolvedAddonVirtual | undefined;
declare function loadPreset(input: PresetConfig, level: number, storybookOptions: InterPresetOptions): Promise<LoadedPreset[]>;
declare function getPresets(presets: PresetConfig[], storybookOptions: InterPresetOptions): Promise<Presets>;
declare function loadAllPresets(options: CLIOptions & LoadOptions & BuilderOptions & {
    corePresets: PresetConfig[];
    overridePresets: PresetConfig[];
    /** Whether preset failures should be critical or not */
    isCritical?: boolean;
    build?: StorybookConfigRaw['build'];
}): Promise<Presets>;

interface FileSystemCacheOptions {
    ns?: string;
    prefix?: string;
    hash_alg?: string;
    basePath?: string;
    ttl?: number;
}
interface CacheItem {
    key: string;
    content?: any;
    value?: any;
}
interface CacheSetOptions {
    ttl?: number;
    encoding?: BufferEncoding;
}
declare class FileSystemCache {
    private prefix;
    private hash_alg;
    private cache_dir;
    private ttl;
    constructor(options?: FileSystemCacheOptions);
    private generateHash;
    private isExpired;
    private parseCacheData;
    private parseSetData;
    get<T = any>(name: string, fallback?: T): Promise<T>;
    getSync<T>(name: string, fallback?: T): T;
    set<T>(name: string, data: T, orgOpts?: CacheSetOptions | number): Promise<void>;
    setSync<T>(name: string, data: T, orgOpts?: CacheSetOptions | number): void;
    setMany(items: CacheItem[], options?: CacheSetOptions): Promise<void>;
    setManySync(items: CacheItem[], options?: CacheSetOptions): void;
    remove(name: string): Promise<void>;
    removeSync(name: string): void;
    clear(): Promise<void>;
    clearSync(): void;
    getAll(): Promise<CacheItem[]>;
    load(): Promise<{
        files: CacheItem[];
    }>;
}
declare function createFileSystemCache(options: FileSystemCacheOptions): FileSystemCache;

declare const cache: FileSystemCache;

declare global {
	interface SymbolConstructor {
		readonly observable: symbol;
	}
}

// Helper type. Not useful on its own.
type Without<FirstType, SecondType> = {[KeyType in Exclude<keyof FirstType, keyof SecondType>]?: never};

/**
Create a type that has mutually exclusive keys.

This type was inspired by [this comment](https://github.com/Microsoft/TypeScript/issues/14094#issuecomment-373782604).

This type works with a helper type, called `Without`. `Without<FirstType, SecondType>` produces a type that has only keys from `FirstType` which are not present on `SecondType` and sets the value type for these keys to `never`. This helper type is then used in `MergeExclusive` to remove keys from either `FirstType` or `SecondType`.

@example
```
import type {MergeExclusive} from 'type-fest';

interface ExclusiveVariation1 {
	exclusive1: boolean;
}

interface ExclusiveVariation2 {
	exclusive2: string;
}

type ExclusiveOptions = MergeExclusive<ExclusiveVariation1, ExclusiveVariation2>;

let exclusiveOptions: ExclusiveOptions;

exclusiveOptions = {exclusive1: true};
//=> Works
exclusiveOptions = {exclusive2: 'hi'};
//=> Works
exclusiveOptions = {exclusive1: true, exclusive2: 'hi'};
//=> Error
```

@category Object
*/
type MergeExclusive<FirstType, SecondType> =
	(FirstType | SecondType) extends object ?
		(Without<FirstType, SecondType> & SecondType) | (Without<SecondType, FirstType> & FirstType) :
		FirstType | SecondType;

type StdioOption =
	| 'pipe'
	| 'overlapped'
	| 'ipc'
	| 'ignore'
	| 'inherit'
	| Stream
	| number
	| undefined;

type EncodingOption =
  | 'utf8'
  // eslint-disable-next-line unicorn/text-encoding-identifier-case
  | 'utf-8'
  | 'utf16le'
  | 'utf-16le'
  | 'ucs2'
  | 'ucs-2'
  | 'latin1'
  | 'binary'
  | 'ascii'
  | 'hex'
  | 'base64'
  | 'base64url'
  | 'buffer'
  | null
  | undefined;
type DefaultEncodingOption = 'utf8';

type CommonOptions<EncodingType extends EncodingOption = DefaultEncodingOption> = {
	/**
	Kill the spawned process when the parent process exits unless either:
		- the spawned process is [`detached`](https://nodejs.org/api/child_process.html#child_process_options_detached)
		- the parent process is terminated abruptly, for example, with `SIGKILL` as opposed to `SIGTERM` or a normal exit

	@default true
	*/
	readonly cleanup?: boolean;

	/**
	Prefer locally installed binaries when looking for a binary to execute.

	If you `$ npm install foo`, you can then `execa('foo')`.

	@default `true` with `$`, `false` otherwise
	*/
	readonly preferLocal?: boolean;

	/**
	Preferred path to find locally installed binaries in (use with `preferLocal`).

	@default process.cwd()
	*/
	readonly localDir?: string | URL;

	/**
	Path to the Node.js executable to use in child processes.

	This can be either an absolute path or a path relative to the `cwd` option.

	Requires `preferLocal` to be `true`.

	For example, this can be used together with [`get-node`](https://github.com/ehmicky/get-node) to run a specific Node.js version in a child process.

	@default process.execPath
	*/
	readonly execPath?: string;

	/**
	Buffer the output from the spawned process. When set to `false`, you must read the output of `stdout` and `stderr` (or `all` if the `all` option is `true`). Otherwise the returned promise will not be resolved/rejected.

	If the spawned process fails, `error.stdout`, `error.stderr`, and `error.all` will contain the buffered data.

	@default true
	*/
	readonly buffer?: boolean;

	/**
	Same options as [`stdio`](https://nodejs.org/dist/latest-v6.x/docs/api/child_process.html#child_process_options_stdio).

	@default `inherit` with `$`, `pipe` otherwise
	*/
	readonly stdin?: StdioOption;

	/**
	Same options as [`stdio`](https://nodejs.org/dist/latest-v6.x/docs/api/child_process.html#child_process_options_stdio).

	@default 'pipe'
	*/
	readonly stdout?: StdioOption;

	/**
	Same options as [`stdio`](https://nodejs.org/dist/latest-v6.x/docs/api/child_process.html#child_process_options_stdio).

	@default 'pipe'
	*/
	readonly stderr?: StdioOption;

	/**
	Setting this to `false` resolves the promise with the error instead of rejecting it.

	@default true
	*/
	readonly reject?: boolean;

	/**
	Add an `.all` property on the promise and the resolved value. The property contains the output of the process with `stdout` and `stderr` interleaved.

	@default false
	*/
	readonly all?: boolean;

	/**
	Strip the final [newline character](https://en.wikipedia.org/wiki/Newline) from the output.

	@default true
	*/
	readonly stripFinalNewline?: boolean;

	/**
	Set to `false` if you don't want to extend the environment variables when providing the `env` property.

	@default true
	*/
	readonly extendEnv?: boolean;

	/**
	Current working directory of the child process.

	@default process.cwd()
	*/
	readonly cwd?: string | URL;

	/**
	Environment key-value pairs. Extends automatically from `process.env`. Set `extendEnv` to `false` if you don't want this.

	@default process.env
	*/
	readonly env?: NodeJS.ProcessEnv;

	/**
	Explicitly set the value of `argv[0]` sent to the child process. This will be set to `command` or `file` if not specified.
	*/
	readonly argv0?: string;

	/**
	Child's [stdio](https://nodejs.org/api/child_process.html#child_process_options_stdio) configuration.

	@default 'pipe'
	*/
	readonly stdio?: 'pipe' | 'overlapped' | 'ignore' | 'inherit' | readonly StdioOption[];

	/**
	Specify the kind of serialization used for sending messages between processes when using the `stdio: 'ipc'` option or `execaNode()`:
		- `json`: Uses `JSON.stringify()` and `JSON.parse()`.
		- `advanced`: Uses [`v8.serialize()`](https://nodejs.org/api/v8.html#v8_v8_serialize_value)

	[More info.](https://nodejs.org/api/child_process.html#child_process_advanced_serialization)

	@default 'json'
	*/
	readonly serialization?: 'json' | 'advanced';

	/**
	Prepare child to run independently of its parent process. Specific behavior [depends on the platform](https://nodejs.org/api/child_process.html#child_process_options_detached).

	@default false
	*/
	readonly detached?: boolean;

	/**
	Sets the user identity of the process.
	*/
	readonly uid?: number;

	/**
	Sets the group identity of the process.
	*/
	readonly gid?: number;

	/**
	If `true`, runs `command` inside of a shell. Uses `/bin/sh` on UNIX and `cmd.exe` on Windows. A different shell can be specified as a string. The shell should understand the `-c` switch on UNIX or `/d /s /c` on Windows.

	We recommend against using this option since it is:
	- not cross-platform, encouraging shell-specific syntax.
	- slower, because of the additional shell interpretation.
	- unsafe, potentially allowing command injection.

	@default false
	*/
	readonly shell?: boolean | string;

	/**
	Specify the character encoding used to decode the `stdout` and `stderr` output. If set to `'buffer'` or `null`, then `stdout` and `stderr` will be a `Buffer` instead of a string.

	@default 'utf8'
	*/
	readonly encoding?: EncodingType;

	/**
	If `timeout` is greater than `0`, the parent will send the signal identified by the `killSignal` property (the default is `SIGTERM`) if the child runs longer than `timeout` milliseconds.

	@default 0
	*/
	readonly timeout?: number;

	/**
	Largest amount of data in bytes allowed on `stdout` or `stderr`. Default: 100 MB.

	@default 100_000_000
	*/
	readonly maxBuffer?: number;

	/**
	Signal value to be used when the spawned process will be killed.

	@default 'SIGTERM'
	*/
	readonly killSignal?: string | number;

	/**
	You can abort the spawned process using [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).

	When `AbortController.abort()` is called, [`.isCanceled`](https://github.com/sindresorhus/execa#iscanceled) becomes `true`.

	@example
	```
	import {execa} from 'execa';

	const abortController = new AbortController();
	const subprocess = execa('node', [], {signal: abortController.signal});

	setTimeout(() => {
		abortController.abort();
	}, 1000);

	try {
		await subprocess;
	} catch (error) {
		console.log(subprocess.killed); // true
		console.log(error.isCanceled); // true
	}
	```
	*/
	readonly signal?: AbortSignal;

	/**
	If `true`, no quoting or escaping of arguments is done on Windows. Ignored on other platforms. This is set to `true` automatically when the `shell` option is `true`.

	@default false
	*/
	readonly windowsVerbatimArguments?: boolean;

	/**
	On Windows, do not create a new console window. Please note this also prevents `CTRL-C` [from working](https://github.com/nodejs/node/issues/29837) on Windows.

	@default true
	*/
	readonly windowsHide?: boolean;

	/**
	Print each command on `stderr` before executing it.

	This can also be enabled by setting the `NODE_DEBUG=execa` environment variable in the current process.

	@default false
	*/
	readonly verbose?: boolean;
};

type StdoutStderrAll = string | Buffer | undefined;

type ExecaReturnBase<StdoutStderrType extends StdoutStderrAll> = {
	/**
	The file and arguments that were run, for logging purposes.

	This is not escaped and should not be executed directly as a process, including using `execa()` or `execaCommand()`.
	*/
	command: string;

	/**
	Same as `command` but escaped.

	This is meant to be copy and pasted into a shell, for debugging purposes.
	Since the escaping is fairly basic, this should not be executed directly as a process, including using `execa()` or `execaCommand()`.
	*/
	escapedCommand: string;

	/**
	The numeric exit code of the process that was run.
	*/
	exitCode: number;

	/**
	The output of the process on stdout.
	*/
	stdout: StdoutStderrType;

	/**
	The output of the process on stderr.
	*/
	stderr: StdoutStderrType;

	/**
	Whether the process failed to run.
	*/
	failed: boolean;

	/**
	Whether the process timed out.
	*/
	timedOut: boolean;

	/**
	Whether the process was killed.
	*/
	killed: boolean;

	/**
	The name of the signal that was used to terminate the process. For example, `SIGFPE`.

	If a signal terminated the process, this property is defined and included in the error message. Otherwise it is `undefined`.
	*/
	signal?: string;

	/**
	A human-friendly description of the signal that was used to terminate the process. For example, `Floating point arithmetic error`.

	If a signal terminated the process, this property is defined and included in the error message. Otherwise it is `undefined`. It is also `undefined` when the signal is very uncommon which should seldomly happen.
	*/
	signalDescription?: string;

	/**
	The `cwd` of the command if provided in the command options. Otherwise it is `process.cwd()`.
	*/
	cwd: string;
};

type ExecaSyncReturnValue<StdoutStderrType extends StdoutStderrAll = string> = {
} & ExecaReturnBase<StdoutStderrType>;

/**
Result of a child process execution. On success this is a plain object. On failure this is also an `Error` instance.

The child process fails when:
- its exit code is not `0`
- it was killed with a signal
- timing out
- being canceled
- there's not enough memory or there are already too many child processes
*/
type ExecaReturnValue<StdoutStderrType extends StdoutStderrAll = string> = {
	/**
	The output of the process with `stdout` and `stderr` interleaved.

	This is `undefined` if either:
	- the `all` option is `false` (default value)
	- `execaSync()` was used
	*/
	all?: StdoutStderrType;

	/**
	Whether the process was canceled.

	You can cancel the spawned process using the [`signal`](https://github.com/sindresorhus/execa#signal-1) option.
	*/
	isCanceled: boolean;
} & ExecaSyncReturnValue<StdoutStderrType>;

type ExecaSyncError<StdoutStderrType extends StdoutStderrAll = string> = {
	/**
	Error message when the child process failed to run. In addition to the underlying error message, it also contains some information related to why the child process errored.

	The child process stderr then stdout are appended to the end, separated with newlines and not interleaved.
	*/
	message: string;

	/**
	This is the same as the `message` property except it does not include the child process stdout/stderr.
	*/
	shortMessage: string;

	/**
	Original error message. This is the same as the `message` property except it includes neither the child process stdout/stderr nor some additional information added by Execa.

	This is `undefined` unless the child process exited due to an `error` event or a timeout.
	*/
	originalMessage?: string;
} & Error & ExecaReturnBase<StdoutStderrType>;

type ExecaError<StdoutStderrType extends StdoutStderrAll = string> = {
	/**
	The output of the process with `stdout` and `stderr` interleaved.

	This is `undefined` if either:
	- the `all` option is `false` (default value)
	- `execaSync()` was used
	*/
	all?: StdoutStderrType;

	/**
	Whether the process was canceled.
	*/
	isCanceled: boolean;
} & ExecaSyncError<StdoutStderrType>;

type KillOptions = {
	/**
	Milliseconds to wait for the child process to terminate before sending `SIGKILL`.

	Can be disabled with `false`.

	@default 5000
	*/
	forceKillAfterTimeout?: number | false;
};

type ExecaChildPromise<StdoutStderrType extends StdoutStderrAll> = {
	/**
	Stream combining/interleaving [`stdout`](https://nodejs.org/api/child_process.html#child_process_subprocess_stdout) and [`stderr`](https://nodejs.org/api/child_process.html#child_process_subprocess_stderr).

	This is `undefined` if either:
		- the `all` option is `false` (the default value)
		- both `stdout` and `stderr` options are set to [`'inherit'`, `'ipc'`, `Stream` or `integer`](https://nodejs.org/dist/latest-v6.x/docs/api/child_process.html#child_process_options_stdio)
	*/
	all?: Readable;

	catch<ResultType = never>(
		onRejected?: (reason: ExecaError<StdoutStderrType>) => ResultType | PromiseLike<ResultType>
	): Promise<ExecaReturnValue<StdoutStderrType> | ResultType>;

	/**
	Same as the original [`child_process#kill()`](https://nodejs.org/api/child_process.html#child_process_subprocess_kill_signal), except if `signal` is `SIGTERM` (the default value) and the child process is not terminated after 5 seconds, force it by sending `SIGKILL`. Note that this graceful termination does not work on Windows, because Windows [doesn't support signals](https://nodejs.org/api/process.html#process_signal_events) (`SIGKILL` and `SIGTERM` has the same effect of force-killing the process immediately.) If you want to achieve graceful termination on Windows, you have to use other means, such as [`taskkill`](https://github.com/sindresorhus/taskkill).
	*/
	kill(signal?: string, options?: KillOptions): void;

	/**
	Similar to [`childProcess.kill()`](https://nodejs.org/api/child_process.html#child_process_subprocess_kill_signal). This used to be preferred when cancelling the child process execution as the error is more descriptive and [`childProcessResult.isCanceled`](#iscanceled) is set to `true`. But now this is deprecated and you should either use `.kill()` or the `signal` option when creating the child process.
	*/
	cancel(): void;

	/**
	[Pipe](https://nodejs.org/api/stream.html#readablepipedestination-options) the child process's `stdout` to `target`, which can be:
	- Another `execa()` return value
	- A writable stream
	- A file path string

	If the `target` is another `execa()` return value, it is returned. Otherwise, the original `execa()` return value is returned. This allows chaining `pipeStdout()` then `await`ing the final result.

	The `stdout` option] must be kept as `pipe`, its default value.
	*/
	pipeStdout?<Target extends ExecaChildPromise<StdoutStderrAll>>(target: Target): Target;
	pipeStdout?(target: Writable | string): ExecaChildProcess<StdoutStderrType>;

	/**
	Like `pipeStdout()` but piping the child process's `stderr` instead.

	The `stderr` option must be kept as `pipe`, its default value.
	*/
	pipeStderr?<Target extends ExecaChildPromise<StdoutStderrAll>>(target: Target): Target;
	pipeStderr?(target: Writable | string): ExecaChildProcess<StdoutStderrType>;

	/**
	Combines both `pipeStdout()` and `pipeStderr()`.

	Either the `stdout` option or the `stderr` option must be kept as `pipe`, their default value. Also, the `all` option must be set to `true`.
	*/
	pipeAll?<Target extends ExecaChildPromise<StdoutStderrAll>>(target: Target): Target;
	pipeAll?(target: Writable | string): ExecaChildProcess<StdoutStderrType>;
};

type ExecaChildProcess<StdoutStderrType extends StdoutStderrAll = string> = ChildProcess &
ExecaChildPromise<StdoutStderrType> &
Promise<ExecaReturnValue<StdoutStderrType>>;

type PackageJsonWithDepsAndDevDeps = PackageJson & Required<Pick<PackageJson, 'dependencies' | 'devDependencies'>>;
type PackageJsonWithMaybeDeps = Partial<Pick<PackageJson, 'dependencies' | 'devDependencies' | 'peerDependencies' | 'files'>>;

type PackageMetadata = {
    version: string;
    location?: string;
    reasons?: string[];
};
type InstallationMetadata = {
    dependencies: Record<string, PackageMetadata[]>;
    duplicatedDependencies: Record<string, string[]>;
    infoCommand: string;
    dedupeCommand: string;
};

type PackageManagerName = 'npm' | 'yarn1' | 'yarn2' | 'pnpm' | 'bun';
declare const COMMON_ENV_VARS: {
    COREPACK_ENABLE_STRICT: string;
    COREPACK_ENABLE_AUTO_PIN: string;
    NO_UPDATE_NOTIFIER: string;
};
/**
 * Extract package name and version from input
 *
 * @param pkg A string like `@storybook/cli`, `react` or `react@^16`
 * @returns A tuple of 2 elements: [packageName, packageVersion]
 */
declare function getPackageDetails(pkg: string): [string, string?];
interface JsPackageManagerOptions {
    cwd?: string;
    configDir?: string;
    storiesPaths?: string[];
}
type PackageJsonInfo = {
    packageJsonPath: string;
    operationDir: string;
    packageJson: PackageJsonWithDepsAndDevDeps;
};
declare abstract class JsPackageManager {
    #private;
    abstract readonly type: PackageManagerName;
    /** The path to the primary package.json file (contains the `storybook` dependency). */
    readonly primaryPackageJson: PackageJsonInfo;
    /** The paths to all package.json files in the project root. */
    packageJsonPaths: string[];
    /**
     * The path to the Storybook instance directory. This is used to find the primary package.json
     * file in a repository.
     */
    readonly instanceDir: string;
    /** The current working directory. */
    protected readonly cwd: string;
    /** Cache for latest version results to avoid repeated network calls. */
    static readonly latestVersionCache: Map<string, string | null>;
    /** Cache for installed version results to avoid repeated file system calls. */
    static readonly installedVersionCache: Map<string, string | null>;
    constructor(options?: JsPackageManagerOptions);
    /** Runs arbitrary package scripts. */
    abstract getRunCommand(command: string): string;
    /**
     * Run a command from a local or remote. Fetches a package from the registry without installing it
     * as a dependency, hotloads it, and runs whatever default command binary it exposes.
     */
    abstract getRemoteRunCommand(pkg: string, args: string[], specifier?: string): string;
    /** Get the package.json file for a given module. */
    abstract getModulePackageJSON(packageName: string): PackageJson | null;
    isStorybookInMonorepo(): boolean;
    installDependencies(options?: {
        force?: boolean;
    }): Promise<void>;
    dedupeDependencies(options?: {
        force?: boolean;
    }): Promise<void>;
    /** Read the `package.json` file available in the provided directory */
    static getPackageJson(packageJsonPath: string): PackageJsonWithDepsAndDevDeps;
    writePackageJson(packageJson: PackageJson, directory?: string): void;
    getAllDependencies(): Record<string, string>;
    isDependencyInstalled(dependency: string): boolean;
    /**
     * Add dependencies to a project using `yarn add` or `npm install`.
     *
     * @example
     *
     * ```ts
     * addDependencies(options, [
     *   `@storybook/react@${storybookVersion}`,
     *   `@storybook/addon-links@${linksVersion}`,
     * ]);
     * ```
     *
     * @param {Object} options Contains `skipInstall`, `packageJson` and `installAsDevDependencies`
     *   which we use to determine how we install packages.
     * @param {Array} dependencies Contains a list of packages to add.
     */
    addDependencies(options: {
        skipInstall: true;
        type: 'dependencies' | 'devDependencies' | 'peerDependencies';
        writeOutputToFile?: boolean;
        packageJsonInfo?: PackageJsonInfo;
    } | {
        skipInstall?: false;
        type: 'dependencies' | 'devDependencies';
        writeOutputToFile?: boolean;
        packageJsonInfo?: PackageJsonInfo;
    }, dependencies: string[]): Promise<void | ExecaChildProcess>;
    /**
     * Removing dependencies from the package.json file, which is found first starting from the
     * instance root. The method does not run a package manager install like `npm install`.
     *
     * @example
     *
     * ```ts
     * removeDependencies([`@storybook/react`]);
     * ```
     *
     * @param dependencies Contains a list of packages to remove.
     */
    removeDependencies(dependencies: string[]): Promise<void>;
    /**
     * Return an array of strings matching following format: `<package_name>@<package_latest_version>`
     *
     * For packages in the storybook monorepo, when the latest version is equal to the version of the
     * current CLI the version is not added to the string.
     *
     * When a package is in the monorepo, and the version is not equal to the CLI version, the version
     * is taken from the versions.ts file and added to the string.
     *
     * @param packages
     */
    getVersionedPackages(packages: string[]): Promise<string[]>;
    /**
     * Return an array of string standing for the latest version of the input packages. To be able to
     * identify which version goes with which package the order of the input array is keep.
     *
     * @param packageNames
     */
    getVersions(...packageNames: string[]): Promise<string[]>;
    /**
     * Return the latest version of the input package available on npmjs registry. If constraint are
     * provided it return the latest version matching the constraints.
     *
     * For `@storybook/*` packages the latest version is retrieved from `cli/src/versions.json` file
     * directly
     *
     * @param packageName The name of the package
     * @param constraint A valid semver constraint, example: '1.x || >=2.5.0 || 5.0.0 - 7.2.3'
     */
    getVersion(packageName: string, constraint?: string): Promise<string>;
    /**
     * Get the latest version of the package available on npmjs.com. If constraint is set then it
     * returns a version satisfying it, otherwise the latest version available is returned.
     *
     * @param packageName Name of the package
     * @param constraint Version range to use to constraint the returned version
     */
    latestVersion(packageName: string, constraint?: string): Promise<string | null>;
    /**
     * Clear the latest version cache. Useful for testing or when you want to refresh version
     * information.
     *
     * @param packageName Optional package name to clear only specific entries. If not provided,
     *   clears all cache.
     */
    static clearLatestVersionCache(packageName?: string): void;
    /**
     * Clear the installed version cache for a specific package or all packages.
     *
     * @param packageName Optional package name to clear from cache. If not provided, clears all.
     */
    clearInstalledVersionCache(packageName?: string): void;
    /**
     * Clear both the latest version cache and installed version cache. This should be called after
     * any operation that modifies dependencies.
     */
    clearAllVersionCaches(): void;
    addStorybookCommandInScripts(options?: {
        port: number;
        preCommand?: string;
    }): void;
    addScripts(scripts: Record<string, string>): void;
    addPackageResolutions(versions: Record<string, string>): void;
    protected abstract runInstall(options?: {
        force?: boolean;
    }): ExecaChildProcess;
    protected abstract runAddDeps(dependencies: string[], installAsDevDependencies: boolean, writeOutputToFile?: boolean): ExecaChildProcess;
    protected abstract getResolutions(packageJson: PackageJson, versions: Record<string, string>): Record<string, any>;
    /**
     * Get the latest or all versions of the input package available on npmjs.com
     *
     * @param packageName Name of the package
     * @param fetchAllVersions Should return
     */
    protected abstract runGetVersions<T extends boolean>(packageName: string, fetchAllVersions: T): Promise<T extends true ? string[] : string>;
    abstract getRegistryURL(): Promise<string | undefined>;
    abstract runInternalCommand(command: string, args: string[], cwd?: string, stdio?: 'inherit' | 'pipe' | 'ignore'): ExecaChildProcess;
    abstract runPackageCommand(command: string, args: string[], cwd?: string, stdio?: 'inherit' | 'pipe' | 'ignore'): ExecaChildProcess;
    abstract runPackageCommandSync(command: string, args: string[], cwd?: string, stdio?: 'inherit' | 'pipe' | 'ignore'): string;
    abstract findInstallations(pattern?: string[]): Promise<InstallationMetadata | undefined>;
    abstract findInstallations(pattern?: string[], options?: {
        depth: number;
    }): Promise<InstallationMetadata | undefined>;
    abstract parseErrorFromLogs(logs?: string): string;
    executeCommandSync({ command, args, stdio, cwd, ignoreError, env, ...execaOptions }: CommonOptions<'utf8'> & {
        command: string;
        args: string[];
        cwd?: string;
        ignoreError?: boolean;
    }): string;
    /**
     * Execute a command asynchronously and return the execa process. This allows you to hook into
     * stdout/stderr streams and monitor the process.
     *
     * @example Const process = packageManager.executeCommand({ command: 'npm', args: ['install'] });
     * process.stdout?.on('data', (data) => console.log(data.toString())); const result = await
     * process;
     */
    executeCommand({ command, args, stdio, cwd, ignoreError, env, ...execaOptions }: CommonOptions<'utf8'> & {
        command: string;
        args: string[];
        cwd?: string;
        ignoreError?: boolean;
    }): ExecaChildProcess;
    /** Returns the installed (within node_modules or pnp zip) version of a specified package */
    getInstalledVersion(packageName: string): Promise<string | null>;
    isPackageInstalled(packageName: string): Promise<boolean>;
    /**
     * Searches for a dependency/devDependency in all package.json files and returns the version of
     * the dependency.
     */
    getDependencyVersion(dependency: string): string | null;
    static hasStorybookDependency(packageJsonPath: string): boolean;
    static hasAnyStorybookDependency(packageJsonPath: string): boolean;
    /** List all package.json files starting from the given directory and stopping at the project root. */
    static listAllPackageJsonPaths(instanceDir: string, storiesPaths?: string[]): string[];
    static getPackageJsonInfo(packageJsonPath: string): PackageJsonInfo;
}

declare class JsPackageManagerFactory {
    /** Cache for package manager instances */
    private static cache;
    /** Generate a cache key based on the parameters */
    private static getCacheKey;
    /** Clear the package manager cache */
    static clearCache(): void;
    /**
     * Determine which package manager type to use based on lockfiles, commands, and environment
     *
     * @param cwd - Current working directory
     * @returns Package manager type as string: 'npm', 'pnpm', 'bun', 'yarn1', or 'yarn2'
     * @throws Error if no usable package manager is found
     */
    static getPackageManagerType(cwd?: string): PackageManagerName;
    static getPackageManager({ force, configDir, storiesPaths, ignoreCache, }?: {
        force?: PackageManagerName;
        configDir?: string;
        storiesPaths?: string[];
        ignoreCache?: boolean;
    }, cwd?: string): JsPackageManager;
    /** Look up map of package manager proxies by name */
    private static PROXY_MAP;
    /**
     * Infer the package manager based on the command the user is running. Each package manager sets
     * the `npm_config_user_agent` environment variable with its name and version e.g. "npm/7.24.0"
     * Which is really useful when invoking commands via npx/pnpx/yarn create/etc.
     */
    private static inferPackageManagerFromUserAgent;
}

declare function temporaryDirectory({ prefix }?: {
    prefix?: string | undefined;
}): Promise<string>;
type FileOptions = MergeExclusive<{
    /**
     * File extension.
     *
     * Mutually exclusive with the `name` option.
     *
     * _You usually won't need this option. Specify it only when actually needed._
     */
    readonly extension?: string;
}, {
    /**
     * Filename.
     *
     * Mutually exclusive with the `extension` option.
     *
     * _You usually won't need this option. Specify it only when actually needed._
     */
    readonly name?: string;
}>;
declare function temporaryFile({ name, extension }?: FileOptions): Promise<string>;
declare function parseList(str: string): string[];
/**
 * Given a package manager, returns the coerced version of Storybook. It tries to find renderer
 * packages in the project and returns the coerced version of the first one found. Example: If
 *
 * @storybook/react version 8.0.0-alpha.14 is installed, it returns the coerced version 8.0.0
 */
declare function getCoercedStorybookVersion(packageManager: JsPackageManager): Promise<string>;
declare function getEnvConfig(program: Record<string, any>, configEnv: Record<string, any>): void;
/**
 * Given a file name, creates an object with utilities to manage a log file. It creates a temporary
 * log file which you can manage with the returned functions. You can then decide whether to move
 * the log file to the users project, or remove it.
 *
 * @example
 *
 * ```ts
 * const { logStream, moveLogFile, removeLogFile, clearLogFile, readLogFile } =
 *   await createLogStream('my-log-file.log');
 *
 * // SCENARIO 1:
 * // you can write custom messages to generate a log file
 * logStream.write('my log message');
 * await moveLogFile();
 *
 * // SCENARIO 2:
 * // or you can pass it to stdio and capture the output of that command
 * try {
 *   await this.executeCommand({
 *     command: 'pnpm',
 *     args: ['info', packageName, ...args],
 *     // do not output to the user, and send stdio and stderr to log file
 *     stdio: ['ignore', logStream, logStream],
 *   });
 * } catch (err) {
 *   // do something with the log file content
 *   const output = await readLogFile();
 *   // move the log file to the users project
 *   await moveLogFile();
 * }
 * // success, no need to keep the log file
 * await removeLogFile();
 * ```
 */
declare const createLogStream: (logFileName?: string) => Promise<{
    moveLogFile: () => Promise<void>;
    removeLogFile: () => Promise<void>;
    clearLogFile: () => Promise<void>;
    readLogFile: () => Promise<string>;
    logStream: WriteStream;
}>;
declare const isCorePackage: (pkg: string) => boolean;
declare const isSatelliteAddon: (pkg: string) => boolean;

interface Options {
    before: CoreCommon_AddonInfo;
    after: CoreCommon_AddonInfo;
    configFile: string;
    getConfig: (path: string) => any;
}
declare const checkAddonOrder: ({ before, after, configFile, getConfig }: Options) => Promise<void>;

declare function loadEnvs(options?: {
    production?: boolean;
}): Promise<{
    stringified: Record<string, string>;
    raw: Record<string, string>;
}>;
declare const stringifyEnvs: (raw: Record<string, string>) => Record<string, string>;
declare const stringifyProcessEnvs: (raw: Record<string, string>) => Record<string, string>;
declare const optionalEnvToBoolean: (input: string | undefined) => boolean | undefined;
/**
 * Consistently determine if we are in a CI environment
 *
 * Doing Boolean(process.env.CI) or !process.env.CI is not enough, because users might set CI=false
 * or CI=0, which would be truthy, and thus return true in those cases.
 */
declare function isCI(): boolean | undefined;

declare const commonGlobOptions: (glob: string) => {
    ignore?: undefined;
} | {
    ignore: string[];
};

declare const frameworkToRenderer: Record<SupportedFrameworks | SupportedRenderers, SupportedRenderers | 'vue'>;

/**
 * Builder options can be specified in `core.builder.options` or `framework.options.builder`.
 * Preference is given here to `framework.options.builder` if both are specified.
 */
declare function getBuilderOptions<T extends Record<string, any>>(options: Options$1): Promise<T | Record<string, never>>;

/** Framework can be a string or an object. This utility always returns the string name. */
declare function getFrameworkName(options: Options$1): Promise<string>;
/**
 * Extracts the proper framework name from the given framework field. The framework field can be the
 * framework package name or a path to the framework package.
 *
 * @example
 *
 * ```ts
 * ExtractProperFrameworkName('/path/to/@storybook/angular'); // => '@storybook/angular'
 * extractProperFrameworkName('@third-party/framework'); // => '@third-party/framework'
 * ```
 */
declare const extractProperFrameworkName: (framework: string) => string;

/**
 * Render is set as a string on core. It must be set by the framework It falls back to the framework
 * name if not set
 */
declare function getRendererName(options: Options$1): Promise<string>;
/**
 * Extracts the proper renderer name from the given framework name.
 *
 * @example
 *
 * ```ts
 * extractProperRendererNameFromFramework('@storybook/react'); // => 'react'
 * extractProperRendererNameFromFramework('@storybook/angular'); // => 'angular'
 * extractProperRendererNameFromFramework('@third-party/framework'); // => null
 * ```
 *
 * @param frameworkName The name of the framework.
 * @returns The name of the renderer.
 */
declare function extractProperRendererNameFromFramework(frameworkName: string): Promise<"vue" | storybook_internal_types.SupportedRenderers | null>;

declare function getStorybookConfiguration(storybookScript: string, shortName: string, longName: string): string | null;

declare const rendererPackages: Record<string, string>;
declare const frameworkPackages: Record<string, SupportedFrameworks>;
declare const builderPackages: string[];
declare const findConfigFile: (prefix: string, configDir: string) => string | null;
declare const getConfigInfo: (configDir?: string) => {
    configDir: string;
    mainConfigPath: string | null;
    previewConfigPath: string | null;
    managerConfigPath: string | null;
};
declare const getStorybookInfo: (configDir?: string) => CoreCommon_StorybookInfo;

declare const getAutoRefs: (options: Options$1) => Promise<Record<string, Ref>>;
declare function getRefs(options: Options$1): Promise<Record<string, Ref>>;

declare function globToRegexp(glob: string): RegExp;

declare class HandledError extends Error {
    handled: boolean;
    constructor(error: unknown);
}

/**
 * Return a string corresponding to template filled with bindings using following pattern: For each
 * (key, value) of `bindings` replace, in template, `{{key}}` by escaped version of `value`
 *
 * @param template {String} Template with `{{binding}}`
 * @param bindings {Object} key-value object use to fill the template, `{{key}}` will be replaced by
 *   `escaped(value)`
 * @returns {String} Filled template
 */
declare const interpolate: (template: string, bindings: Record<string, string>) => string;

declare const boost: Set<string>;
declare function getInterpretedFile(pathToFile: string): string | undefined;
declare function getInterpretedFileWithExt(pathToFile: string): {
    path: string;
    ext: string;
} | undefined;

declare function interopRequireDefault(filePath: string): any;
declare function serverRequire(filePath: string | string[]): any;
declare function serverResolve(filePath: string | string[]): string | null;

declare function loadCustomPresets({ configDir }: {
    configDir: string;
}): PresetConfig[];

declare function loadMainConfig({ configDir, noCache, cwd, }: {
    configDir: string;
    noCache?: boolean;
    cwd?: string;
}): Promise<StorybookConfig>;

declare function loadManagerOrAddonsFile({ configDir }: {
    configDir: string;
}): string | undefined;

declare function loadPreviewOrConfigFile({ configDir }: {
    configDir: string;
}): string | undefined;

declare const commandLog: (message: string) => (errorMessage?: string | void | undefined, errorInfo?: string) => void;
declare function paddedLog(message: string): void;
declare function getChars(char: string, amount: number): string;
declare function codeLog(codeLines: string[], leftPadAmount?: number): void;

declare function logConfig(caption: unknown, config: unknown): void;

declare const DEFAULT_FILES_PATTERN = "**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))";
declare const getDirectoryFromWorkingDir: ({ configDir, workingDir, directory, }: NormalizeOptions & {
    directory: string;
}) => string;
declare const normalizeStoriesEntry: (entry: StoriesEntry, { configDir, workingDir, defaultFilesPattern }: NormalizeOptions) => NormalizedStoriesSpecifier;
interface NormalizeOptions {
    configDir: string;
    workingDir: string;
    defaultFilesPattern?: string;
}
declare const normalizeStories: (entries: StoriesEntry[], options: NormalizeOptions) => NormalizedStoriesSpecifier[];

declare const getProjectRoot: () => string;
declare const invalidateProjectRootCache: () => void;
declare const nodePathsToArray: (nodePath: string) => string[];
/** Ensures that a path starts with `./` or `../`, or is entirely `.` or `..` */
declare function normalizeStoryPath(filename: string): string;

declare function readTemplate(filename: string): Promise<string>;

type RemoveAddonOptions = {
    packageManager: JsPackageManager;
    configDir?: string;
    skipInstall?: boolean;
};
/**
 * Remove the given addon package and remove it from main.js
 *
 * @example
 *
 * ```sh
 * sb remove @storybook/addon-links
 * ```
 */
declare function removeAddon(addon: string, options: RemoveAddonOptions): Promise<void>;

/**
 * Get the path of the file or directory with input name inside the Storybook cache directory:
 *
 * - `node_modules/.cache/storybook/{directoryName}` in a Node.js project or npm package
 * - `.cache/storybook/{directoryName}` otherwise
 *
 * @param fileOrDirectoryName {string} Name of the file or directory
 * @returns {string} Absolute path to the file or directory
 */
declare function resolvePathInStorybookCache(fileOrDirectoryName: string, sub?: string): string;

declare function isPreservingSymlinks(): boolean | undefined;

declare function getPreviewBodyTemplate(configDirPath: string, interpolations?: Record<string, string>): string;
declare function getPreviewHeadTemplate(configDirPath: string, interpolations?: Record<string, string>): string;

declare function validateFrameworkName(frameworkName: string | undefined): asserts frameworkName is string;

declare function validateConfigurationFiles(configDir: string, cwd?: string): Promise<void>;

/** Mimicking the satisfies operator until we can upgrade to TS4.9 */
declare function satisfies<A>(): <T extends A>(x: T) => T;

declare function stripAbsNodeModulesPath(absPath: string): string;

/**
 * Format the content of a file using prettier. If prettier is not available in the user's project,
 * it will fallback to use editorconfig settings if available and formats the file by a
 * prettier-fallback.
 */
declare function formatFileContent(filePath: string, content: string): Promise<string>;

interface StoryIdData {
    storyFilePath: string;
    exportedStoryName: string;
}
type GetStoryIdOptions = StoryIdData & {
    configDir: string;
    stories: StoriesEntry[];
    workingDir?: string;
    userTitle?: string;
    storyFilePath: string;
};
declare function getStoryId(data: StoryIdData, options: Options$1): Promise<{
    storyId: string;
    kind: string;
}>;
declare function getStoryTitle({ storyFilePath, configDir, stories, workingDir, userTitle, }: Omit<GetStoryIdOptions, 'exportedStoryName'>): string | undefined;

/** Replaces the path separator with forward slashes */
declare const posix: (localPath: string, seperator?: string) => string;

declare const getAddonNames: (mainConfig: StorybookConfig) => string[];

declare function syncStorybookAddons(mainConfig: StorybookConfig, previewConfigPath: string, configDir: string): Promise<void>;
declare function getSyncedStorybookAddons(mainConfig: StorybookConfig, previewConfig: ConfigFile, configDir: string): Promise<ConfigFile>;

/**
 * Helper function to scan for files matching a glob pattern and transform them
 *
 * @param options Configuration options
 * @param transform Function to transform the found files
 * @returns Array of errors encountered during transformation
 */
declare function scanAndTransformFiles<T extends Record<string, unknown>>({ promptMessage, defaultGlob, dryRun, force, transformFn, transformOptions, }: {
    promptMessage?: string;
    defaultGlob?: string;
    dryRun: boolean;
    force?: boolean;
    transformFn: (files: string[], options: T, dryRun: boolean) => Promise<Array<{
        file: string;
        error: Error;
    }>>;
    transformOptions: T;
}): Promise<Array<{
    file: string;
    error: Error;
}>>;

declare const transformImportFiles: (files: string[], renamedImports: Record<string, string>, dryRun?: boolean) => Promise<{
    file: string;
    error: Error;
}[]>;

export { COMMON_ENV_VARS, DEFAULT_FILES_PATTERN, type FileOptions, FileSystemCache, HandledError, type InstallationMetadata, JsPackageManager, JsPackageManagerFactory, type PackageJsonInfo, type PackageJsonWithDepsAndDevDeps, type PackageJsonWithMaybeDeps, type PackageManagerName, type PackageMetadata, type RemoveAddonOptions, boost, builderPackages, cache, checkAddonOrder, codeLog, commandLog, commonGlobOptions, createFileSystemCache, createLogStream, extractProperFrameworkName, extractProperRendererNameFromFramework, filterPresetsConfig, findConfigFile, formatFileContent, frameworkPackages, frameworkToRenderer, getAddonNames, getAutoRefs, getBuilderOptions, getChars, getCoercedStorybookVersion, getConfigInfo, getDirectoryFromWorkingDir, getEnvConfig, getFrameworkName, getInterpretedFile, getInterpretedFileWithExt, getPackageDetails, getPresets, getPreviewBodyTemplate, getPreviewHeadTemplate, getProjectRoot, getRefs, getRendererName, getStoryId, getStoryTitle, getStorybookConfiguration, getStorybookInfo, getSyncedStorybookAddons, globToRegexp, interopRequireDefault, interpolate, invalidateProjectRootCache, isCI, isCorePackage, isPreservingSymlinks, isSatelliteAddon, loadAllPresets, loadCustomPresets, loadEnvs, loadMainConfig, loadManagerOrAddonsFile, loadPreset, loadPreviewOrConfigFile, logConfig, nodePathsToArray, normalizeStories, normalizeStoriesEntry, normalizeStoryPath, optionalEnvToBoolean, paddedLog, parseList, posix, readTemplate, removeAddon, rendererPackages, resolveAddonName, resolvePathInStorybookCache, satisfies, scanAndTransformFiles, serverRequire, serverResolve, stringifyEnvs, stringifyProcessEnvs, stripAbsNodeModulesPath, syncStorybookAddons, temporaryDirectory, temporaryFile, transformImportFiles, validateConfigurationFiles, validateFrameworkName, _default as versions };
