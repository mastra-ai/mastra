import type {ChildProcess, SpawnOptions} from 'node:child_process';

type StdioOption = Readonly<Exclude<SpawnOptions['stdio'], undefined>[number]>;
type StdinOption = StdioOption | {readonly string?: string};

/**
Options passed to `nano-spawn`.

All [`child_process.spawn()` options](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) can be passed.
*/
export type Options = Omit<SpawnOptions, 'env' | 'stdio'> & Readonly<Partial<{
	/**
	Subprocess's standard [input](https://en.wikipedia.org/wiki/Standard_streams#Standard_input_(stdin)).

	[All values supported](https://nodejs.org/api/child_process.html#optionsstdio) by `node:child_process` are available. The most common ones are:
	- `'pipe'` (default value): use `nodeChildProcess.stdin` stream.
	- `'inherit'`: uses the current process's [input](https://nodejs.org/api/process.html#processstdin). This is useful when running in a terminal.
	- `'ignore'`: discards the input/output.
	- [`Stream`](https://nodejs.org/api/stream.html#stream): redirects the input from/to a stream. For example, [`fs.createReadStream()`](https://nodejs.org/api/fs.html#fscreatereadstreampath-options) can be used, once the stream's [`open`](https://nodejs.org/api/fs.html#event-open) event has been emitted.
	- `{string: '...'}`: passes a string as input.

	@default 'pipe'
	*/
	stdin: StdinOption;

	/**
	Subprocess's standard [output](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)).

	[All values supported](https://nodejs.org/api/child_process.html#optionsstdio) by `node:child_process` are available. The most common ones are:
	- `'pipe'` (default value): returns the output using `result.stdout` and `result.output`.
	- `'inherit'`: uses the current process's [output](https://nodejs.org/api/process.html#processstdout). This is useful when running in a terminal.
	- `'ignore'`: discards the input/output.
	- [`Stream`](https://nodejs.org/api/stream.html#stream): redirects the output from/to a stream. For example, [`fs.createWriteStream()`](https://nodejs.org/api/fs.html#fscreatewritestreampath-options) can be used, once the stream's [`open`](https://nodejs.org/api/fs.html#event-open) event has been emitted.

	@default 'pipe'
	*/
	stdout: StdioOption;

	/**
	Subprocess's standard [error](https://en.wikipedia.org/wiki/Standard_streams#Standard_error_(stderr)).

	[All values supported](https://nodejs.org/api/child_process.html#optionsstdio) by `node:child_process` are available. The most common ones are:
	- `'pipe'` (default value): returns the output using `result.stderr` and `result.output`.
	- `'inherit'`: uses the current process's [output](https://nodejs.org/api/process.html#processstdout). This is useful when running in a terminal.
	- `'ignore'`: discards the input/output.
	- [`Stream`](https://nodejs.org/api/stream.html#stream): redirects the output from/to a stream. For example, [`fs.createWriteStream()`](https://nodejs.org/api/fs.html#fscreatewritestreampath-options) can be used, once the stream's [`open`](https://nodejs.org/api/fs.html#event-open) event has been emitted.

	@default 'pipe'
	*/
	stderr: StdioOption;

	/**
	Subprocess's standard [input](https://en.wikipedia.org/wiki/Standard_streams#Standard_input_(stdin))/[output](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout))/[error](https://en.wikipedia.org/wiki/Standard_streams#Standard_error_(stderr)).

	[All values supported](https://nodejs.org/api/child_process.html#optionsstdio) by `node:child_process` are available. The most common ones are:
	- `'pipe'` (default value): returns the output using `result.stdout`, `result.stderr` and `result.output`.
	- `'inherit'`: uses the current process's [input](https://nodejs.org/api/process.html#processstdin)/[output](https://nodejs.org/api/process.html#processstdout). This is useful when running in a terminal.
	- `'ignore'`: discards the input/output.
	- [`Stream`](https://nodejs.org/api/stream.html#stream): redirects the input/output from/to a stream. For example, [`fs.createReadStream()`](https://nodejs.org/api/fs.html#fscreatereadstreampath-options)/[`fs.createWriteStream()`](https://nodejs.org/api/fs.html#fscreatewritestreampath-options) can be used, once the stream's [`open`](https://nodejs.org/api/fs.html#event-open) event has been emitted.
	- `{string: '...'}`: passes a string as input to `stdin`.

	@default ['pipe', 'pipe', 'pipe']
	*/
	stdio: SpawnOptions['stdio'] | readonly [StdinOption, ...readonly StdioOption[]];

	/**
	Allows executing binaries installed locally with `npm` (or `yarn`, etc.).

	@default false
	*/
	preferLocal: boolean;

	// Fixes issues with Remix and Next.js
	// See https://github.com/sindresorhus/execa/pull/1141
	/**
	Override specific [environment variables](https://en.wikipedia.org/wiki/Environment_variable). Other environment variables are inherited from the current process ([`process.env`](https://nodejs.org/api/process.html#processenv)).

	@default {}
	*/
	env: Readonly<Partial<Record<string, string>>>;
}>>;

/**
When the subprocess succeeds, its promise is resolved with this object.
*/
export type Result = {
	/**
	The output of the subprocess on [standard output](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)).

	If the output ends with a [newline](https://en.wikipedia.org/wiki/Newline), that newline is automatically stripped.

	This is an empty string if either:
	- The `stdout` option is set to another value than `'pipe'` (its default value).
	- The output is being iterated using `subprocess.stdout` or `subprocess[Symbol.asyncIterator]`.
	*/
	stdout: string;

	/**
	The output of the subprocess on [standard error](https://en.wikipedia.org/wiki/Standard_streams#Standard_error_(stderr)).

	If the output ends with a [newline](https://en.wikipedia.org/wiki/Newline), that newline is automatically stripped.

	This is an empty string if either:
	- The `stderr` option is set to another value than `'pipe'` (its default value).
	- The output is being iterated using `subprocess.stderr` or `subprocess[Symbol.asyncIterator]`.
	*/
	stderr: string;

	/**
	Like `result.stdout` but for both the [standard output](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)) and [standard error](https://en.wikipedia.org/wiki/Standard_streams#Standard_error_(stderr)), interleaved.
	*/
	output: string;

	/**
	The file and arguments that were run.

	It is intended for logging or debugging. Since the escaping is fairly basic, it should not be executed directly.
	*/
	command: string;

	/**
	Duration of the subprocess, in milliseconds.
	*/
	durationMs: number;

	/**
	If `subprocess.pipe()` was used, the result or error of the other subprocess that was piped into this subprocess.
	*/
	pipedFrom?: Result | SubprocessError;
};

/**
When the subprocess fails, its promise is rejected with this error.

Subprocesses fail either when their exit code is not `0` or when terminated by a signal. Other failure reasons include misspelling the command name or using the [`timeout`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) option.
*/
export class SubprocessError extends Error implements Result {
	stdout: Result['stdout'];
	stderr: Result['stderr'];
	output: Result['output'];
	command: Result['command'];
	durationMs: Result['durationMs'];
	pipedFrom?: Exclude<Result['pipedFrom'], undefined>;

	/**
	The numeric [exit code](https://en.wikipedia.org/wiki/Exit_status) of the subprocess that was run.

	This is `undefined` when the subprocess could not be started, or when it was terminated by a signal.
	*/
	exitCode?: number;

	/**
	The name of the [signal](https://en.wikipedia.org/wiki/Signal_(IPC)) (like [`SIGTERM`](https://en.wikipedia.org/wiki/Signal_(IPC)#SIGTERM)) that terminated the subprocess, sent by either:
	- The current process.
	- Another process. This case is [not supported on Windows](https://nodejs.org/api/process.html#signal-events).

	If a signal terminated the subprocess, this property is defined and included in the [error message](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/message). Otherwise it is `undefined`.
	*/
	signalName?: string;
}

/**
Subprocess started by `spawn()`.

A subprocess is a promise that is either resolved with a successful `result` object or rejected with a `subprocessError`.

It is also an iterable, iterating over each `stdout`/`stderr` line, as soon as it is available. The iteration waits for the subprocess to end (even when using [`break`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/break) or [`return`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return)). It throws if the subprocess fails. This means you do not need to call `await subprocess`.
*/
export type Subprocess = Promise<Result> & AsyncIterable<string> & {
	/**
	Underlying [Node.js child process](https://nodejs.org/api/child_process.html#class-childprocess).

	Among other things, this can be used to terminate the subprocess using [`.kill()`](https://nodejs.org/api/child_process.html#subprocesskillsignal) or exchange IPC message using [`.send()`](https://nodejs.org/api/child_process.html#subprocesssendmessage-sendhandle-options-callback).
	*/
	nodeChildProcess: Promise<ChildProcess>;

	/**
	Iterates over each `stdout` line, as soon as it is available.

	The iteration waits for the subprocess to end (even when using [`break`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/break) or [`return`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return)). It throws if the subprocess fails. This means you do not need to call `await subprocess`.
	*/
	stdout: AsyncIterable<string>;

	/**
	Iterates over each `stderr` line, as soon as it is available.

	The iteration waits for the subprocess to end (even when using [`break`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/break) or [`return`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return)). It throws if the subprocess fails. This means you do not need to call `await subprocess`.
	*/
	stderr: AsyncIterable<string>;

	/**
	Similar to the `|` symbol in shells. [Pipe](https://nodejs.org/api/stream.html#readablepipedestination-options) the subprocess's[`stdout`](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)) to a second subprocess's [`stdin`](https://en.wikipedia.org/wiki/Standard_streams#Standard_input_(stdin)).

	This resolves with that second subprocess's result. If either subprocess is rejected, this is rejected with that subprocess's error instead.

	This follows the same syntax as `spawn(file, arguments?, options?)`. It can be done multiple times in a row.

	@param file - The program/script to execute
	@param arguments - Arguments to pass to `file` on execution.
	@param options
	@returns `Subprocess`

	@example

	```
	const result = await spawn('npm', ['run', 'build'])
		.pipe('sort')
		.pipe('head', ['-n', '2']);
	```
	*/
	pipe(file: string, arguments?: readonly string[], options?: Options): Subprocess;
	pipe(file: string, options?: Options): Subprocess;
};

/**
Executes a command using `file ...arguments`.

This has the same syntax as [`child_process.spawn()`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options).

If `file` is `'node'`, the current Node.js version and [flags](https://nodejs.org/api/cli.html#options) are inherited.

@param file - The program/script to execute
@param arguments - Arguments to pass to `file` on execution.
@param options
@returns `Subprocess`

@example <caption>Run commands</caption>

```
import spawn from 'nano-spawn';

const result = await spawn('echo', ['🦄']);

console.log(result.output);
//=> '🦄'
```

@example <caption>Iterate over output lines</caption>

```
for await (const line of spawn('ls', ['--oneline'])) {
	console.log(line);
}
//=> index.d.ts
//=> index.js
//=> …
```
*/
export default function spawn(file: string, arguments?: readonly string[], options?: Options): Subprocess;
export default function spawn(file: string, options?: Options): Subprocess;
