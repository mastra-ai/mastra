//#region src/subscribe/StreamFanout.ts
/**
* TODO
*/
var StreamFanout = class {
	#writers = /* @__PURE__ */ new Set();
	/**
	* TODO
	*/
	createStream(transform) {
		const { readable, writable } = new TransformStream({ transform: (chunk, controller) => {
			controller.enqueue(transform ? transform(chunk) : chunk);
		} });
		const writer = writable.getWriter();
		this.#writers.add(writer);
		writer.closed.catch(() => {}).finally(() => {
			this.#writers.delete(writer);
		});
		return readable;
	}
	/**
	* TODO
	*/
	write(chunk) {
		for (const writer of this.#writers) writer.ready.then(() => writer.write(chunk)).catch(() => this.#writers.delete(writer));
	}
	/**
	* TODO
	*/
	close() {
		for (const writer of this.#writers) try {
			writer.close();
		} catch {}
		this.#writers.clear();
	}
	/**
	* TODO
	*/
	size() {
		return this.#writers.size;
	}
};

//#endregion
export { StreamFanout };
//# sourceMappingURL=StreamFanout.mjs.map