// these type declarations are extracted and heavily simplified from the TypeScript "dom" library

export function fetch(input: Request): Promise<Response>;

export class Request {
    constructor(input: string, init?: RequestInit);
    readonly method: string;
    readonly url: string;
}

export interface RequestInit {
    body?: ArrayBufferView | ArrayBuffer | string | null;
    headers?: Headers;
    method?: string;
}

export class Headers {
    constructor();
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
}

export interface Body {
    readonly body: ReadableStream<Uint8Array> | null;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    json(): Promise<any>;
    text(): Promise<string>;
}

export interface Response extends Body {
    readonly headers: Headers;
    readonly ok: boolean;
    readonly status: number;
}

export interface ReadableStream<R = any> {
    cancel(reason?: any): Promise<void>;
    getReader(): ReadableStreamDefaultReader<R>;
}

export interface ReadableStreamGenericReader {
    cancel(reason?: any): Promise<void>;
}

export interface ReadableStreamDefaultReader<R = any> extends ReadableStreamGenericReader {
    read(): Promise<ReadableStreamReadResult<R>>;
}

export type ReadableStreamReadResult<T> =
    | {done: true, value?: T}
    | {done: false, value: T}
