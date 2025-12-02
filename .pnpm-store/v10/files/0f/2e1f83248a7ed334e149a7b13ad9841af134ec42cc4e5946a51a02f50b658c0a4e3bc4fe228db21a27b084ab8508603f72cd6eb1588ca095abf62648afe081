"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extendStackTrace = extendStackTrace;
const object_utils_js_1 = require("./object-utils.js");
function extendStackTrace(err, stackError) {
    if (isStackHolder(err) && stackError.stack) {
        // Remove the first line that just says `Error`.
        const stackExtension = stackError.stack.split('\n').slice(1).join('\n');
        err.stack += `\n${stackExtension}`;
        return err;
    }
    return err;
}
function isStackHolder(obj) {
    return (0, object_utils_js_1.isObject)(obj) && (0, object_utils_js_1.isString)(obj.stack);
}
