import type { ServerResponse } from 'node:http';
declare class MockServerResponse {
    writtenChunks: any[];
    headers: {};
    statusCode: number;
    statusMessage: string;
    ended: boolean;
    private eventListeners;
    write(chunk: any): boolean;
    end(chunk?: any): void;
    writeHead(statusCode: number, statusMessage: string, headers: Record<string, string>): void;
    once(event: string, listener: (...args: any[]) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    get body(): string;
    /**
     * Get the decoded chunks as strings.
     */
    getDecodedChunks(): string[];
    /**
     * Wait for the stream to finish writing to the mock response.
     */
    waitForEnd(): Promise<void>;
}
export declare function createMockServerResponse(): ServerResponse & MockServerResponse;
export {};
//# sourceMappingURL=mock-server-response.d.ts.map