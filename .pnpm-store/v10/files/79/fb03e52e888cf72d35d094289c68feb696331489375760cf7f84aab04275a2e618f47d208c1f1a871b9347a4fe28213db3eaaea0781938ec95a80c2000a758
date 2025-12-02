"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RUNTIME = void 0;
/**
 * A constant that indicates which environment and version the SDK is running in.
 */
exports.RUNTIME = evaluateRuntime();
function evaluateRuntime() {
    var _a, _b, _c, _d, _e;
    /**
     * A constant that indicates whether the environment the code is running is a Web Browser.
     */
    const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
    if (isBrowser) {
        return {
            type: "browser",
            version: window.navigator.userAgent,
        };
    }
    /**
     * A constant that indicates whether the environment the code is running is Cloudflare.
     * https://developers.cloudflare.com/workers/runtime-apis/web-standards/#navigatoruseragent
     */
    const isCloudflare = typeof globalThis !== "undefined" && ((_a = globalThis === null || globalThis === void 0 ? void 0 : globalThis.navigator) === null || _a === void 0 ? void 0 : _a.userAgent) === "Cloudflare-Workers";
    if (isCloudflare) {
        return {
            type: "workerd",
        };
    }
    /**
     * A constant that indicates whether the environment the code is running is Edge Runtime.
     * https://vercel.com/docs/functions/runtimes/edge-runtime#check-if-you're-running-on-the-edge-runtime
     */
    const isEdgeRuntime = typeof EdgeRuntime === "string";
    if (isEdgeRuntime) {
        return {
            type: "edge-runtime",
        };
    }
    /**
     * A constant that indicates whether the environment the code is running is a Web Worker.
     */
    const isWebWorker = typeof self === "object" &&
        // @ts-ignore
        typeof (self === null || self === void 0 ? void 0 : self.importScripts) === "function" &&
        (((_b = self.constructor) === null || _b === void 0 ? void 0 : _b.name) === "DedicatedWorkerGlobalScope" ||
            ((_c = self.constructor) === null || _c === void 0 ? void 0 : _c.name) === "ServiceWorkerGlobalScope" ||
            ((_d = self.constructor) === null || _d === void 0 ? void 0 : _d.name) === "SharedWorkerGlobalScope");
    if (isWebWorker) {
        return {
            type: "web-worker",
        };
    }
    /**
     * A constant that indicates whether the environment the code is running is Deno.
     * FYI Deno spoofs process.versions.node, see https://deno.land/std@0.177.0/node/process.ts?s=versions
     */
    const isDeno = typeof Deno !== "undefined" && typeof Deno.version !== "undefined" && typeof Deno.version.deno !== "undefined";
    if (isDeno) {
        return {
            type: "deno",
            version: Deno.version.deno,
        };
    }
    /**
     * A constant that indicates whether the environment the code is running is Bun.sh.
     */
    const isBun = typeof Bun !== "undefined" && typeof Bun.version !== "undefined";
    if (isBun) {
        return {
            type: "bun",
            version: Bun.version,
        };
    }
    /**
     * A constant that indicates whether the environment the code is running is Node.JS.
     */
    const isNode = typeof process !== "undefined" &&
        "version" in process &&
        !!process.version &&
        "versions" in process &&
        !!((_e = process.versions) === null || _e === void 0 ? void 0 : _e.node);
    if (isNode) {
        return {
            type: "node",
            version: process.versions.node,
            parsedVersion: Number(process.versions.node.split(".")[0]),
        };
    }
    /**
     * A constant that indicates whether the environment the code is running is in React-Native.
     * https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Core/setUpNavigator.js
     */
    const isReactNative = typeof navigator !== "undefined" && (navigator === null || navigator === void 0 ? void 0 : navigator.product) === "ReactNative";
    if (isReactNative) {
        return {
            type: "react-native",
        };
    }
    return {
        type: "unknown",
    };
}
