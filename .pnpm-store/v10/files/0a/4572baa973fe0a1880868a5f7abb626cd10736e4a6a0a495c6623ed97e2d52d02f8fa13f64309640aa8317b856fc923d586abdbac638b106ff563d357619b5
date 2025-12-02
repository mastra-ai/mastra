/**
 * WebBlob is a Blob implementation for web resources that supports range requests.
 */
interface WebBlobCreateOptions {
    /**
     * @default 1_000_000
     *
     * Objects below that size will immediately be fetched and put in RAM, rather
     * than streamed ad-hoc
     */
    cacheBelow?: number;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
}
export declare class WebBlob extends Blob {
    static create(url: URL, opts?: WebBlobCreateOptions): Promise<Blob>;
    private url;
    private start;
    private end;
    private contentType;
    private full;
    private fetch;
    constructor(url: URL, start: number, end: number, contentType: string, full: boolean, customFetch: typeof fetch);
    get size(): number;
    get type(): string;
    slice(start?: number, end?: number): WebBlob;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    stream(): ReturnType<Blob["stream"]>;
    private fetchRange;
}
export {};
//# sourceMappingURL=WebBlob.d.ts.map