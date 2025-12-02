const require_strings = require('./strings.cjs');

//#region src/helpers/stream.ts
/**
* Creates a {@link ReadableStream} that sends a `value` every `interval`
* milliseconds as a heartbeat, intended to keep a stream open.
*
* Returns the `stream` itself and a `finalize` function that can be used to
* close the stream and send a final value.
*/
const createStream = (opts) => {
	/**
	* We need to resolve this promise with both the stream and the `finalize`
	* function, but having them both instantiated synchronously is difficult, as
	* we need access to the stream's internals too.
	*
	* We create this cheeky deferred promise to grab the internal `finalize`
	* value. Be warned that simpler solutions may appear to compile, but fail at
	* runtime due to variables not being assigned; make sure to test your code!
	*/
	let passFinalize;
	const finalizeP = new Promise((resolve) => {
		passFinalize = resolve;
	});
	const interval = opts?.interval ?? 3e3;
	const value = opts?.value ?? " ";
	return new Promise(async (resolve, reject) => {
		try {
			const stream = new ReadableStream({ start(controller) {
				const encoder = new TextEncoder();
				const heartbeat = setInterval(() => {
					controller.enqueue(encoder.encode(value));
				}, interval);
				const finalize = (data) => {
					clearInterval(heartbeat);
					Promise.resolve(data).then((resolvedData) => {
						controller.enqueue(encoder.encode(require_strings.stringify(resolvedData)));
						controller.close();
					});
				};
				passFinalize(finalize);
			} });
			resolve({
				stream,
				finalize: await finalizeP
			});
		} catch (err) {
			reject(err);
		}
	});
};

//#endregion
exports.createStream = createStream;
//# sourceMappingURL=stream.cjs.map