import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// When setting `shell: true` under-the-hood, we must manually escape the file and arguments.
// This ensures arguments are properly split, and prevents command injection.
export const applyForceShell = async (file, commandArguments, options) => await shouldForceShell(file, options)
	? [escapeFile(file), commandArguments.map(argument => escapeArgument(argument)), {...options, shell: true}]
	: [file, commandArguments, options];

// On Windows, running most executable files (except *.exe and *.com) requires using a shell.
// This includes *.cmd and *.bat, which itself includes Node modules binaries.
// We detect this situation and automatically:
//  - Set the `shell: true` option
//  - Escape shell-specific characters
const shouldForceShell = async (file, {shell, cwd, env = process.env}) => process.platform === 'win32'
	&& !shell
	&& !(await isExe(file, cwd, env));

// Detect whether the executable file is a *.exe or *.com file.
// Windows allows omitting file extensions (present in the `PATHEXT` environment variable).
// Therefore we must use the `PATH` environment variable and make `access` calls to check this.
// Environment variables are case-insensitive on Windows, so we check both `PATH` and `Path`.
const isExe = (file, cwd, {Path = '', PATH = Path}) =>
	// If the *.exe or *.com file extension was not omitted.
	// Windows common file systems are case-insensitive.
	exeExtensions.some(extension => file.toLowerCase().endsWith(extension))
	|| mIsExe(file, cwd, PATH);

// Memoize the `mIsExe` and `fs.access`, for performance
const EXE_MEMO = {};
// eslint-disable-next-line no-return-assign
const memoize = function_ => (...arguments_) =>
	// Use returned assignment to keep code small
	EXE_MEMO[arguments_.join('\0')] ??= function_(...arguments_);

const access = memoize(fs.access);
const mIsExe = memoize(async (file, cwd, PATH) => {
	const parts = PATH
		// `PATH` is ;-separated on Windows
		.split(path.delimiter)
		// `PATH` allows leading/trailing ; on Windows
		.filter(Boolean)
		// `PATH` parts can be double quoted on Windows
		.map(part => part.replace(/^"(.*)"$/, '$1'));

	// For performance, parallelize and stop iteration as soon as an *.exe or *.com file is found
	try {
		await Promise.any(
			[cwd, ...parts].flatMap(part => exeExtensions
				.map(extension => access(`${path.resolve(part, file)}${extension}`)),
			),
		);
	} catch {
		return false;
	}

	return true;
});

// Other file extensions require using a shell
const exeExtensions = ['.exe', '.com'];

// `cmd.exe` escaping for arguments.
// Taken from https://github.com/moxystudio/node-cross-spawn
const escapeArgument = argument => escapeFile(escapeFile(`"${argument
	.replaceAll(/(\\*)"/g, '$1$1\\"')
	.replace(/(\\*)$/, '$1$1')}"`));

// `cmd.exe` escaping for file and arguments.
const escapeFile = file => file.replaceAll(/([()\][%!^"`<>&|;, *?])/g, '^$1');
