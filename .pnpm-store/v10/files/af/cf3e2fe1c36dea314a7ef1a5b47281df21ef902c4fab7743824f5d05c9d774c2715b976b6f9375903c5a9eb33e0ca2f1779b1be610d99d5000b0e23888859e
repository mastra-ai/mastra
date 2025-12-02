const require_rolldown_runtime = require('../../_virtual/rolldown_runtime.cjs');
const require_consts = require('../../helpers/consts.cjs');
const require_connect = require('../../proto/src/components/connect/protobuf/connect.cjs');
const require_util = require('./util.cjs');
let debug = require("debug");
debug = require_rolldown_runtime.__toESM(debug);

//#region src/components/connect/buffer.ts
var MessageBuffer = class {
	buffered = {};
	pending = {};
	inngest;
	debug;
	constructor(inngest) {
		this.inngest = inngest;
		this.debug = (0, debug.default)("inngest:connect:message-buffer");
	}
	append(response) {
		this.buffered[response.requestId] = response;
		delete this.pending[response.requestId];
	}
	addPending(response, deadline) {
		this.pending[response.requestId] = response;
		setTimeout(() => {
			if (this.pending[response.requestId]) {
				this.debug("Message not acknowledged in time", response.requestId);
				this.append(response);
			}
		}, deadline);
	}
	acknowledgePending(requestId) {
		delete this.pending[requestId];
	}
	async sendFlushRequest(hashedSigningKey, msg) {
		const headers = {
			"Content-Type": "application/protobuf",
			...hashedSigningKey ? { Authorization: `Bearer ${hashedSigningKey}` } : {}
		};
		if (this.inngest.env) headers[require_consts.headerKeys.Environment] = this.inngest.env;
		const resp = await fetch(await this.inngest["inngestApi"]["getTargetUrl"]("/v0/connect/flush"), {
			method: "POST",
			body: new Uint8Array(require_connect.SDKResponse.encode(msg).finish()),
			headers
		});
		if (!resp.ok) {
			this.debug("Failed to flush messages", await resp.text());
			throw new Error("Failed to flush messages");
		}
		return require_connect.FlushResponse.decode(new Uint8Array(await resp.arrayBuffer()));
	}
	async flush(hashedSigningKey) {
		if (Object.keys(this.buffered).length === 0) return;
		this.debug(`Flushing ${Object.keys(this.buffered).length} messages`);
		for (let attempt = 0; attempt < 5; attempt++) {
			for (const [k, v] of Object.entries(this.buffered)) try {
				await this.sendFlushRequest(hashedSigningKey, v);
				delete this.buffered[k];
			} catch (err) {
				this.debug("Failed to flush message", k, err);
				break;
			}
			if (Object.keys(this.buffered).length === 0) return;
			await new Promise((resolve) => setTimeout(resolve, require_util.expBackoff(attempt)));
		}
		throw new Error("Failed to flush messages");
	}
};

//#endregion
exports.MessageBuffer = MessageBuffer;
//# sourceMappingURL=buffer.cjs.map