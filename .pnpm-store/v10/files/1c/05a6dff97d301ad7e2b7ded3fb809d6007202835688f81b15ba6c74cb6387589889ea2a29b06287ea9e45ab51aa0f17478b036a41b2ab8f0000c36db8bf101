/**
 * This file exports APIs that vary across runtimes (i.e. Node & Browser - V8 isolates)
 * as a singleton object.
 *
 * Runtime polyfills are written in VanillaJS for now to avoid TS complication. Moreover,
 * due to this issue https://github.com/microsoft/TypeScript/issues/44848, there is not a good way
 * to tell Typescript which conditional import to use during build type.
 *
 * The Runtime type definition ensures type safety for now.
 * Runtime js modules are copied into dist folder with bash script.
 *
 * TODO: Support TS runtime modules
 */
type Runtime = {
    crypto: Crypto;
    fetch: typeof globalThis.fetch;
    AbortController: typeof globalThis.AbortController;
    Blob: typeof globalThis.Blob;
    FormData: typeof globalThis.FormData;
    Headers: typeof globalThis.Headers;
    Request: typeof globalThis.Request;
    Response: typeof globalThis.Response;
};
export declare const runtime: Runtime;
export {};
//# sourceMappingURL=runtime.d.ts.map