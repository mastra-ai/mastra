import {on, once} from 'node:events';
import {PassThrough as PassThroughStream} from 'node:stream';
import {finished} from 'node:stream/promises';

export default function mergeStreams(streams) {
	if (!Array.isArray(streams)) {
		throw new TypeError(`Expected an array, got \`${typeof streams}\`.`);
	}

	for (const stream of streams) {
		validateStream(stream);
	}

	const objectMode = streams.some(({readableObjectMode}) => readableObjectMode);
	const highWaterMark = getHighWaterMark(streams, objectMode);
	const passThroughStream = new MergedStream({
		objectMode,
		writableHighWaterMark: highWaterMark,
		readableHighWaterMark: highWaterMark,
	});

	for (const stream of streams) {
		passThroughStream.add(stream);
	}

	if (streams.length === 0) {
		endStream(passThroughStream);
	}

	return passThroughStream;
}

const getHighWaterMark = (streams, objectMode) => {
	if (streams.length === 0) {
		// @todo Use `node:stream` `getDefaultHighWaterMark(objectMode)` in next major release
		return 16_384;
	}

	const highWaterMarks = streams
		.filter(({readableObjectMode}) => readableObjectMode === objectMode)
		.map(({readableHighWaterMark}) => readableHighWaterMark);
	return Math.max(...highWaterMarks);
};

class MergedStream extends PassThroughStream {
	#streams = new Set([]);
	#ended = new Set([]);
	#aborted = new Set([]);
	#onFinished;

	add(stream) {
		validateStream(stream);

		if (this.#streams.has(stream)) {
			return;
		}

		this.#streams.add(stream);

		this.#onFinished ??= onMergedStreamFinished(this, this.#streams);
		endWhenStreamsDone({
			passThroughStream: this,
			stream,
			streams: this.#streams,
			ended: this.#ended,
			aborted: this.#aborted,
			onFinished: this.#onFinished,
		});

		stream.pipe(this, {end: false});
	}

	remove(stream) {
		validateStream(stream);

		if (!this.#streams.has(stream)) {
			return false;
		}

		stream.unpipe(this);
		return true;
	}
}

const onMergedStreamFinished = async (passThroughStream, streams) => {
	updateMaxListeners(passThroughStream, PASSTHROUGH_LISTENERS_COUNT);
	const controller = new AbortController();

	try {
		await Promise.race([
			onMergedStreamEnd(passThroughStream, controller),
			onInputStreamsUnpipe(passThroughStream, streams, controller),
		]);
	} finally {
		controller.abort();
		updateMaxListeners(passThroughStream, -PASSTHROUGH_LISTENERS_COUNT);
	}
};

const onMergedStreamEnd = async (passThroughStream, {signal}) => {
	await finished(passThroughStream, {signal, cleanup: true});
};

const onInputStreamsUnpipe = async (passThroughStream, streams, {signal}) => {
	for await (const [unpipedStream] of on(passThroughStream, 'unpipe', {signal})) {
		if (streams.has(unpipedStream)) {
			unpipedStream.emit(unpipeEvent);
		}
	}
};

const validateStream = stream => {
	if (typeof stream?.pipe !== 'function') {
		throw new TypeError(`Expected a readable stream, got: \`${typeof stream}\`.`);
	}
};

const endWhenStreamsDone = async ({passThroughStream, stream, streams, ended, aborted, onFinished}) => {
	updateMaxListeners(passThroughStream, PASSTHROUGH_LISTENERS_PER_STREAM);
	const controller = new AbortController();

	try {
		await Promise.race([
			afterMergedStreamFinished(onFinished, stream),
			onInputStreamEnd({passThroughStream, stream, streams, ended, aborted, controller}),
			onInputStreamUnpipe({stream, streams, ended, aborted, controller}),
		]);
	} finally {
		controller.abort();
		updateMaxListeners(passThroughStream, -PASSTHROUGH_LISTENERS_PER_STREAM);
	}

	if (streams.size === ended.size + aborted.size) {
		if (ended.size === 0 && aborted.size > 0) {
			abortStream(passThroughStream);
		} else {
			endStream(passThroughStream);
		}
	}
};

// This is the error thrown by `finished()` on `stream.destroy()`
const isAbortError = error => error?.code === 'ERR_STREAM_PREMATURE_CLOSE';

const afterMergedStreamFinished = async (onFinished, stream) => {
	try {
		await onFinished;
		abortStream(stream);
	} catch (error) {
		if (isAbortError(error)) {
			abortStream(stream);
		} else {
			errorStream(stream, error);
		}
	}
};

const onInputStreamEnd = async ({passThroughStream, stream, streams, ended, aborted, controller: {signal}}) => {
	try {
		await finished(stream, {signal, cleanup: true, readable: true, writable: false});
		if (streams.has(stream)) {
			ended.add(stream);
		}
	} catch (error) {
		if (signal.aborted || !streams.has(stream)) {
			return;
		}

		if (isAbortError(error)) {
			aborted.add(stream);
		} else {
			errorStream(passThroughStream, error);
		}
	}
};

const onInputStreamUnpipe = async ({stream, streams, ended, aborted, controller: {signal}}) => {
	await once(stream, unpipeEvent, {signal});
	streams.delete(stream);
	ended.delete(stream);
	aborted.delete(stream);
};

const unpipeEvent = Symbol('unpipe');

const endStream = stream => {
	if (stream.writable) {
		stream.end();
	}
};

const abortStream = stream => {
	if (stream.readable || stream.writable) {
		stream.destroy();
	}
};

// `stream.destroy(error)` crashes the process with `uncaughtException` if no `error` event listener exists on `stream`.
// We take care of error handling on user behalf, so we do not want this to happen.
const errorStream = (stream, error) => {
	if (!stream.destroyed) {
		stream.once('error', noop);
		stream.destroy(error);
	}
};

const noop = () => {};

const updateMaxListeners = (passThroughStream, increment) => {
	const maxListeners = passThroughStream.getMaxListeners();
	if (maxListeners !== 0 && maxListeners !== Number.POSITIVE_INFINITY) {
		passThroughStream.setMaxListeners(maxListeners + increment);
	}
};

// Number of times `passThroughStream.on()` is called regardless of streams:
//  - once due to `finished(passThroughStream)`
//  - once due to `on(passThroughStream)`
const PASSTHROUGH_LISTENERS_COUNT = 2;

// Number of times `passThroughStream.on()` is called per stream:
//  - once due to `stream.pipe(passThroughStream)`
const PASSTHROUGH_LISTENERS_PER_STREAM = 1;
