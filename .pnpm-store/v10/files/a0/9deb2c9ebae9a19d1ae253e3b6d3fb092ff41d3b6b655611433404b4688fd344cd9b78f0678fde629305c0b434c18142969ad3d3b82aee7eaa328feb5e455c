import { DeepgramVersionError } from "./lib/errors";
import DeepgramClient from "./DeepgramClient";
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
        throw new DeepgramVersionError();
    }
}
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
    return new DeepgramClient(resolvedOptions);
}
export { createClient, DeepgramClient, Deepgram };
/**
 * Helpful exports.
 */
export * from "./packages";
export * from "./lib/types";
export * from "./lib/enums";
export * from "./lib/constants";
export * from "./lib/errors";
export * from "./lib/helpers";
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
export { webvtt, srt } from "@deepgram/captions";
//# sourceMappingURL=index.js.map