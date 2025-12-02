
//#region src/middleware/logger.ts
var DefaultLogger = class {
	info(...args) {
		console.info(...args);
	}
	warn(...args) {
		console.warn(...args);
	}
	error(...args) {
		console.error(...args);
	}
	debug(...args) {
		console.debug(...args);
	}
};
/**
* ProxyLogger aims to provide a thin wrapper on user's provided logger.
* It's expected to be turned on and off based on the function execution
* context, so it doesn't result in duplicated logging.
*
* And also attempt to allow enough time for the logger to flush all logs.
*
* @public
*/
var ProxyLogger = class {
	logger;
	enabled = false;
	constructor(logger) {
		this.logger = logger;
		return new Proxy(this, { get(target, prop, receiver) {
			if (prop in target) return Reflect.get(target, prop, receiver);
			return Reflect.get(target.logger, prop, receiver);
		} });
	}
	info(...args) {
		if (!this.enabled) return;
		this.logger.info(...args);
	}
	warn(...args) {
		if (!this.enabled) return;
		this.logger.warn(...args);
	}
	error(...args) {
		if (!this.enabled) return;
		this.logger.error(...args);
	}
	debug(...args) {
		if (!this.enabled || !(typeof this.logger.debug === "function")) return;
		this.logger.debug(...args);
	}
	enable() {
		this.enabled = true;
	}
	disable() {
		this.enabled = false;
	}
	async flush() {
		if (this.logger.constructor.name !== DefaultLogger.name) await new Promise((resolve) => {
			setTimeout(() => resolve(null), 1e3);
		});
	}
};

//#endregion
exports.DefaultLogger = DefaultLogger;
exports.ProxyLogger = ProxyLogger;
//# sourceMappingURL=logger.cjs.map