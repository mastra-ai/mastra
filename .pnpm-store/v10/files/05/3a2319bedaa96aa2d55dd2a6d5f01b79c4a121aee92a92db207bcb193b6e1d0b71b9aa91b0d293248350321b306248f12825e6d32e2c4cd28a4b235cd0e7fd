import {pipeline} from 'node:stream/promises';

export const handlePipe = async subprocesses => {
	// Ensure both subprocesses have exited before resolving, and that we handle errors from both
	const [[from, to]] = await Promise.all([Promise.allSettled(subprocesses), pipeStreams(subprocesses)]);

	// If both subprocesses fail, throw destination error to use a predictable order and avoid race conditions
	if (to.reason) {
		to.reason.pipedFrom = from.reason ?? from.value;
		throw to.reason;
	}

	if (from.reason) {
		throw from.reason;
	}

	return {...to.value, pipedFrom: from.value};
};

const pipeStreams = async subprocesses => {
	try {
		const [{stdout}, {stdin}] = await Promise.all(subprocesses.map(({nodeChildProcess}) => nodeChildProcess));
		if (stdin === null) {
			throw new Error('The "stdin" option must be set on the first "spawn()" call in the pipeline.');
		}

		if (stdout === null) {
			throw new Error('The "stdout" option must be set on the last "spawn()" call in the pipeline.');
		}

		// Do not `await` nor handle stream errors since this is already done by each subprocess
		// eslint-disable-next-line promise/prefer-await-to-then
		pipeline(stdout, stdin).catch(() => {});
	} catch (error) {
		await Promise.allSettled(subprocesses.map(({nodeChildProcess}) => closeStdin(nodeChildProcess)));
		throw error;
	}
};

const closeStdin = async nodeChildProcess => {
	const {stdin} = await nodeChildProcess;
	stdin.end();
};
