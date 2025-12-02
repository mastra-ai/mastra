"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisabledTraceUtil = void 0;
const span_1 = require("./span");
/**
 * @private
 * @internal
 */
class DisabledTraceUtil {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    startSpan(name) {
        return new span_1.Span();
    }
    startActiveSpan(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    name, fn, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    attributes) {
        const emptySpan = new span_1.Span();
        return fn(emptySpan);
    }
    currentSpan() {
        return new span_1.Span();
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    recordProjectId(projectId) { }
}
exports.DisabledTraceUtil = DisabledTraceUtil;
//# sourceMappingURL=disabled-trace-util.js.map