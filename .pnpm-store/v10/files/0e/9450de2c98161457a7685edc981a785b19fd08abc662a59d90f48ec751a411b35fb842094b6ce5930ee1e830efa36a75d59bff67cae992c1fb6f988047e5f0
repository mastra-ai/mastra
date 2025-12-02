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
    getRequestCredentials(): RequestCredentials;
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

type UrlResponse = {
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
} | {
    type: 'controlled-stream';
    headers?: Record<string, string>;
    controller: TestResponseController;
} | undefined;
type UrlResponseParameter = UrlResponse | UrlResponse[] | ((options: {
    callNumber: number;
}) => UrlResponse);
type UrlHandler = {
    response: UrlResponseParameter;
};
type UrlHandlers<URLS extends {
    [url: string]: {
        response?: UrlResponseParameter;
    };
}> = {
    [url in keyof URLS]: UrlHandler;
};
declare class TestServerCall {
    private request;
    constructor(request: Request);
    get requestBody(): Promise<any>;
    get requestBodyMultipart(): Promise<Record<string, any>> | null;
    get requestCredentials(): RequestCredentials;
    get requestHeaders(): Record<string, string>;
    get requestUrlSearchParams(): URLSearchParams;
    get requestUrl(): string;
    get requestMethod(): string;
}
declare function createTestServer<URLS extends {
    [url: string]: {
        response?: UrlResponseParameter;
    };
}>(routes: URLS): {
    urls: UrlHandlers<URLS>;
    calls: TestServerCall[];
};
declare class TestResponseController {
    private readonly transformStream;
    private readonly writer;
    constructor();
    get stream(): ReadableStream;
    write(chunk: string): Promise<void>;
    error(error: Error): Promise<void>;
    close(): Promise<void>;
}

export { JsonTestServer, StreamingTestServer, TestResponseController, type TestServerJsonBodyType, type TestServerResponse, type UrlHandler, type UrlHandlers, type UrlResponse, convertArrayToAsyncIterable, convertArrayToReadableStream, convertAsyncIterableToArray, convertReadableStreamToArray, convertResponseStreamToArray, createTestServer, describeWithTestServer, mockId, withTestServer };
