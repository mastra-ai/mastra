"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBun = exports.isNode = exports.isBrowser = exports.BROWSER_AGENT = exports.BUN_VERSION = exports.NODE_VERSION = void 0;
exports.NODE_VERSION = typeof process !== "undefined" && process.versions && process.versions.node
    ? process.versions.node
    : "unknown";
exports.BUN_VERSION = typeof process !== "undefined" && process.versions && process.versions.bun
    ? process.versions.bun
    : "unknown";
exports.BROWSER_AGENT = typeof window !== "undefined" && window.navigator && window.navigator.userAgent
    ? window.navigator.userAgent
    : "unknown";
const isBrowser = () => exports.BROWSER_AGENT !== "unknown";
exports.isBrowser = isBrowser;
const isNode = () => exports.NODE_VERSION !== "unknown";
exports.isNode = isNode;
const isBun = () => exports.BUN_VERSION !== "unknown";
exports.isBun = isBun;
//# sourceMappingURL=runtime.js.map