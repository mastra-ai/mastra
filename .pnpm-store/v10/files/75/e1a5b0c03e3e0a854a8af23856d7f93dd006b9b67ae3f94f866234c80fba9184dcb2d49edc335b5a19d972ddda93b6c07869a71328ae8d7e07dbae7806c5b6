import {once, on} from 'node:events';
import process from 'node:process';

export const getResult = async (nodeChildProcess, {input}, context) => {
	const instance = await nodeChildProcess;
	if (input !== undefined) {
		instance.stdin.end(input);
	}

	const onClose = once(instance, 'close');

	try {
		await Promise.race([
			onClose,
			...instance.stdio.filter(Boolean).map(stream => onStreamError(stream)),
		]);
		checkFailure(context, getErrorOutput(instance));
		return getOutputs(context);
	} catch (error) {
		await Promise.allSettled([onClose]);
		throw getResultError(error, instance, context);
	}
};

const onStreamError = async stream => {
	for await (const [error] of on(stream, 'error')) {
		// Ignore errors that are due to closing errors when the subprocesses exit normally, or due to piping
		if (!['ERR_STREAM_PREMATURE_CLOSE', 'EPIPE'].includes(error?.code)) {
			throw error;
		}
	}
};

const checkFailure = ({command}, {exitCode, signalName}) => {
	if (signalName !== undefined) {
		throw new SubprocessError(`Command was terminated with ${signalName}: ${command}`);
	}

	if (exitCode !== undefined) {
		throw new SubprocessError(`Command failed with exit code ${exitCode}: ${command}`);
	}
};

export const getResultError = (error, instance, context) => Object.assign(
	getErrorInstance(error, context),
	getErrorOutput(instance),
	getOutputs(context),
);

const getErrorInstance = (error, {command}) => error instanceof SubprocessError
	? error
	: new SubprocessError(`Command failed: ${command}`, {cause: error});

export class SubprocessError extends Error {
	name = 'SubprocessError';
}

const getErrorOutput = ({exitCode, signalCode}) => ({
	// `exitCode` can be a negative number (`errno`) when the `error` event is emitted on the `instance`
	...(exitCode < 1 ? {} : {exitCode}),
	...(signalCode === null ? {} : {signalName: signalCode}),
});

const getOutputs = ({state: {stdout, stderr, output}, command, start}) => ({
	stdout: getOutput(stdout),
	stderr: getOutput(stderr),
	output: getOutput(output),
	command,
	durationMs: Number(process.hrtime.bigint() - start) / 1e6,
});

const getOutput = output => output.at(-1) === '\n'
	? output.slice(0, output.at(-2) === '\r' ? -2 : -1)
	: output;
