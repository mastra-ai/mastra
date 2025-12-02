<h1 align="center" title="nano-spawn">
	<img src="media/logo.jpg" alt="nano-spawn logo">
</h1>

![Test coverage](https://img.shields.io/badge/coverage-100%25-green)
<!-- [![Downloads](https://img.shields.io/npm/dm/nano-spawn.svg)](https://npmjs.com/nano-spawn) -->
<!-- ![Dependents](https://img.shields.io/librariesio/dependents/npm/nano-spawn) -->

> Tiny process execution for humans — a better [`child_process`](https://nodejs.org/api/child_process.html)

## Features

No dependencies. Small package size: ![npm package minzipped size](https://img.shields.io/bundlejs/size/nano-spawn) [![Install size](https://packagephobia.com/badge?p=nano-spawn)](https://packagephobia.com/result?p=nano-spawn)

Despite the small size, this is packed with some essential features:
- [Promise-based](#spawnfile-arguments-options-default-export) interface.
- [Iterate](#subprocesssymbolasynciterator) over the output lines.
- [Pipe](#subprocesspipefile-arguments-options) multiple subprocesses and retrieve [intermediate results](#resultpipedfrom).
- Execute [locally installed binaries](#optionspreferlocal) without `npx`.
- Improved [Windows support](#windows-support).
- Proper handling of [subprocess failures](#subprocesserror) and better error messages.
- Get [interleaved output](#resultoutput) from stdout and stderr similar to what is printed on the terminal.
- Strip [unnecessary newlines](#resultstdout).
- Pass strings as [`stdin` input](#optionsstdin-optionsstdout-optionsstderr) to the subprocess.
- Preserve the current [Node.js version and flags](#spawnfile-arguments-options-default-export).
- Simpler syntax to set [environment variables](#optionsenv) or [`stdin`/`stdout`/`stderr`](#optionsstdin-optionsstdout-optionsstderr).
- Compute the command [duration](#resultdurationms).

For additional features, please check out [Execa](#execa).

## Install

```sh
npm install nano-spawn
```

## Usage

### Run commands

```js
import spawn from 'nano-spawn';

const result = await spawn('echo', ['🦄']);

console.log(result.output);
//=> '🦄'
```

### Iterate over output lines

```js
for await (const line of spawn('ls', ['--oneline'])) {
	console.log(line);
}
//=> index.d.ts
//=> index.js
//=> …
```

### Pipe commands

```js
const result = await spawn('npm', ['run', 'build'])
	.pipe('sort')
	.pipe('head', ['-n', '2']);
```

## API

### spawn(file, arguments?, options?) <sup>default export</sup>

`file`: `string`\
`arguments`: `string[]`\
`options`: [`Options`](#options)\
_Returns_: [`Subprocess`](#subprocess)

Executes a command using `file ...arguments`.

This has the same syntax as [`child_process.spawn()`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options).

If `file` is `'node'`, the current Node.js version and [flags](https://nodejs.org/api/cli.html#options) are inherited.

#### Options

##### options.stdio, options.shell, options.timeout, options.signal, options.cwd, options.killSignal, options.serialization, options.detached, options.uid, options.gid, options.windowsVerbatimArguments, options.windowsHide, options.argv0

All [`child_process.spawn()` options](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) can be passed to [`spawn()`](#spawnfile-arguments-options-default-export).

##### options.env

_Type_: `object`\
_Default_: `{}`

Override specific [environment variables](https://en.wikipedia.org/wiki/Environment_variable). Other environment variables are inherited from the current process ([`process.env`](https://nodejs.org/api/process.html#processenv)).

##### options.preferLocal

_Type_: `boolean`\
_Default_: `false`

Allows executing binaries installed locally with `npm` (or `yarn`, etc.).

##### options.stdin, options.stdout, options.stderr

_Type_: `string | number | Stream | {string: string}`

Subprocess's standard [input](https://en.wikipedia.org/wiki/Standard_streams#Standard_input_(stdin))/[output](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout))/[error](https://en.wikipedia.org/wiki/Standard_streams#Standard_error_(stderr)).

[All values supported](https://nodejs.org/api/child_process.html#optionsstdio) by `node:child_process` are available. The most common ones are:
- `'pipe'` (default value): returns the output using [`result.stdout`](#resultstdout), [`result.stderr`](#resultstderr) and [`result.output`](#resultoutput).
- `'inherit'`: uses the current process's [input](https://nodejs.org/api/process.html#processstdin)/[output](https://nodejs.org/api/process.html#processstdout). This is useful when running in a terminal.
- `'ignore'`: discards the input/output.
- [`Stream`](https://nodejs.org/api/stream.html#stream): redirects the input/output from/to a stream. For example, [`fs.createReadStream()`](https://nodejs.org/api/fs.html#fscreatereadstreampath-options)/[`fs.createWriteStream()`](https://nodejs.org/api/fs.html#fscreatewritestreampath-options) can be used, once the stream's [`open`](https://nodejs.org/api/fs.html#event-open) event has been emitted.
- `{string: '...'}`: passes a string as input to `stdin`.

#### Subprocess

Subprocess started by [`spawn()`](#spawnfile-arguments-options-default-export).

##### await subprocess

_Returns_: [`Result`](#result)\
_Throws_: [`SubprocessError`](#subprocesserror)

A subprocess is a promise that is either resolved with a successful [`result` object](#result) or rejected with a [`subprocessError`](#error).

##### subprocess.stdout

_Returns_: `AsyncIterable<string>`\
_Throws_: [`SubprocessError`](#subprocesserror)

Iterates over each [`stdout`](#resultstdout) line, as soon as it is available.

The iteration waits for the subprocess to end (even when using [`break`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/break) or [`return`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/return)). It throws if the subprocess [fails](#subprocesserror). This means you do not need to call [`await subprocess`](#await-subprocess).

##### subprocess.stderr

_Returns_: `AsyncIterable<string>`\
_Throws_: [`SubprocessError`](#subprocesserror)

Same as [`subprocess.stdout`](#subprocessstdout) but for [`stderr`](#resultstderr) instead.

##### subprocess[Symbol.asyncIterator]\()

_Returns_: `AsyncIterable<string>`\
_Throws_: [`SubprocessError`](#subprocesserror)

Same as [`subprocess.stdout`](#subprocessstdout) but for both [`stdout` and `stderr`](#resultoutput).

##### subprocess.pipe(file, arguments?, options?)

`file`: `string`\
`arguments`: `string[]`\
`options`: [`Options`](#options)\
_Returns_: [`Subprocess`](#subprocess)

Similar to the `|` symbol in shells. [Pipe](https://nodejs.org/api/stream.html#readablepipedestination-options) the subprocess's[`stdout`](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)) to a second subprocess's [`stdin`](https://en.wikipedia.org/wiki/Standard_streams#Standard_input_(stdin)).

This resolves with that second subprocess's [result](#result). If either subprocess is rejected, this is rejected with that subprocess's [error](#subprocesserror) instead.

This follows the same syntax as [`spawn(file, arguments?, options?)`](#spawnfile-arguments-options-default-export). It can be done multiple times in a row.

##### await subprocess.nodeChildProcess

_Type_: `ChildProcess`

Underlying [Node.js child process](https://nodejs.org/api/child_process.html#class-childprocess).

Among other things, this can be used to terminate the subprocess using [`.kill()`](https://nodejs.org/api/child_process.html#subprocesskillsignal) or exchange IPC message using [`.send()`](https://nodejs.org/api/child_process.html#subprocesssendmessage-sendhandle-options-callback).

#### Result

When the subprocess succeeds, its [promise](#await-subprocess) is resolved with an object with the following properties.

##### result.stdout

_Type_: `string`

The output of the subprocess on [standard output](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)).

If the output ends with a [newline](https://en.wikipedia.org/wiki/Newline), that newline is automatically stripped.

This is an empty string if either:
- The [`stdout`](#optionsstdin-optionsstdout-optionsstderr) option is set to another value than `'pipe'` (its default value).
- The output is being iterated using [`subprocess.stdout`](#subprocessstdout) or [`subprocess[Symbol.asyncIterator]`](#subprocesssymbolasynciterator).

##### result.stderr

_Type_: `string`

Like [`result.stdout`](#resultstdout) but for the [standard error](https://en.wikipedia.org/wiki/Standard_streams#Standard_error_(stderr)) instead.

##### result.output

_Type_: `string`

Like [`result.stdout`](#resultstdout) but for both the [standard output](https://en.wikipedia.org/wiki/Standard_streams#Standard_output_(stdout)) and [standard error](https://en.wikipedia.org/wiki/Standard_streams#Standard_error_(stderr)), interleaved.

##### result.command

_Type_: `string`

The file and arguments that were run.

It is intended for logging or debugging. Since the escaping is fairly basic, it should not be executed directly.

##### result.durationMs

_Type_: `number`

Duration of the subprocess, in milliseconds.

##### result.pipedFrom

_Type_: `Result | SubprocessError | undefined`

If [`subprocess.pipe()`](#subprocesspipefile-arguments-options) was used, the [result](#result) or [error](#subprocesserror) of the other subprocess that was piped into this subprocess.

#### SubprocessError

_Type_: `Error`

When the subprocess fails, its [promise](#await-subprocess) is rejected with this error.

Subprocesses fail either when their [exit code](#subprocesserrorexitcode) is not `0` or when terminated by a [signal](#subprocesserrorsignalname). Other failure reasons include misspelling the command name or using the [`timeout`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) option.

Subprocess errors have the same shape as [successful results](#result), with the following additional properties.

This error class is exported, so you can use `if (error instanceof SubprocessError) { ... }`.

##### subprocessError.exitCode

_Type_: `number | undefined`

The numeric [exit code](https://en.wikipedia.org/wiki/Exit_status) of the subprocess that was run.

This is `undefined` when the subprocess could not be started, or when it was terminated by a [signal](#subprocesserrorsignalname).

##### subprocessError.signalName

_Type_: `string | undefined`

The name of the [signal](https://en.wikipedia.org/wiki/Signal_(IPC)) (like [`SIGTERM`](https://en.wikipedia.org/wiki/Signal_(IPC)#SIGTERM)) that terminated the subprocess, sent by either:
- The current process.
- Another process. This case is [not supported on Windows](https://nodejs.org/api/process.html#signal-events).

If a signal terminated the subprocess, this property is defined and included in the [error message](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/message). Otherwise it is `undefined`.

## Windows support

This package fixes several cross-platform issues with [`node:child_process`](https://nodejs.org/api/child_process.html). It brings full Windows support for:
- Node modules binaries (without requiring the [`shell`](https://nodejs.org/api/child_process.html#default-windows-shell) option). This includes running `npm ...` or `yarn ...`.
- `.cmd`, `.bat`, and other shell files.
- The [`PATHEXT`](https://wiki.tcl-lang.org/page/PATHEXT) environment variable.
- Windows-specific [newlines](https://en.wikipedia.org/wiki/Newline#Representation).

## Alternatives

`nano-spawn`'s main goal is to be small, yet useful. Nonetheless, depending on your use case, there are other ways to run subprocesses in Node.js.

### Execa

[Execa](https://github.com/sindresorhus/execa) is a similar package: it provides the same features, but more. It is also built on top of `node:child_process`, and is maintained by the [same people](#maintainers).

On one hand, it has a bigger size: [![Install size](https://packagephobia.com/badge?p=execa)](https://packagephobia.com/result?p=execa)

On the other hand, it provides a bunch of additional features: [scripts](https://github.com/sindresorhus/execa/blob/main/docs/scripts.md), [template string syntax](https://github.com/sindresorhus/execa/blob/main/docs/execution.md#template-string-syntax), [synchronous execution](https://github.com/sindresorhus/execa/blob/main/docs/execution.md#synchronous-execution), [file input/output](https://github.com/sindresorhus/execa/blob/main/docs/output.md#file-output), [binary input/output](https://github.com/sindresorhus/execa/blob/main/docs/binary.md), [advanced piping](https://github.com/sindresorhus/execa/blob/main/docs/pipe.md), [verbose mode](https://github.com/sindresorhus/execa/blob/main/docs/debugging.md#verbose-mode), [graceful](https://github.com/sindresorhus/execa/blob/main/docs/termination.md#graceful-termination) or [forceful termination](https://github.com/sindresorhus/execa/blob/main/docs/termination.md#forceful-termination), [IPC](https://github.com/sindresorhus/execa/blob/main/docs/ipc.md), [shebangs on Windows](https://github.com/sindresorhus/execa/blob/main/docs/windows.md), [and much more](https://github.com/sindresorhus/nano-spawn/issues/14). Also, it is [very widely used](https://github.com/sindresorhus/execa/network/dependents) and [battle-tested](https://github.com/sindresorhus/execa/graphs/contributors).

We recommend using Execa in most cases, unless your environment requires using small packages (for example, in a library or in a serverless function). It is definitely the best option inside scripts, servers, or apps.

### `node:child_process`

`nano-spawn` is built on top of the [`node:child_process`](https://nodejs.org/api/child_process.html) core module.

If you'd prefer avoiding adding any dependency, you may use `node:child_process` directly. However, you might miss the [features](#features) `nano-spawn` provides: [proper error handling](#subprocesserror), [full Windows support](#windows-support), [local binaries](#optionspreferlocal), [piping](#subprocesspipefile-arguments-options), [lines iteration](#subprocesssymbolasynciterator), [interleaved output](#resultoutput), [and more](#features).

```js
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const pExecFile = promisify(execFile);

const result = await pExecFile('npm', ['run', 'build']);
```

## Maintainers

- [Sindre Sorhus](https://github.com/sindresorhus)
- [@ehmicky](https://github.com/ehmicky)
