export declare type GuardTypes = "immutable" | "request" | "request-no-cors" | "response" | "none";
export interface RawHeaders {
    [key: string]: string | Array<string> | undefined;
}
export declare class Headers {
    protected _guard: GuardTypes;
    private _data;
    constructor(init?: RawHeaders | Headers);
    get [Symbol.toStringTag](): string;
    [Symbol.iterator](): IterableIterator<[string, string]>;
    append(name: string, value: string): void;
    delete(name: string): void;
    entries(): IterableIterator<[string, string]>;
    get(name: string): string | null;
    has(name: string): boolean;
    keys(): IterableIterator<string>;
    set(name: string, value: string): void;
    values(): IterableIterator<string>;
    toJSON(): {};
}
export declare class GuardedHeaders extends Headers {
    constructor(guard: GuardTypes, init?: RawHeaders | Headers);
}
export declare function ensureHeaders(headers: RawHeaders | Headers | undefined): Headers;
