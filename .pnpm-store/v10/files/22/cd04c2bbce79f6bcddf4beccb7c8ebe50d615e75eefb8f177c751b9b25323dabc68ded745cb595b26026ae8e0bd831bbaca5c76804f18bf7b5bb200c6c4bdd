"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceNow = performanceNow;
const object_utils_js_1 = require("./object-utils.js");
function performanceNow() {
    if (typeof performance !== 'undefined' && (0, object_utils_js_1.isFunction)(performance.now)) {
        return performance.now();
    }
    else {
        return Date.now();
    }
}
