declare function mockFetchTextStream({ url, chunks, }: {
    url: string;
    chunks: string[];
}): void;
declare function mockFetchDataStream({ url, chunks, maxCalls, }: {
    url: string;
    chunks: string[];
    maxCalls?: number;
}): {
    requestBody: Promise<unknown>;
};
declare function mockFetchDataStreamWithGenerator({ url, chunkGenerator, maxCalls, }: {
    url: string;
    chunkGenerator: AsyncGenerator<Uint8Array, void, unknown>;
    maxCalls?: number;
}): {
    requestBody: Promise<unknown>;
};
declare function mockFetchError({ statusCode, errorMessage, }: {
    statusCode: number;
    errorMessage: string;
}): void;

export { mockFetchDataStream, mockFetchDataStreamWithGenerator, mockFetchError, mockFetchTextStream };
