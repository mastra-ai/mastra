import { DeepgramClientOptions, IKeyFactory } from "./lib/types/DeepgramClientOptions";
import DeepgramClient from "./DeepgramClient";
/**
 * This class is deprecated and should not be used. It throws a `DeepgramVersionError` when instantiated.
 *
 * @deprecated
 * @see https://dpgr.am/js-v3
 */
declare class Deepgram {
    protected apiKey: string;
    protected apiUrl?: string | undefined;
    protected requireSSL?: boolean | undefined;
    constructor(apiKey: string, apiUrl?: string | undefined, requireSSL?: boolean | undefined);
}
/**
 * Creates a new Deepgram client instance.
 *
 * @param {DeepgramClientArgs} args - Arguments to pass to the Deepgram client constructor.
 * @returns A new Deepgram client instance.
 */
declare function createClient(): DeepgramClient;
declare function createClient(key?: string | IKeyFactory): DeepgramClient;
declare function createClient(options?: DeepgramClientOptions): DeepgramClient;
declare function createClient(key?: string | IKeyFactory, options?: DeepgramClientOptions): DeepgramClient;
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
//# sourceMappingURL=index.d.ts.map