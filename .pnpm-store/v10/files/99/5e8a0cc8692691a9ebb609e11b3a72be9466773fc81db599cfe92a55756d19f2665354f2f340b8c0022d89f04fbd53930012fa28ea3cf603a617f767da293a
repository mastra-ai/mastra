import { SetupServer } from 'msw/node';
import { JsonBodyType } from 'msw';

declare function convertArrayToAsyncIterable<T>(values: T[]): AsyncIterable<T>;

declare function convertArrayToReadableStream<T>(values: T[]): ReadableStream<T>;

declare function convertAsyncIterableToArray<T>(iterable: AsyncIterable<T>): Promise<T[]>;

declare function convertReadableStreamToArray<T>(stream: ReadableStream<T>): Promise<T[]>;

declare function convertResponseStreamToArray(response: Response): Promise<string[]>;

/**
 * @deprecated Use createTestServer instead
 */
declare class JsonTestServer {
    readonly server: SetupServer;
    responseHeaders: Record<string, string>;
    responseBodyJson: any;
    request: Request | undefined;
    /**
     * @deprecated Use createTestServer instead
     */
    constructor(url: string);
    getRequestBodyJson(): Promise<any>;
    getRequestHeaders(): Promise<Record<string, string>>;
    getRequestUrlSearchParams(): Promise<URLSearchParams>;
    getRequestUrl(): Promise<string>;
    setupTestEnvironment(): void;
}

declare function mockId({ prefix, }?: {
    prefix?: string;
}): () => string;

/**
 * @deprecated Use createTestServer instead
 */
declare class StreamingTestServer {
    readonly server: SetupServer;
    responseHeaders: Record<string, string>;
    responseChunks: any[];
    request: Request | undefined;
    /**
     * @deprecated Use createTestServer instead
     */
    constructor(url: string);
    getRequestBodyJson(): Promise<any>;
    getRequestHeaders(): Promise<Record<string, string>>;
    getRequestUrlSearchParams(): Promise<URLSearchParams>;
    setupTestEnvironment(): void;
}

type TestServerJsonBodyType = JsonBodyType;
type TestServerResponse = {
    url: string;
    headers?: Record<string, string>;
} & ({
    type: 'json-value';
    content: TestServerJsonBodyType;
} | {
    type: 'stream-values';
    content: Array<string>;
} | {
    type: 'controlled-stream';
    id?: string;
} | {
    type: 'error';
    status: number;
    content?: string;
});
declare class TestServerCall$1 {
    private request;
    constructor(request: Request);
    getRequestBodyJson(): Promise<any>;
    getRequestHeaders(): Record<string, string>;
    getRequestUrlSearchParams(): URLSearchParams;
}
declare function withTestServer(responses: Array<TestServerResponse> | TestServerResponse, testFunction: (options: {
    calls: () => Array<TestServerCall$1>;
    call: (index: number) => TestServerCall$1;
    getStreamController: (id: string) => ReadableStreamDefaultController<string>;
    streamController: ReadableStreamDefaultController<string>;
}) => Promise<void>): () => Promise<void>;
declare function describeWithTestServer(description: string, responses: Array<TestServerResponse> | TestServerResponse, testFunction: (options: {
    calls: () => Array<TestServerCall$1>;
    call: (index: number) => TestServerCall$1;
    getStreamController: (id: string) => ReadableStreamDefaultController<string>;
    streamController: ReadableStreamDefaultController<string>;
}) => void): void;

type UrlHandler = {
    response?: {
        type: 'json-value';
        headers?: Record<string, string>;
        body: JsonBodyType;
    } | {
        type: 'stream-chunks';
        headers?: Record<string, string>;
        chunks: Array<string>;
    } | {
        type: 'binary';
        headers?: Record<string, string>;
        body: Buffer;
    } | {
        type: 'empty';
        headers?: Record<string, string>;
        status?: number;
    } | {
        type: 'error';
        headers?: Record<string, string>;
        status?: number;
        body?: string;
    };
};
type FullUrlHandler = {
    response: {
        type: 'json-value';
        headers?: Record<string, string>;
        body: JsonBodyType;
    } | {
        type: 'stream-chunks';
        headers?: Record<string, string>;
        chunks: Array<string>;
    } | {
        type: 'binary';
        headers?: Record<string, string>;
        body: Buffer;
    } | {
        type: 'error';
        headers?: Record<string, string>;
        status: number;
        body?: string;
    } | {
        type: 'empty';
        headers?: Record<string, string>;
        status?: number;
    } | undefined;
};
type FullHandlers<URLS extends {
    [url: string]: UrlHandler;
}> = {
    [url in keyof URLS]: FullUrlHandler;
};
declare class TestServerCall {
    private request;
    constructor(request: Request);
    get requestBody(): Promise<any>;
    get requestHeaders(): Record<string, string>;
    get requestUrlSearchParams(): URLSearchParams;
    get requestUrl(): string;
    get requestMethod(): string;
}
declare function createTestServer<URLS extends {
    [url: string]: UrlHandler;
}>(routes: URLS): {
    urls: FullHandlers<URLS>;
    calls: TestServerCall[];
};

export { type FullHandlers, type FullUrlHandler, JsonTestServer, StreamingTestServer, type TestServerJsonBodyType, type TestServerResponse, type UrlHandler, convertArrayToAsyncIterable, convertArrayToReadableStream, convertAsyncIterableToArray, convertReadableStreamToArray, convertResponseStreamToArray, createTestServer, describeWithTestServer, mockId, withTestServer };
