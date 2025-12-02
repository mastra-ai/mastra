import {spawn} from 'node:child_process';
import {once} from 'node:events';
import process from 'node:process';
import {applyForceShell} from './windows.js';
import {getResultError} from './result.js';

export const spawnSubprocess = async (file, commandArguments, options, context) => {
	try {
		// When running `node`, keep the current Node version and CLI flags.
		// Not applied with file paths to `.../node` since those indicate a clear intent to use a specific Node version.
		// This also provides a way to opting out, e.g. using `process.execPath` instead of `node` to discard current CLI flags.
		// Does not work with shebangs, but those don't work cross-platform anyway.
		if (['node', 'node.exe'].includes(file.toLowerCase())) {
			file = process.execPath;
			commandArguments = [...process.execArgv.filter(flag => !flag.startsWith('--inspect')), ...commandArguments];
		}

		[file, commandArguments, options] = await applyForceShell(file, commandArguments, options);
		[file, commandArguments, options] = concatenateShell(file, commandArguments, options);
		const instance = spawn(file, commandArguments, options);
		bufferOutput(instance.stdout, context, 'stdout');
		bufferOutput(instance.stderr, context, 'stderr');

		// The `error` event is caught by `once(instance, 'spawn')` and `once(instance, 'close')`.
		// But it creates an uncaught exception if it happens exactly one tick after 'spawn'.
		// This prevents that.
		instance.once('error', () => {});

		await once(instance, 'spawn');
		return instance;
	} catch (error) {
		throw getResultError(error, {}, context);
	}
};

// When the `shell` option is set, any command argument is concatenated as a single string by Node.js:
// https://github.com/nodejs/node/blob/e38ce27f3ca0a65f68a31cedd984cddb927d4002/lib/child_process.js#L614-L624
// However, since Node 24, it also prints a deprecation warning.
// To avoid this warning, we perform that same operation before calling `node:child_process`.
// Shells only understand strings, which is why Node.js performs that concatenation.
// However, we rely on users splitting command arguments as an array.
// For example, this allows us to easily detect whether the binary file is `node` or `node.exe`.
// So we do want users to pass array of arguments even with `shell: true`, but we also want to avoid any warning.
const concatenateShell = (file, commandArguments, options) => options.shell && commandArguments.length > 0
	? [[file, ...commandArguments].join(' '), [], options]
	: [file, commandArguments, options];

const bufferOutput = (stream, {state}, streamName) => {
	if (stream) {
		stream.setEncoding('utf8');
		if (!state.isIterating[streamName]) {
			state.isIterating[streamName] = false;
			stream.on('data', chunk => {
				state[streamName] += chunk;
				state.output += chunk;
			});
		}
	}
};
