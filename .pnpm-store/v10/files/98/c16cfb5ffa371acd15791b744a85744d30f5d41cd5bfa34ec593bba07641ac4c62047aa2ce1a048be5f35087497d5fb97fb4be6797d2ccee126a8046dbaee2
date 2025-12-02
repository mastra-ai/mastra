import { DeepgramClientOptions, FileSource, PrerecordedSource, UrlSource, TextSource, AnalyzeSource, LiveSchema, TranscriptionSchema } from "./types";
export declare function stripTrailingSlash(url: string): string;
export declare function applyDefaults<O, S>(options?: Partial<O>, subordinate?: Partial<S>): S;
export declare function appendSearchParams(searchParams: URLSearchParams, options: Record<string, unknown>): void;
export declare const resolveHeadersConstructor: () => {
    new (init?: HeadersInit | undefined): Headers;
    prototype: Headers;
};
export declare const isUrlSource: (providedSource: PrerecordedSource | AnalyzeSource) => providedSource is UrlSource;
export declare const isTextSource: (providedSource: PrerecordedSource | AnalyzeSource) => providedSource is TextSource;
export declare const isFileSource: (providedSource: PrerecordedSource) => providedSource is FileSource;
export declare class CallbackUrl extends URL {
    callbackUrl: boolean;
}
export declare const convertProtocolToWs: (url: string) => string;
export declare const buildRequestUrl: (endpoint: string, baseUrl: string | URL, transcriptionOptions: LiveSchema | TranscriptionSchema) => URL;
export declare function isLiveSchema(arg: any): arg is LiveSchema;
export declare function isDeepgramClientOptions(arg: any): arg is DeepgramClientOptions;
export declare const convertLegacyOptions: (optionsArg: DeepgramClientOptions) => DeepgramClientOptions;
//# sourceMappingURL=helpers.d.ts.map