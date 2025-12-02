"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbortController = exports.signalEvent = void 0;
const events_1 = require("events");
exports.signalEvent = "internal-abort";
class AbortSignalImpl extends events_1.EventEmitter {
    constructor() {
        super();
        this.aborted = false;
        this.onabort = () => { };
        this.once(exports.signalEvent, () => {
            this.aborted = true;
            this.emit("abort");
            this.onabort && this.onabort();
        });
    }
}
class AbortController {
    constructor() {
        this.signal = new AbortSignalImpl();
        this.abort = () => {
            this.signal.emit(exports.signalEvent);
        };
    }
}
exports.AbortController = AbortController;
//# sourceMappingURL=abort.js.map