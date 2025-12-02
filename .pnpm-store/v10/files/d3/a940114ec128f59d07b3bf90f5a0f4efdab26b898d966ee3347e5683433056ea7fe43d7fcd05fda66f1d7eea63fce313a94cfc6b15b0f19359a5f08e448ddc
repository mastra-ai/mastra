"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.srt = exports.webvtt = exports.Deepgram = exports.DeepgramClient = exports.createClient = void 0;
const errors_1 = require("./lib/errors");
const DeepgramClient_1 = __importDefault(require("./DeepgramClient"));
exports.DeepgramClient = DeepgramClient_1.default;
/**
 * This class is deprecated and should not be used. It throws a `DeepgramVersionError` when instantiated.
 *
 * @deprecated
 * @see https://dpgr.am/js-v3
 */
class Deepgram {
    constructor(apiKey, apiUrl, requireSSL) {
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
        this.requireSSL = requireSSL;
        throw new errors_1.DeepgramVersionError();
    }
}
exports.Deepgram = Deepgram;
function createClient(keyOrOptions, options) {
    let resolvedOptions = {};
    if (typeof keyOrOptions === "string" || typeof keyOrOptions === "function") {
        if (typeof options === "object") {
            resolvedOptions = options;
        }
        resolvedOptions.key = keyOrOptions;
    }
    else if (typeof keyOrOptions === "object") {
        resolvedOptions = keyOrOptions;
    }
    return new DeepgramClient_1.default(resolvedOptions);
}
exports.createClient = createClient;
/**
 * Helpful exports.
 */
__exportStar(require("./packages"), exports);
__exportStar(require("./lib/types"), exports);
__exportStar(require("./lib/enums"), exports);
__exportStar(require("./lib/constants"), exports);
__exportStar(require("./lib/errors"), exports);
__exportStar(require("./lib/helpers"), exports);
/**
 * Captions. These will be tree-shaken if unused.
 *
 * @see https://github.com/deepgram/deepgram-node-captions
 *
 * import/export declarations don't do anything but set up an alias to the
 * exported variable, they do not count as a "use". Given their semantics,
 * they are tracked specially by any bundler and will not adversely affect
 * tree-shaking.
 */
var captions_1 = require("@deepgram/captions");
Object.defineProperty(exports, "webvtt", { enumerable: true, get: function () { return captions_1.webvtt; } });
Object.defineProperty(exports, "srt", { enumerable: true, get: function () { return captions_1.srt; } });
//# sourceMappingURL=index.js.map